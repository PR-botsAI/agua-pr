const $=id=>document.getElementById(id);
const $$=s=>[...document.querySelectorAll(s)];
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tel=p=>`tel:${String(p||'').replace(/[^0-9+]/g,'')}`;
const map=q=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const WATER_FRESH_HOURS=6;
const coords={
  'Arecibo':[18.4724,-66.7157],'San Juan':[18.4655,-66.1057],'Carolina':[18.3808,-65.9574],
  'Canóvanas':[18.3751,-65.8993],'Loíza':[18.4313,-65.8802],'Trujillo Alto':[18.3547,-66.0074],
  'Juncos':[18.2275,-65.9210],'Gurabo':[18.2544,-65.9729],'Bayamón':[18.3986,-66.1557]
};
let R=null,P=null,L=null,town='Arecibo';

function allTowns(){return R?.nmead?.zones?.flatMap(z=>z.municipalities).sort((a,b)=>a.localeCompare(b,'es'))||['Arecibo'];}
function zoneOffice(name){return R?.nmead?.zones?.find(z=>z.municipalities.includes(name));}
function localContacts(name){return R?.municipalContacts?.[name]||[];}
function helpContact(name){return localContacts(name).find(c=>c.kind==='water')||localContacts(name)[0]||zoneOffice(name);}
function fmtDate(iso){try{return new Intl.DateTimeFormat('es-PR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Puerto_Rico'}).format(new Date(iso));}catch{return iso||'—'}}
function hoursOld(iso){if(!iso)return Infinity;const t=new Date(iso).getTime();return Number.isFinite(t)?(Date.now()-t)/3600000:Infinity;}
function pointIsFresh(p){return hoursOld(p.operationalVerifiedAt||p.verifiedAt)<=WATER_FRESH_HOURS;}

function privateSuppliers(name){
  return (P?.suppliers||[]).filter(s=>s.islandwide||s.municipalities?.includes(name));
}

function currentCycle(){
  const e=R?.currentEmergency;if(!e)return null;
  const start=new Date(e.startedAt).getTime(),hours=e.cycleHours||48,span=hours*3600000;
  const elapsed=Date.now()-start;if(elapsed<0)return null;
  const index=Math.floor(elapsed/span),zone1On=index%2===0,next=new Date(start+(index+1)*span);
  return {index,zone1On,zone2On:!zone1On,next};
}

function matchSector(query){
  const zones=R?.rationingZones?.[town];if(!zones||!query.trim())return null;
  const q=norm(query);let best=null;
  for(const [zone,items] of Object.entries(zones)){
    for(const item of items){
      const n=norm(item);let score=0;
      if(n===q)score=100;else if(n.includes(q)||q.includes(n))score=Math.min(n.length,q.length);else{
        const words=q.split(/\s+/).filter(w=>w.length>3);score=words.filter(w=>n.includes(w)).length*3;
      }
      if(score>0&&(!best||score>best.score))best={zone,item,score};
    }
  }
  return best;
}

function scheduledStatus(zone){
  const cycle=currentCycle();if(!cycle)return null;
  const on=zone==='zone1'?cycle.zone1On:cycle.zone2On;
  return {on,next:cycle.next,zoneLabel:zone==='zone1'?'Zona 1':'Zona 2'};
}

