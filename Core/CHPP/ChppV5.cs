using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using Microsoft.AspNetCore.Http;

namespace HattrickAI.V5.Core;

public sealed record Credentials(string Key, string Secret);

public sealed class ChppV5
{
    private const string RequestTokenUrl = "https://chpp.hattrick.org/oauth/request_token.ashx";
    private const string AuthorizeUrl = "https://chpp.hattrick.org/oauth/authorize.aspx";
    private const string AccessTokenUrl = "https://chpp.hattrick.org/oauth/access_token.ashx";
    private const string UserAgent = "HattrickAI V6";
    private const string RequestedScopes = "set_matchorder,manage_youthplayers";
    private const string GrantedScopesSessionKey = "v6.scopes";
    private const string SupporterSessionKey = "v6.isSupporter";
    private const string ApiUrl = "https://chpp.hattrick.org/chppxml.ashx";
    private const string AccessTokenKey = "v6.access";
    private const string AccessSecretKey = "v6.accessSecret";
    private readonly HttpClient _http;
    private readonly Credentials _credentials;
    private readonly IHttpContextAccessor _context;
    private readonly ChppDebugLog _log;
    private static readonly ConcurrentDictionary<string, (string Secret, DateTimeOffset Expires)> OAuthRequestSecrets = new(StringComparer.Ordinal);

    public ChppV5(Credentials credentials, IHttpContextAccessor context, ChppDebugLog log)
    {
        _credentials = credentials;
        _context = context;
        _log = log;
        _http = new HttpClient(new HttpClientHandler
        {
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate,
            AllowAutoRedirect = false,
            UseCookies = false
        })
        { Timeout = TimeSpan.FromSeconds(30), DefaultRequestVersion = new Version(1, 1), DefaultVersionPolicy = HttpVersionPolicy.RequestVersionExact };
    }

    private ISession Session => _context.HttpContext?.Session ?? throw new InvalidOperationException("HTTP oturumu bulunamadı.");
    private string? AccessToken => Session.GetString(AccessTokenKey);
    private string? AccessSecret => Session.GetString(AccessSecretKey);
    public bool Connected => !string.IsNullOrWhiteSpace(AccessToken) && !string.IsNullOrWhiteSpace(AccessSecret);
    public IReadOnlySet<string> GrantedScopes => ParseScopes(Session.GetString(GrantedScopesSessionKey));
    public bool IsSupporter => string.Equals(Session.GetString(SupporterSessionKey), "1", StringComparison.OrdinalIgnoreCase);
    public bool CanSetMatchOrder => GrantedScopes.Contains("set_matchorder") && IsSupporter;

    public async Task<string> StartAsync(string callback, CancellationToken ct)
    {
        _log.Info("01-START", $"CHPP bağlantı başlatıldı. Callback={callback}");
        var oauth = CreateOAuth(callback, null, null);
        _log.Info("02-REQUEST", "Request token imzası hazırlandı; CHPP request_token gönderiliyor.");
        var signed = Sign("GET", RequestTokenUrl, oauth, null, null);
        using var request = CreateRequest(HttpMethod.Get, AddQuery(RequestTokenUrl, oauth, signed.Signature), null);
        using var response = await _http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        _log.Info("03-RESPONSE", $"Request token yanıtı: HTTP {(int)response.StatusCode} {response.StatusCode}. Body={body}");
        if (!response.IsSuccessStatusCode)
        {
            var oauth2 = CreateOAuth(callback, null, null);
            var signed2 = Sign("GET", RequestTokenUrl, oauth2, null, null);
            using var fallback = CreateRequest(HttpMethod.Get, RequestTokenUrl, signed2.AuthorizationHeader);
            using var response2 = await _http.SendAsync(fallback, ct);
            var body2 = await response2.Content.ReadAsStringAsync(ct);
            if (!response2.IsSuccessStatusCode)
            {
                _log.Error("04-FALLBACK", $"Authorization-header fallback da başarısız: HTTP {(int)response2.StatusCode}. Body={body2}");
                throw new HttpRequestException($"CHPP request token alınamadı. İlk yanıt: {body} İkinci yanıt: {body2}");
            }
            _log.Info("04-FALLBACK", $"Authorization-header fallback başarılı: HTTP {(int)response2.StatusCode}.");
            body = body2;
        }
        var values = ParseForm(body);
        if (!values.TryGetValue("oauth_token", out var token) || !values.TryGetValue("oauth_token_secret", out var secret))
        {
            _log.Error("05-REQUEST-TOKEN", "Request token yanıtında oauth_token veya oauth_token_secret bulunamadı.");
            throw new InvalidOperationException($"CHPP request token yanıtı beklenen formatta değil: {body}");
        }
        _log.Info("05-REQUEST-TOKEN", "oauth_token + oauth_token_secret başarıyla alındı.");
        Session.SetString("v6.request", token);
        Session.SetString("v6.requestSecret", secret);
        OAuthRequestSecrets[token] = (secret, DateTimeOffset.UtcNow.AddMinutes(15));
        Session.SetString("v6.requestedScopes", RequestedScopes);
        _log.Info("05-SESSION", "Request token ve request secret session'a kaydedildi; scope hazırlandı.");
        Session.Remove(GrantedScopesSessionKey);
        Session.Remove(SupporterSessionKey);
        var authorizeUrl = AuthorizeUrl + "?oauth_token=" + Encode(token) + "&scope=" + Encode(RequestedScopes);
        _log.Info("06-AUTHORIZE", "Hattrick yetkilendirme sayfasına yönlendirme hazırlanıyor.");
        return authorizeUrl;
    }

