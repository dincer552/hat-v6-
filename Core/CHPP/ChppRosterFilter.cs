namespace HattrickAI.V5.Core;

/// <summary>
/// CHPP kadro verisindeki teknik direktörü oyuncu havuzundan ayırır.
/// Hattrick teamdetails içindeki Trainer/PlayerID gerçek oyuncu listesindeki aynı ID ile eşleşebilir;
/// bu nedenle filtre analiz motoruna girmeden önce uygulanır.
/// </summary>
public static class ChppRosterFilter
{
    public static int ReadTrainerId(System.Xml.Linq.XElement? teamNode)
        => XmlV5.Int(teamNode?.Element("Trainer"), "PlayerID");

    public static List<Player> ExcludeTrainer(IEnumerable<Player> players, int trainerId)
    {
        ArgumentNullException.ThrowIfNull(players);
        return trainerId > 0
            ? players.Where(p => p.Id > 0 && p.Id != trainerId).ToList()
            : players.Where(p => p.Id > 0).ToList();
    }
}
