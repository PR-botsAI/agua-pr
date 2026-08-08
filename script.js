const ARECIBO={lat:18.4724,lon:-66.7157,label:'Arecibo'};
const fallback={updatedAt:'2026-08-08T01:03:00-04:00',reservoir:{chartUrl:'https://appweb.acueductospr.com/AAA_Embalses/ImageFiles/current_chart_20260807045503590.png',observedLabel:'Gráfica oficial AAA publicada el 7 ago 2026 · lectura diaria ~5:00 a. m.',source:'https://www.acueductos.pr.gov/infraestructura/niveles-de-los-embalses'},serviceUpdates:[]};

const $=(id)=>document.getElementById(id);
const fmt=(iso)=>{try{return new Intl.DateTimeFormat('es-PR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Puerto_Rico'}).format(new Date(iso));}catch{return iso||'—'}};
const escapeHtml=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function renderOfficial(data){
  const payload={...fallback,...data,reservoir:{...fallback.reservoir,...(data?.reservoir||{})}};
  $('app-updated').textContent=fmt(payload.updatedAt);
  if(payload.reservoir.chartUrl){
    $('reservoir-chart').src=payload.reservoir.chartUrl;
    $('reservoir-chart').classList.remove('hidden');
    $('reservoir-loading').classList.add('hidden');
    $('reservoir-time').textContent=payload.reservoir.observedLabel||'Fuente oficial AAA';
  }
  const updates=Array.isArray(payload.serviceUpdates)?payload.serviceUpdates:[];
  $('service-title').textContent='No hay un feed oficial por dirección';
  $('service-chip').textContent='SIN FEED DE SERVICIO';
  $('service-chip').className='chip warn';
  $('service-copy').textContent='AAA publica datos y comunicados, pero H2O PR todavía no recibe un estado estructurado que permita afirmar si una residencia específica tiene agua ahora mismo.';
  if(updates.length){
    $('service-title').textContent='Comunicados oficiales relacionados';
    $('service-chip').textContent='AAA';
    $('service-chip').className='chip good';
    $('service-updates').innerHTML=updates.slice(0,3).map(u=>`<a class="source-item" href="${escapeHtml(u.url)}" target="_blank" rel="noopener"><strong>${escapeHtml(u.title)}</strong><small>${escapeHtml(u.dateLabel||'Fuente AAA')}</small></a>`).join('');
  } else {
    $('service-updates').innerHTML='<div class="source-item"><strong>Consulta directa disponible</strong><small>Para confirmar un sector sin agua, llame a AAA al 787-620-2482 o revise sus canales oficiales.</small></div>';
  }
  const age=Date.now()-new Date(payload.updatedAt).getTime();
  if(Number.isFinite(age)&&age>3*60*60*1000){
    $('stale-banner').textContent='La última actualización automática de H2O PR tiene más de 3 horas. Use los enlaces oficiales antes de tomar una decisión.';
    $('stale-banner').classList.remove('hidden');
  }
}

async function loadOfficial(){
  try{
    const r=await fetch(`./data/live.json?v=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    renderOfficial(await r.json());
  }catch(e){
    console.warn('official data fallback',e);
    renderOfficial(fallback);
  }
}

function rainChance(period){
  const p=period?.probabilityOfPrecipitation?.value;
  return Number.isFinite(p)?`${Math.round(p)}% lluvia`:'Lluvia: —';
}

function renderForecast(periods,label,updated){
  $('weather-time').textContent=`${label} · ${updated?fmt(updated):'NWS'}`;
  $('weather-grid').innerHTML=periods.slice(0,8).map(p=>`<article class="card weather-card"><h3>${escapeHtml(p.name)}</h3><div class="temp">${escapeHtml(p.temperature)}°${escapeHtml(p.temperatureUnit)}</div><p class="rain">${rainChance(p)}</p><p>${escapeHtml(p.shortForecast)}</p><p class="fineprint">Viento ${escapeHtml(p.windSpeed)} ${escapeHtml(p.windDirection)}</p></article>`).join('');
}

function renderAlerts(features){
  if(!features?.length){$('weather-alerts').innerHTML='';return;}
  $('weather-alerts').innerHTML=features.slice(0,4).map(a=>{const p=a.properties||{};return `<article class="alert-card"><strong>${escapeHtml(p.event||'Alerta meteorológica')}</strong><span>${escapeHtml(p.headline||p.description||'')}</span></article>`}).join('');
}

async function loadNws(lat=ARECIBO.lat,lon=ARECIBO.lon,label=ARECIBO.label){
  $('weather-grid').innerHTML='<article class="card loading">Cargando pronóstico oficial…</article>';
  try{
    const pointResp=await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,{headers:{Accept:'application/geo+json'}});
    if(!pointResp.ok)throw new Error(`NWS point ${pointResp.status}`);
    const point=await pointResp.json();
    const city=point?.properties?.relativeLocation?.properties?.city;
    const region=point?.properties?.relativeLocation?.properties?.state;
    const resolved=city?`${city}${region?`, ${region}`:''}`:label;
    const [forecastResp,alertsResp]=await Promise.all([
      fetch(point.properties.forecast,{headers:{Accept:'application/geo+json'}}),
      fetch(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,{headers:{Accept:'application/geo+json'}})
    ]);
    if(!forecastResp.ok)throw new Error(`NWS forecast ${forecastResp.status}`);
    const forecast=await forecastResp.json();
    const alerts=alertsResp.ok?await alertsResp.json():{features:[]};
    renderForecast(forecast?.properties?.periods||[],resolved,forecast?.properties?.updated);
    renderAlerts(alerts.features||[]);
    return resolved;
  }catch(e){
    console.error(e);
    $('weather-grid').innerHTML='<article class="card"><strong>No se pudo cargar api.weather.gov.</strong><p>Abra el pronóstico oficial del Servicio Nacional de Meteorología en San Juan.</p><a class="button secondary" href="https://www.weather.gov/sju/" target="_blank" rel="noopener">Abrir NWS San Juan ↗</a></article>';
    $('weather-time').textContent='Error al conectar';
    return label;
  }
}

$('locate-btn')?.addEventListener('click',()=>{
  if(!navigator.geolocation){alert('Este navegador no ofrece ubicación.');return;}
  const btn=$('locate-btn');btn.disabled=true;btn.textContent='Buscando…';
  navigator.geolocation.getCurrentPosition(async pos=>{
    const label=await loadNws(pos.coords.latitude,pos.coords.longitude,'Tu ubicación');
    $('location-title').textContent=label;
    $('location-copy').textContent='El pronóstico usa su ubicación aproximada. Los datos de AAA siguen siendo fuentes generales/oficiales de Puerto Rico.';
    btn.textContent='Ubicación actualizada';
  },()=>{btn.disabled=false;btn.textContent='Usar mi ubicación';alert('No se pudo obtener permiso de ubicación.');},{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
});

loadOfficial();
loadNws();
