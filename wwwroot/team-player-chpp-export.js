// TEAM_PLAYER_CHPP_JSON_EXPORT_V1
// Removal marker: see HattrickAI_V5/Docs/TEAM_PLAYER_CHPP_JSON_EXPORT.md
// This is a read-only development helper. It never writes match orders and never exposes OAuth tokens.
(function () {
  'use strict';

  const BUTTON_ID = 'v5TeamPlayerChppExport';
  const ANALYZE_ID = 'analyze';
  const STATUS_URL = '/api/v5/status';
  const EXPORT_URL = '/api/v5/team-player-export';

  let connected = false;
  let busy = false;

  function ensureButton() {
    const analyze = document.getElementById(ANALYZE_ID);
    if (!analyze || !analyze.parentElement) return null;
    let button = document.getElementById(BUTTON_ID);
    if (button) return button;

    button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.disabled = true;
    button.textContent = '👥 TAKIM + OYUNCU JSON AL (CHPP bağla)';
    button.style.cssText = [
      'width:100%',
      'height:48px',
      'margin-top:9px',
      'border:1px solid #9bb5a4',
      'border-radius:10px',
      'background:#f7faf8',
      'color:#1f6f43',
      'font-size:13px',
      'font-weight:900',
      'cursor:not-allowed',
      'opacity:.55'
    ].join(';');

    button.addEventListener('click', exportPlayers);
    analyze.insertAdjacentElement('afterend', button);
    return button;
  }

  function setButtonState(isConnected, text, disabled) {
    connected = !!isConnected;
    const button = ensureButton();
    if (!button || busy) return;
    button.disabled = disabled ?? !connected;
    button.textContent = text || (connected ? '👥 TAKIM + OYUNCU JSON AL' : '👥 TAKIM + OYUNCU JSON AL (CHPP bağla)');
    button.style.opacity = button.disabled ? '.55' : '1';
    button.style.cursor = button.disabled ? 'not-allowed' : 'pointer';
    button.style.background = button.disabled ? '#f7faf8' : '#e9f5ed';
  }

  async function readJson(url) {
    const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { throw new Error('Sunucudan geçersiz JSON yanıtı geldi.'); }
    if (!response.ok) throw new Error(data.detail || data.title || data.message || ('HTTP ' + response.status));
    return data;
  }

  async function refreshConnectionState() {
    try {
      const status = await readJson(STATUS_URL);
      setButtonState(status.connected, status.connected ? '👥 TAKIM + OYUNCU JSON AL' : '👥 TAKIM + OYUNCU JSON AL (CHPP bağla)', !status.connected);
    } catch {
      setButtonState(false, '👥 TAKIM + OYUNCU JSON AL (CHPP durumu okunamadı)', true);
    }
  }

  async function exportPlayers() {
    const button = ensureButton();
    if (!button || !connected || busy) return;
    busy = true;
    button.disabled = true;
    button.textContent = '⏳ CHPP oyuncu verileri alınıyor…';
    button.style.opacity = '.75';
    button.style.cursor = 'wait';
    button.title = '';

    try {
      // The API responds with Content-Disposition: attachment. Navigating directly
      // avoids mobile-browser blocking of an async Blob/anchor download after fetch().
      window.location.assign(EXPORT_URL);
      window.setTimeout(() => {
        busy = false;
        refreshConnectionState();
      }, 2500);
    } catch (error) {
      busy = false;
      button.textContent = '❌ Oyuncu JSON alınamadı';
      button.title = error?.message || String(error);
      setTimeout(refreshConnectionState, 2500);
    }
  }

  function boot() {
    ensureButton();
    refreshConnectionState();
    window.setInterval(refreshConnectionState, 3000);
    const observer = new MutationObserver(() => ensureButton());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
