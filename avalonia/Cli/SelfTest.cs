using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

/// <summary>
/// G3 scenario: launch the real app, navigate every page, read state as JSON, screenshot, exercise filters, sort, select,
/// chart click-through, keyboard on the legend, the dialog focus, the security checks, then exit cleanly.
/// Every check is recorded; the process exit code is non-zero if any check failed.
/// </summary>
public static class SelfTest
{
    static readonly List<(string name, bool ok, string detail)> Checks = new();
    static void Check(string name, bool ok, string detail = "") { Checks.Add((name, ok, detail)); Console.WriteLine($"{(ok ? "PASS" : "FAIL")}  {name}{(detail == "" ? "" : "  [" + detail + "]")}"); }

    static HttpClient _http = null!; static int _port; static string _token = "";
    static async Task<JsonElement> Get(string p) => JsonSerializer.Deserialize<JsonElement>(await _http.GetStringAsync(p));
    static async Task<JsonElement> Post(string p, object o)
    {
        var r = await _http.PostAsync(p, new StringContent(JsonSerializer.Serialize(o), Encoding.UTF8, "application/json"));
        var t = await r.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<JsonElement>(t);
    }
    static bool _osKeys;
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
    /// <summary>Send a key: with --oskeys a real OS-level key (xdotool on Linux/X11, keybd_event on Windows), otherwise the app's synthetic routed key.</summary>
    static async Task Key(string key)
    {
        if (!_osKeys) { await Invoke(new { action = "key", key }); return; }
        if (OperatingSystem.IsLinux())
        {
            var k = key switch { "Space" => "space", "Escape" => "Escape", "Enter" => "Return", _ => key };
            var psi = new ProcessStartInfo("xdotool") { UseShellExecute = false }; psi.ArgumentList.Add("key"); psi.ArgumentList.Add(k);
            using var pr = Process.Start(psi)!; await pr.WaitForExitAsync();
        }
        else if (OperatingSystem.IsWindows())
        {
            byte vk = key switch { "Tab" => 0x09, "Escape" => 0x1B, "Space" => 0x20, "Enter" => 0x0D, _ => throw new ArgumentException(key) };
            keybd_event(vk, 0, 0, UIntPtr.Zero); keybd_event(vk, 0, 2, UIntPtr.Zero);
        }
        await Task.Delay(120);
    }
    static Task<JsonElement> Invoke(object o) => Post("/ui/invoke", o);
    static async Task<JsonElement> State() => await Get("/ui/state");
    static async Task<JsonElement> Settle(Func<JsonElement, bool> until, int ms = 3000)
    {
        var sw = Stopwatch.StartNew(); JsonElement s;
        do { s = await State(); if (until(s)) return s; await Task.Delay(100); } while (sw.ElapsedMilliseconds < ms);
        return s;
    }

