using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

/// <summary>
/// F1: memory over the whole process tree of the app, same points P0..P5 for every stack.
/// Linux: PSS and RSS via tools/measure-memory.py. Windows: private working set (PROCESS_MEMORY_COUNTERS_EX2.PrivateWorkingSetSize)
/// and total working set per process. macOS: `footprint -p` and `ps` RSS.
/// </summary>
public static class MemTest
{
    static HttpClient _http = null!;
    static async Task<string> Post(string p, object o) => await (await _http.PostAsync(p, new StringContent(JsonSerializer.Serialize(o), Encoding.UTF8, "application/json"))).Content.ReadAsStringAsync();

    [StructLayout(LayoutKind.Sequential)]
    struct PMC2
    {
        public uint cb, PageFaultCount; public nuint PeakWorkingSetSize, WorkingSetSize, QuotaPeakPagedPoolUsage, QuotaPagedPoolUsage, QuotaPeakNonPagedPoolUsage, QuotaNonPagedPoolUsage, PagefileUsage, PeakPagefileUsage, PrivateUsage, PrivateWorkingSetSize; public ulong SharedCommitUsage;
    }
    [DllImport("psapi.dll", SetLastError = true)] static extern bool GetProcessMemoryInfo(IntPtr h, ref PMC2 c, uint cb);

