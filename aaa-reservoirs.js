(()=>{
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number.isFinite(Number(v))?new Intl.NumberFormat('es-PR',{minimumFractionDigits:2,maximumFractionDigits:3}).format(Number(v)):'—';
  const time=iso=>{try{return new Intl.DateTimeFormat('es-PR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Puerto_Rico'}).format(new Date(iso));}catch{return iso||'—'}};
  const ageMinutes=iso=>{const t=Date.parse(iso||'');return Number.isFinite(t)?Math.max(0,Math.round((Date.now()-t)/60000)):null;};

  function sparkline(series){
    const rows=(series||[]).filter(x=>Number.isFinite(Number(x.value)));
    if(rows.length<2)return '<div class="aaa-no-trend">Sin historial suficiente</div>';
    const vals=rows.map(x=>Number(x.value)),min=Math.min(...vals),max=Math.max(...vals),span=Math.max(.001,max-min),W=220,H=54,P=3;
    const points=rows.map((r,i)=>`${(P+i/(rows.length-1)*(W-P*2)).toFixed(1)},${(H-P-(Number(r.value)-min)/span*(H-P*2)).toFixed(1)}`).join(' ');
    return `<svg class="aaa-spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${points}"/></svg>`;
  }

  function statusBadge(change){
    if(!Number.isFinite(Number(change)))return '<span class="aaa-delta neutral">24 h —</span>';
    const n=Number(change),cls=n>0?'up':n<0?'down':'neutral',arrow=n>0?'↑':n<0?'↓':'→';
    return `<span class="aaa-delta ${cls}">${arrow} ${num(Math.abs(n))} m / 24 h</span>`;
  }

  function render(data){
    const state=$('aaa-reservoir-state');
    const status=data?.status||'unavailable';
    state.className=`aaa-source-state ${status}`;
    state.textContent=status==='live'?'DATOS EN VIVO':status==='stale'?'DATOS ANTERIORES':'NO DISPONIBLE';
    $('aaa-reservoir-updated').textContent=data?.lastSuccessAt?`Última consulta exitosa: ${time(data.lastSuccessAt)}`:'Sin consulta exitosa todavía';
    const rows=(data?.reservoirs||[]).filter(r=>r.name);
    if(!rows.length){$('aaa-reservoir-grid').innerHTML='<div class="live-empty">No hay lecturas disponibles. H2O PR no muestra valores de sustitución.</div>';return;}
    $('aaa-reservoir-grid').innerHTML=rows.map(r=>{
      const reading=r.reading;
      const age=ageMinutes(reading?.observedAt);
      const fresh=age!=null&&age<=120;
      const stale=age!=null&&age>360;
      const freshness=reading?(stale?'LECTURA ANTIGUA':fresh?'LECTURA RECIENTE':'LECTURA DISPONIBLE'):'SIN LECTURA';
      return `<article class="aaa-card ${stale?'is-stale':''}">
        <div class="aaa-card-head"><div><span class="aaa-town">${esc(r.municipality||'Puerto Rico')}</span><h3>${esc(r.name)}</h3></div><span class="aaa-freshness">${freshness}</span></div>
        ${reading?`<div class="aaa-reading"><strong>${num(reading.value)}</strong><span>${esc(reading.unit||'m')}</span></div>`:'<div class="aaa-reading"><strong>—</strong></div>'}
        <div class="aaa-change">${statusBadge(r.change24h)}<small>${reading?.observedAt?`Leído ${time(reading.observedAt)}`:'Sin hora de lectura'}</small></div>
        ${sparkline(r.series)}
        <div class="aaa-foot"><span>USGS + AAA</span><a href="https://waterdata.usgs.gov/monitoring-location/USGS-${encodeURIComponent(r.id)}/" target="_blank" rel="noopener">Ver estación</a></div>
      </article>`;
    }).join('');
  }

  async function load(){
    if(!$('aaa-reservoir-dashboard'))return;
    try{
      const r=await fetch(`./data/aaa-reservoirs.json?v=${Date.now()}`,{cache:'no-store'});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      render(await r.json());
    }catch(error){
      $('aaa-reservoir-state').className='aaa-source-state unavailable';
      $('aaa-reservoir-state').textContent='NO DISPONIBLE';
      $('aaa-reservoir-grid').innerHTML='<div class="live-empty">No pudimos cargar las lecturas. H2O PR no inventará valores.</div>';
      console.warn('AAA/USGS reservoir dashboard',error);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
