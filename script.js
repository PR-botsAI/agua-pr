const $=id=>document.getElementById(id);
const $$=s=>[...document.querySelectorAll(s)];
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tel=p=>`tel:${String(p||'').replace(/[^0-9+]/g,'')}`;
const map=q=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const coords={
  'Arecibo':[18.4724,-66.7157],'San Juan':[18.4655,-66.1057],'Carolina':[18.3808,-65.9574],
  'Canóvanas':[18.3751,-65.8993],'Loíza':[18.4313,-65.8802],'Trujillo Alto':[18.3547,-66.0074],
  'Juncos':[18.2275,-65.9210],'Gurabo':[18.2544,-65.9729]
};
let R=null,L=null,town='Arecibo',recognition=null,listening=false;

function allTowns(){return R?.nmead?.zones?.flatMap(z=>z.municipalities).sort((a,b)=>a.localeCompare(b,'es'))||['Arecibo'];}
function zoneOffice(name){return R?.nmead?.zones?.find(z=>z.municipalities.includes(name));}
function localContacts(name){return R?.municipalContacts?.[name]||[];}
function helpContact(name){return localContacts(name).find(c=>c.kind==='water')||localContacts(name)[0]||zoneOffice(name);}
function fmtDate(iso){try{return new Intl.DateTimeFormat('es-PR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Puerto_Rico'}).format(new Date(iso));}catch{return iso||'—'}}

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

function renderRationing(){
  const card=$('rationing-card'),box=$('sector-box'),affected=R?.currentEmergency?.affectedMunicipalities?.includes(town);
  if(!affected){
    card.className='rationing-card calm';
    card.innerHTML=`<strong>No hay un calendario de Carraízo publicado para ${esc(town)}.</strong><p>Eso no confirma que tengas servicio. Si estás sin agua, usa los teléfonos de ayuda de tu pueblo abajo.</p>`;
    box.classList.add('hidden');return;
  }
  const c=currentCycle();
  card.className='rationing-card alert';
  card.innerHTML=`<div><span class="alert-label">RACIONAMIENTO ACTIVO</span><strong>${esc(town)} tiene sectores dentro del plan de Carraízo.</strong><p>Ciclo de 48 horas. ${c?`Próximo cambio programado: <b>${esc(fmtDate(c.next))}</b>.`:''} Escribe tu sector para saber qué zona te corresponde.</p></div><a href="${esc(R.currentEmergency.source)}" target="_blank" rel="noopener">Ver plan publicado</a>`;
  box.classList.remove('hidden');
  $('sector').value='';$('sector-result').innerHTML='';
}

function checkSector(){
  const q=$('sector').value.trim(),result=$('sector-result');
  if(!q){result.innerHTML='<span class="sector-neutral">Escribe el nombre de tu sector o urbanización.</span>';return;}
  const m=matchSector(q);
  if(!m){
    result.innerHTML=`<div class="sector-neutral"><strong>No encontré “${esc(q)}” en la lista publicada.</strong><p>No voy a adivinar tu zona. Llama a la oficina local para confirmar antes de almacenar o salir a buscar agua.</p></div>`;return;
  }
  const s=scheduledStatus(m.zone);
  result.innerHTML=`<div class="sector-answer ${s.on?'scheduled-on':'scheduled-off'}"><span>${esc(s.zoneLabel)} · coincidencia: ${esc(m.item)}</span><strong>${s.on?'CALENDARIO: CON SERVICIO':'CALENDARIO: SIN SERVICIO'}</strong><p>${s.on?'Según el calendario de 48 horas, esta zona está en su periodo con servicio. Esto no garantiza presión o agua real en tu casa.':'Según el calendario de 48 horas, esta zona está en interrupción programada.'}</p><small>Próximo cambio programado: ${esc(fmtDate(s.next))}</small></div>`;
  speak(`${town}. ${m.item}. ${s.zoneLabel}. Según el calendario, ${s.on?'está en periodo con servicio':'está en periodo sin servicio'}. El calendario no garantiza presión o servicio real en tu residencia.`);
}

function statusLabel(p){
  if(p.status==='municipal_24_7')return ['PUBLICADO 24/7','good'];
  if(p.status==='emergency_active')return ['PUBLICADO ACTIVO','good'];
  return ['CONFIRMAR ANTES DE SALIR','check'];
}

