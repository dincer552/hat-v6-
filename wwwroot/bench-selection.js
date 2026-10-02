(function(){
  'use strict';
  const slots=['Kaleci','Göbek defans','Bek','İç orta saha','Forvet','Kanat','Ekstra'];
  const key='hattrickai.v5.benchSelections';
  const esc=s=>String(s??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]));
  const loadSaved=()=>{try{return JSON.parse(localStorage.getItem(key)||'{}');}catch(_){return {};}};
  const saveSaved=v=>{try{localStorage.setItem(key,JSON.stringify(v));}catch(_){} };
  function host(){
    const pitch=document.getElementById('ownPitch');
    if(!pitch)return null;
    return pitch.closest('.lineup-card')||pitch.parentElement;
  }
  function ensure(){
    const h=host();
    if(!h)return null;
    let box=document.getElementById('benchSelectionBox');
    if(box)return box;
    box=document.createElement('section');
    box.id='benchSelectionBox';
    box.style.cssText='margin-top:12px;background:#fff;border:1px solid #dfe5e1;border-radius:15px;box-shadow:0 2px 9px #0002;overflow:hidden';
    box.innerHTML='<button id="benchToggle" type="button" aria-expanded="false" style="width:100%;border:0;background:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;color:#27322d;font:800 13px Arial;cursor:pointer"><span>🪑 Yedek Oyuncular (7 slot)</span><span id="benchArrow">⌄</span></button><div id="benchBody" style="display:none;border-top:1px solid #e5ebe7;padding:10px 12px"></div>';
    h.parentNode.insertBefore(box,h.nextSibling);
    document.getElementById('benchToggle').onclick=function(){
      const b=document.getElementById('benchBody');
      const t=document.getElementById('benchToggle');
      const a=document.getElementById('benchArrow');
      const open=b.style.display!=='none';
      b.style.display=open?'none':'block';
      t.setAttribute('aria-expanded',String(!open));
      a.textContent=open?'⌄':'⌃';
    };
    return box;
  }
  function render(payload){
    const box=ensure();
    if(!box)return;
    const body=document.getElementById('benchBody');
    if(!body)return;
    const rec=new Map((payload.recommendations||[]).map(x=>[x.slot,x.alternatives||[]]));
    const candidates=Array.isArray(payload.candidates)?payload.candidates:[];
    const saved=loadSaved();
    body.innerHTML=slots.map(function(slot){
      const alternatives=rec.get(slot)||[];
      const eligible=slot==='Ekstra'?candidates:candidates.filter(function(p){return (p.eligibleSlots||[]).includes(slot);});
      const ids=new Set();
      alternatives.forEach(function(p){ids.add(Number(p.id));});
      eligible.forEach(function(p){ids.add(Number(p.id));});
      const options=Array.from(ids).map(function(id){return alternatives.find(function(p){return Number(p.id)===id;})||candidates.find(function(p){return Number(p.id)===id;});}).filter(Boolean);
      const selected=saved[slot]&&options.some(function(p){return Number(p.id)===Number(saved[slot]);})?Number(saved[slot]):(alternatives[0]?.id||options[0]?.id||0);
      if(selected)saved[slot]=selected;
      const opts=options.length?options.map(function(p){return '<option value="'+Number(p.id)+'" '+(Number(p.id)===Number(selected)?'selected':'')+'>'+esc(p.name)+(alternatives.some(function(a){return Number(a.id)===Number(p.id);})?' • öneri':'')+'</option>';}).join(''):'<option value="0">Uygun oyuncu yok</option>';
      return '<div class="bench-row" data-slot="'+esc(slot)+'" style="padding:9px 0;border-bottom:1px solid #edf1ee"><div style="font:800 12px Arial;color:#35423b;margin-bottom:5px">'+esc(slot)+'</div><select class="bench-player" style="width:100%;box-sizing:border-box;border:1px solid #ccd6d0;border-radius:8px;padding:8px;background:#fff;font:600 12px Arial" '+(options.length?'':'disabled')+'>'+opts+'</select></div>';
    }).join('');
    saveSaved(saved);
    body.querySelectorAll('.bench-player').forEach(function(sel){
      sel.addEventListener('change',function(){
        const savedNow=loadSaved();
        savedNow[sel.closest('.bench-row').dataset.slot]=Number(sel.value);
        saveSaved(savedNow);
      });
    });
  }
  async function load(){
    try{
      const r=await fetch('/api/v5/motor-logs?ts='+Date.now(),{cache:'no-store'});
      if(!r.ok)return;
      const data=await r.json();
      if(data && data.available && data.log && data.log.bench)render(data.log.bench);
    }catch(_){ }
  }
  function watch(){
    const runtime=document.getElementById('runtime');
    if(runtime){
      let last='';
      const check=function(){
        const t=runtime.textContent||'';
        if(t!==last){
          last=t;
          if(/analiz tamamlandı/i.test(t))load();
        }
      };
      new MutationObserver(check).observe(runtime,{subtree:true,childList:true,characterData:true});
    }
    setInterval(load,2000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch);else watch();
})();
