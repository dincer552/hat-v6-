using System.Text.Json;
using System.Xml.Linq;

namespace HattrickAI.V5.Core;

/// <summary>
/// CHPP-WRITE-04: offline-only request/response contract simulator.
/// It deliberately performs no HTTP call and cannot write to Hattrick.
/// </summary>
public sealed class ChppMatchOrderMockWriteService
{
    public ChppMockWriteResult Write(int teamId, int matchId, ChppMatchOrderPayload payload)
    {
        ArgumentNullException.ThrowIfNull(payload);
        if (teamId <= 0) throw new ArgumentOutOfRangeException(nameof(teamId));
        if (matchId <= 0) throw new ArgumentOutOfRangeException(nameof(matchId));

        var lineupJson = ChppMatchOrderPayloadBuilder.Serialize(payload);
        using var document = JsonDocument.Parse(lineupJson);
        if (!document.RootElement.TryGetProperty("positions", out var positions) || positions.GetArrayLength() != 14)
            throw new InvalidOperationException("Mock CHPP contract: positions[14] bekleniyor.");
        if (!document.RootElement.TryGetProperty("bench", out var bench) || bench.GetArrayLength() != 14)
            throw new InvalidOperationException("Mock CHPP contract: bench[14] bekleniyor.");

        var request = new ChppMockWriteRequest(
            "matchorders",
            "3.1",
            "POST",
            teamId,
            matchId,
            lineupJson);

        var response = $"<MatchOrders><MatchData TeamID=\"{teamId}\" MatchID=\"{matchId}\" OrdersSet=\"true\"><TacticType>{TacticCode(payload.Tactic)}</TacticType><Attitude>{AttitudeCode(payload.Attitude)}</Attitude></MatchData></MatchOrders>";
        return new ChppMockWriteResult(request, response, ParseResponse(response));
    }

    private static int TacticCode(TeamTactic tactic) => tactic switch
    {
        TeamTactic.Normal => 0,
        TeamTactic.Pressing => 1,
        TeamTactic.CounterAttack => 2,
        TeamTactic.AttackMiddle => 3,
        TeamTactic.AttackWings => 4,
        TeamTactic.Creative => 7,
        TeamTactic.LongShots => 8,
        _ => throw new InvalidOperationException($"Mock CHPP tactic eşleşmesi yok: {tactic}.")
    };

    private static int AttitudeCode(TeamAttitude attitude) => attitude switch
    {
        TeamAttitude.PlayItCool => -1,
        TeamAttitude.Normal => 0,
        TeamAttitude.MatchOfTheSeason => 1,
        _ => throw new InvalidOperationException($"Mock CHPP attitude eşleşmesi yok: {attitude}.")
    };

    private static ChppMockWriteResponse ParseResponse(string xml)
    {
        var root = XDocument.Parse(xml).Root ?? throw new InvalidOperationException("Mock CHPP response boş.");
        var data = root.Element("MatchData") ?? throw new InvalidOperationException("Mock CHPP response MatchData eksik.");
        return new ChppMockWriteResponse(
            int.Parse((string?)data.Attribute("TeamID") ?? "0"),
            int.Parse((string?)data.Attribute("MatchID") ?? "0"),
            bool.Parse((string?)data.Attribute("OrdersSet") ?? "false"),
            int.Parse(data.Element("TacticType")?.Value ?? "-1"),
            int.Parse(data.Element("Attitude")?.Value ?? "-99"));
    }
}

public sealed record ChppMockWriteRequest(
    string File,
    string Version,
    string Method,
    int TeamId,
    int MatchId,
    string LineupJson);

public sealed record ChppMockWriteResponse(
    int TeamId,
    int MatchId,
    bool OrdersSet,
    int TacticType,
    int Attitude);

public sealed record ChppMockWriteResult(
    ChppMockWriteRequest Request,
    string RawResponse,
    ChppMockWriteResponse Response);
