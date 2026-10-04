using System.Collections.Concurrent;
using System.Text.RegularExpressions;

namespace HattrickAI.V5.Core;

public sealed record ChppLogEntry(DateTimeOffset Time, string Level, string Step, string Message);

public sealed class ChppDebugLog
{
    private const int MaxEntries = 500;
    private readonly ConcurrentQueue<ChppLogEntry> _entries = new();
    private readonly string _filePath = "/app/chpp-debug.log";

    public void Info(string step, string message) => Add("INFO", step, message);
    public void Error(string step, string message) => Add("ERROR", step, message);

    public IReadOnlyList<ChppLogEntry> GetRecent(int count = 200)
        => _entries.Reverse().Take(Math.Clamp(count, 1, MaxEntries)).ToList();

    public void Clear()
    {
        while (_entries.TryDequeue(out _)) { }
        try { File.WriteAllText(_filePath, string.Empty); } catch { }
    }

    private void Add(string level, string step, string message)
    {
        var entry = new ChppLogEntry(DateTimeOffset.Now, level, step, Redact(message));
        _entries.Enqueue(entry);
        while (_entries.Count > MaxEntries && _entries.TryDequeue(out _)) { }
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_filePath)!);
            File.AppendAllText(_filePath, $"[{entry.Time:yyyy-MM-dd HH:mm:ss.fff zzz}] [{entry.Level}] [{entry.Step}] {entry.Message}{Environment.NewLine}");
        }
        catch { }
    }

    private static string Redact(string value)
    {
        if (string.IsNullOrEmpty(value)) return value;
        value = Regex.Replace(value, @"(oauth_token_secret|access_token_secret|oauth_signature)=([^&\s,]+)", "$1=***", RegexOptions.IgnoreCase);
        value = Regex.Replace(value, @"(oauth_token|oauth_verifier)=([^&\s,]+)", "$1=***", RegexOptions.IgnoreCase);
        return value.Length > 4000 ? value[..4000] + "…" : value;
    }
}
