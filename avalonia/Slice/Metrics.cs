using System.Diagnostics;

namespace Slice;

public static class Metrics
{
    public static object Snapshot()
    {
        var p = Process.GetCurrentProcess();
        long rss = p.WorkingSet64;
        if (OperatingSystem.IsLinux())
        {
            try { foreach (var l in File.ReadLines("/proc/self/status")) if (l.StartsWith("VmRSS:")) rss = long.Parse(l.Split(' ', StringSplitOptions.RemoveEmptyEntries)[1]) * 1024; } catch { }
        }
        return new { rssMb = Math.Round(rss / 1048576.0, 1), managedMb = Math.Round(GC.GetTotalMemory(false) / 1048576.0, 1), privateMb = Math.Round(p.PrivateMemorySize64 / 1048576.0, 1), threads = p.Threads.Count };
    }
}