    static List<int> Tree(int root)
    {
        var pairs = new List<(int pid, int ppid)>();
        if (OperatingSystem.IsWindows())
        {
            var o = Run("powershell", "-NoProfile -Command \"Get-CimInstance Win32_Process | ForEach-Object { '{0} {1}' -f $_.ProcessId, $_.ParentProcessId }\"");
            foreach (var l in o.Split('\n', StringSplitOptions.RemoveEmptyEntries)) { var t = l.Trim().Split(' '); if (t.Length == 2 && int.TryParse(t[0], out var a) && int.TryParse(t[1], out var b)) pairs.Add((a, b)); }
        }
        else
        {
            var o = Run("ps", "-A -o pid=,ppid=");
            foreach (var l in o.Split('\n', StringSplitOptions.RemoveEmptyEntries)) { var t = l.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries); if (t.Length == 2 && int.TryParse(t[0], out var a) && int.TryParse(t[1], out var b)) pairs.Add((a, b)); }
        }
        var res = new List<int>(); var q = new Queue<int>(); q.Enqueue(root);
        while (q.Count > 0) { var p = q.Dequeue(); res.Add(p); foreach (var c in pairs.Where(x => x.ppid == p)) q.Enqueue(c.pid); }
        return res;
    }

    static string Run(string exe, string args)
    {
        var psi = new ProcessStartInfo(exe, args) { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };
        using var p = Process.Start(psi)!; var o = p.StandardOutput.ReadToEnd(); p.StandardError.ReadToEnd(); p.WaitForExit(); return o;
    }

    static object Measure(int root, string script)
    {
        if (OperatingSystem.IsLinux())
        {
            var o = Run("python3", $"\"{script}\" {root}");
            var j = JsonSerializer.Deserialize<JsonElement>(o);
            return new { os = "linux", processes = j.GetProperty("process_count").GetInt32(), pss_mb = j.GetProperty("pss_mb").GetDouble(), rss_mb = j.GetProperty("rss_mb").GetDouble() };
        }
        if (OperatingSystem.IsWindows())
        {
            double priv = 0, ws = 0; var pids = Tree(root); var names = new List<string>();
            foreach (var pid in pids)
            {
                try
                {
                    using var pr = Process.GetProcessById(pid); var c = new PMC2 { cb = (uint)Marshal.SizeOf<PMC2>() };
                    if (GetProcessMemoryInfo(pr.Handle, ref c, c.cb)) { priv += c.PrivateWorkingSetSize; ws += c.WorkingSetSize; names.Add(pr.ProcessName); }
                }
                catch { }
            }
            return new { os = "windows", processes = pids.Count, names, private_ws_mb = Math.Round(priv / 1048576.0, 1), total_ws_mb = Math.Round(ws / 1048576.0, 1) };
        }
        // macOS: footprint and RSS summed over the tree
        double fp = 0, rss = 0; var mp = Tree(root);
        foreach (var pid in mp)
        {
            var f = Run("footprint", $"-p {pid}");
            foreach (var l in f.Split('\n')) if (l.Contains("phys_footprint:") || l.TrimStart().StartsWith("Footprint:")) { var m = System.Text.RegularExpressions.Regex.Match(l, @"([\d.,]+)\s*(KB|MB|GB|B)\b", System.Text.RegularExpressions.RegexOptions.IgnoreCase); if (m.Success) { var v = double.Parse(m.Groups[1].Value.Replace(",", ""), System.Globalization.CultureInfo.InvariantCulture); fp += m.Groups[2].Value.ToUpper() switch { "GB" => v * 1024, "KB" => v / 1024, "B" => v / 1048576, _ => v }; break; } }
            var r = Run("ps", $"-o rss= -p {pid}").Trim(); if (double.TryParse(r, out var kb)) rss += kb / 1024;
        }
        return new { os = "macos", processes = mp.Count, footprint_mb = Math.Round(fp, 1), rss_mb = Math.Round(rss, 1) };
    }

    public static async Task<int> Run(List<string> a)
    {
        var exe = a[1]; var data = a[2]; var outDir = a[3]; Directory.CreateDirectory(outDir);
        var script = a.IndexOf("--measure-script") is var si and >= 0 ? a[si + 1] : "tools/measure-memory.py";
        var soak = a.IndexOf("--soak") is var oi and >= 0 ? int.Parse(a[oi + 1]) : 20;
        var idle = a.IndexOf("--idle") is var ii and >= 0 ? int.Parse(a[ii + 1]) : 60;
        var disc = Path.Combine(outDir, "discovery.json"); File.Delete(disc);
        var psi = new ProcessStartInfo(exe) { UseShellExecute = false };
        foreach (var x in new[] { "--data", data, "--automation", "--discovery", disc }) psi.ArgumentList.Add(x);
        for (var i = 0; i < a.Count; i++) if (a[i] == "--extra-arg") psi.ArgumentList.Add(a[i + 1]);
        using var p = Process.Start(psi)!;
        for (var t = 0; t < 600 && !File.Exists(disc); t++) await Task.Delay(100);
        var cfg = JsonSerializer.Deserialize<JsonElement>(File.ReadAllText(disc));
        _http = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{cfg.GetProperty("port").GetInt32()}"), Timeout = TimeSpan.FromMinutes(5) }; _http.DefaultRequestHeaders.Add("X-Folio-Token", cfg.GetProperty("token").GetString());
        while (!JsonSerializer.Deserialize<JsonElement>(await _http.GetStringAsync("/status")).GetProperty("ready").GetBoolean()) await Task.Delay(100);

        var points = new List<object>();
        async Task Point(string name) { var m = Measure(p.Id, script); points.Add(new { point = name, m }); Console.WriteLine(name + " " + JsonSerializer.Serialize(m)); }
        async Task Scroll() => await Post("/bench/scroll", new { });

        await Post("/ui/navigate", new { page = "Overview" }); await Task.Delay(5000); await Point("P0 Overview 5s");
        await Post("/ui/navigate", new { page = "Transactions" }); await Task.Delay(5000); await Point("P1 Transactions 5s");
        await Scroll(); await Task.Delay(3000); await Point("P2 after scroll 1 +3s");
        await Scroll(); await Task.Delay(3000); await Point("P3 after scroll 2 +3s");
        await Scroll(); await Task.Delay(idle * 1000); await Point($"P4 after scroll 3 + {idle}s idle");
        var cols = new[] { "Date", "Description", "Account", "Category", "Amount" };
        for (var i = 0; i < soak; i++)
        {
            await Post("/bench/sort", new { column = cols[i % 5], direction = i % 2 == 0 ? "asc" : "desc" });
            await Post("/ui/invoke", new { action = "filter", search = "sobeys" }); await Task.Delay(300);
            await Post("/ui/invoke", new { action = "filter" }); await Task.Delay(300);
            await Scroll();
            if (i % 5 == 4) await Point($"soak after {i + 1} scrolls");
        }
        await Task.Delay(idle * 1000); await Point($"P5 after soak ({soak} scrolls) + {idle}s idle");
        File.WriteAllText(Path.Combine(outDir, "memtest.json"), JsonSerializer.Serialize(points, new JsonSerializerOptions { WriteIndented = true }));
        await Post("/quit", new { }); p.WaitForExit(15000);
        return 0;
    }
}