    public async Task CompleteAsync(string oauthToken, string verifier, CancellationToken ct)
    {
        _log.Info("07-CALLBACK", "CHPP callback alındı; access token aşaması başlıyor.");
        Session.SetString("v6.request", oauthToken.Trim());
        var token = oauthToken.Trim();
        var secret = Session.GetString("v6.requestSecret");
        if (string.IsNullOrWhiteSpace(secret))
        {
            if (OAuthRequestSecrets.TryGetValue(token, out var cached) && cached.Expires > DateTimeOffset.UtcNow)
                secret = cached.Secret;
            if (!string.IsNullOrWhiteSpace(secret))
                _log.Info("08-SESSION", "Request secret session'da yoktu; OAuth kısa süreli cache'den geri alındı.");
        }
        if (string.IsNullOrWhiteSpace(secret))
        {
            _log.Error("08-SESSION", "Callback geldi ancak request token secret session/cache içinde bulunamadı.");
            throw new InvalidOperationException("CHPP yetkilendirme oturumu bulunamadı.");
        }
        _log.Info("08-SESSION", "Request token + secret hazır; verifier ile access token isteniyor.");
        verifier = verifier.Trim().Replace("#_=_", string.Empty, StringComparison.Ordinal);
        var oauth = CreateOAuth(null, token, verifier);
        var signed = Sign("GET", AccessTokenUrl, oauth, secret, null);
        using var request = CreateRequest(HttpMethod.Get, AddQuery(AccessTokenUrl, oauth, signed.Signature), null);
        using var response = await _http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        _log.Info("09-ACCESS", $"Access token yanıtı: HTTP {(int)response.StatusCode} {response.StatusCode}. Body={body}");
        if (!response.IsSuccessStatusCode)
        {
            var oauth2 = CreateOAuth(null, token, verifier);
            var signed2 = Sign("GET", AccessTokenUrl, oauth2, secret, null);
            using var fallback = CreateRequest(HttpMethod.Get, AccessTokenUrl, signed2.AuthorizationHeader);
            using var response2 = await _http.SendAsync(fallback, ct);
            var body2 = await response2.Content.ReadAsStringAsync(ct);
            if (!response2.IsSuccessStatusCode)
            {
                _log.Error("10-FALLBACK", $"Access-token Authorization-header fallback başarısız: HTTP {(int)response2.StatusCode}. Body={body2}");
                throw new HttpRequestException($"CHPP access token alınamadı. İlk yanıt: {body} İkinci yanıt: {body2}");
            }
            _log.Info("10-FALLBACK", $"Access-token fallback başarılı: HTTP {(int)response2.StatusCode}.");
            body = body2;
        }
        var values = ParseForm(body);
        if (!values.TryGetValue("oauth_token", out var access) || !values.TryGetValue("oauth_token_secret", out var accessSecret))
        {
            _log.Error("11-ACCESS-TOKEN", "Access token yanıtında oauth_token veya oauth_token_secret bulunamadı.");
            throw new InvalidOperationException($"CHPP access token yanıtı beklenen formatta değil: {body}");
        }
        _log.Info("11-ACCESS-TOKEN", "access_token + access_token_secret başarıyla alındı.");
        Session.SetString(AccessTokenKey, access);
        Session.SetString(AccessSecretKey, accessSecret);
        var returnedScopes = values.TryGetValue("scope", out var scope) ? scope : string.Empty;
        Session.SetString(GrantedScopesSessionKey, returnedScopes);
        _log.Info("11-SESSION", $"Access token session'a kaydedildi. Granted scopes={returnedScopes}");
        _log.Info("12-TEAMDETAILS", "teamdetails v3.0 çağrılıyor; supporter durumu doğrulanacak.");
        var supporterXml = await GetXmlAsync("teamdetails", new Dictionary<string,string?> { ["version"] = "3.0" }, ct);
        var supporterRoot = XmlV5.Root(supporterXml);
        var supporterText = XmlV5.Text(supporterRoot, "UserIsSupporter");
        if (string.IsNullOrWhiteSpace(supporterText)) supporterText = XmlV5.Text(supporterRoot?.Descendants("User").FirstOrDefault(), "HasSupporter");
        Session.SetString(SupporterSessionKey, IsTruthy(supporterText) ? "1" : "0");
        _log.Info("13-SUPPORTER", $"Supporter doğrulandı: {supporterText}; CanSetMatchOrder={CanSetMatchOrder}");
        Session.Remove("v6.request");
        Session.Remove("v6.requestSecret");
        Session.Remove("v6.requestedScopes");
        OAuthRequestSecrets.TryRemove(token, out _);
        _log.Info("14-COMPLETE", "CHPP bağlantı bilgileri session'a kaydedildi; OAuth bağlantısı tamamlandı.");
    }

