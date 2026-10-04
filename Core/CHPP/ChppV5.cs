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
    private const string AccessTokenKey = "v6.access";
    private const string AccessSecretKey = "v6.accessSecret";
    private readonly HttpClient _http;
    private readonly Credentials _credentials;
    private readonly IHttpContextAccessor _context;

    public ChppV5(Credentials credentials, IHttpContextAccessor context)
    {
        _credentials = credentials;
        _context = context;
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

    public async Task<string> StartAsync(string callback, CancellationToken ct)
    {
        var oauth = CreateOAuth(callback, null, null);
        var signed = Sign("GET", RequestTokenUrl, oauth, null, null);
        using var request = CreateRequest(HttpMethod.Get, AddQuery(RequestTokenUrl, oauth, signed.Signature), null);
        using var response = await _http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"CHPP request token alınamadı: {body}");
        var values = ParseForm(body);
        if (!values.TryGetValue("oauth_token", out var token) || !values.TryGetValue("oauth_token_secret", out var secret))
            throw new InvalidOperationException($"CHPP request token yanıtı beklenen formatta değil: {body}");
        Session.SetString("v6.request", token);
        Session.SetString("v6.requestSecret", secret);
        return AuthorizeUrl + "?oauth_token=" + Encode(token);
    }

    public async Task CompleteAsync(string oauthToken, string verifier, CancellationToken ct)
    {
        Session.SetString("v6.request", oauthToken.Trim());
        var token = Session.GetString("v6.request");
        var secret = Session.GetString("v6.requestSecret");
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(secret))
            throw new InvalidOperationException("CHPP yetkilendirme oturumu bulunamadı.");
        verifier = verifier.Trim().Replace("#_=_", string.Empty, StringComparison.Ordinal);
        var oauth = CreateOAuth(null, token, verifier);
        var signed = Sign("GET", AccessTokenUrl, oauth, secret, null);
        using var request = CreateRequest(HttpMethod.Get, AddQuery(AccessTokenUrl, oauth, signed.Signature), null);
        using var response = await _http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"CHPP access token alınamadı: {body}");
        var values = ParseForm(body);
        if (!values.TryGetValue("oauth_token", out var access) || !values.TryGetValue("oauth_token_secret", out var accessSecret))
            throw new InvalidOperationException($"CHPP access token yanıtı beklenen formatta değil: {body}");
        Session.SetString(AccessTokenKey, access);
        Session.SetString(AccessSecretKey, accessSecret);
        Session.Remove("v6.request");
        Session.Remove("v6.requestSecret");
    }

    public void Disconnect()
    {
        Session.Remove(AccessTokenKey);
        Session.Remove(AccessSecretKey);
        Session.Remove("v6.request");
        Session.Remove("v6.requestSecret");
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
        var header = oauth.Select(p => Encode(p.Key) + "="" + Encode(p.Value) + """).ToList();
        header.Add("oauth_signature="" + Encode(signature) + """);
        return (signature, "OAuth " + string.Join(", ", header));
    }

    private static string AddQuery(string url, IDictionary<string,string> values, string signature)
        => url + "?" + string.Join("&", values.Select(x => Encode(x.Key) + "=" + Encode(x.Value)).Append("oauth_signature=" + Encode(signature)));

    private static Dictionary<string,string> ParseForm(string value)
        => value.Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(x => x.Split('=', 2)).Where(x => x.Length == 2)
            .ToDictionary(x => DecodeForm(x[0]), x => DecodeForm(x[1]));

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
