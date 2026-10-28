using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace HattrickAI.V5.Core.AI;

public sealed class HattrickMemoryStore
{
    private readonly string _path;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private const int MaxRecordChars = 8000;

    public HattrickMemoryStore(IConfiguration configuration)
    {
        _path = configuration["HATTRICK_MEMORY_PATH"]?.Trim() is { Length: > 0 } configured
            ? configured
            : "/data/hattrick-memory.jsonl";
    }

    public async Task<MemoryRecord> SaveAsync(string kind, string prompt, string? answer = null, string? feedback = null, string? teamKey = null, CancellationToken ct = default)
    {
        var record = new MemoryRecord(
            Guid.NewGuid().ToString("N"),
            DateTimeOffset.UtcNow,
            Safe(kind, 40),
            Safe(prompt, MaxRecordChars),
            Safe(answer, MaxRecordChars),
            Safe(feedback, 2000),
            Safe(teamKey, 120));
        await _gate.WaitAsync(ct);
        try
        {
            var dir = Path.GetDirectoryName(_path);
            if (!string.IsNullOrWhiteSpace(dir)) Directory.CreateDirectory(dir);
            await using var stream = new FileStream(_path, FileMode.Append, FileAccess.Write, FileShare.Read, 4096, FileOptions.Asynchronous);
            await JsonSerializer.SerializeAsync(stream, record, JsonOptions, ct);
            await stream.WriteAsync(Encoding.UTF8.GetBytes("\n"), ct);
        }
        finally { _gate.Release(); }
        return record;
    }

    public async Task<IReadOnlyList<MemoryRecord>> RecentAsync(int count = 12, string? teamKey = null, CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try
        {
            if (!File.Exists(_path)) return Array.Empty<MemoryRecord>();
            var lines = await File.ReadAllLinesAsync(_path, ct);
            var records = new List<MemoryRecord>();
            foreach (var line in lines.TakeLast(5000))
            {
                try
                {
                    var record = JsonSerializer.Deserialize<MemoryRecord>(line, JsonOptions);
                    if (record is null) continue;
                    if (!string.IsNullOrWhiteSpace(teamKey) && !string.IsNullOrWhiteSpace(record.TeamKey) && record.TeamKey != teamKey) continue;
                    records.Add(record);
                }
                catch (JsonException) { /* Ignore a partially written/corrupt line. */ }
            }
            return records.TakeLast(Math.Clamp(count, 1, 30)).ToArray();
        }
        finally { _gate.Release(); }
    }

    private static string? Safe(string? value, int max) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim()[..Math.Min(value.Trim().Length, max)];

    public sealed record MemoryRecord(string Id, DateTimeOffset CreatedAt, string Kind, string? Prompt, string? Answer, string? Feedback, string? TeamKey);
}
