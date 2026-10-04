using System.Text.Json;
using System.Text.Json.Serialization;
using HattrickAI.V5.Core;

const string EmbeddedConsumerKey = "4CzYYAnSg7SSHkQyDVMLIV";

var builder = WebApplication.CreateBuilder(args);
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    o.SerializerOptions.NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals;
});
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<ChppDebugLog>();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(o =>
{
    o.Cookie.Name = "hattrickai.v6";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Lax;
    o.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    o.IdleTimeout = TimeSpan.FromHours(8);
});
builder.Services.AddScoped<ChppV5>(sp =>
{
    var key = builder.Configuration["CHPP_CONSUMER_KEY"]?.Trim();
    if (string.IsNullOrWhiteSpace(key)) key = EmbeddedConsumerKey;
    var secret = builder.Configuration["CHPP_CONSUMER_SECRET"]?.Trim() ?? string.Empty;
    return new ChppV5(new Credentials(key, secret), sp.GetRequiredService<IHttpContextAccessor>(), sp.GetRequiredService<ChppDebugLog>());
});

var app = builder.Build();
var port = int.TryParse(Environment.GetEnvironmentVariable("PORT"), out var p) ? p : 10000;
app.Urls.Add($"http://0.0.0.0:{port}");
app.UseSession();
app.UseDefaultFiles();
app.UseStaticFiles();

var build = Environment.GetEnvironmentVariable("V6_BUILD")
    ?? Environment.GetEnvironmentVariable("BUILD_SHA")
    ?? Environment.GetEnvironmentVariable("GITHUB_SHA")
    ?? "dev";
if (build.Length > 7) build = build[..7];

app.MapGet("/hattrick", () => Results.Redirect("/hattrick.html"));
app.MapGet("/chpp-logs", () => Results.Redirect("/chpp-logs.html"));
app.MapGet("/api/chpp/logs", (ChppDebugLog log) => Results.Ok(new { entries = log.GetRecent(300) }));
app.MapPost("/api/chpp/logs/clear", (ChppDebugLog log) => { log.Clear(); return Results.Ok(new { ok = true }); });
app.MapGet("/health", () => Results.Ok(new { ok = true, service = "HattrickAI V6", build }));
app.MapGet("/api/v5/build", () => Results.Ok(new { build }));
app.MapGet("/api/v5/status", (ChppV5 chpp) => Results.Ok(new
{
    connected = chpp.Connected,
    configured = !string.IsNullOrWhiteSpace(builder.Configuration["CHPP_CONSUMER_SECRET"]),
    canSetMatchOrder = chpp.CanSetMatchOrder
}));

app.MapGet("/auth/chpp/start", async (HttpContext http, ChppV5 chpp, ChppDebugLog log, CancellationToken ct) =>
{
    log.Info("00-ROUTE", $"/auth/chpp/start çağrıldı. Host={http.Request.Host}");
    try
    {
        if (string.IsNullOrWhiteSpace(builder.Configuration["CHPP_CONSUMER_SECRET"]))
            return Results.Redirect("/hattrick?error=" + Uri.EscapeDataString("CHPP_CONSUMER_SECRET tanımlı değil."));
        var proto = http.Request.Headers["X-Forwarded-Proto"].FirstOrDefault() ?? http.Request.Scheme;
        var callback = $"{proto}://{http.Request.Host}/auth/chpp/callback";
        var url = await chpp.StartAsync(callback, ct);
        log.Info("06-REDIRECT", "CHPP authorize URL üretildi; Hattrick'e yönlendiriliyor.");
        return Results.Redirect(url);
    }
    catch (Exception ex)
    {
        log.Error("ERROR", ex.ToString());
        return Results.Redirect("/hattrick?error=" + Uri.EscapeDataString(ex.Message));
    }
});

app.MapGet("/auth/chpp/callback", async (HttpContext http, ChppV5 chpp, ChppDebugLog log, string? oauth_token, string? oauth_verifier, CancellationToken ct) =>
{
    log.Info("07-CALLBACK", $"Callback route: token={(string.IsNullOrWhiteSpace(oauth_token) ? "YOK" : "VAR")}, verifier={(string.IsNullOrWhiteSpace(oauth_verifier) ? "YOK" : "VAR")}");
    try
    {
        if (string.IsNullOrWhiteSpace(oauth_token) || string.IsNullOrWhiteSpace(oauth_verifier))
            return Results.Redirect("/hattrick?error=" + Uri.EscapeDataString("CHPP callback eksik parametre ile geldi."));
        await chpp.CompleteAsync(oauth_token, oauth_verifier, ct);
        return Results.Redirect("/hattrick");
    }
    catch (Exception ex)
    {
        log.Error("ERROR", ex.ToString());
        return Results.Redirect("/hattrick?error=" + Uri.EscapeDataString(ex.Message));
    }
});

app.MapPost("/auth/chpp/logout", (ChppV5 chpp) =>
{
    chpp.Disconnect();
    return Results.Ok(new { ok = true });
});

app.Run();