function renderWater(){
  const points=(R?.waterPoints||[]).filter(p=>p.municipality===town),list=$('water-list'),empty=$('water-empty'),mobile=R?.mobileWater?.[town];
  $('water-count').textContent=points.length?`${points.length} punto${points.length===1?'':'s'} publicado${points.length===1?'':'s'}`:'Sin oasis fijo confirmado';
  if(mobile){$('mobile-water').classList.remove('hidden');$('mobile-water').innerHTML=`<strong>Distribución móvil / cisterna</strong><p>${esc(mobile.message)}</p><a class="btn primary" href="${tel(mobile.phone)}">Llamar ${esc(mobile.phone)}</a>`;}else $('mobile-water').classList.add('hidden');
  if(!points.length){
    list.innerHTML='';empty.classList.remove('hidden');const h=helpContact(town);const p=h?.phone||R.nmead.centralPhone;$('water-empty-call').href=tel(p);$('water-empty-call').textContent=`Llamar ${p}`;return;
  }
  empty.classList.add('hidden');
  list.innerHTML=points.map(p=>{const [label,cls]=statusLabel(p);return `<article class="resource"><div class="resource-top"><div><span class="status ${cls}">${label}</span><h3>${esc(p.name)}</h3></div><small>Revisado ${esc(p.verifiedOn)}</small></div><p class="address">${esc(p.address)}</p><p><strong>Horario:</strong> ${esc(p.hours||'No publicado')}</p><div class="resource-actions"><a class="btn primary" href="${tel(p.confirmPhone)}">Confirmar por teléfono</a><a class="btn outline" href="${map(p.address)}" target="_blank" rel="noopener">Cómo llegar</a><a class="source" href="${esc(p.source)}" target="_blank" rel="noopener">Fuente</a></div></article>`}).join('');
}

function renderHelp(){
  const local=localContacts(town),zone=zoneOffice(town),cards=[];
  for(const c of local)cards.push({title:c.label,phone:c.phone,note:c.note,source:c.source,tag:'LOCAL / AGUA'});
  if(zone)cards.push({title:`NMEAD · Zona ${zone.name}`,phone:zone.phone,note:`Oficina regional oficial que cubre ${town}.`,source:R.nmead.source,tag:'EMERGENCIAS'});
  cards.push({title:'AAA · Servicio al Cliente',phone:R.aaa.phone,note:`${R.aaa.hours}. Averías, querellas y orientación de servicio.`,source:R.aaa.source,tag:'AAA'});
  $('help-list').innerHTML=cards.map(c=>`<article class="help-card"><span>${esc(c.tag)}</span><h3>${esc(c.title)}</h3><p>${esc(c.note)}</p><a class="call" href="${tel(c.phone)}">Llamar ${esc(c.phone)}</a>${c.source?`<a class="source" href="${esc(c.source)}" target="_blank" rel="noopener">Ver fuente</a>`:''}</article>`).join('');
}

function setTown(name,{announce=false}={}){
  if(!allTowns().includes(name))return;town=name;$('municipality').value=name;$$('[data-town]').forEach(e=>e.textContent=name);renderRationing();renderWater();renderHelp();loadWeather();
  if(announce)speak(summary());
}
function summary(){
  const affected=R?.currentEmergency?.affectedMunicipalities?.includes(town),points=(R?.waterPoints||[]).filter(p=>p.municipality===town),h=helpContact(town);
  let s=`H2O PR. ${town}. `;
  if(affected)s+='Hay racionamiento programado en sectores de este pueblo. Dime tu barrio o urbanización para buscar tu zona. ';
  s+=points.length?`Tengo ${points.length} puntos de agua publicados. `:'No tengo un oasis fijo confirmado publicado. ';
  if(h?.phone)s+=`Para ayuda llama al ${h.phone}.`;
  return s;
}

