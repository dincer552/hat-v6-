(() => {
  const style = document.createElement("style");
  style.textContent = [
    "#dy-ai-launch{position:fixed;right:20px;bottom:20px;z-index:9998;border:0;border-radius:999px;background:#168653;color:#fff;padding:13px 17px;font:700 14px/1.2 Inter,Arial,sans-serif;box-shadow:0 8px 28px #10232635;cursor:pointer}",
    "#dy-ai-panel{position:fixed;right:20px;bottom:78px;z-index:9999;width:min(370px,calc(100vw - 28px));height:min(560px,calc(100dvh - 110px));display:none;flex-direction:column;overflow:hidden;background:#fff;border:1px solid #dfe7e3;border-radius:18px;box-shadow:0 18px 60px #10232635;font:14px/1.45 Inter,Arial,sans-serif;color:#172522}",
    "#dy-ai-panel.open{display:flex}#dy-ai-head{background:#102326;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}",
    "#dy-ai-head strong{font-size:15px}#dy-ai-head small{display:block;color:#b9ccc5;font-size:11px;margin-top:2px}#dy-ai-close{border:0;background:transparent;color:#fff;font-size:24px;cursor:pointer}",
    "#dy-ai-messages{padding:14px;overflow:auto;display:flex;flex-direction:column;gap:10px;flex:1;background:#f7faf8}",
    ".dy-ai-msg{white-space:pre-wrap;overflow-wrap:anywhere;max-width:92%;padding:10px 12px;border-radius:13px;background:#fff;border:1px solid #e2e9e5}",
    ".dy-ai-msg.user{align-self:flex-end;background:#e4f5eb;border-color:#d2ebdd}.dy-ai-msg.assistant{align-self:flex-start}",
    "#dy-ai-suggestions{display:flex;gap:6px;flex-wrap:wrap;padding:0 12px 10px;background:#fff}",
    ".dy-ai-suggest{border:1px solid #dfe7e3;background:#fff;color:#176c45;border-radius:999px;padding:6px 9px;font-size:11px;cursor:pointer}",
    "#dy-ai-form{display:flex;gap:8px;padding:12px;border-top:1px solid #e2e9e5;background:#fff}",
    "#dy-ai-input{min-width:0;flex:1;resize:none;max-height:100px;border:1px solid #d5dfd9;border-radius:11px;padding:10px;font:14px Arial,sans-serif;outline-color:#168653}",
    "#dy-ai-send{border:0;border-radius:10px;background:#168653;color:#fff;padding:0 13px;font-weight:700;cursor:pointer}#dy-ai-send:disabled{opacity:.55;cursor:wait}",
    "@media(max-width:480px){#dy-ai-launch{right:14px;bottom:14px}#dy-ai-panel{right:10px;bottom:70px;height:min(560px,calc(100dvh - 90px))}}"
  ].join("\n");
  document.head.appendChild(style);

  const launch = document.createElement("button");
  launch.id = "dy-ai-launch";
  launch.type = "button";
  launch.textContent = "✦ Dinçer AI";
  launch.setAttribute("aria-expanded", "false");
  launch.setAttribute("aria-controls", "dy-ai-panel");

  const panel = document.createElement("section");
  panel.id = "dy-ai-panel";
  panel.setAttribute("aria-label", "Dinçer AI asistanı");
  panel.innerHTML = [
    '<header id="dy-ai-head"><div><strong>Dinçer AI</strong><small>HVAC · PLC · SCADA · Otomasyon</small></div><button id="dy-ai-close" type="button" aria-label="Kapat">×</button></header>',
    '<div id="dy-ai-messages" aria-live="polite"><div class="dy-ai-msg assistant">Merhaba! HVAC, Siemens PLC, SCADA, Modbus veya Dinçer’in projeleri hakkında ne öğrenmek istersin?</div></div>',
    '<div id="dy-ai-suggestions"><button class="dy-ai-suggest" type="button">Siemens PLC</button><button class="dy-ai-suggest" type="button">HVAC otomasyonu</button><button class="dy-ai-suggest" type="button">Projeler</button></div>',
    '<form id="dy-ai-form"><textarea id="dy-ai-input" rows="1" maxlength="3000" placeholder="Sorunu yaz..." aria-label="Mesajın"></textarea><button id="dy-ai-send" type="submit">Gönder</button></form>'
  ].join("");
  document.body.append(launch, panel);

  const close = panel.querySelector("#dy-ai-close");
  const form = panel.querySelector("#dy-ai-form");
  const input = panel.querySelector("#dy-ai-input");
  const send = panel.querySelector("#dy-ai-send");
  const messagesNode = panel.querySelector("#dy-ai-messages");
  const history = [];

  function toggle(open) {
    panel.classList.toggle("open", open);
    launch.setAttribute("aria-expanded", String(open));
    if (open) input.focus();
  }
  function addMessage(role, text) {
    const node = document.createElement("div");
    node.className = "dy-ai-msg " + role;
    node.textContent = text;
    messagesNode.appendChild(node);
    messagesNode.scrollTop = messagesNode.scrollHeight;
    return node;
  }
  async function ask(text) {
    const question = text.trim();
    if (!question || send.disabled) return;
    addMessage("user", question);
    history.push({ role: "user", content: question });
    input.value = "";
    send.disabled = true;
    send.textContent = "…";
    const waiting = addMessage("assistant", "Yanıt hazırlanıyor…");
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-9) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error || "Şu anda yanıt alınamadı. Biraz sonra tekrar dene.");
      waiting.textContent = data.answer || "Yanıt alınamadı.";
      history.push({ role: "assistant", content: waiting.textContent });
    } catch (error) {
      waiting.textContent = error.message || "Bağlantı kurulamadı. Lütfen tekrar dene.";
    } finally {
      send.disabled = false;
      send.textContent = "Gönder";
      messagesNode.scrollTop = messagesNode.scrollHeight;
      input.focus();
    }
  }

  launch.addEventListener("click", () => toggle(!panel.classList.contains("open")));
  close.addEventListener("click", () => toggle(false));
  form.addEventListener("submit", event => { event.preventDefault(); ask(input.value); });
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); }
  });
  panel.querySelectorAll(".dy-ai-suggest").forEach(button => {
    button.addEventListener("click", () => ask(button.textContent === "Projeler" ? "Dinçer Yüksek'in öne çıkan projelerini anlat." : button.textContent + " hakkında yardımcı olur musun?"));
  });
})();