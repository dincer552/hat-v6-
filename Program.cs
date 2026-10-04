using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using HattrickAI.V5.Core;

const string EmbeddedConsumerKey = "";

var builder = WebApplication.CreateBuilder(args);
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals;
});
builder.Services.AddHttpContextAccessor();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.Cookie.Name = "hattrickai.v5";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.IdleTimeout = TimeSpan.FromHours(8);
});
builder.Services.AddScoped<ChppV5>(sp =>
{
    var configuredKey = builder.Configuration["CHPP_CONSUMER_KEY"];
    var key = string.IsNullOrWhiteSpace(configuredKey) ? EmbeddedConsumerKey : configuredKey.Trim();
    var secret = builder.Configuration["CHPP_CONSUMER_SECRET"]?.Trim() ?? string.Empty;
    return new ChppV5(new Credentials(key, secret), sp.GetRequiredService<IHttpContextAccessor>());
});
builder.Services.AddScoped<AnalysisService>();
builder.Services.AddScoped<ReferenceMatchService>();
builder.Services.AddScoped<ChppMatchOrderReadService>();

var app = builder.Build();
var portText = Environment.GetEnvironmentVariable("PORT");
var port = int.TryParse(portText, out var parsed) ? parsed : 10000;
app.Urls.Add($"http://0.0.0.0:{port}");
app.UseSession();
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapGet("/hattrick", () => Results.Redirect("/hattrick.html"));

var build = Environment.GetEnvironmentVariable("V5_BUILD")
    ?? Environment.GetEnvironmentVariable("BUILD_SHA")
    ?? Environment.GetEnvironmentVariable("GITHUB_SHA")
    ?? "dev";
if (build.Length > 7) build = build[..7];

app.MapGet("/health", () => Results.Ok(new { ok = true, service = "HattrickAI V5", build }));
app.MapGet("/api/v5/build", () => Results.Ok(new { build }));
app.MapGet("/api/v5/status", (ChppV5 chpp) => Results.Ok(new { connected = chpp.Connected, configured = !string.IsNullOrWhiteSpace(builder.Configuration["CHPP_CONSUMER_SECRET"]), canSetMatchOrder = chpp.CanSetMatchOrder }));
app.MapGet("/api/v5/motor-logs", (HttpContext http) =>
{
    var log = MotorRunLogStore.GetLatest(http.Session.Id);
    return log is null ? Results.Ok(new { available = false }) : Results.Ok(new { available = true, log });
});
app.MapGet("/api/v5/motor-database/latest", () =>
    MotorResultArchive.TryGetLatest(out var json)
        ? Results.Text(json, "application/json; charset=utf-8")
        : Results.NotFound(new { available = false, message = "Henüz kaydedilmiş motor JSON snapshot yok." }));
app.MapGet("/api/v5/motor-database/list", () =>
    Results.Ok(new { available = Directory.Exists(MotorResultArchive.RootDirectory), entries = MotorResultArchive.List() }));
app.MapGet("/api/v5/motor-database/{runId}", (string runId) =>
    MotorResultArchive.TryGetByRunId(runId, out var json)
        ? Results.Text(json, "application/json; charset=utf-8")
        : Results.NotFound(new { available = false, message = "İstenen runId için motor JSON snapshot bulunamadı.", runId }));

app.MapPost("/api/v5/questionnaire", (HttpContext http, QuestionnaireRequest request) =>
{
    if (!Enum.TryParse<CoachStyle>(request.CoachStyle, true, out var coach)) return Results.BadRequest(new { message = "Teknik direktör seçimi geçersiz." });
    if (!Enum.TryParse<TeamSpiritLevel>(request.TeamSpirit, true, out var spirit)) return Results.BadRequest(new { message = "Takım ruhu seçimi geçersiz." });
    if (!Enum.TryParse<TeamAttitude>(request.MatchImportance, true, out var attitude)) return Results.BadRequest(new { message = "Maç önemi geçersiz." });
    http.Session.SetString("v5.coach", coach.ToString());
    http.Session.SetString("v5.spirit", spirit.ToString());
    http.Session.SetString("v5.attitude", attitude.ToString());
    return Results.Ok(new { ok = true });
});

app.MapGet("/api/v5/questionnaire", (HttpContext http) =>
{
    var questionnaire = new MatchQuestionnaire(
        Enum.TryParse<CoachStyle>(http.Session.GetString("v5.coach"), true, out var coach) ? coach : CoachStyle.Neutral,
        Enum.TryParse<TeamSpiritLevel>(http.Session.GetString("v5.spirit"), true, out var spirit) ? spirit : TeamSpiritLevel.Composed,
        Enum.TryParse<TeamAttitude>(http.Session.GetString("v5.attitude"), true, out var attitude) ? attitude : TeamAttitude.Normal);
    return Results.Ok(questionnaire);
});

