namespace HattrickAI.V5.Core;

/// <summary>
/// CHPP-WRITE-07: compares the exact post-write CHPP snapshot with the payload
/// that was submitted. Current matchorders 3.1 formal roles are 100-113 for the
/// 14 first-string slots and 114-120 for the seven primary bench slots.
/// </summary>
public static class ChppMatchOrderReadBackVerifier
{
    private const int FirstStringRoleBase = 100;
    private const int PrimaryBenchRoleBase = 114;

    public static ChppMatchOrderReadBackResult Verify(ChppMatchOrderPayload expected, ChppUpcomingMatchSnapshot actual)
    {
        ArgumentNullException.ThrowIfNull(expected);
        ArgumentNullException.ThrowIfNull(actual);

        if (!actual.OrdersSet.GetValueOrDefault()) return Fail("CHPP read-back OrdersSet=true değil.");
        if (actual.MatchId <= 0 || actual.TeamId <= 0) return Fail("CHPP read-back match/team kimliği geçersiz.");

        var expectedPositions = expected.Lineup.Positions;
        if (expectedPositions.Count != 14 || expectedPositions.Count(p => p.Id > 0) != 11)
            return Fail("Beklenen payload 14 pozisyon ve tam 11 oyuncu içermiyor.");

        var actualStarters = actual.Players.Where(p => p.RoleId >= FirstStringRoleBase && p.RoleId < PrimaryBenchRoleBase).ToArray();
        if (actualStarters.Length != 11 || actualStarters.Select(p => p.PlayerId).Distinct().Count() != 11)
            return Fail($"Read-back ilk 11 sayısı/benzersizliği geçersiz: {actualStarters.Length}.");

        for (var i = 0; i < expectedPositions.Count; i++)
        {
            var expectedSlot = expectedPositions[i];
            var actualPlayer = actual.Players.FirstOrDefault(p => p.RoleId == FirstStringRoleBase + i);
            if (expectedSlot.Id <= 0)
            {
                if (actualPlayer is not null) return Fail($"Boş ilk 11 slotu CHPP'de dolu: role {FirstStringRoleBase + i}.");
                continue;
            }

            if (actualPlayer is null || actualPlayer.PlayerId != expectedSlot.Id || actualPlayer.Behaviour != expectedSlot.Behaviour)
                return Fail($"XI eşleşmedi: RoleID {FirstStringRoleBase + i}.");
        }

        var expectedBench = expected.Lineup.Bench.Take(7).ToArray();
        if (expectedBench.Length != 7 || expectedBench.Any(p => p.Id <= 0)) return Fail("Beklenen primary bench 7 dolu oyuncudan oluşmuyor.");
        for (var i = 0; i < expectedBench.Length; i++)
        {
            var actualPlayer = actual.Players.FirstOrDefault(p => p.RoleId == PrimaryBenchRoleBase + i);
            if (actualPlayer is null || actualPlayer.PlayerId != expectedBench[i].Id)
                return Fail($"Primary bench eşleşmedi: slot {i + 1}.");
        }

        if (actual.Players.Any(p => p.RoleId is >= 200 and <= 213))
            return Fail("İlk sürümde backup bench boş olmalı; CHPP read-back backup oyuncu döndürdü.");

        if (!int.TryParse(expected.Lineup.Settings.Tactic, out var expectedTactic) || actual.TacticType != expectedTactic)
            return Fail($"Taktik eşleşmedi: beklenen {expected.Lineup.Settings.Tactic}, CHPP {actual.TacticType}.");
        if (!int.TryParse(expected.Lineup.Settings.SpeechLevel, out var expectedAttitude) || actual.Attitude != expectedAttitude)
            return Fail($"Attitude eşleşmedi: beklenen {expected.Lineup.Settings.SpeechLevel}, CHPP {actual.Attitude}.");

        return new ChppMatchOrderReadBackResult(true, "CHPP read-back doğrulandı.");
    }

    private static ChppMatchOrderReadBackResult Fail(string reason) => new(false, reason);
}

public sealed record ChppMatchOrderReadBackResult(bool Verified, string Reason);
