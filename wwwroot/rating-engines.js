(function () {
  'use strict';

  const API = { compare: '/api/v5/rating-engines/compare' };
  let comparison = null;

  async function json(url) {
    const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_) { throw new Error('Rating engine yanıtı geçersiz.'); }
    if (!response.ok) {
      const detail = data.detail ? (' • ' + data.detail) : '';
      throw new Error((data.message || data.title || ('HTTP ' + response.status)) + detail);
    }
    return data;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>\"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' })[m];
    });
  }

  function fmt(value) {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    return Number(value).toFixed(2).replace(/\.00$/, '');
  }

  function panel() {
    let el = document.getElementById('ratingEnginePanel');
    if (el) return el;
    const ownLineup = document.getElementById('ownPitch')?.closest('.lineup-card');
    if (!ownLineup) return null;
    el = document.createElement('section');
    el.id = 'ratingEnginePanel';
    el.className = 'panel';
    el.style.cssText = 'margin-bottom:14px;overflow:hidden;background:#fff;border-radius:15px;box-shadow:0 2px 9px #0002;display:block';
    el.innerHTML = '<div style="padding:14px 18px;border-bottom:1px solid #edf1ee"><div style="font-size:10px;font-weight:900;letter-spacing:.07em;color:#7c837f">RATING ENGINE</div><div style="font-size:20px;font-weight:800;margin-top:3px">Önerilen kadronun motor karşılaştırması</div><div id="ratingEngineSummary" style="font-size:11px;color:#6f7772;margin-top:6px">Analiz sonrası motor sonuçları getiriliyor…</div></div><div style="padding:13px 15px"><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:11px;min-width:760px"><thead><tr style="text-align:center;background:#f5f8f5"><th style="padding:8px;text-align:left">Motor</th><th>DEF-L</th><th>DEF-C</th><th>DEF-R</th><th>MID</th><th>ATT-L</th><th>ATT-C</th><th>ATT-R</th><th>HatStats</th><th>Loddar</th></tr></thead><tbody id="ratingEngineRows"><tr><td colspan="10" style="padding:12px;text-align:center;color:#7a827d">Analiz sonrası bekleniyor…</td></tr></tbody></table></div></div>';
    ownLineup.insertAdjacentElement('afterend', el);
    return el;
  }

  function render() {
    const el = panel();
    if (!el || !comparison) return;
    const summary = el.querySelector('#ratingEngineSummary');
    const rows = el.querySelector('#ratingEngineRows');
    const selected = comparison.selected || 'V5';
    const selectedRow = comparison.rows.find(function (row) { return row.engine === selected; });
    if (summary) summary.textContent = (selectedRow ? selectedRow.name : selected) + " ile analiz edildi • aşağıda aynı önerilen XI'nin diğer motor sonuçları gösteriliyor.";
    rows.innerHTML = comparison.rows.map(function (row) {
      const active = row.engine === selected;
      return '<tr style="border-top:1px solid #edf1ee;background:' + (active ? '#eef7f0' : '#fff') + '\">' +
        '<td style="padding:8px;font-weight:900">' + esc(row.name) + (active ? ' <span style="font-size:9px;color:#176638">(SEÇİLİ)</span>' : '') + '</td>' +
        '<td style="text-align:center">' + fmt(row.rating.leftDefence) + '</td>' +
        '<td style="text-align:center">' + fmt(row.rating.centralDefence) + '</td>' +
        '<td style="text-align:center">' + fmt(row.rating.rightDefence) + '</td>' +
        '<td style="text-align:center">' + fmt(row.rating.midfield) + '</td>' +
        '<td style="text-align:center">' + fmt(row.rating.leftAttack) + '</td>' +
        '<td style="text-align:center">' + fmt(row.rating.centralAttack) + '</td>' +
        '<td style="text-align:center">' + fmt(row.rating.rightAttack) + '</td>' +
        '<td style="text-align:center">' + fmt(row.hatStats) + '</td>' +
        '<td style="text-align:center">' + fmt(row.loddarStats) + '</td>' +
        '</tr>';
    }).join('');
    el.style.display = '';
  }

  async function refreshComparison() {
    const el = panel();
    if (!el) return;
    try {
      comparison = await json(API.compare);
      render();
      window.__v5RatingEngineComparison = comparison;
    } catch (error) {
      const summary = el.querySelector('#ratingEngineSummary');
      if (summary) summary.textContent = 'Motor karşılaştırması hesaplanamadı: ' + (error && error.message ? error.message : 'bilinmeyen hata');
      el.style.display = '';
    }
  }

  function installAnalysisCapture() {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async function (input, init) {
      const response = await originalFetch(input, init);
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (url.indexOf('/api/v5/analysis') !== -1 && response.ok) {
          response.clone().json().then(function (data) {
            window.__v5LastAnalysis = data;
            window.setTimeout(refreshComparison, 80);
          }).catch(function () {});
        }
      } catch (_) {}
      return response;
    };
  }

  function boot() {
    installAnalysisCapture();
    panel();
    window.setTimeout(refreshComparison, 1000);
    window.setInterval(refreshComparison, 10000);
  }

  window.v5RefreshRatingEngines = refreshComparison;
  window.v5RenderRatingEngines = render;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
