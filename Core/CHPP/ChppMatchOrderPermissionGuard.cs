namespace HattrickAI.V5.Core;

/// <summary>
/// CHPP-WRITE-05: hard guard for match-order writes.
/// A connected OAuth session is not enough; the granted set_matchorder scope is required.
/// </summary>
public static class ChppMatchOrderPermissionGuard
{
    public const string RequiredScope = "set_matchorder";

    public static void EnsureCanWrite(ChppV5 chpp)
    {
        ArgumentNullException.ThrowIfNull(chpp);
        if (!chpp.Connected)
            throw new UnauthorizedAccessException("CHPP bağlantısı yok; match order aktarımı engellendi.");
        if (!chpp.CanSetMatchOrder)
            throw new UnauthorizedAccessException("CHPP set_matchorder yetkisi yok; match order aktarımı engellendi. Hattrick bağlantısını set_matchorder yetkisiyle yeniden yetkilendirin.");
    }

    public static void EnsureScope(IEnumerable<string> grantedScopes)
    {
        ArgumentNullException.ThrowIfNull(grantedScopes);
        var scopes = grantedScopes.ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (!scopes.Contains(RequiredScope))
            throw new UnauthorizedAccessException("CHPP set_matchorder yetkisi yok; match order aktarımı engellendi.");
    }
}
