namespace HattrickAI.V5.Core;

public enum PlayerSpecialty { None=0, Technical=1, Quick=2, Powerful=3, Unpredictable=4, Head=5 }
public enum PlayerOrder { Normal=0, Defensive=1, Offensive=2, TowardsMiddle=3, TowardsWing=4 }
public enum TeamTactic { Normal=0, Pressing=1, CounterAttack=2, AttackMiddle=3, AttackWings=4, Creative=7, LongShots=8 }
public enum TeamAttitude { PlayItCool=-1, Normal=0, MatchOfTheSeason=1 }

public sealed record Player(
    int Id,
    string Name,
    int Keeper,
    int Defending,
    int Playmaking,
    int Passing,
    int Winger,
    int Scoring,
    int Stamina,
    int Form,
    int Experience,
    int Loyalty=0,
    int InjuryLevel=-1,
    PlayerSpecialty Specialty=PlayerSpecialty.None,
    int SetPiecesSkill=0);

public sealed record Slot(
    string Code,
    string Label,
    string Description,
    string? PlayerName,
    int PlayerId,
    double Rating,
    double X,
    double Y,
    PlayerOrder Order=PlayerOrder.Normal,
    double? HistoricalStars=null);

public sealed record Lineup(string TeamName, string Formation, IReadOnlyList<Slot> Slots);