function speak(text){
  if(!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='es-PR';u.rate=.92;window.speechSynthesis.speak(u);
}
function processVoice(text){
  const n=norm(text);$('voice-status').textContent=`Escuché: “${text}”`;
  const foundTown=allTowns().find(t=>n.includes(norm(t)));if(foundTown)setTown(foundTown);
  const sectorMatch=matchSector(text);if(sectorMatch){$('sector').value=sectorMatch.item;checkSector();return;}
  if(/cisterna|lleven agua|llevar agua|entrega|manejo de emergencia|ayuda/.test(n)){$('help').scrollIntoView({behavior:'smooth'});const h=helpContact(town);speak(`${town}. Para pedir ayuda o cisterna, llama al ${h?.phone||R.nmead.centralPhone}.`);return;}
  if(/agua|oasis|buscar/.test(n)){$('water').scrollIntoView({behavior:'smooth'});speak(summary());return;}
  if(/aaa|acueductos/.test(n)){$('help').scrollIntoView({behavior:'smooth'});speak(`AAA servicio al cliente: ${R.aaa.phone}.`);return;}
  speak(summary());
}
function startVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){$('voice-status').textContent='Este navegador no permite reconocimiento de voz. Usa los botones o prueba Chrome en Android/Windows.';speak(summary());return;}
  if(listening&&recognition){recognition.stop();return;}
  recognition=new SR();recognition.lang='es-PR';recognition.interimResults=false;recognition.maxAlternatives=1;
  recognition.onstart=()=>{listening=true;$('voice-status').textContent='Escuchando… Habla ahora.';$('voice').classList.add('listening');};
  recognition.onresult=e=>processVoice(e.results[0][0].transcript);
  recognition.onerror=e=>{$('voice-status').textContent=`No pude escuchar bien (${e.error}). Intenta otra vez.`;};
  recognition.onend=()=>{listening=false;$('voice').classList.remove('listening');};recognition.start();
}

async function loadLive(){try{const r=await fetch(`./data/live.json?v=${Date.now()}`,{cache:'no-store'});L=await r.json();if(L?.reservoir?.chartUrl){$('reservoir').src=L.reservoir.chartUrl;$('reservoir').classList.remove('hidden');}}catch(e){console.warn(e)}}
async function loadWeather(){
  const c=coords[town],box=$('weather');if(!c){box.innerHTML='<p>Para este pueblo abre el pronóstico oficial de NWS San Juan.</p><a class="source" href="https://www.weather.gov/sju/" target="_blank" rel="noopener">Abrir NWS</a>';return;}
  box.textContent='Cargando pronóstico oficial…';
  try{const p=await fetch(`https://api.weather.gov/points/${c[0]},${c[1]}`,{headers:{Accept:'application/geo+json'}});const pj=await p.json();const f=await fetch(pj.properties.forecast,{headers:{Accept:'application/geo+json'}});const j=await f.json();box.innerHTML=(j.properties.periods||[]).slice(0,4).map(x=>`<div class="weather-row"><strong>${esc(x.name)}</strong><span>${esc(x.temperature)}°${esc(x.temperatureUnit)}</span><span>${esc(x.shortForecast)}</span></div>`).join('');}catch{box.innerHTML='<p>No se pudo cargar NWS.</p><a class="source" href="https://www.weather.gov/sju/" target="_blank" rel="noopener">Abrir NWS</a>';}
}

async function init(){
  try{const r=await fetch(`./data/resources.json?v=${Date.now()}`,{cache:'no-store'});R=await r.json();}catch{document.body.innerHTML='<main class="fatal"><h1>H2O PR no pudo cargar los recursos de emergencia.</h1><a href="tel:7877240124">Llamar NMEAD 787-724-0124</a><a href="tel:7876202482">Llamar AAA 787-620-2482</a></main>';return;}
  $('municipality').innerHTML=allTowns().map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');$('municipality').value=town;
  $('municipality').addEventListener('change',e=>setTown(e.target.value));$('check-sector').addEventListener('click',checkSector);$('sector').addEventListener('keydown',e=>{if(e.key==='Enter')checkSector()});
  $('voice').addEventListener('click',startVoice);$('bottom-voice').addEventListener('click',startVoice);$('read-health').addEventListener('click',()=>speak(R.health.guidance));
  $('large-text').addEventListener('click',()=>{document.documentElement.classList.toggle('large');$('large-text').textContent=document.documentElement.classList.contains('large')?'A− Texto normal':'A+ Texto grande';});
  $$('[data-jump]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.jump)?.scrollIntoView({behavior:'smooth'})));
  $('health-text').textContent=R.health.guidance;$('data-time').textContent=` Datos de emergencia revisados: ${fmtDate(R.updatedAt)}.`;
  setTown(town);loadLive();
}
init();
