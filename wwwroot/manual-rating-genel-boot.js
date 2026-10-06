// Overrides calc() to use Excel Genel formulas via GenelRating
window.addEventListener('load', function(){
  if(typeof GenelRating==='undefined'){
    console.error('GenelRating yok');
    return;
  }
  window.calc = async function calc(){
    const btn=document.getElementById('calculate'), err=document.getElementById('error');
    if(err) err.style.display='none';
    if(btn) btn.disabled=true;
    const status=document.getElementById('status');
    if(status) status.textContent='Genel motor hesaplıyor…';
    try{
      if(typeof selected==='undefined' || !selected.size) throw new Error('Önce sahaya oyuncu yerleştir');
      const coachEl=document.getElementById('coachLv');
      const out=await GenelRating.rateLineup(selected, coachEl?coachEl.value:0);
      const v=out.rating;
      if(typeof renderPitch==='function') renderPitch(v);
      const result=document.getElementById('result');
      if(result){
        const fmtLocal=(typeof fmt==='function')?fmt:(x=>Number(x||0).toFixed(2));
        result.innerHTML='<div class="eyebrow">GENEL SONUÇ</div><div class="ratings">'+
          [['DEF-L',v.leftDefence],['DEF-C',v.centralDefence],['DEF-R',v.rightDefence],['MID',v.midfield],['ATT-L',v.leftAttack],['ATT-C',v.centralAttack],['ATT-R',v.rightAttack]]
          .map(x=>'<div class="rating"><b>'+fmtLocal(x[1])+'</b><span>'+x[0]+'</span></div>').join('')+
          '</div><div class="sub" style="padding:8px 14px">Excel Genel formülleri · KoçR='+out.coachR.toFixed(4)+' · '+out.rowCount+' satır</div>';
      }
      const request=(typeof payload==='function')?payload():null;
      lastCalculation={
        schema:'hattrickai-v6-manual-genel-v1', engine:'Genel', calculatedAt:new Date().toISOString(),
        coachR:out.coachR, rating:v, detail:out.detail, request,
        selectedSlots:[...selected].map(([slot,p])=>({
          slot, playerId:p.id, playerName:p.name, order:Number(p.order||0),
          pos:GenelRating.resolvePos(slot, Number(p.order||0)),
          skills:Object.fromEntries((typeof SKILLS!=='undefined'?SKILLS:[]).map(([k])=>[k,Number(p[k]||0)]))
        }))
      };
      if(typeof setJsonEnabled==='function') setJsonEnabled(true);
      if(status) status.textContent='Genel hesaplandı • '+selected.size+' oyuncu';
    }catch(e){
      lastCalculation=null;
      if(typeof setJsonEnabled==='function') setJsonEnabled(false);
      if(err){ err.textContent=e.message; err.style.display='block'; }
      if(status) status.textContent='Hesaplama başarısız';
    }finally{
      if(btn) btn.disabled=!(typeof selected!=='undefined' && selected.size);
    }
  };
  const btn=document.getElementById('calculate');
  if(btn){ btn.onclick=window.calc; }
});
