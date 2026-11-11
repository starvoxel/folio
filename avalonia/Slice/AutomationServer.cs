using System.ComponentModel;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Avalonia.Controls;
using Avalonia.Media.Imaging;
using Avalonia.Threading;

namespace Slice;

/// <summary>
/// Minimal AD-16 style automation server: HttpListener bound to 127.0.0.1, per-session random token,
/// user-only discovery file, Host check, no Origin header allowed, small request bodies.
/// </summary>
public sealed class AutomationServer
{
    private readonly MainWindow _w;
    private readonly HttpListener _l = new();
    private readonly string _token;
    public int Port { get; }
    public string DiscoveryFile { get; }
    private const int MaxBody = 64 * 1024;
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public AutomationServer(MainWindow w, Options opt)
    {
        _w = w;
        _token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var probe = new TcpListener(IPAddress.Loopback, 0); probe.Start(); Port = ((IPEndPoint)probe.LocalEndpoint).Port; probe.Stop();
        _l.Prefixes.Add($"http://127.0.0.1:{Port}/");
        _l.Start();
        DiscoveryFile = opt.DiscoveryFile ?? DefaultDiscovery();
        Directory.CreateDirectory(Path.GetDirectoryName(DiscoveryFile)!);
        File.WriteAllText(DiscoveryFile, JsonSerializer.Serialize(new { port = Port, token = _token, pid = Environment.ProcessId }));
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(DiscoveryFile, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        _ = Task.Run(Loop);
    }

    public static string DefaultDiscovery()
    {
        var dir = OperatingSystem.IsWindows()
            ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FolioSlice")
            : Path.Combine(Environment.GetEnvironmentVariable("XDG_RUNTIME_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".folio-slice"), "folio-slice");
        return Path.Combine(dir, "automation.json");
    }

    private async Task Loop()
    {
        while (_l.IsListening)
        {
            HttpListenerContext ctx;
            try { ctx = await _l.GetContextAsync(); } catch { return; }
            _ = Task.Run(() => Handle(ctx));
        }
    }

    private static bool FixedEq(string a, string b) => CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));

    private async Task Handle(HttpListenerContext ctx)
    {
        var rq = ctx.Request; var rs = ctx.Response;
        try
        {
            if (rq.Headers["Origin"] is not null) { await Send(rs, 403, new { error = "Origin header not allowed" }); return; }
            var host = rq.Headers["Host"];
            if (host != $"127.0.0.1:{Port}") { await Send(rs, 403, new { error = "bad Host" }); return; }
            var tok = rq.Headers["X-Folio-Token"] ?? "";
            if (tok.Length == 0 || !FixedEq(tok, _token)) { await Send(rs, 401, new { error = "missing or wrong token" }); return; }
            if (rq.ContentLength64 > MaxBody) { await Send(rs, 413, new { error = "body too large" }); return; }
            JsonElement body = default;
            if (rq.HasEntityBody)
            {
                using var ms = new MemoryStream(); var buf = new byte[4096]; int n;
                while ((n = await rq.InputStream.ReadAsync(buf)) > 0) { ms.Write(buf, 0, n); if (ms.Length > MaxBody) { await Send(rs, 413, new { error = "body too large" }); return; } }
                if (ms.Length > 0) body = JsonSerializer.Deserialize<JsonElement>(ms.ToArray());
            }
            var path = rq.Url!.AbsolutePath;
            switch (path)
            {
                case "/status":
                    await Send(rs, 200, new { app = "FolioSlice", ready = _w.FirstFrameDone, pid = Environment.ProcessId, startupMs = Math.Round(Program.StartupMs), page = Ui(() => _w.CurrentPage), headless = Program.Options.Headless, dataDir = _w.Store.DataDir, rows = _w.Store.Rows.Count, metrics = Metrics.Snapshot() }); break;
                case "/ui/state": await Send(rs, 200, await Dispatcher.UIThread.InvokeAsync(() => _w.State())); break;
                case "/ui/navigate":
                    {
                        var page = body.GetProperty("page").GetString()!;
                        await Dispatcher.UIThread.InvokeAsync(() => _w.Navigate(page));
                        await Dispatcher.UIThread.InvokeAsync(() => _w.NextFrames(2));
                        await Send(rs, 200, await Dispatcher.UIThread.InvokeAsync(() => _w.State())); break;
                    }
                case "/ui/screenshot":
                    {
                        var png = await Dispatcher.UIThread.InvokeAsync(async () => { await _w.NextFrames(2); return Shot(); });
                        rs.StatusCode = 200; rs.ContentType = "image/png"; rs.ContentLength64 = png.Length; await rs.OutputStream.WriteAsync(png); rs.Close(); break;
                    }
                case "/ui/invoke": await Send(rs, 200, await Dispatcher.UIThread.InvokeAsync(() => Invoke(body))); break;
                case "/bench/scroll":
                    {
                        var r = await Dispatcher.UIThread.InvokeAsync(async () => { _w.Navigate("Transactions"); await _w.NextFrames(3); return await _w.Transactions.ScrollPassAsync(); });
                        await Send(rs, 200, r); break;
                    }
                case "/bench/sort":
                    {
                        var col = body.GetProperty("column").GetString()!; var dir = body.TryGetProperty("direction", out var d) && d.GetString() == "desc" ? ListSortDirection.Descending : ListSortDirection.Ascending;
                        var r = await Dispatcher.UIThread.InvokeAsync(async () => { _w.Navigate("Transactions"); await _w.NextFrames(3); return await _w.Transactions.TimeSortAsync(col, dir); });
                        await Send(rs, 200, r); break;
                    }
                case "/quit":
                    await Send(rs, 200, new { quitting = true });
                    Dispatcher.UIThread.Post(() => (Avalonia.Application.Current!.ApplicationLifetime as Avalonia.Controls.ApplicationLifetimes.IClassicDesktopStyleApplicationLifetime)!.Shutdown(0));
                    break;
                default: await Send(rs, 404, new { error = "unknown endpoint", path }); break;
            }
        }
        catch (Exception e) { try { await Send(rs, 500, new { error = e.GetType().Name, message = e.Message }); } catch { } }
    }

    private T Ui<T>(Func<T> f) => Dispatcher.UIThread.Invoke(f);

    private byte[] Shot()
    {
        var size = new Avalonia.PixelSize((int)_w.Bounds.Width, (int)_w.Bounds.Height);
        using var bmp = new RenderTargetBitmap(size, new Avalonia.Vector(96, 96));
        bmp.Render(_w);
        using var ms = new MemoryStream(); bmp.Save(ms); return ms.ToArray();
    }

    private object Invoke(JsonElement b)
    {
        var action = b.GetProperty("action").GetString()!;
        string? S(string n) => b.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        switch (action)
        {
            case "theme": _w.Settings.SetTheme(S("value")!); break;
            case "month": _w.SetMonth(S("value")!); break;
            case "filter": _w.OpenTransactions(new Filter { Search = S("search") ?? "", AccountId = S("accountId"), CategoryId = S("categoryId"), Month = S("month"), Direction = S("direction") }); break;
            case "sort": _w.Transactions.Sort(S("column")!, S("direction") == "desc" ? ListSortDirection.Descending : ListSortDirection.Ascending); break;
            case "select": _w.Transactions.Select(S("id")!); break;
            case "clickDonut": _w.Reporting.ClickDonut(S("key")!); break;
            case "clickBar": _w.Reporting.ClickBar(S("month")!, S("direction")!); break;
            case "openDialog": _ = _w.Settings.OpenDialogAsync(); break;
            case "closeDialog": _w.Settings.CloseDialog(); break;
            case "key": _w.SendKey(S("key")!, b.TryGetProperty("shift", out var sh) && sh.GetBoolean()); break;
            default: throw new ArgumentException("unknown action " + action);
        }
        return new { ok = true, action };
    }

    private static Task Send(HttpListenerResponse rs, int code, object o)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(o, Json);
        rs.StatusCode = code; rs.ContentType = "application/json"; rs.ContentLength64 = bytes.Length;
        return rs.OutputStream.WriteAsync(bytes).AsTask().ContinueWith(_ => rs.Close());
    }
}