    public void Disconnect()
    {
        _log.Info("LOGOUT", "CHPP session bağlantısı temizleniyor.");
        Session.Remove(AccessTokenKey);
        Session.Remove(AccessSecretKey);
        Session.Remove("v6.request");
        Session.Remove("v6.requestSecret");
        Session.Remove(GrantedScopesSessionKey);
        Session.Remove("v6.requestedScopes");
        Session.Remove(SupporterSessionKey);
    }

    public async Task<string> GetXmlAsync(string file, IDictionary<string,string?> parameters, CancellationToken ct)
    {
        if (!Connected) throw new InvalidOperationException("CHPP bağlantısı yok.");
        var query = new List<KeyValuePair<string,string>> { new("file", file) };
        query.AddRange(parameters.Where(p => !string.IsNullOrWhiteSpace(p.Value)).Select(p => new KeyValuePair<string,string>(p.Key, p.Value!)));
        var requestUrl = ApiUrl + "?" + string.Join("&", query.Select(p => Encode(p.Key) + "=" + Encode(p.Value)));
        _log.Info("API", $"CHPP XML çağrısı: file={file}");
        var oauth = CreateOAuth(null, AccessToken!, null);
        var all = query.Concat(oauth.Select(p => new KeyValuePair<string,string>(p.Key, p.Value))).ToList();
        var signed = Sign("GET", ApiUrl, oauth, AccessSecret, all);
        using var request = CreateRequest(HttpMethod.Get, requestUrl, signed.AuthorizationHeader);
        using var response = await _http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        _log.Info("12-TEAMDETAILS", $"CHPP XML yanıtı: HTTP {(int)response.StatusCode} {response.StatusCode}; file={file}");
        if (!response.IsSuccessStatusCode)
        {
            _log.Error("12-TEAMDETAILS", $"teamdetails başarısız. Body={body}");
            throw new HttpRequestException($"CHPP XML isteği başarısız ({(int)response.StatusCode}): {body}");
        }
        _log.Info("12-TEAMDETAILS", "teamdetails XML başarıyla alındı.");
        return body;
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string url, string? authorization)
    {
        var request = new HttpRequestMessage(method, url);
        if (!string.IsNullOrWhiteSpace(authorization))
            request.Headers.TryAddWithoutValidation("Authorization", authorization);
        request.Headers.TryAddWithoutValidation("User-Agent", UserAgent);
        request.Headers.TryAddWithoutValidation("Accept-Language", "en");
        request.Headers.TryAddWithoutValidation("Accept", "application/x-www-form-urlencoded, application/xml, text/xml, */*");
        return request;
    }

