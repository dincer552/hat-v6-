using System.Text.Json;
using System.Text.Json.Serialization;

namespace HattrickAI.V5.Core;

/// <summary>
/// CHPP-WRITE-02: converts the current V5 XI + seven primary bench choices
/// into the JSON lineup payload expected by matchorders 2.5+ / 3.1.
/// This class is pure/offline: it performs no CHPP request and never writes.
/// </summary>
public static class ChppMatchOrderPayloadBuilder
{
    private static readonly IReadOnlyDictionary<string, int> PositionIndex =
        new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["GK"] = 0,
            ["DEF-R"] = 1,
            ["DEF-CR"] = 2,
            ["DEF-C"] = 3,
            ["DEF-CL"] = 4,
            ["DEF-L"] = 5,
            ["W-R"] = 6,
            ["IM-R"] = 7,
            ["IM-C"] = 8,
            ["IM-L"] = 9,
            ["W-L"] = 10,
            ["FW-R"] = 11,
            ["FW-C"] = 12,
            ["FW-L"] = 13
        };

    private static readonly IReadOnlyDictionary<string, int> TacticCode =
        new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["Normal"] = 0,
            ["Pressing"] = 1,
            ["CounterAttack"] = 2,
            ["AttackMiddle"] = 3,
            ["AttackWings"] = 4,
            ["Creative"] = 7,
            ["LongShots"] = 8
        };

    public static ChppMatchOrderPayload Build(
        Lineup lineup,
        IReadOnlyDictionary<string, int> primaryBenchBySlot,
        TeamTactic tactic,
        TeamAttitude attitude = TeamAttitude.Normal)
    {
        ArgumentNullException.ThrowIfNull(lineup);
        ArgumentNullException.ThrowIfNull(primaryBenchBySlot);

        if (lineup.Slots.Count != 11)
            throw new InvalidOperationException($"CHPP payload için ilk 11 tam olmalı; bulunan: {lineup.Slots.Count}.");

        var starters = lineup.Slots.Where(x => x.PlayerId > 0).ToList();
        if (starters.Count != 11 || starters.Select(x => x.PlayerId).Distinct().Count() != 11)
            throw new InvalidOperationException("CHPP payload ilk 11 içinde 11 benzersiz oyuncu bekliyor.");

        var positions = Enumerable.Repeat(new ChppPlayerSlot(0, 0), 14).ToArray();
        foreach (var slot in starters)
        {
            if (!PositionIndex.TryGetValue(slot.Code, out var index))
                throw new InvalidOperationException($"CHPP PositionCode eşleşmesi yok: {slot.Code}.");
            if (positions[index].Id != 0)
                throw new InvalidOperationException($"CHPP pozisyonu iki kez dolu: {slot.Code}.");
            positions[index] = new ChppPlayerSlot(slot.PlayerId, ToBehaviour(slot.Order));
        }

        var expectedBench = new[] { "Kaleci", "Göbek defans", "Bek", "İç orta saha", "Forvet", "Kanat", "Ekstra" };
        var missing = expectedBench.Where(x => !primaryBenchBySlot.ContainsKey(x)).ToArray();
        if (missing.Length > 0)
            throw new InvalidOperationException("CHPP primary bench eksik: " + string.Join(", ", missing));

        var bench = expectedBench
            .Select(slot => primaryBenchBySlot[slot])
            .ToArray();
        if (bench.Any(x => x <= 0))
            throw new InvalidOperationException("CHPP bench oyuncu ID'leri pozitif olmalı.");
        if (bench.Distinct().Count() != bench.Length)
            throw new InvalidOperationException("CHPP bench içinde aynı oyuncu birden fazla slotta kullanılamaz.");
        if (bench.Intersect(starters.Select(x => x.PlayerId)).Any())
            throw new InvalidOperationException("CHPP bench oyuncusu ilk 11 ile aynı olamaz.");

        if (!TacticCode.TryGetValue(tactic.ToString(), out var tacticCode))
            throw new InvalidOperationException($"CHPP tactic eşleşmesi yok: {tactic}.");

        var speechLevel = attitude switch
        {
            TeamAttitude.PlayItCool => -1,
            TeamAttitude.Normal => 0,
            TeamAttitude.MatchOfTheSeason => 1,
            _ => throw new InvalidOperationException($"CHPP attitude desteklenmiyor: {attitude}.")
        };

        var json = new ChppLineupJson(
            positions,
            bench.Select(x => new ChppPlayerSlot(x, 0)).Concat(Enumerable.Repeat(new ChppPlayerSlot(0, 0), 7)).ToArray(),
            Enumerable.Repeat(new ChppPlayerSlot(0, 0), 11).ToArray(),
            string.Empty,
            string.Empty,
            new ChppLineupSettings(tacticCode.ToString(), speechLevel.ToString(), string.Empty, string.Empty, string.Empty, string.Empty),
            Array.Empty<object>());

        return new ChppMatchOrderPayload(lineup.Formation, tactic, attitude, json);
    }

    public static string Serialize(ChppMatchOrderPayload payload)
        => JsonSerializer.Serialize(payload.Lineup, new JsonSerializerOptions
        {
            PropertyNamingPolicy = null,
            DefaultIgnoreCondition = JsonIgnoreCondition.Never,
            WriteIndented = false
        });

    private static int ToBehaviour(PlayerOrder order) => order switch
    {
        PlayerOrder.Normal => 0,
        PlayerOrder.Defensive => 2,
        PlayerOrder.Offensive => 1,
        PlayerOrder.TowardsMiddle => 3,
        PlayerOrder.TowardsWing => 4,
        _ => throw new InvalidOperationException($"CHPP behaviour eşleşmesi yok: {order}.")
    };
}

public sealed record ChppMatchOrderPayload(
    string Formation,
    TeamTactic Tactic,
    TeamAttitude Attitude,
    ChppLineupJson Lineup);

public sealed record ChppPlayerSlot(int Id, int Behaviour);

public sealed record ChppLineupSettings(
    string Tactic,
    string SpeechLevel,
    string NewLineup,
    string CoachModifier,
    string ManMarkerPlayerId,
    string ManMarkingPlayerId);

public sealed record ChppLineupJson(
    [property: JsonPropertyName("positions")] IReadOnlyList<ChppPlayerSlot> Positions,
    [property: JsonPropertyName("bench")] IReadOnlyList<ChppPlayerSlot> Bench,
    [property: JsonPropertyName("kickers")] IReadOnlyList<ChppPlayerSlot> Kickers,
    [property: JsonPropertyName("captain")] string Captain,
    [property: JsonPropertyName("setPieces")] string SetPieces,
    [property: JsonPropertyName("settings")] ChppLineupSettings Settings,
    [property: JsonPropertyName("substitutions")] IReadOnlyList<object> Substitutions);
