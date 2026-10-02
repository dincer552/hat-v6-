using System.Globalization;

namespace HattrickAI.V5.Core;

/// <summary>
/// CHPP-WRITE-06 live write orchestration and WRITE-07 read-back verification.
/// Validation and permission guards run immediately before the network write;
/// the service does not silently downgrade or replace an unsupported tactic.
/// </summary>
public sealed class ChppMatchOrderWriteService
{
    private readonly ChppV5 _chpp;
    private readonly ChppMatchOrderReadService _reader;

    public ChppMatchOrderWriteService(ChppV5 chpp)
    {
        _chpp = chpp;
        _reader = new ChppMatchOrderReadService(chpp);
    }

    public async Task<ChppMatchOrderWriteResult> WriteAsync(
        ChppMatchOrderPayload payload,
        ChppUpcomingMatchSnapshot target,
        IEnumerable<int>? rosterPlayerIds,
        CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(payload);
        ArgumentNullException.ThrowIfNull(target);
        ChppMatchOrderPermissionGuard.EnsureCanWrite(_chpp);
        ChppMatchOrderValidator.EnsureValid(payload, target, rosterPlayerIds);

        var raw = await _chpp.SetMatchOrderAsync(target.MatchId, target.TeamId, payload, ct);
        var root = XmlV5.Root(raw);
        var matchData = root?.Descendants("MatchData").FirstOrDefault() ?? root;
        var reason = XmlV5.Text(matchData, "Reason");
        var ordersSet = string.Equals(XmlV5.Text(matchData, "OrdersSet"), "true", StringComparison.OrdinalIgnoreCase)
            || string.Equals((string?)matchData?.Attribute("OrdersSet"), "true", StringComparison.OrdinalIgnoreCase);

        return new ChppMatchOrderWriteResult(target.MatchId, target.TeamId, ordersSet, payload.Tactic.ToString(), raw, reason);
    }

    /// <summary>
    /// WRITE-07: performs the live write, then re-reads the exact same match/team
    /// and refuses to report success unless XI, seven primary bench slots, tactic
    /// and attitude match the submitted payload.
    /// </summary>
    public async Task<ChppMatchOrderWriteReadBackResult> WriteAndVerifyAsync(
        ChppMatchOrderPayload payload,
        ChppUpcomingMatchSnapshot target,
        IEnumerable<int>? rosterPlayerIds,
        CancellationToken ct)
    {
        var write = await WriteAsync(payload, target, rosterPlayerIds, ct);
        if (!write.OrdersSet)
            return new ChppMatchOrderWriteReadBackResult(write, false, "CHPP write başarılı kabul edilmedi; read-back çalıştırılmadı.", null);

        var actual = await _reader.ReadMatchAsync(target.TeamId, target.MatchId, ct);
        if (actual.MatchId != target.MatchId || actual.TeamId != target.TeamId)
            return new ChppMatchOrderWriteReadBackResult(write, false, "Read-back yanlış match/team döndürdü.", actual);

        var verification = ChppMatchOrderReadBackVerifier.Verify(payload, actual);
        return new ChppMatchOrderWriteReadBackResult(write, verification.Verified, verification.Reason, actual);
    }
}

public sealed record ChppMatchOrderWriteResult(
    int MatchId,
    int TeamId,
    bool OrdersSet,
    string Tactic,
    string RawResponse,
    string Reason);

public sealed record ChppMatchOrderWriteReadBackResult(
    ChppMatchOrderWriteResult Write,
    bool Verified,
    string Reason,
    ChppUpcomingMatchSnapshot? ReadBack);
