using System.Globalization;
using System.Xml.Linq;

namespace HattrickAI.V5.Core;

/// <summary>
/// Lightweight CHPP snapshot used by the DEV team/player JSON button.
/// Unlike OfflineExportService this reads only teamdetails + own players.
/// </summary>
public sealed class TeamPlayerChppExportService
{
    private readonly ChppV5 _chpp;

    public TeamPlayerChppExportService(ChppV5 chpp) => _chpp = chpp;

    public async Task<object> ExportAsync(string build, CancellationToken ct)
    {
        if (!_chpp.Connected)
            throw new UnauthorizedAccessException("CHPP bağlantısı yok.");

        var teamXml = await _chpp.GetXmlAsync("teamdetails", new Dictionary<string, string?>
        {
            ["version"] = "3.0"
        }, ct);
        var team = XmlV5.Root(teamXml)?.Descendants("Team").FirstOrDefault();
        var teamId = XmlV5.Int(team, "TeamID");
        if (teamId <= 0)
            throw new InvalidOperationException("CHPP teamdetails içinde takım ID bulunamadı.");

        var playersXml = await _chpp.GetXmlAsync("players", new Dictionary<string, string?>
        {
            ["version"] = "1.3",
            ["teamId"] = teamId.ToString(CultureInfo.InvariantCulture)
        }, ct);

        // IMPORTANT: "Trainer/PlayerID" is not a valid XML element name. Passing
        // that path to XElement.Element() makes .NET throw the exact 502 seen in
        // production: "The '/' character ... cannot be included in a name."
        // Reuse the existing safe team-details traversal used by AnalysisService.
        var trainerId = ChppRosterFilter.ReadTrainerId(team);
        var players = XmlV5.Root(playersXml)?.Descendants("Player")
            .Select(ParsePlayer)
            .Where(p => p.Id > 0 && p.Id != trainerId)
            .OrderBy(p => p.Id)
            .ToList() ?? [];

        return new
        {
            schema = "hattrickai-v5-team-player-chpp-v1",
            exportedAt = DateTimeOffset.UtcNow,
            source = "CHPP",
            security = new
            {
                credentialsIncluded = false,
                oauthTokensIncluded = false,
                sessionCookiesIncluded = false,
                rawChppXmlIncluded = false
            },
            team = new
            {
                teamId,
                teamName = XmlV5.Text(team, "TeamName"),
                playerCount = players.Count
            },
            players,
            sourceSnapshot = new
            {
                build,
                playerSource = "CHPP players v1.3",
                trainerExcluded = trainerId > 0
            }
        };
    }

    private static Player ParsePlayer(XElement p) => new(
        XmlV5.Int(p, "PlayerID"),
        XmlV5.Text(p, "PlayerName"),
        XmlV5.Int(p, "KeeperSkill"),
        XmlV5.Int(p, "DefenderSkill"),
        XmlV5.Int(p, "PlaymakerSkill"),
        XmlV5.Int(p, "PassingSkill"),
        XmlV5.Int(p, "WingerSkill"),
        XmlV5.Int(p, "ScorerSkill"),
        XmlV5.Int(p, "StaminaSkill"),
        XmlV5.Int(p, "PlayerForm"),
        XmlV5.Int(p, "Experience"),
        XmlV5.Int(p, "Loyalty"),
        XmlV5.Int(p, "InjuryLevel"),
        ParseSpecialty(XmlV5.Text(p, "Specialty")),
        XmlV5.Int(p, "SetPiecesSkill"));

    private static PlayerSpecialty ParseSpecialty(string value)
        => Enum.TryParse<PlayerSpecialty>(value, true, out var specialty) ? specialty : PlayerSpecialty.None;
}
