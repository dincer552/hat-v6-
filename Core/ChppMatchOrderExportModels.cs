namespace HattrickAI.V5.Core;

public sealed record ChppMatchOrderExportRequest(
    string Formation,
    string Tactic,
    string Attitude,
    IReadOnlyList<ChppMatchOrderExportSlot> Slots,
    IReadOnlyDictionary<string, int> Bench);

public sealed record ChppMatchOrderExportSlot(
    string Code,
    int PlayerId,
    int Order);
