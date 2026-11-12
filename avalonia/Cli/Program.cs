using System.Diagnostics;
using System.Text;
using System.Text.Json;
using SkiaSharp;

// folio-slice-cli: tiny client for the slice's loopback automation server.
//   status | state | navigate <page> | screenshot <file.png> | invoke '<json>' | bench-scroll | bench-sort <col> [desc] | quit
//   wait-ready [--timeout s]                    poll discovery file + /status until the app is ready
//   selftest <app-exe> <data-dir> <outdir> [--theme light|dark] [--headless]   full G3 scenario against the real window
//   memtest <app-exe> <data-dir> <outdir> [--measure-script tools/measure-memory.py] [--soak N] [--extra-arg X]   F1 memory scenario, process-tree metric per OS
//   diff <a.png> <b.png> [--tolerance 0.001]     pixel compare, exit 1 over tolerance
var a = args.ToList();
string? disc = null;
var di = a.IndexOf("--discovery"); if (di >= 0) { disc = a[di + 1]; a.RemoveRange(di, 2); }
if (a.Count == 0) { Console.Error.WriteLine("usage: see source header"); return 2; }

if (a[0] == "diff") return Diff(a);
if (a[0] == "memtest") return await MemTest.Run(a);
if (a[0] == "selftest") return await SelfTest.Run(a);
if (a[0] == "wait-ready") return await WaitReady(a, disc);

disc ??= Environment.GetEnvironmentVariable("FOLIO_DISCOVERY") ?? DefaultDiscovery();
var cfg = JsonSerializer.Deserialize<JsonElement>(File.ReadAllText(disc));
var port = cfg.GetProperty("port").GetInt32(); var token = cfg.GetProperty("token").GetString()!;
using var http = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{port}"), Timeout = TimeSpan.FromMinutes(5) };
http.DefaultRequestHeaders.Add("X-Folio-Token", token);

async Task<string> Post(string path, string json) => await (await http.PostAsync(path, new StringContent(json, Encoding.UTF8, "application/json"))).Content.ReadAsStringAsync();
switch (a[0])
{
    case "status": Console.WriteLine(await http.GetStringAsync("/status")); break;
    case "state": Console.WriteLine(await http.GetStringAsync("/ui/state")); break;
    case "navigate": Console.WriteLine(await Post("/ui/navigate", JsonSerializer.Serialize(new { page = a[1] }))); break;
    case "invoke": Console.WriteLine(await Post("/ui/invoke", a[1])); break;
    case "screenshot": File.WriteAllBytes(a[1], await http.GetByteArrayAsync("/ui/screenshot")); Console.WriteLine($"wrote {a[1]}"); break;
    case "bench-scroll": Console.WriteLine(await Post("/bench/scroll", "{}")); break;
    case "bench-sort": Console.WriteLine(await Post("/bench/sort", JsonSerializer.Serialize(new { column = a[1], direction = a.Count > 2 ? a[2] : "asc" }))); break;
    case "quit": Console.WriteLine(await Post("/quit", "{}")); break;
    default: Console.Error.WriteLine("unknown command"); return 2;
}
return 0;

static string DefaultDiscovery() => OperatingSystem.IsWindows()
    ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FolioSlice", "automation.json")
    : Path.Combine(Environment.GetEnvironmentVariable("XDG_RUNTIME_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".folio-slice"), "folio-slice", "automation.json");

// wait-ready: poll the discovery file and /status until the app reports ready. Start the app yourself
// (redirect its stdout/stderr to a file) so the CLI never owns its pipes.
static async Task<int> WaitReady(List<string> a, string? disc)
{
    var timeout = 60; var ti = a.IndexOf("--timeout"); if (ti >= 0) timeout = int.Parse(a[ti + 1]);
    disc ??= Environment.GetEnvironmentVariable("FOLIO_DISCOVERY") ?? DefaultDiscovery();
    var sw = Stopwatch.StartNew();
    while (sw.Elapsed.TotalSeconds < timeout)
    {
        if (File.Exists(disc))
        {
            try
            {
                var cfg = JsonSerializer.Deserialize<JsonElement>(File.ReadAllText(disc));
                using var http = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{cfg.GetProperty("port").GetInt32()}") };
                http.DefaultRequestHeaders.Add("X-Folio-Token", cfg.GetProperty("token").GetString());
                var s = JsonSerializer.Deserialize<JsonElement>(await http.GetStringAsync("/status"));
                if (s.GetProperty("ready").GetBoolean()) { Console.WriteLine(JsonSerializer.Serialize(new { waitedMs = sw.ElapsedMilliseconds, status = s })); return 0; }
            }
            catch { }
        }
        await Task.Delay(50);
    }
    Console.Error.WriteLine("timeout waiting for app"); return 1;
}

static int Diff(List<string> a)
{
    var tol = 0.001; var ti = a.IndexOf("--tolerance"); if (ti >= 0) tol = double.Parse(a[ti + 1], System.Globalization.CultureInfo.InvariantCulture);
    using var x = SKBitmap.Decode(a[1]); using var y = SKBitmap.Decode(a[2]);
    if (x.Width != y.Width || x.Height != y.Height) { Console.WriteLine($"size differs {x.Width}x{x.Height} vs {y.Width}x{y.Height}"); return 1; }
    long diff = 0;
    for (var j = 0; j < x.Height; j++) for (var i = 0; i < x.Width; i++)
    {
        var p = x.GetPixel(i, j); var q = y.GetPixel(i, j);
        if (Math.Abs(p.Red - q.Red) > 2 || Math.Abs(p.Green - q.Green) > 2 || Math.Abs(p.Blue - q.Blue) > 2) diff++;
    }
    var frac = (double)diff / (x.Width * x.Height);
    Console.WriteLine($"{a[1]} vs {a[2]}: {diff} pixels differ ({frac:P4}), tolerance {tol:P4}: {(frac <= tol ? "MATCH" : "MISMATCH")}");
    return frac <= tol ? 0 : 1;
}