app.MapGet("/api/v5/analysis", async (HttpContext http, AnalysisService service, ChppV5 chpp, CancellationToken ct) =>
{
    if (!chpp.Connected) return Results.Unauthorized();
    var runId = MotorRunLogStore.Start(http.Session.Id);
    try
    {
        using var logScope = MotorRunLogContext.Push(runId);
        MotorRunLogStore.StartMotor(runId, "M3", "CHPP verileri hazırlanıyor");
        var questionnaire = new MatchQuestionnaire(
            Enum.TryParse<CoachStyle>(http.Session.GetString("v5.coach"), true, out var coach) ? coach : CoachStyle.Neutral,
            Enum.TryParse<TeamSpiritLevel>(http.Session.GetString("v5.spirit"), true, out var spirit) ? spirit : TeamSpiritLevel.Composed,
            Enum.TryParse<TeamAttitude>(http.Session.GetString("v5.attitude"), true, out var attitude) ? attitude : TeamAttitude.Normal);
        var result = await service.RunAsync(build, questionnaire, ct);
        MotorRunLogStore.Finish(runId, true, "Analiz tamamlandı");
        var motorLog = MotorRunLogStore.Get(runId);
        MotorResultArchive.Save(runId, result, result.MotorPipeline!, motorLog, build);
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        MotorRunLogStore.Finish(runId, false, ex.Message);
        return Results.Problem(ex.Message, statusCode: 502);
    }
});

// V5_RATING_CALCULATION_JSON_V1: exact per-player regional rating calculation trace.
app.MapGet("/api/v5/rating-calculation-details", (HttpContext http) =>
{
    var session = http.Session;
    var playersJson = session.GetString("v5.rating.players");
    var lineupJson = session.GetString("v5.rating.lineup");
    var contextJson = session.GetString("v5.rating.context");

    if (string.IsNullOrWhiteSpace(playersJson) || string.IsNullOrWhiteSpace(lineupJson) || string.IsNullOrWhiteSpace(contextJson))
        return Results.BadRequest(new { message = "Önce analiz çalıştırılmalı; rating hesaplama oturumu bulunamadı." });

    var selectedEngine = session.GetString("v5.rating.engine")
        ?? session.GetString("v5.rating.selected")
        ?? RatingEngineKind.V5.ToString();
    if (!string.Equals(selectedEngine, RatingEngineKind.V5.ToString(), StringComparison.OrdinalIgnoreCase))
        return Results.Conflict(new { message = $"Hesap JSON dökümü şu anda V5 motoru için kullanılabilir. Seçili motor: {selectedEngine}." });

    try
    {
        var players = JsonSerializer.Deserialize<List<Player>>(playersJson) ?? [];
        var storedLineup = JsonSerializer.Deserialize<StoredLineup>(lineupJson);
        var storedSlots = storedLineup?.Slots ?? Array.Empty<Slot>();
        var validSlots = storedSlots
            .Where(s => s is not null && s.PlayerId > 0 && !string.IsNullOrWhiteSpace(s.Code))
            .ToList();
        var lineup = storedLineup is null
            ? null
            : new Lineup(
                storedLineup.TeamName ?? "Takım",
                storedLineup.Formation ?? string.Empty,
                validSlots);
        var context = JsonSerializer.Deserialize<RatingContext>(contextJson);
        if (lineup is null || context is null || players.Count == 0 || validSlots.Count == 0)
            return Results.BadRequest(new { message = "Kaydedilmiş rating hesaplama verisi eksik." });

        var confidence = int.TryParse(
            session.GetString("v5.rating.confidence"),
            System.Globalization.NumberStyles.Integer,
            System.Globalization.CultureInfo.InvariantCulture,
            out var parsedConfidence)
            ? Math.Clamp(parsedConfidence, 0, 9)
            : 4;

        var trace = new RegionalRatingEngineFixed().CalculateLineupWithTrace(lineup, players, context);
        var attackMultiplier = Math.Clamp(1.0 + (confidence - 4.0) * 0.05, 0.80, 1.25);
        var finalRating = ConfidenceRatingAdjuster.Apply(trace.EngineRatingBeforeConfidence, confidence);
        trace = trace with
        {
            ConfidenceLevel = confidence,
            ConfidenceAttackMultiplier = attackMultiplier,
            FinalRating = finalRating
        };

        var json = JsonSerializer.SerializeToUtf8Bytes(
            trace,
            new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals
            });

        var safeTeam = string.Concat((lineup.TeamName ?? "team").Select(ch => char.IsLetterOrDigit(ch) ? ch : '_'));
        if (string.IsNullOrWhiteSpace(safeTeam)) safeTeam = "team";
        var filename = $"hattrickai-v5-rating-calculation-{safeTeam}-{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss}.json";
        return Results.File(json, "application/json; charset=utf-8", filename);
    }
    catch (JsonException)
    {
        return Results.BadRequest(new { message = "Kaydedilmiş rating hesaplama JSON'u çözümlenemedi." });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message, statusCode: 502);
    }
});

