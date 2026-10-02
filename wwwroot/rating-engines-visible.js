(function () {
  'use strict';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>\"']/g, function (m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]); }); }
  function fmt(v) { return v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(2).replace(/\.00$/, ''); }
  function ensurePanel() {
    var own = document.getElementById('ownPitch');
    if (!own) return null;
    var card = own.closest('.lineup-card');
    if (!card) return null;
    var panel = document.getElementById('ratingEnginePanel');
    if (panel) { panel.style.display = 'block'; return panel; }
    panel = document.createElement('section');
    panel.id = 'ratingEnginePanel';
    panel.className = 'panel';
    panel.style.cssText = 'margin-bottom:14px;overflow:hidden;background:#fff;border-radius:15px;box-shadow:0 2px 9px #0002;display:block';
    panel.innerHTML = '<div style="padding:14px 18px;border-bottom:1px solid #edf1ee"><div style="font-size:10px;font-weight:900;letter-spacing:.07em;color:#7c837f">RATING ENGINE</div><div style="font-size:20px;font-weight:800;margin-top:3px">Önerilen kadronun motor karşılaştırması</div><div id="ratingEngineSummary" style="font-size:11px;color:#6f7772;margin-top:6px">Analiz sonrası motor sonuçları getiriliyor…</div></div><div style="padding:13px 15px;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:11px;min-width:760px"><thead><tr style="text-align:center;background:#f5f8f5"><th style="padding:8px;text-align:left">Motor</th><th>DEF-L</th><th>DEF-C</th><th>DEF-R</th><th>MID</th><th>ATT-L</th><th>ATT-C</th><th>ATT-R</th><th>HatStats</th><th>Loddar</th></tr></thead><tbody id="ratingEngineRows"><tr><td colspan="10" style="padding:12px;text-align:center;color:#7a827d">Analiz sonrası bekleniyor…</td></tr></tbody></table></div>';
    card.insertAdjacentElement('afterend', panel);
    return panel;
  }
  function render(data) {
    var panel = ensurePanel();
    if (!panel || !data) return;
    var selected = data.selected || 'V5';
    var rows = Array.isArray(data.rows) ? data.rows : [];
    var selectedRow = rows.find(function (r) { return r.engine === selected; });
    var summary = panel.querySelector('#ratingEngineSummary');
    var body = panel.querySelector('#ratingEngineRows');
    if (summary) summary.textContent = (selectedRow ? selectedRow.name : selected) + " ile analiz edildi • aynı önerilen XI tüm motorlarla karşılaştırıldı.";
    if (!body) return;
    body.innerHTML = rows.map(function (r) {
      var active = r.engine === selected;
      var rating = r.rating || {};
      return '<tr style="border-top:1px solid #edf1ee;background:' + (active ? '#eef7f0' : '#fff') + '">' +
        '<td style="padding:8px;font-weight:900">' + esc(r.name) + (active ? ' <span style="font-size:9px;color:#176638">(SEÇİLİ)</span>' : '') + '</td>' +
        '<td style="text-align:center">' + fmt(rating.leftDefence) + '</td><td style="text-align:center">' + fmt(rating.centralDefence) + '</td><td style="text-align:center">' + fmt(rating.rightDefence) + '</td>' +
        '<td style="text-align:center">' + fmt(rating.midfield) + '</td><td style="text-align:center">' + fmt(rating.leftAttack) + '</td><td style="text-align:center">' + fmt(rating.centralAttack) + '</td><td style="text-align:center">' + fmt(rating.rightAttack) + '</td>' +
        '<td style="text-align:center">' + fmt(r.hatStats) + '</td><td style="text-align:center">' + fmt(r.loddarStats) + '</td></tr>';
    }).join('');
  }
  async function poll() {
    var panel = ensurePanel();
    if (!panel) return;
    try {
      var response = await fetch('/api/v5/rating-engines/compare?ts=' + Date.now(), { cache:'no-store', credentials:'same-origin' });
      var text = await response.text();
      var data = text ? JSON.parse(text) : {};
      if (!response.ok) {
        var s = panel.querySelector('#ratingEngineSummary');
        if (s) s.textContent = data.message || ('Motor karşılaştırması bekleniyor (HTTP ' + response.status + ')');
        return;
      }
      render(data);
    } catch (e) {
      var s2 = panel.querySelector('#ratingEngineSummary');
      if (s2) s2.textContent = 'Motor karşılaştırması bekleniyor…';
    }
  }
  function boot() {
    ensurePanel();
    poll();
    setInterval(poll, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); }, { once:true });
  else setTimeout(boot, 300);
})();