function renderTownSummary(){
  const affected=R?.currentEmergency?.affectedMunicipalities?.includes(town);
  const points=(R?.waterPoints||[]).filter(p=>p.municipality===town);
  const fresh=points.filter(pointIsFresh).length;
  const suppliers=privateSuppliers(town);
  const h=helpContact(town);
  $('town-summary').innerHTML=`<article class="summary-card">
    <p class="eyebrow">AHORA EN ${esc(town)}</p>
    <h2>Tu plan rápido</h2>
    <div class="summary-rows">
      <div class="summary-row"><span class="summary-state ${affected?'alert':'good'}">SERVICIO</span><div><strong>${affected?'Hay racionamiento publicado para sectores':'No hay plan de Carraízo publicado para este pueblo'}</strong><small>${affected?'Busca tu sector abajo para ver la zona programada.':'Eso no confirma que tu residencia tenga agua.'}</small></div></div>
      <div class="summary-row"><span class="summary-state ${fresh?'good':''}">AGUA</span><div><strong>${points.length?`${points.length} ubicación${points.length===1?'':'es'} pública${points.length===1?'':'s'} publicada${points.length===1?'':'s'}`:'No tenemos oasis fijo publicado para este pueblo'}</strong><small>${fresh?`${fresh} con confirmación operativa reciente.`:'Llama antes de salir; no tenemos confirmación operativa reciente.'}</small></div></div>
      <div class="summary-row"><span class="summary-state good">PLAN B</span><div><strong>${suppliers.length?`${suppliers.length} opción${suppliers.length===1?'':'es'} privada${suppliers.length===1?'':'s'} verificable${suppliers.length===1?'':'s'}`:'Sin suplidor privado verificado local todavía'}</strong><small>${suppliers.length?'Entrega comercial: confirma precio y disponibilidad.':'La oficina regional de emergencia sigue disponible como respaldo.'}</small></div></div>
      <div class="summary-row"><span class="summary-state">AYUDA</span><div><strong>${h?.phone?`Llama ${esc(h.phone)}`:`Llama ${esc(R.nmead.centralPhone)}`}</strong><small>${esc(h?.label||`NMEAD · Zona ${zoneOffice(town)?.name||'Puerto Rico'}`)}</small></div></div>
    </div>
  </article>`;
}

function renderRationing(){
  const card=$('rationing-card'),box=$('sector-box'),affected=R?.currentEmergency?.affectedMunicipalities?.includes(town);
  if(!affected){
    card.className='rationing-card calm';
    card.innerHTML=`<strong>No hay un calendario de Carraízo publicado para ${esc(town)}.</strong><p>Eso no confirma que tengas servicio. Si estás sin agua, usa las opciones de agua y teléfonos de ayuda.</p>`;
    box.classList.add('hidden');return;
  }
  const c=currentCycle();
  card.className='rationing-card alert';
  card.innerHTML=`<div><span class="alert-label">RACIONAMIENTO PUBLICADO</span><strong>${esc(town)} tiene sectores dentro del plan de Carraízo.</strong><p>Ciclo publicado de 48 horas. ${c?`Próximo cambio programado: <b>${esc(fmtDate(c.next))}</b>.`:''} Escribe tu sector para buscarlo en la lista.</p></div><a href="${esc(R.currentEmergency.source)}" target="_blank" rel="noopener">Ver fuente del plan</a>`;
  box.classList.remove('hidden');
  $('sector').value='';$('sector-result').innerHTML='';
}

function checkSector(){
  const q=$('sector').value.trim(),result=$('sector-result');
  if(!q){result.innerHTML='<span class="sector-neutral">Escribe el nombre de tu sector o urbanización.</span>';return;}
  const m=matchSector(q);
  if(!m){result.innerHTML=`<div class="sector-neutral"><strong>No encontré “${esc(q)}” en la lista publicada.</strong><p>No voy a adivinar tu zona. Llama a la oficina local para confirmar.</p></div>`;return;}
  const s=scheduledStatus(m.zone);
  if(!s){result.innerHTML='<div class="sector-neutral"><strong>Encontré tu sector, pero no puedo calcular el ciclo ahora mismo.</strong><p>Usa la fuente publicada o llama a la oficina local.</p></div>';return;}
  result.innerHTML=`<div class="sector-answer ${s.on?'scheduled-on':'scheduled-off'}"><span>${esc(s.zoneLabel)} · coincidencia: ${esc(m.item)}</span><strong>${s.on?'CALENDARIO: CON SERVICIO':'CALENDARIO: SIN SERVICIO'}</strong><p>${s.on?'Según el calendario publicado, esta zona está en su periodo con servicio. Esto no garantiza presión o agua real en tu casa.':'Según el calendario publicado, esta zona está en interrupción programada.'}</p><small>Próximo cambio programado: ${esc(fmtDate(s.next))}</small></div>`;
}

