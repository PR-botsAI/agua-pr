(()=>{
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=v=>Number.isFinite(Number(v))?new Intl.NumberFormat('es-PR',{maximumFractionDigits:2}).format(Number(v)):'—';
  const prettyName=id=>String(id||'').replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const statusText=s=>s==='live'?'EN VIVO':s==='stale'?'DATOS ANTERIORES':'NO DISPONIBLE';
  const statusClass=s=>s==='live'?'feed-live':s==='stale'?'feed-stale':'feed-down';
  const when=iso=>{try{return new Intl.DateTimeFormat('es-PR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Puerto_Rico'}).format(new Date(iso));}catch{return iso||'—'}};

  function renderFeedState(name,feed){
    return `<div class="feed-state ${statusClass(feed?.status)}"><span></span><strong>${esc(name)}</strong><b>${statusText(feed?.status)}</b></div>`;
  }

  function renderKpis(data){
    const g=data.generation||{},h=data.history||{};
    const totalMetric=g.metrics?.find(m=>String(m.index)==='0')||g.metrics?.[0];
    const hydroMw=(g.sites||[]).filter(s=>/hidro/i.test(s.type||'')).reduce((sum,s)=>sum+Number(s.siteTotalMw||0),0);
    const activeSites=(g.sites||[]).filter(s=>Number(s.siteTotalMw)>0).length;
    const lastPoint=h.points?.at?.(-1)||h.points?.[h.points.length-1];
    $('prepa-kpis').innerHTML=[
      {label:'Generación reportada',value:totalMetric?`${number(totalMetric.value)} MW`:'—',note:totalMetric?.description||'PREPA dataSource.js'},
      {label:'Generación hidroeléctrica',value:g.sites?`${number(hydroMw)} MW`:'—',note:'Suma de sitios tipo Hidroeléctricas reportados por PREPA'},
      {label:'Plantas / sitios produciendo',value:g.sites?String(activeSites):'—',note:g.sites?`${g.sites.length} sitios reportados en total`:'Sin datos'},
      {label:'Frecuencia más reciente',value:Number.isFinite(lastPoint?.frequencyHz)?`${number(lastPoint.frequencyHz)} Hz`:'—',note:lastPoint?.hour?`Lectura ${lastPoint.hour}`:'PREPA dataGraph.js'}
    ].map(k=>`<article class="live-kpi"><span>${esc(k.label)}</span><strong>${esc(k.value)}</strong><small>${esc(k.note)}</small></article>`).join('');
  }

  function renderLevels(data){
    const feed=data.levels||{},rows=feed.reservoirs||[];
    if(!rows.length){$('prepa-levels').innerHTML='<div class="live-empty">PREPA no entregó lecturas de embalses en la última consulta.</div>';return;}
    $('prepa-levels').innerHTML=rows.map(r=>{
      const d=Number(r.difference),dir=Number.isFinite(d)?(d>0?'up':d<0?'down':'flat'):'flat';
      const wording=dir==='up'?'SUBIÓ':dir==='down'?'BAJÓ':'SIN CAMBIO';
      return `<article class="level-card">
        <div class="level-head"><h4>${esc(prettyName(r.id))}</h4><span class="delta ${dir}">${wording}${r.differenceRaw!=null?` ${esc(r.differenceRaw)}`:''}</span></div>
        <div class="level-reading">${number(r.reading)}</div>
        <small>Lectura reportada directamente por PREPA. H2O PR no calcula un “% lleno” con capacidades estimadas.</small>
      </article>`;
    }).join('');
  }

  function renderFuel(data){
    const rows=(data.generation?.byFuel||[]).filter(x=>Number.isFinite(Number(x.value))&&Number(x.value)>=0);
    if(!rows.length){$('prepa-fuels').innerHTML='<div class="live-empty">No hay desglose por fuente disponible.</div>';return;}
    const sum=rows.reduce((s,x)=>s+Number(x.value),0);
    const percentMode=sum>=90&&sum<=110&&rows.every(x=>Number(x.value)<=100);
    const max=Math.max(1,...rows.map(x=>Number(x.value)));
    $('prepa-fuels').innerHTML=rows.sort((a,b)=>Number(b.value)-Number(a.value)).map(r=>{
      const value=Number(r.value||0);
      const width=percentMode?Math.max(0,Math.min(100,value)):Math.max(0,Math.min(100,value/max*100));
      const display=percentMode?`${number(value)}%`:number(value);
      return `<div class="fuel-row"><div><strong>${esc(r.fuel)}</strong><span>${esc(display)}</span></div><div class="fuel-track"><i style="width:${width.toFixed(1)}%"></i></div></div>`;
    }).join('')+`<p class="panel-note">${percentMode?'PREPA reporta este desglose como participación porcentual.':'Valores mostrados en la unidad entregada por PREPA; H2O PR no les asigna una unidad que la fuente no declare.'}</p>`;
  }

  function renderTrend(data){
    const all=(data.history?.points||[]).filter(p=>Number.isFinite(Number(p.generationMw)));
    if(all.length<2){$('prepa-trend').innerHTML='<div class="live-empty">No hay suficiente historial para dibujar la tendencia.</div>';return;}
    const step=Math.max(1,Math.ceil(all.length/140)),points=all.filter((_,i)=>i%step===0||i===all.length-1);
    const vals=points.map(p=>Number(p.generationMw)),min=Math.min(...vals),max=Math.max(...vals),span=Math.max(1,max-min);
    const W=800,H=220,P=26;
    const xy=points.map((p,i)=>{
      const x=P+(i/(points.length-1))*(W-P*2),y=H-P-((Number(p.generationMw)-min)/span)*(H-P*2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const latest=points[points.length-1];
    $('prepa-trend').innerHTML=`<div class="trend-meta"><span><b>Más reciente:</b> ${number(latest.generationMw)} MW</span><span><b>Mín:</b> ${number(min)} MW</span><span><b>Máx:</b> ${number(max)} MW</span></div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tendencia de generación reportada por PREPA"><line x1="${P}" y1="${H-P}" x2="${W-P}" y2="${H-P}" class="axis"/><polyline points="${xy}" class="trend-line" fill="none"/></svg><div class="trend-foot"><span>${esc(points[0].hour||'')}</span><span>${esc(latest.hour||'')}</span></div>`;
  }

  function render(data){
    const states=$('prepa-feed-state');
    states.innerHTML=renderFeedState('Generación',data.generation)+renderFeedState('Embalses',data.levels)+renderFeedState('Histórico',data.history);
    $('prepa-updated').textContent=data.updatedAt?`H2O PR actualizó este conjunto: ${when(data.updatedAt)}`:'Esperando primera actualización.';
    const stale=[data.generation,data.levels,data.history].some(x=>x?.status==='stale');
    const down=[data.generation,data.levels,data.history].some(x=>x?.status==='unavailable');
    const notice=$('prepa-notice');
    if(stale||down){notice.classList.remove('hidden');notice.textContent=stale?'Una fuente no respondió ahora. Mostramos la última lectura exitosa y la marcamos como anterior.':'Una o más fuentes PREPA no están disponibles; H2O PR no sustituye esos valores con datos inventados.';}else notice.classList.add('hidden');
    renderKpis(data);renderLevels(data);renderFuel(data);renderTrend(data);
  }

  async function load(){
    const root=$('prepa-dashboard');if(!root)return;
    try{
      const response=await fetch(`./data/prepa.json?v=${Date.now()}`,{cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      render(await response.json());
    }catch(error){
      $('prepa-feed-state').innerHTML='<div class="feed-state feed-down"><span></span><strong>PREPA</strong><b>NO DISPONIBLE</b></div>';
      $('prepa-kpis').innerHTML='<div class="live-empty">No pudimos cargar el conjunto PREPA. H2O PR no mostrará números de sustitución.</div>';
      $('prepa-updated').textContent='Error cargando data/prepa.json';
      console.warn('PREPA dashboard',error);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
