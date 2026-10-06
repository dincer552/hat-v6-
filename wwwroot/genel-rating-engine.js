/* Genel rating engine for manual-rating.html — Excel Genel formulas */
window.GenelRating = (function(){
  let ROWS=[], POSITIONS=[], READY=false;
  const ORDER_NAME={0:'normal',1:'defansif',2:'ofansif',3:'merkeze',4:'kanada'};
  const SEC_KEY={
    'Left Defence':'leftDefence','Central Defence':'centralDefence','Right Defence':'rightDefence',
    'Midfield':'midfield','Left Attack':'leftAttack','Central Attack':'centralAttack','Right Attack':'rightAttack'
  };
  function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
  function formF(form){return 0.378*Math.sqrt(Math.min(7,Math.max(0,num(form)-1)));}
  function expPoly(exp){const x=Math.max(0,num(exp)-1);return (-0.00000725*Math.pow(x,4)+0.0005*Math.pow(x,3)-0.01336*Math.pow(x,2)+0.176*x);}
  function coachR(lv){const c=num(lv);return 1.02-(c<=0?c*0.13/10:c*0.12/10);}
  function qRound(v){return Math.round(v*4)/4;}
  function skill(pl, skillName){
    const map={Goalkeeping:'keeper',Defending:'defending',Playmaking:'playmaking',Passing:'passing',Winger:'winger',Scoring:'scoring',SetPieces:'setPieces',Stamina:'stamina'};
    const k=map[skillName]; if(!k||!pl) return null; return num(pl[k]);
  }
  async function ensure(){
    if(READY) return;
    if(!window.GENEL_ALL_HEX) throw new Error('genel-all-data.js yüklenmedi');
    const hex=window.GENEL_ALL_HEX;
    const bin=new Uint8Array(hex.length/2);
    for(let i=0;i<bin.length;i++) bin[i]=parseInt(hex.substr(i*2,2),16);
    const text=await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    const data=JSON.parse(text);
    ROWS=data.rows||[]; POSITIONS=data.positions||[]; READY=true;
  }
  function resolvePos(code, order){
    if(code==='GK') return 'GK';
    const ord=ORDER_NAME[Number(order)||0]||'normal';
    const full=code+' '+ord;
    if(POSITIONS.includes(full)) return full;
    if(POSITIONS.includes(code+' normal')) return code+' normal';
    return POSITIONS.find(p=>p===code||p.startsWith(code+' '))||full;
  }
  function forPlayer(pos, pl, R){
    const rows=ROWS.filter(r=>r.pos===pos);
    const bySec={}; const lineTrace=[];
    for(const r of rows){
      const D=skill(pl,r.sk); if(D==null) continue;
      const F=num(pl.form), H=num(pl.experience), loy=num(pl.loyalty);
      const I=formF(F), J=Math.max(0,num(D)-1)+loy, N=num(r.n), K=expPoly(H)*N, E=num(r.k), L=J*I*E+K;
      bySec[r.sec]=bySec[r.sec]||{L:0,ss:num(r.ss),V:num(r.v)};
      bySec[r.sec].L+=L;
      lineTrace.push({pos,sector:r.sec,skill:r.sk,D,E,F,H,I,J,K,L,N});
    }
    const sectorM={};
    for(const [sec,o] of Object.entries(bySec)) sectorM[sec]=o.L>0?qRound(Math.pow(o.L*R*o.ss,o.V)/4+1):0.75;
    return {sectorM,lineTrace};
  }
  async function rateLineup(selectedMap, coachLv){
    await ensure();
    const R=coachR(coachLv);
    const totals={leftDefence:0,centralDefence:0,rightDefence:0,midfield:0,leftAttack:0,centralAttack:0,rightAttack:0};
    const detail=[];
    for(const [code,p] of selectedMap){
      const pos=resolvePos(code, Number(p.order||0));
      const {sectorM,lineTrace}=forPlayer(pos,p,R);
      detail.push({slot:code,pos,playerId:p.id,playerName:p.name,sectorM,lineTrace});
      for(const [sec,m] of Object.entries(sectorM)){ const k=SEC_KEY[sec]; if(k) totals[k]+=m; }
    }
    const rating={
      leftDefence:qRound(totals.leftDefence), centralDefence:qRound(totals.centralDefence), rightDefence:qRound(totals.rightDefence),
      midfield:qRound(totals.midfield), leftAttack:qRound(totals.leftAttack), centralAttack:qRound(totals.centralAttack), rightAttack:qRound(totals.rightAttack)
    };
    return {rating, detail, coachR:R, rowCount:ROWS.length};
  }
  return {ensure, rateLineup, coachR, resolvePos};
})();