function statusLabel(p){
  if(pointIsFresh(p))return ['CONFIRMADO RECIENTEMENTE','good'];
  return ['LLAMA ANTES DE SALIR','check'];
}

function renderWater(){
  const points=(R?.waterPoints||[]).filter(p=>p.municipality===town),list=$('water-list'),empty=$('water-empty'),mobile=R?.mobileWater?.[town];
  const fresh=points.filter(pointIsFresh).length;
  $('water-count').textContent=points.length?`${points.length} ubicación${points.length===1?'':'es'} publicada${points.length===1?'':'s'}${fresh?` · ${fresh} reciente${fresh===1?'':'s'}`:''}`:'Sin oasis fijo publicado';
  if(mobile){$('mobile-water').classList.remove('hidden');$('mobile-water').innerHTML=`<strong>Asistencia móvil / cisterna publicada</strong><p>${esc(mobile.message)}</p><a class="btn primary wide" href="${tel(mobile.phone)}">Llamar ${esc(mobile.phone)}</a>`;}else $('mobile-water').classList.add('hidden');
  if(!points.length){
    list.innerHTML='';empty.classList.remove('hidden');const h=helpContact(town);const p=h?.phone||R.nmead.centralPhone;$('water-empty-call').href=tel(p);$('water-empty-call').textContent=`Llamar ${p}`;
  }else{
    empty.classList.add('hidden');
    list.innerHTML=points.map(p=>{const [label,cls]=statusLabel(p);return `<article class="resource"><div class="resource-top"><div><span class="status ${cls}">${label}</span><h3>${esc(p.name)}</h3></div><small>Fuente revisada: ${esc(p.verifiedOn||'sin fecha')}</small></div><p class="address">${esc(p.address)}</p><p><strong>Horario publicado:</strong> ${esc(p.hours||'No publicado')}</p><div class="resource-actions"><a class="btn primary" href="${tel(p.confirmPhone)}">Llamar para confirmar</a><a class="btn outline" href="${map(p.address)}" target="_blank" rel="noopener">Cómo llegar</a></div><a class="source" href="${esc(p.source)}" target="_blank" rel="noopener">Ver fuente</a></article>`}).join('');
  }
  renderPrivateWater();
}