    public static async Task<int> Run(List<string> a)
    {
        var exe = a[1]; var data = a[2]; var outDir = a[3]; Directory.CreateDirectory(outDir);
        var theme = a.IndexOf("--theme") is var ti and >= 0 ? a[ti + 1] : "light";
        _osKeys = a.Contains("--oskeys");
        var disc = Path.Combine(outDir, "discovery.json"); File.Delete(disc);
        var psi = new ProcessStartInfo(exe) { UseShellExecute = false };
        foreach (var x in new[] { "--data", data, "--automation", "--discovery", disc, "--theme", theme }) psi.ArgumentList.Add(x);
        if (a.Contains("--headless")) psi.ArgumentList.Add("--headless");
        for (var i = 0; i < a.Count - 1; i++) if (a[i] == "--extra-arg") psi.ArgumentList.Add(a[i + 1]);
        var sw = Stopwatch.StartNew();
        using var p = Process.Start(psi)!;
        JsonElement status = default;
        while (sw.Elapsed.TotalSeconds < 90)
        {
            if (p.HasExited) { Check("app starts", false, "exited " + p.ExitCode); return Finish(outDir); }
            if (File.Exists(disc))
            {
                try
                {
                    var cfg = JsonSerializer.Deserialize<JsonElement>(File.ReadAllText(disc)); _port = cfg.GetProperty("port").GetInt32(); _token = cfg.GetProperty("token").GetString()!;
                    _http = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{_port}"), Timeout = TimeSpan.FromMinutes(2) }; _http.DefaultRequestHeaders.Add("X-Folio-Token", _token);
                    status = await Get("/status"); if (status.GetProperty("ready").GetBoolean()) break;
                }
                catch { }
            }
            await Task.Delay(50);
        }
        var wall = sw.ElapsedMilliseconds;
        Check("app starts and reports ready", status.ValueKind != JsonValueKind.Undefined && status.GetProperty("ready").GetBoolean(), $"wall {wall} ms, in-app startup {status.GetProperty("startupMs")} ms");
        Check("10,000 rows loaded", status.GetProperty("rows").GetInt32() == 10000);

        // Independent expectations from the fixtures (integer cents).
        var tx = JsonSerializer.Deserialize<JsonElement>(File.ReadAllText(Path.Combine(data, "transactions.json"))).EnumerateArray().ToList();
        var cats = JsonSerializer.Deserialize<JsonElement>(File.ReadAllText(Path.Combine(data, "categories.json"))).EnumerateArray().ToDictionary(c => c.GetProperty("id").GetString()!, c => c.GetProperty("parent_id").ValueKind == JsonValueKind.Null ? c.GetProperty("id").GetString()! : c.GetProperty("parent_id").GetString()!);

        // 1. every page: navigate, state, screenshot
        foreach (var page in new[] { "Overview", "Transactions", "Reporting", "Net worth", "Accounts", "Rules & categories", "Settings" })
        {
            var s = await Post("/ui/navigate", new { page });
            Check($"navigate to {page}", s.GetProperty("page").GetString() == page);
            var content = s.GetProperty("content");
            if (page == "Transactions") Check("Transactions state lists 10,000 rows", content.GetProperty("total").GetInt32() == 10000 && content.GetProperty("shown").GetInt32() == 10000);
            else if (page == "Reporting") Check("Reporting state has donut slices and 12 bars", content.GetProperty("donut").GetArrayLength() > 0 && content.GetProperty("bars").GetArrayLength() == 12);
            else if (page == "Settings") Check("Settings state has theme", content.GetProperty("theme").GetString() is { Length: > 0 });
            else Check($"{page} placeholder shows its title", content.GetProperty("title").GetString() == page);
            var png = await _http.GetByteArrayAsync("/ui/screenshot");
            var file = Path.Combine(outDir, page.Replace(' ', '-').Replace("&", "and") + ".png"); File.WriteAllBytes(file, png);
            Check($"screenshot of {page}", png.Length > 5000 && png[1] == 'P' && png[2] == 'N', $"{png.Length} bytes");
        }

        // 2. Transactions: filter, sort, select
        await Post("/ui/navigate", new { page = "Transactions" });
        await Invoke(new { action = "filter", search = "sobeys" });
        var st = await Settle(s => s.GetProperty("content").GetProperty("filter").GetProperty("search").GetString() == "sobeys");
        var expect = tx.Count(t => t.GetProperty("description").GetString()!.Contains("sobeys", StringComparison.OrdinalIgnoreCase) || (t.GetProperty("note").ValueKind == JsonValueKind.String && t.GetProperty("note").GetString()!.Contains("sobeys", StringComparison.OrdinalIgnoreCase)));
        Check("search filter row count matches fixtures", st.GetProperty("content").GetProperty("shown").GetInt32() == expect, $"{st.GetProperty("content").GetProperty("shown")} vs {expect}");
        await Invoke(new { action = "filter" });
        await Invoke(new { action = "sort", column = "Amount", direction = "asc" });
        st = await State(); var first = st.GetProperty("content").GetProperty("firstRows")[0].GetProperty("amountCents").GetInt64();
        Check("sort by Amount ascending puts the smallest first", first == tx.Min(t => t.GetProperty("amount_cents").GetInt64()), first.ToString());
        var id = st.GetProperty("content").GetProperty("firstRows")[2].GetProperty("Id").GetString()!;
        await Invoke(new { action = "select", id });
        st = await Settle(s => s.GetProperty("content").GetProperty("selected").ValueKind == JsonValueKind.Object);
        var sel = st.GetProperty("content").GetProperty("selected");
        Check("selecting a row fills the details panel", sel.GetProperty("id").GetString() == id && st.GetProperty("content").GetProperty("detailsPanel").GetProperty("body").GetString()!.Contains(sel.GetProperty("account").GetString()!));
        await Invoke(new { action = "sort", column = "Date", direction = "asc" });

        // 3. Reporting click-through (donut and bar), checked against fixtures
        await Post("/ui/navigate", new { page = "Reporting" });
        await Invoke(new { action = "month", value = "2026-03" });
        st = await Settle(s => s.GetProperty("content").GetProperty("month").GetString() == "2026-03");
        var slice = st.GetProperty("content").GetProperty("donut")[0]; var key = slice.GetProperty("Key").GetString()!;
        var expectCents = -tx.Where(t => t.GetProperty("date").GetString()!.StartsWith("2026-03") && t.GetProperty("amount_cents").GetInt64() < 0 && cats[t.GetProperty("category_id").ValueKind == JsonValueKind.Null ? "uncategorized" : t.GetProperty("category_id").GetString()!] == key && key != "savings").Sum(t => t.GetProperty("amount_cents").GetInt64());
        Check("donut slice total matches fixtures", slice.GetProperty("cents").GetInt64() == expectCents, $"{slice.GetProperty("cents")} vs {expectCents}");
        await Invoke(new { action = "clickDonut", key });
        st = await Settle(s => s.GetProperty("page").GetString() == "Transactions");
        var expectRows = tx.Count(t => t.GetProperty("date").GetString()!.StartsWith("2026-03") && t.GetProperty("amount_cents").GetInt64() < 0 && cats[t.GetProperty("category_id").ValueKind == JsonValueKind.Null ? "uncategorized" : t.GetProperty("category_id").GetString()!] == key);
        Check("donut click opens Transactions filtered", st.GetProperty("content").GetProperty("shown").GetInt32() == expectRows && st.GetProperty("content").GetProperty("filter").GetProperty("categoryId").GetString() == key, $"{st.GetProperty("content").GetProperty("shown")} rows vs {expectRows}");
        await Post("/ui/navigate", new { page = "Reporting" });
        await Invoke(new { action = "clickBar", month = "2026-05", direction = "in" });
        st = await Settle(s => s.GetProperty("page").GetString() == "Transactions");
        var expectIn = tx.Count(t => t.GetProperty("date").GetString()!.StartsWith("2026-05") && t.GetProperty("amount_cents").GetInt64() > 0 && cats[t.GetProperty("category_id").ValueKind == JsonValueKind.Null ? "uncategorized" : t.GetProperty("category_id").GetString()!] != "savings");
        Check("bar click opens Transactions filtered", st.GetProperty("content").GetProperty("shown").GetInt32() == expectIn, $"{st.GetProperty("content").GetProperty("shown")} vs {expectIn}");

        if (_osKeys && OperatingSystem.IsLinux())
        {
            var fpsi = new ProcessStartInfo("xdotool") { UseShellExecute = false }; foreach (var x in new[] { "search", "--onlyvisible", "--name", "Folio", "windowfocus", "--sync" }) fpsi.ArgumentList.Add(x);
            using var fpr = Process.Start(fpsi)!; await fpr.WaitForExitAsync();
        }
        if (_osKeys && OperatingSystem.IsWindows()) { p.Refresh(); SetForegroundWindow(p.MainWindowHandle); await Task.Delay(500); }
        Check("keys are sent as " + (_osKeys ? "real OS key events" : "synthetic routed events"), true);
        // 4. Keyboard: Tab from the top of Reporting until a legend row has focus, then Enter
        await Invoke(new { action = "filter" });
        await Post("/ui/navigate", new { page = "Reporting" });
        var reached = false; var trail = new List<string>();
        for (var i = 0; i < 60 && !reached; i++)
        {
            await Key("Tab"); await Task.Delay(50);
            var f = (await State()).GetProperty("focused").GetString() ?? ""; trail.Add(f);
            reached = f.Contains(", $") && f.StartsWith("Button");
        }
        Check("Tab reaches a donut legend row", reached, string.Join(" > ", trail.TakeLast(3)));
        if (reached)
        {
            await Key("Space");
            st = await Settle(s => s.GetProperty("page").GetString() == "Transactions");
            Check("Space on a legend row opens Transactions filtered", st.GetProperty("page").GetString() == "Transactions" && st.GetProperty("content").GetProperty("filter").GetProperty("categoryId").ValueKind == JsonValueKind.String);
        }

        // 5. Dialog focus
        await Invoke(new { action = "filter" });
        await Post("/ui/navigate", new { page = "Settings" });
        await Invoke(new { action = "openDialog" });
        st = await Settle(s => s.GetProperty("dialog").GetProperty("open").GetBoolean());
        await Task.Delay(500); st = await State();
        var d = st.GetProperty("dialog");
        Check("dialog opens", d.GetProperty("open").GetBoolean());
        Check("keyboard focus is inside the dialog on open", d.GetProperty("focusInsideDialog").GetBoolean(), "focused: " + d.GetProperty("focused"));
        var stayed = true; var seen = new HashSet<string>();
        for (var i = 0; i < 8; i++) { await Key("Tab"); await Task.Delay(80); var dd = (await State()).GetProperty("dialog"); seen.Add(dd.GetProperty("focused").GetString() ?? "null"); stayed &= dd.GetProperty("focusInsideDialog").GetBoolean(); }
        Check("Tab cycles inside the dialog", stayed, string.Join(" | ", seen));
        await Key("Escape");
        st = await Settle(s => !s.GetProperty("dialog").GetProperty("open").GetBoolean(), 2000);
        Check("Escape closes the dialog", !st.GetProperty("dialog").GetProperty("open").GetBoolean());

        // 6. Theme switch through state, then screenshot
        await Invoke(new { action = "theme", value = theme == "dark" ? "Light" : "Dark" }); await Task.Delay(400);
        var other = await State();
        Check("theme can be switched", other.GetProperty("theme").GetString() != (theme == "dark" ? "Dark" : "Light"), other.GetProperty("theme").GetString());
        File.WriteAllBytes(Path.Combine(outDir, "Settings-switched.png"), await _http.GetByteArrayAsync("/ui/screenshot"));

        // 7. Security checks
        async Task<int> Raw(Action<HttpRequestMessage> f) { using var c = new HttpClient(); var m = new HttpRequestMessage(HttpMethod.Get, $"http://127.0.0.1:{_port}/status"); f(m); return (int)(await c.SendAsync(m)).StatusCode; }
        Check("request without token is rejected (401)", await Raw(_ => { }) == 401);
        Check("request with wrong token is rejected (401)", await Raw(m => m.Headers.Add("X-Folio-Token", "nope")) == 401);
        Check("request with an Origin header is rejected (403)", await Raw(m => { m.Headers.Add("X-Folio-Token", _token); m.Headers.Add("Origin", "http://evil.example"); }) == 403);
        var hostCode = await Raw(m => { m.Headers.Add("X-Folio-Token", _token); m.Headers.Host = "evil.example"; });
        Check("request with a foreign Host is not served (HttpListener answers 404, the app also checks Host)", hostCode is 400 or 403 or 404, "status " + hostCode);
        Check("valid request is accepted (200)", await Raw(m => m.Headers.Add("X-Folio-Token", _token)) == 200);
        if (!OperatingSystem.IsWindows()) Check("discovery file is user-only (0600)", (File.GetUnixFileMode(disc) & (UnixFileMode.GroupRead | UnixFileMode.GroupWrite | UnixFileMode.OtherRead | UnixFileMode.OtherWrite)) == 0, File.GetUnixFileMode(disc).ToString());

        // 7b. Optional idle period (G1 capture): the app sits untouched while a capture runs outside.
        if (a.IndexOf("--idle") is var ii and >= 0)
        {
            var secs = int.Parse(a[ii + 1]); var idleSw = Stopwatch.StartNew();
            Console.WriteLine($"idling {secs}s");
            while (idleSw.Elapsed.TotalSeconds < secs) await Task.Delay(1000);
            var m = (await Get("/status")).GetProperty("metrics");
            Check($"app still responsive after {secs}s idle", true, "metrics " + m);
        }

        // 8. Clean exit
        await Post("/quit", new { });
        var exited = p.WaitForExit(15000);
        Check("app exits cleanly on quit", exited && p.ExitCode == 0, exited ? "exit code " + p.ExitCode : "still running");
        if (!exited) try { p.Kill(true); } catch { }
        return Finish(outDir);
    }

    static int Finish(string outDir)
    {
        var failed = Checks.Count(c => !c.ok);
        File.WriteAllText(Path.Combine(outDir, "selftest.json"), JsonSerializer.Serialize(new { passed = Checks.Count - failed, failed, checks = Checks.Select(c => new { c.name, c.ok, c.detail }) }, new JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine($"\n{Checks.Count - failed} passed, {failed} failed");
        return failed == 0 ? 0 : 1;
    }
}
