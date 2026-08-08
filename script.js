const DEFAULT_MUNICIPALITY = 'Arecibo';
const MUNICIPAL_COORDS = {
  'Arecibo':[18.4724,-66.7157],
  'San Juan':[18.4655,-66.1057],
  'Carolina':[18.3808,-65.9574],
  'Canóvanas':[18.3751,-65.8993],
  'Loíza':[18.4313,-65.8802],
  'Trujillo Alto':[18.3547,-66.0074],
  'Juncos':[18.2275,-65.9210],
  'Gurabo':[18.2544,-65.9729]
};
const fallbackLive = {
  updatedAt:null,
  reservoir:{
    chartUrl:'https://appweb.acueductospr.com/AAA_Embalses/ImageFiles/current_chart_20260807045503590.png',
    observedLabel:'Última gráfica oficial AAA disponible en H2O PR'
  }
};

let resources = null;
let liveData = fallbackLive;
let currentMunicipality = DEFAULT_MUNICIPALITY;
let lastForecastLabel = 'Arecibo';
let recognition = null;
let isListening = false;

const $ = (id) => document.getElementById(id);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const phoneHref = (phone) => `tel:${String(phone || '').replace(/[^0-9+]/g,'')}`;
const normalizeText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const mapUrl = (query) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
const formatDateTime = (iso) => {
  if(!iso) return '—';
  try { return new Intl.DateTimeFormat('es-PR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Puerto_Rico'}).format(new Date(iso)); }
  catch { return iso; }
};
const formatDate = (iso) => {
  if(!iso) return '';
  try { return new Intl.DateTimeFormat('es-PR',{dateStyle:'medium',timeZone:'America/Puerto_Rico'}).format(new Date(`${iso}T12:00:00-04:00`)); }
  catch { return iso; }
};

function allMunicipalities(){
  if(!resources?.nmead?.zones) return [DEFAULT_MUNICIPALITY];
  return resources.nmead.zones.flatMap(zone => zone.municipalities).sort((a,b)=>a.localeCompare(b,'es'));
}

function zoneForMunicipality(name){
  return resources?.nmead?.zones?.find(zone => zone.municipalities.includes(name)) || null;
}

function localContacts(name){
  return resources?.municipalContacts?.[name] || [];
}

function preferredHelpContact(name){
  const contacts = localContacts(name);
  return contacts.find(c=>c.kind==='water') || contacts.find(c=>c.kind==='emergency') || contacts[0] || zoneForMunicipality(name);
}

function setMunicipality(name,{announce=false,scroll=false}={}){
  if(!allMunicipalities().includes(name)) return;
  currentMunicipality = name;
  const select = $('municipality-select');
  if(select) select.value = name;
  $$('[data-municipality]').forEach(el=>el.textContent=name);
  renderWaterPoints();
  renderContacts();
  const coords = MUNICIPAL_COORDS[name];
  if(coords) loadNws(coords[0],coords[1],name);
  else {
    $('weather-time').textContent = 'Usa “mi ubicación” para un pronóstico local exacto.';
    $('weather-grid').innerHTML = '<p class="weather-message">Para este municipio, usa el botón <strong>“Usar mi ubicación”</strong> arriba. H2O PR no adivina coordenadas para información meteorológica.</p>';
    $('weather-alerts').innerHTML = '';
  }
  if(announce) speak(`Mostrando recursos para ${name}. ${waterSummary(name)}`);
  if(scroll) $('agua')?.scrollIntoView({behavior:'smooth',block:'start'});
}