function renderPrivateWater(){
  const suppliers=privateSuppliers(town),box=$('private-water-list'),empty=$('private-water-empty');
  if(!suppliers.length){box.innerHTML='';empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');
  box.innerHTML=suppliers.map(s=>`<article class="supplier-card commercial">
    <span class="supplier-label">SERVICIO PRIVADO · PAGO</span>
    <h3>${esc(s.name)}</h3>
    <p>${esc(s.summary)}</p>
    <div class="supplier-meta"><strong>Cobertura publicada:</strong> ${esc(s.serviceAreaLabel)}</div>
    <div class="supplier-note">${esc(s.verificationNote)}</div>
    <div class="supplier-actions"><a class="btn primary" href="${tel(s.phone)}">Llamar ${esc(s.phoneLabel||s.phone)}</a><a class="btn outline" href="${esc(s.source)}" target="_blank" rel="noopener">Ver proveedor</a></div>
  </article>`).join('');
}

function renderStorage(){
  const items=P?.storageSolutions||[],box=$('storage-list');
  box.innerHTML=items.map(s=>`<article class="supplier-card storage"><span class="supplier-label">ALMACENAMIENTO / CISTERNA</span><h3>${esc(s.name)}</h3><p>${esc(s.summary)}</p><div class="supplier-meta">${esc(s.serviceAreaLabel)}</div><div class="supplier-actions"><a class="btn primary" href="${tel(s.phone)}">Llamar ${esc(s.phone)}</a><a class="btn outline" href="${esc(s.source)}" target="_blank" rel="noopener">Ver sitio</a></div></article>`).join('');
}

function renderHelp(){
  const local=localContacts(town),zone=zoneOffice(town),cards=[];
  for(const c of local)cards.push({title:c.label,phone:c.phone,note:c.note,source:c.source,tag:'LOCAL / AGUA'});
  if(zone)cards.push({title:`NMEAD · Zona ${zone.name}`,phone:zone.phone,note:`Oficina regional oficial que cubre ${town}.`,source:R.nmead.source,tag:'EMERGENCIAS'});
  cards.push({title:'AAA · Servicio al Cliente',phone:R.aaa.phone,note:`${R.aaa.hours}. Averías, querellas y orientación de servicio.`,source:R.aaa.source,tag:'AAA'});
  $('help-list').innerHTML=cards.map(c=>`<article class="help-card"><span>${esc(c.tag)}</span><h3>${esc(c.title)}</h3><p>${esc(c.note)}</p><a class="call" href="${tel(c.phone)}">Llamar ${esc(c.phone)}</a>${c.source?`<a class="source" href="${esc(c.source)}" target="_blank" rel="noopener">Ver fuente</a>`:''}</article>`).join('');
}

function setTown(name){
  if(!allTowns().includes(name))return;town=name;$('municipality').value=name;$$('[data-town]').forEach(e=>e.textContent=name);renderTownSummary();renderRationing();renderWater();renderHelp();loadWeather();
}

async function loadLive(){try{const r=await fetch(`./data/live.json?v=${Date.now()}`,{cache:'no-store'});L=await r.json();}catch(e){console.warn(e)}}
async function loadWeather(){
  const c=coords[town],box=$('weather');if(!c){box.innerHTML='<p>Para este pueblo abre el pronóstico oficial de NWS San Juan.</p><a class="source" href="https://www.weather.gov/sju/" target="_blank" rel="noopener">Abrir NWS</a>';return;}
  box.textContent='Cargando pronóstico oficial…';
  try{const p=await fetch(`https://api.weather.gov/points/${c[0]},${c[1]}`,{headers:{Accept:'application/geo+json'}});const pj=await p.json();const f=await fetch(pj.properties.forecast,{headers:{Accept:'application/geo+json'}});const j=await f.json();box.innerHTML=(j.properties.periods||[]).slice(0,4).map(x=>`<div class="weather-row"><strong>${esc(x.name)}</strong><span>${esc(x.temperature)}°${esc(x.temperatureUnit)}</span><span>${esc(x.shortForecast)}</span></div>`).join('');}catch{box.innerHTML='<p>No se pudo cargar NWS.</p><a class="source" href="https://www.weather.gov/sju/" target="_blank" rel="noopener">Abrir NWS</a>';}
}

async function init(){
  try{
    const [rr,pr]=await Promise.all([
      fetch(`./data/resources.json?v=${Date.now()}`,{cache:'no-store'}),
      fetch(`./data/private-water-suppliers.json?v=${Date.now()}`,{cache:'no-store'})
    ]);
    R=await rr.json();P=await pr.json();
  }catch{
    document.body.innerHTML='<main class="fatal"><h1>H2O PR no pudo cargar los recursos de emergencia.</h1><a href="tel:7877240124">Llamar NMEAD 787-724-0124</a><a href="tel:7876202482">Llamar AAA 787-620-2482</a></main>';return;
  }
  $('municipality').innerHTML=allTowns().map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');$('municipality').value=town;
  $('municipality').addEventListener('change',e=>setTown(e.target.value));
  $('check-sector').addEventListener('click',checkSector);
  $('sector').addEventListener('keydown',e=>{if(e.key==='Enter')checkSector()});
  $('large-text').addEventListener('click',()=>{document.documentElement.classList.toggle('large');$('large-text').textContent=document.documentElement.classList.contains('large')?'A− Texto normal':'A+ Texto grande';});
  $$('[data-jump]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.jump)?.scrollIntoView({behavior:'smooth'})));
  $('health-text').textContent=R.health.guidance;
  $('data-time').textContent=` Datos de emergencia revisados: ${fmtDate(R.updatedAt)}. Suplidores privados revisados: ${fmtDate(P.updatedAt)}.`;
  renderStorage();setTown(town);loadLive();
}
init();
