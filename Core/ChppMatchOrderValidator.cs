namespace HattrickAI.V5.Core;

/// <summary>
/// CHPP-WRITE-03: validates a prepared match-order payload before any write is allowed.
/// This layer is deliberately pure and performs no CHPP request.
/// </summary>
public static class ChppMatchOrderValidator
{
    public static IReadOnlyList<string> Validate(
        ChppMatchOrderPayload payload,
        ChppUpcomingMatchSnapshot target,
        IEnumerable<int>? teamPlayerIds = null,
        DateTimeOffset? now = null,
        TimeSpan? minimumLeadTime = null)
    {
        ArgumentNullException.ThrowIfNull(payload);
        ArgumentNullException.ThrowIfNull(target);

        var errors = new List<string>();
        var current = now ?? DateTimeOffset.UtcNow;
        var lead = minimumLeadTime ?? TimeSpan.FromMinutes(20);

        if (target.MatchId <= 0)
            errors.Add("Hedef maç ID'si geçersiz.");
        if (target.MatchDate == default)
            errors.Add("Hedef maç tarihi geçersiz.");
        else if (target.MatchDate <= current)
            errors.Add("Hedef maç başlamış veya geçmiş.");
        else if (target.MatchDate - current < lead)
            errors.Add($"Hedef maç başlangıcına en az {lead.TotalMinutes:0} dakika kalmalı.");

        if (payload.Lineup.Positions.Count != 14)
            errors.Add($"CHPP positions tam olarak 14 slot olmalı; bulunan: {payload.Lineup.Positions.Count}.");
        else
        {
            var starterIds = payload.Lineup.Positions.Select(x => x.Id).Where(x => x > 0).ToArray();
            if (starterIds.Length != 11)
                errors.Add($"CHPP positions içinde tam 11 oyuncu olmalı; bulunan: {starterIds.Length}.");
            if (starterIds.Distinct().Count() != starterIds.Length)
                errors.Add("CHPP positions içinde duplicate oyuncu var.");
        }

        if (payload.Lineup.Bench.Count != 14)
            errors.Add($"CHPP bench tam olarak 14 slot olmalı; bulunan: {payload.Lineup.Bench.Count}.");
        else
        {
            var primary = payload.Lineup.Bench.Take(7).Select(x => x.Id).Where(x => x > 0).ToArray();
            var backup = payload.Lineup.Bench.Skip(7).Select(x => x.Id).Where(x => x > 0).ToArray();
            if (primary.Length != 7)
                errors.Add($"CHPP primary bench içinde tam 7 oyuncu olmalı; bulunan: {primary.Length}.");
            if (primary.Distinct().Count() != primary.Length)
                errors.Add("CHPP primary bench içinde duplicate oyuncu var.");
            if (backup.Length != 0)
                errors.Add("WRITE-03 ilk sürümünde backup bench boş kalmalı.");

            var starters = payload.Lineup.Positions.Select(x => x.Id).Where(x => x > 0).ToHashSet();
            if (primary.Any(starters.Contains))
                errors.Add("Bench oyuncusu ilk 11 ile aynı olamaz.");
        }

        if (payload.Lineup.Kickers.Count != 11)
            errors.Add($"CHPP kickers dizisi tam olarak 11 slot olmalı; bulunan: {payload.Lineup.Kickers.Count}.");
        if (payload.Lineup.Substitutions.Count != 0)
            errors.Add("WRITE-03 ilk sürümünde substitution emirleri gönderilmemeli.");

        // Captain, set pieces and automatic substitutions are intentionally out of scope for v1.
        if (target.TeamId <= 0 || (target.HomeTeamId != target.TeamId && target.AwayTeamId != target.TeamId))
            errors.Add("Hedef maç kullanıcının bağlı olduğu takımın maçı değil.");

        if (teamPlayerIds is not null)
        {
            var roster = teamPlayerIds.Where(x => x > 0).ToHashSet();
            var sentIds = payload.Lineup.Positions.Concat(payload.Lineup.Bench)
                .Select(x => x.Id).Where(x => x > 0).Distinct();
            var outsiders = sentIds.Where(id => !roster.Contains(id)).ToArray();
            if (outsiders.Length > 0)
                errors.Add("Takım kadrosunda olmayan oyuncu ID'si kullanıldı: " + string.Join(", ", outsiders));
        }

        return errors;
    }

    public static void EnsureValid(
        ChppMatchOrderPayload payload,
        ChppUpcomingMatchSnapshot target,
        IEnumerable<int>? teamPlayerIds = null,
        DateTimeOffset? now = null,
        TimeSpan? minimumLeadTime = null)
    {
        var errors = Validate(payload, target, teamPlayerIds, now, minimumLeadTime);
        if (errors.Count > 0)
            throw new InvalidOperationException("CHPP match order doğrulaması başarısız: " + string.Join(" | ", errors));
    }
}