// TEAM_PLAYER_CHPP_JSON_EXPORT_V1: lightweight DEV data collection endpoint.
// Returns a real attachment so mobile browsers can download it without Blob/async gesture issues.
app.MapGet("/api/v5/team-player-export", async (ChppV5 chpp, CancellationToken ct) =>
{
    if (!chpp.Connected) return Results.Unauthorized();
    try
    {
        var data = await new TeamPlayerChppExportService(chpp).ExportAsync(build, ct);
        var bytes = JsonSerializer.SerializeToUtf8Bytes(data, new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
        var filename = $"hattrickai-team-players-{DateTimeOffset.UtcNow:yyyy-MM-ddTHH-mm-ss-fffZ}.json";
        return Results.File(bytes, "application/json", filename);
    }
    catch (UnauthorizedAccessException) { return Results.Unauthorized(); }
    catch (Exception ex) { return Results.Problem(ex.Message, statusCode: 502); }
});

app.MapGet("/api/v5/offline-export", async (HttpContext http, AnalysisService service, ChppV5 chpp, CancellationToken ct) =>
{
    if (!chpp.Connected) return Results.Unauthorized();
    try
    {
        var questionnaire = new MatchQuestionnaire(
            Enum.TryParse<CoachStyle>(http.Session.GetString("v5.coach"), true, out var coach) ? coach : CoachStyle.Neutral,
            Enum.TryParse<TeamSpiritLevel>(http.Session.GetString("v5.spirit"), true, out var spirit) ? spirit : TeamSpiritLevel.Composed,
            Enum.TryParse<TeamAttitude>(http.Session.GetString("v5.attitude"), true, out var attitude) ? attitude : TeamAttitude.Normal);
        var exporter = new OfflineExportService(chpp, service);
        return Results.Ok(await exporter.ExportAsync(build, questionnaire, ct));
    }
    catch (UnauthorizedAccessException) { return Results.Unauthorized(); }
    catch (Exception ex) { return Results.Problem(ex.Message, statusCode: 502); }
});

app.MapGet("/api/v5/reference-match", async (ReferenceMatchService service, ChppV5 chpp, CancellationToken ct) =>
{
    if (!chpp.Connected) return Results.Unauthorized();
    try { return Results.Ok(await service.GetAsync(ct)); }
    catch (Exception ex) { return Results.Problem(ex.Message, statusCode: 502); }
});

app.MapGet("/api/v5/chpp-export/target", async (ChppMatchOrderReadService reader, ChppV5 chpp, CancellationToken ct) =>
{
    if (!chpp.Connected) return Results.Unauthorized();
    try
    {
        var target = await reader.ReadUpcomingAsync(ct);
        return Results.Ok(new
        {
            target.MatchId,
            target.TeamId,
            target.MatchDate,
            target.HomeTeamId,
            target.AwayTeamId,
            target.HomeTeamName,
            target.AwayTeamName,
            target.OrdersSet,
            canWrite = chpp.CanSetMatchOrder,
            writeEnabled = string.Equals(builder.Configuration["CHPP_MATCHORDER_WRITE_ENABLED"], "true", StringComparison.OrdinalIgnoreCase)
        });
    }
    catch (UnauthorizedAccessException ex) { return Results.Unauthorized(); }
    catch (Exception ex) { return Results.Problem(ex.Message, statusCode: 502); }
});

app.MapPost("/api/v5/chpp-export", async (ChppMatchOrderExportRequest request, ChppMatchOrderReadService reader, ChppV5 chpp, CancellationToken ct) =>
{
    if (!chpp.Connected) return Results.Unauthorized();
    if (!string.Equals(builder.Configuration["CHPP_MATCHORDER_WRITE_ENABLED"], "true", StringComparison.OrdinalIgnoreCase))
        return Results.Problem("CHPP match order canlı aktarımı yapılandırma ile kapalı. CHPP_MATCHORDER_WRITE_ENABLED=true olmadan gerçek write yapılmaz.", statusCode: 403);
    if (!chpp.CanSetMatchOrder)
        return Results.Problem("CHPP set_matchorder yetkisi yok.", statusCode: 403);
    try
    {
        if (!Enum.TryParse<TeamTactic>(request.Tactic, true, out var tactic))
            return Results.BadRequest(new { message = $"Desteklenmeyen Hattrick taktiği: {request.Tactic}" });
        if (!Enum.TryParse<TeamAttitude>(request.Attitude, true, out var attitude) || attitude == TeamAttitude.Auto)
            return Results.BadRequest(new { message = "Desteklenmeyen maç tutumu." });
        if (request.Slots is null || request.Slots.Count != 11)
            return Results.BadRequest(new { message = "İlk 11 tam olarak 11 oyuncu içermeli." });
        if (request.Slots.Any(x => x.PlayerId <= 0 || string.IsNullOrWhiteSpace(x.Code)))
            return Results.BadRequest(new { message = "İlk 11 oyuncu/pozisyon verisi geçersiz." });
        var orderValues = request.Slots.Select(x => x.Order).ToArray();
        if (orderValues.Any(x => !Enum.IsDefined(typeof(PlayerOrder), x)))
            return Results.BadRequest(new { message = "Oyuncu davranış kodu geçersiz." });

        var slots = request.Slots.Select(x => new Slot(x.Code, x.Code, string.Empty, null, x.PlayerId, 0, 0, 0, (PlayerOrder)x.Order)).ToList();
        var lineup = new Lineup("CHPP", request.Formation ?? string.Empty, slots);
        var payload = ChppMatchOrderPayloadBuilder.Build(lineup, request.Bench, tactic, attitude);
        var target = await reader.ReadUpcomingAsync(ct);
        var result = await new ChppMatchOrderWriteService(chpp).WriteAndVerifyAsync(payload, target, null, ct);
        if (!result.Verified)
            return Results.Problem(result.Reason, statusCode: 502);
        return Results.Ok(new
        {
            ok = true,
            verified = true,
            result.Write.MatchId,
            result.Write.TeamId,
            result.Write.OrdersSet,
            result.Write.Tactic,
            result.Reason
        });
    }
    catch (UnauthorizedAccessException ex) { return Results.Problem(ex.Message, statusCode: 403); }
    catch (InvalidOperationException ex) { return Results.BadRequest(new { message = ex.Message }); }
    catch (Exception ex) { return Results.Problem(ex.Message, statusCode: 502); }
});

app.MapGet("/auth/chpp/start", async (HttpContext http, ChppV5 chpp, CancellationToken ct) =>
{
    try
    {
        if (string.IsNullOrWhiteSpace(builder.Configuration["CHPP_CONSUMER_SECRET"])) return Results.Redirect("/?error=" + Uri.EscapeDataString("CHPP_CONSUMER_SECRET Azure Environment Variables içinde tanımlı değil."));
        var proto = http.Request.Headers["X-Forwarded-Proto"].FirstOrDefault() ?? http.Request.Scheme;
        var callback = $"{proto}://{http.Request.Host}/auth/chpp/callback";
        return Results.Redirect(await chpp.StartAsync(callback, ct));
    }
    catch (Exception ex) { return Results.Redirect("/?error=" + Uri.EscapeDataString(ex.Message)); }
});

app.MapGet("/auth/chpp/callback", async (ChppV5 chpp, string? oauth_token, string? oauth_verifier, CancellationToken ct) =>
{
    try
    {
        if (string.IsNullOrWhiteSpace(oauth_token) || string.IsNullOrWhiteSpace(oauth_verifier)) return Results.Redirect("/?error=" + Uri.EscapeDataString("CHPP callback eksik parametre ile geldi."));
        await chpp.CompleteAsync(oauth_token, oauth_verifier, ct);
        return Results.Redirect("/");
    }
    catch (Exception ex) { return Results.Redirect("/?error=" + Uri.EscapeDataString(ex.Message)); }
});
app.MapPost("/auth/chpp/logout", (ChppV5 chpp) => { chpp.Disconnect(); return Results.Ok(new { ok = true }); });
RatingEngineWebEndpoints.Map(app);
app.Run();

public sealed record QuestionnaireRequest(string CoachStyle, string TeamSpirit, string MatchImportance);
public sealed record StoredLineup(string TeamName, string Formation, IReadOnlyList<Slot> Slots);