    private Dictionary<string,string> CreateOAuth(string? callback, string? token, string? verifier)
    {
        var d = new Dictionary<string,string>(StringComparer.Ordinal)
        {
            ["oauth_timestamp"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture),
            ["oauth_nonce"] = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant(),
            ["oauth_consumer_key"] = _credentials.Key,
            ["oauth_signature_method"] = "HMAC-SHA1",
            ["oauth_version"] = "1.0"
        };
        if (!string.IsNullOrWhiteSpace(callback)) d["oauth_callback"] = callback;
        if (!string.IsNullOrWhiteSpace(token)) d["oauth_token"] = token;
        if (!string.IsNullOrWhiteSpace(verifier)) d["oauth_verifier"] = verifier;
        return d;
    }

    private (string Signature, string AuthorizationHeader) Sign(string method, string baseUrl, IDictionary<string,string> oauth, string? tokenSecret, IEnumerable<KeyValuePair<string,string>>? all)
    {
        var values = (all ?? oauth.Select(x => new KeyValuePair<string,string>(x.Key, x.Value)))
            .Select(p => new KeyValuePair<string,string>(Encode(p.Key), Encode(p.Value)))
            .OrderBy(p => p.Key, StringComparer.Ordinal).ThenBy(p => p.Value, StringComparer.Ordinal).ToList();
        var normalized = string.Join("&", values.Select(p => p.Key + "=" + p.Value));
        var baseString = method.ToUpperInvariant() + "&" + Encode(baseUrl) + "&" + Encode(normalized);
        var signingKey = Encode(_credentials.Secret) + "&" + Encode(tokenSecret ?? string.Empty);
        using var hmac = new HMACSHA1(Encoding.ASCII.GetBytes(signingKey));
        var signature = Convert.ToBase64String(hmac.ComputeHash(Encoding.ASCII.GetBytes(baseString)));
        var header = oauth.Select(p => Encode(p.Key) + "=\"" + Encode(p.Value) + "\"").ToList();
        header.Add("oauth_signature=\"" + Encode(signature) + "\"");
        return (signature, "OAuth " + string.Join(", ", header));
    }

    private static string AddQuery(string url, IDictionary<string,string> values, string signature)
        => url + "?" + string.Join("&", values.Select(x => Encode(x.Key) + "=" + Encode(x.Value)).Append("oauth_signature=" + Encode(signature)));

    private static Dictionary<string,string> ParseForm(string value)
        => value.Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(x => x.Split('=', 2)).Where(x => x.Length == 2)
            .ToDictionary(x => DecodeForm(x[0]), x => DecodeForm(x[1]));

    private static HashSet<string> ParseScopes(string? value) => (value ?? string.Empty).Split(new[] { ',', ' ', '+' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet(StringComparer.OrdinalIgnoreCase);
    private static bool IsTruthy(string? value) => string.Equals(value?.Trim(), "1", StringComparison.OrdinalIgnoreCase) || string.Equals(value?.Trim(), "true", StringComparison.OrdinalIgnoreCase);
    private static string DecodeForm(string value) => Uri.UnescapeDataString(value.Replace("+", " ", StringComparison.Ordinal));
    private static string Encode(string value) => Uri.EscapeDataString(value);
}

public static class XmlV5
{
    public static XElement? Root(string xml) => XDocument.Parse(xml).Root;
    public static string Text(XElement? e, string name) => e?.Element(name)?.Value?.Trim() ?? e?.Descendants(name).FirstOrDefault()?.Value?.Trim() ?? string.Empty;
    public static int Int(XElement? e, string name) => int.TryParse(Text(e,name), NumberStyles.Integer, CultureInfo.InvariantCulture, out var v) ? v : 0;
    public static double Double(XElement? e, string name) => double.TryParse(Text(e,name), NumberStyles.Float | NumberStyles.AllowThousands, CultureInfo.InvariantCulture, out var v) ? v : 0d;
    public static DateTimeOffset Date(XElement? e, string name) => DateTimeOffset.TryParse(Text(e,name), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var v) ? v : default;
}
