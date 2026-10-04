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
    return new ChppV5(new Credentials(key, secret), sp.GetRequiredService<IHttpContextAccessor>());
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
app.MapGet("/health", () => Results.Ok(new { ok = true, service = "HattrickAI V6", build }));
app.MapGet("/api/v5/build", () => Results.Ok(new { build }));
app.MapGet("/api/v5/status", (ChppV5 chpp) => Results.Ok(new
{
    connected = chpp.Connected,
    configured = !string.IsNullOrWhiteSpace(builder.Configuration["CHPP_CONSUMER_SECRET"]),
    canSetMatchOrder = chpp.CanSetMatchOrder
}));

app.MapGet("/auth/chpp/start", async (HttpContext http, ChppV5 chpp, CancellationToken ct) =>
{
    try
    {
        if (string.IsNullOrWhiteSpace(builder.Configuration["CHPP_CONSUMER_SECRET"]))
            return Results.Redirect("/hattrick?error=" + Uri.EscapeDataString("CHPP_CONSUMER_SECRET tanımlı değil."));
        var proto = http.Request.Headers["X-Forwarded-Proto"].FirstOrDefault() ?? http.Request.Scheme;
        var callback = $"{proto}://{http.Request.Host}/auth/chpp/callback";
        return Results.Redirect(await chpp.StartAsync(callback, ct));
    }
    catch (Exception ex)
    {
        return Results.Redirect("/hattrick?error=" + Uri.EscapeDataString(ex.Message));
    }
});

app.MapGet("/auth/chpp/callback", async (HttpContext http, ChppV5 chpp, string? oauth_token, string? oauth_verifier, CancellationToken ct) =>
{
    try
    {
        if (string.IsNullOrWhiteSpace(oauth_token) || string.IsNullOrWhiteSpace(oauth_verifier))
            return Results.Redirect("/hattrick?error=" + Uri.EscapeDataString("CHPP callback eksik parametre ile geldi."));
        await chpp.CompleteAsync(oauth_token, oauth_verifier, ct);
        return Results.Redirect("/hattrick");
    }
    catch (Exception ex)
    {
        return Results.Redirect("/hattrick?error=" + Uri.EscapeDataString(ex.Message));
    }
});

app.MapPost("/auth/chpp/logout", (ChppV5 chpp) =>
{
    chpp.Disconnect();
    return Results.Ok(new { ok = true });
});

app.Run();