function populateMunicipalities(){
  const select = $('municipality-select');
  if(!select) return;
  select.innerHTML = allMunicipalities().map(name=>`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  select.value = currentMunicipality;
  select.addEventListener('change',()=>setMunicipality(select.value));
}

function pointBadge(point){
  if(point.status === 'permanent') return '<span class="status-badge status-good">PUNTO PERMANENTE</span>';
  return '<span class="status-badge status-check">LLAMA ANTES DE SALIR</span>';
}

function renderWaterPoints(){
  if(!resources) return;
  const points = resources.waterPoints.filter(point=>point.municipality===currentMunicipality);
  const list = $('water-points');
  const empty = $('no-water-points');
  const warning = $('water-warning');
  $('water-count').textContent = points.length ? `${points.length} publicado${points.length===1?'':'s'}` : 'Sin punto confirmado';

  if(!points.length){
    list.innerHTML='';
    empty.classList.remove('hidden');
    const help = preferredHelpContact(currentMunicipality);
    if(help?.phone){
      $('empty-call').href=phoneHref(help.phone);
      $('empty-call').textContent=`Llamar ${help.phone}`;
    } else {
      $('empty-call').href=phoneHref(resources.nmead.centralPhone);
      $('empty-call').textContent=`Llamar NMEAD ${resources.nmead.centralPhone}`;
    }
    warning.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  const needsConfirm = points.some(point=>point.status!=='permanent');
  if(needsConfirm){
    warning.innerHTML='<strong>Importante:</strong> algunos puntos fueron publicados por el municipio en una emergencia anterior. H2O PR los conserva como referencia, pero debes llamar antes de salir.';
    warning.classList.remove('hidden');
  } else warning.classList.add('hidden');

  list.innerHTML = points.map(point=>{
    const sourceDate = point.sourceDate ? `Publicado ${formatDate(point.sourceDate)}` : `Fuente revisada ${formatDate(point.verifiedOn)}`;
    return `<article class="resource-card">
      <div class="resource-top">
        <div>${pointBadge(point)}<h3>${escapeHtml(point.name)}</h3></div>
        <span class="source-stamp">${escapeHtml(sourceDate)}</span>
      </div>
      <p class="address">${escapeHtml(point.address)}</p>
      <div class="resource-facts">
        <span><strong>Horario:</strong> ${escapeHtml(point.hours || 'No publicado')}</span>
        ${point.accessibility?`<span><strong>Acceso:</strong> ${escapeHtml(point.accessibility)}</span>`:''}
      </div>
      <p class="resource-note">${escapeHtml(point.note)}</p>
      <div class="card-actions">
        <a class="btn btn-primary" href="${phoneHref(point.confirmPhone)}">Confirmar ${escapeHtml(point.confirmPhone)}</a>
        <a class="btn btn-outline" href="${mapUrl(point.address)}" target="_blank" rel="noopener">Cómo llegar</a>
        <a class="source-link" href="${escapeHtml(point.source)}" target="_blank" rel="noopener">Ver fuente</a>
      </div>
    </article>`;
  }).join('');
}

function contactCard(contact,{official=true}={}){
  return `<article class="contact-card">
    <div>
      <span class="contact-type">${official?'CONTACTO VERIFICADO':'CONTACTO DE APOYO'}</span>
      <h3>${escapeHtml(contact.label || contact.name || 'Ayuda')}</h3>
      <p>${escapeHtml(contact.note || '')}</p>
    </div>
    <a class="phone-link" href="${phoneHref(contact.phone)}"><span>Llamar</span><strong>${escapeHtml(contact.phone)}</strong></a>
    ${contact.source?`<a class="source-link" href="${escapeHtml(contact.source)}" target="_blank" rel="noopener">Fuente</a>`:''}
  </article>`;
}

function renderContacts(){
  if(!resources) return;
  const local = localContacts(currentMunicipality);
  const zone = zoneForMunicipality(currentMunicipality);
  const cards = [];
  local.forEach(contact=>cards.push(contactCard(contact,{official:contact.sourceType!=='community-directory'})));
  if(zone){
    cards.push(contactCard({
      label:`NMEAD — Zona ${zone.name}`,
      phone:zone.phone,
      note:`Oficina regional oficial que cubre ${currentMunicipality}.`,
      source:resources.nmead.source
    }));
  }
  cards.push(contactCard({
    label:'AAA — Servicio al Cliente',
    phone:resources.aaa.phone,
    note:`${resources.aaa.hours}. Para averías, servicio y orientación de la Autoridad.`,
    source:resources.aaa.source
  }));
  $('contact-grid').innerHTML=cards.join('');
}

function renderSuppliers(){
  if(!resources) return;
  $('supplier-grid').innerHTML=resources.suppliers.map(supplier=>`<article class="supplier-card">
    <span class="supplier-type">${escapeHtml(supplier.kind)}</span>
    <h3>${escapeHtml(supplier.name)}</h3>
    <p class="supplier-area">${escapeHtml(supplier.area)}</p>
    <p>${escapeHtml(supplier.note)}</p>
    <div class="card-actions">
      <a class="btn btn-dark" href="${phoneHref(supplier.phone)}">Llamar ${escapeHtml(supplier.phone)}</a>
      <a class="source-link" href="${escapeHtml(supplier.source)}" target="_blank" rel="noopener">Sitio del proveedor</a>
    </div>
  </article>`).join('');
}

function renderHealth(){
  if(!resources?.health) return;
  $('health-guidance').textContent=resources.health.guidance;
  $('health-source').href=resources.health.source;
}

function renderReservoir(){
  const reservoir={...fallbackLive.reservoir,...(liveData?.reservoir||{})};
  if(!reservoir.chartUrl) return;
  $('reservoir-chart').src=reservoir.chartUrl;
  $('reservoir-chart').classList.remove('hidden');
  $('reservoir-loading').classList.add('hidden');
  $('reservoir-time').textContent=reservoir.observedLabel || 'Fuente oficial AAA';
}

function rainChance(period){
  const value=period?.probabilityOfPrecipitation?.value;
  return Number.isFinite(value)?`${Math.round(value)}% lluvia`:'Lluvia —';
}

function renderWeather(periods,label,updated){
  lastForecastLabel=label;
  $('weather-time').textContent=`NWS · ${label}${updated?` · actualizado ${formatDateTime(updated)}`:''}`;
  $('weather-grid').innerHTML=periods.slice(0,4).map(period=>`<div class="weather-row">
    <strong>${escapeHtml(period.name)}</strong>
    <span class="weather-temp">${escapeHtml(period.temperature)}°${escapeHtml(period.temperatureUnit)}</span>
    <span>${rainChance(period)}</span>
    <span>${escapeHtml(period.shortForecast)}</span>
  </div>`).join('') || '<p>No hay periodos de pronóstico disponibles.</p>';
}

function renderAlerts(features){
  if(!features?.length){ $('weather-alerts').innerHTML=''; return; }
  $('weather-alerts').innerHTML=features.slice(0,3).map(feature=>{
    const p=feature.properties||{};
    return `<div class="weather-alert"><strong>${escapeHtml(p.event||'Alerta meteorológica')}</strong><span>${escapeHtml(p.headline||'')}</span></div>`;
  }).join('');
}

async function loadNws(lat,lon,label='Tu ubicación'){
  $('weather-grid').innerHTML='<p>Cargando pronóstico oficial…</p>';
  try{
    const pointResp=await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,{headers:{Accept:'application/geo+json'}});
    if(!pointResp.ok) throw new Error(`NWS points ${pointResp.status}`);
    const point=await pointResp.json();
    const [forecastResp,alertsResp]=await Promise.all([
      fetch(point.properties.forecast,{headers:{Accept:'application/geo+json'}}),
      fetch(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,{headers:{Accept:'application/geo+json'}})
    ]);
    if(!forecastResp.ok) throw new Error(`NWS forecast ${forecastResp.status}`);
    const forecast=await forecastResp.json();
    const alerts=alertsResp.ok?await alertsResp.json():{features:[]};
    const city=point?.properties?.relativeLocation?.properties?.city;
    renderWeather(forecast?.properties?.periods||[],city||label,forecast?.properties?.updated);
    renderAlerts(alerts.features||[]);
    return city||label;
  }catch(error){
    console.warn(error);
    $('weather-time').textContent='No se pudo conectar con NWS';
    $('weather-grid').innerHTML='<p class="weather-message">El pronóstico no cargó. <a class="text-link" href="https://www.weather.gov/sju/" target="_blank" rel="noopener">Abrir NWS San Juan</a>.</p>';
    return label;
  }
}

function waterSummary(name=currentMunicipality){
  if(!resources) return 'Los recursos todavía están cargando.';
  const points=resources.waterPoints.filter(point=>point.municipality===name);
  if(!points.length){
    const help=preferredHelpContact(name);
    return `No tengo un oasis confirmado para ${name}. Para no enviarte a un lugar equivocado, llama ${help?.phone||resources.nmead.centralPhone} y pregunta dónde están entregando agua hoy.`;
  }
  const permanent=points.filter(p=>p.status==='permanent');
  if(permanent.length){
    return `Tengo ${points.length} punto${points.length===1?'':'s'} publicado${points.length===1?'':'s'} para ${name}. ${permanent[0].name} aparece como permanente. Confirma antes de salir al ${permanent[0].confirmPhone}.`;
  }
  const help=preferredHelpContact(name);
  return `Tengo ${points.length} punto${points.length===1?'':'s'} publicado${points.length===1?'':'s'} anteriormente para ${name}, pero ninguno está confirmado como activo hoy. Llama ${help?.phone||points[0].confirmPhone} antes de salir.`;
}

function helpSummary(name=currentMunicipality){
  if(!resources) return 'Los contactos todavía están cargando.';
  const contact=preferredHelpContact(name);
  const zone=zoneForMunicipality(name);
  const parts=[];
  if(contact?.phone) parts.push(`Para ayuda local en ${name}, llama ${contact.phone}.`);
  if(zone && contact?.phone!==zone.phone) parts.push(`La zona ${zone.name} de Manejo de Emergencias es ${zone.phone}.`);
  parts.push(`AAA es ${resources.aaa.phone}.`);
  return parts.join(' ');
}

function speak(text){
  if(!('speechSynthesis' in window)){
    $('voice-status').textContent='Este navegador no puede leer en voz alta. La información permanece disponible en pantalla.';
    return;
  }
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang='es-PR';
  utterance.rate=0.92;
  const voices=window.speechSynthesis.getVoices();
  const spanish=voices.find(v=>/^es[-_]/i.test(v.lang));
  if(spanish) utterance.voice=spanish;
  window.speechSynthesis.speak(utterance);
}

function detectMunicipality(transcript){
  const normalized=normalizeText(transcript);
  return allMunicipalities().sort((a,b)=>b.length-a.length).find(name=>normalized.includes(normalizeText(name))) || null;
}

function handleVoiceIntent(transcript){
  const heard=transcript.trim();
  const normalized=normalizeText(heard);
  const municipality=detectMunicipality(heard);
  if(municipality) setMunicipality(municipality);
  $('voice-status').textContent=`Escuché: “${heard}”`;

  if(/agua|oasis|donde|buscar|necesito/.test(normalized)){
    $('agua')?.scrollIntoView({behavior:'smooth'});
    const answer=waterSummary(municipality||currentMunicipality);
    $('voice-status').textContent=`${heard} — ${answer}`;
    speak(answer);
    return;
  }
  if(/manejo|emergencia|ayuda|llamar|telefono/.test(normalized)){
    $('ayuda')?.scrollIntoView({behavior:'smooth'});
    const answer=helpSummary(municipality||currentMunicipality);
    $('voice-status').textContent=answer;
    speak(answer);
    return;
  }
  if(/aaa|acueductos/.test(normalized)){
    const answer=`La Autoridad de Acueductos y Alcantarillados atiende en el ${resources.aaa.phone}, ${resources.aaa.hours}.`;
    $('voice-status').textContent=answer;
    speak(answer);
    return;
  }
  if(/cisterna|camion|entrega|suplidor|comprar/.test(normalized)){
    $('entrega')?.scrollIntoView({behavior:'smooth'});
    const first=resources.suppliers[0];
    const answer=`Tengo proveedores privados listados. ${first.name} indica entrega de agua potable a granel y su teléfono es ${first.phone}. Confirma precio y disponibilidad antes de contratar.`;
    $('voice-status').textContent=answer;
    speak(answer);
    return;
  }
  if(/hervir|salud|segura|regrese|consumo/.test(normalized)){
    $('salud')?.scrollIntoView({behavior:'smooth'});
    $('voice-status').textContent=resources.health.guidance;
    speak(resources.health.guidance);
    return;
  }
  if(/lluvia|clima|tiempo|alerta/.test(normalized)){
    $('situacion')?.scrollIntoView({behavior:'smooth'});
    const answer=`Abriendo el pronóstico y las alertas meteorológicas. El último pronóstico cargado corresponde a ${lastForecastLabel}.`;
    $('voice-status').textContent=answer;
    speak(answer);
    return;
  }
  if(municipality){
    const answer=`Listo. Cambié tu pueblo a ${municipality}. ${waterSummary(municipality)}`;
    $('voice-status').textContent=answer;
    speak(answer);
    return;
  }
  const answer='No entendí la solicitud. Puedes decir: necesito agua, manejo de emergencias, AAA, entrega de agua, o el nombre de tu pueblo.';
  $('voice-status').textContent=answer;
  speak(answer);
}

function setupVoice(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){
    $('voice-status').textContent='Tu navegador no ofrece reconocimiento de voz. Puedes usar “Escuchar resumen” o los botones grandes de la página.';
    $('voice-mic').disabled=true;
    return;
  }
  recognition=new Recognition();
  recognition.lang='es-US';
  recognition.interimResults=false;
  recognition.maxAlternatives=1;
  recognition.onstart=()=>{
    isListening=true;
    $('voice-status').textContent='Te escucho… di tu pueblo y qué necesitas.';
    $('voice-mic').textContent='Escuchando…';
  };
  recognition.onend=()=>{
    isListening=false;
    $('voice-mic').textContent='Iniciar voz';
  };
  recognition.onerror=(event)=>{
    $('voice-status').textContent=`No pude escuchar (${event.error}). Puedes intentar otra vez o usar los botones.`;
  };
  recognition.onresult=(event)=>handleVoiceIntent(event.results[0][0].transcript);
}

function startVoice(){
  if(!recognition){
    $('voice-panel')?.scrollIntoView({behavior:'smooth'});
    speak(`H2O PR. ${waterSummary()} ${helpSummary()}`);
    return;
  }
  try { if(isListening) recognition.stop(); else recognition.start(); } catch {}
}

function setupControls(){
  $$('[data-go]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.go)?.scrollIntoView({behavior:'smooth',block:'start'})));
  $('voice-start')?.addEventListener('click',()=>{ $('voice-panel')?.scrollIntoView({behavior:'smooth'}); startVoice(); });
  $('voice-mic')?.addEventListener('click',startVoice);
  $('mobile-voice')?.addEventListener('click',()=>{ $('voice-panel')?.scrollIntoView({behavior:'smooth'}); startVoice(); });
  $('voice-read')?.addEventListener('click',()=>speak(`H2O PR para ${currentMunicipality}. ${waterSummary()} ${helpSummary()} ${resources.health.guidance}`));
  $('health-read')?.addEventListener('click',()=>speak(resources.health.guidance));

  const largeBtn=$('large-text-btn');
  const saved=localStorage.getItem('h2opr-large-text')==='1';
  document.documentElement.classList.toggle('large-text',saved);
  largeBtn?.setAttribute('aria-pressed',String(saved));
  largeBtn?.addEventListener('click',()=>{
    const active=!document.documentElement.classList.contains('large-text');
    document.documentElement.classList.toggle('large-text',active);
    localStorage.setItem('h2opr-large-text',active?'1':'0');
    largeBtn.setAttribute('aria-pressed',String(active));
    largeBtn.textContent=active?'A− Texto normal':'A+ Texto grande';
  });

  $('locate-btn')?.addEventListener('click',()=>{
    if(!navigator.geolocation){
      $('location-help').textContent='Este navegador no ofrece ubicación. Selecciona tu pueblo manualmente.';
      return;
    }
    const btn=$('locate-btn');
    btn.disabled=true;
    btn.textContent='Buscando…';
    navigator.geolocation.getCurrentPosition(async position=>{
      const city=await loadNws(position.coords.latitude,position.coords.longitude,'Tu ubicación');
      const match=allMunicipalities().find(name=>normalizeText(name)===normalizeText(city));
      if(match){
        setMunicipality(match);
        $('location-help').textContent=`Ubicación aproximada identificada como ${match}. No se guardó la ubicación.`;
      }else{
        $('location-help').textContent=`Pronóstico cargado para ${city}. No pudimos vincularlo automáticamente a un municipio; selecciona tu pueblo arriba.`;
      }
      btn.disabled=false;
      btn.textContent='Ubicación actualizada';
    },()=>{
      btn.disabled=false;
      btn.textContent='Usar mi ubicación';
      $('location-help').textContent='No se obtuvo permiso de ubicación. Selecciona tu pueblo manualmente.';
    },{enableHighAccuracy:false,timeout:9000,maximumAge:300000});
  });
}

async function loadData(){
  const [resourcesResult,liveResult]=await Promise.allSettled([
    fetch(`./data/resources.json?v=${Date.now()}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}),
    fetch(`./data/live.json?v=${Date.now()}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()})
  ]);
  if(resourcesResult.status==='fulfilled') resources=resourcesResult.value;
  else throw new Error('No se pudo cargar el registro de recursos de emergencia.');
  if(liveResult.status==='fulfilled') liveData={...fallbackLive,...liveResult.value};

  $('resources-updated').textContent=formatDateTime(resources.updatedAt);
  $('app-updated').textContent=formatDateTime(liveData.updatedAt);
  populateMunicipalities();
  renderSuppliers();
  renderHealth();
  renderReservoir();
  setupVoice();
  setupControls();
  setMunicipality(DEFAULT_MUNICIPALITY);
}

loadData().catch(error=>{
  console.error(error);
  document.querySelector('main').insertAdjacentHTML('afterbegin','<div class="fatal-notice"><strong>No se pudo cargar el registro de emergencia.</strong> Llama al 911 si hay peligro inmediato, a AAA al <a href="tel:7876202482">787-620-2482</a> o a NMEAD al <a href="tel:7877240124">787-724-0124</a>.</div>');
});
