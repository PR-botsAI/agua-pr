import fs from 'node:fs/promises';

const OUT=new URL('../data/aaa-reservoirs.json',import.meta.url);
const SITES=[
  {id:'50059000',slug:'carraizo',name:'Carraízo / Lago Loíza',municipality:'Trujillo Alto'},
  {id:'50045000',slug:'la-plata',name:'La Plata',municipality:'Toa Alta'},
  {id:'50047550',slug:'cidra',name:'Cidra',municipality:'Cidra'},
  {id:'50111210',slug:'toa-vaca',name:'Toa Vaca',municipality:'Villalba'},
  {id:'50071225',slug:'fajardo',name:'Fajardo',municipality:'Fajardo'},
  {id:'50076800',slug:'rio-blanco',name:'Río Blanco / Lago Blanco',municipality:'Naguabo'}
];
const PARAM='72376';
const BASE='https://waterservices.usgs.gov/nwis/iv/';

async function previous(){try{return JSON.parse(await fs.readFile(OUT,'utf8'));}catch{return null;}}
function seriesValues(series){return (series?.values||[]).flatMap(v=>v?.value||[]).map(v=>({value:Number(v.value),observedAt:v.dateTime,qualifiers:v.qualifiers||[]})).filter(v=>Number.isFinite(v.value)&&v.observedAt);}
function nearest24h(values){if(values.length<2)return null;const latest=values.at(-1);const target=Date.parse(latest.observedAt)-24*3600000;let best=null;for(const v of values){const delta=Math.abs(Date.parse(v.observedAt)-target);if(!best||delta<best.delta)best={...v,delta};}return best&&best.delta<=3*3600000?best:null;}
function compact(values){if(values.length<=96)return values;const step=Math.ceil(values.length/96);return values.filter((_,i)=>i%step===0||i===values.length-1);}
function parse(payload){const bySite=new Map();for(const series of payload?.value?.timeSeries||[]){const id=series?.sourceInfo?.siteCode?.[0]?.value;if(!id)continue;const values=seriesValues(series);if(!values.length)continue;bySite.set(id,{values,unit:series?.variable?.unit?.unitCode||null,description:series?.variable?.variableDescription||null});}
 return SITES.map(site=>{const hit=bySite.get(site.id);if(!hit)return {...site,reading:null,change24h:null,series:[]};const latest=hit.values.at(-1),prior=nearest24h(hit.values),change24h=prior?Number((latest.value-prior.value).toFixed(3)):null;return {...site,reading:{value:latest.value,unit:hit.unit,observedAt:latest.observedAt,qualifiers:latest.qualifiers,parameterDescription:hit.description},change24h,prior24h:prior?{value:prior.value,observedAt:prior.observedAt}:null,series:compact(hit.values).map(v=>({value:v.value,observedAt:v.observedAt}))};});}
async function pull(){const url=`${BASE}?format=json&sites=${encodeURIComponent(SITES.map(s=>s.id).join(','))}&parameterCd=${PARAM}&siteStatus=all&period=P2D`;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(url,{signal:controller.signal,headers:{'user-agent':'H2O-PR-data-refresh/2.0 (+https://h20pr.com)','accept':'application/json','cache-control':'no-cache'}});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return {url,payload:await r.json()};}finally{clearTimeout(timer);}}
const old=await previous();const attemptedAt=new Date().toISOString();let output;
try{const {url,payload}=await pull();const reservoirs=parse(payload);const live=reservoirs.filter(r=>Number.isFinite(r.reading?.value)).length;if(!live)throw new Error('USGS returned no configured reservoir readings');output={schemaVersion:1,status:'live',updatedAt:attemptedAt,lastSuccessAt:attemptedAt,source:'USGS Water Services',sourceUrl:url,cooperativeOperator:'Puerto Rico Aqueduct and Sewer Authority',parameterCode:PARAM,parameterMeaning:'Lake or reservoir elevation above local mean sea level, meters [OLDPR]',reservoirs};console.log(`USGS/AAA reservoirs live: ${live}/${SITES.length}`);}catch(error){if(old?.lastSuccessAt){output={...old,status:'stale',updatedAt:attemptedAt,lastAttemptAt:attemptedAt,error:error instanceof Error?error.message:String(error)};console.warn('Using last real USGS reservoir readings as STALE:',output.error);}else{output={schemaVersion:1,status:'unavailable',updatedAt:attemptedAt,lastAttemptAt:attemptedAt,source:'USGS Water Services',sourceUrl:BASE,cooperativeOperator:'Puerto Rico Aqueduct and Sewer Authority',parameterCode:PARAM,reservoirs:SITES.map(s=>({...s,reading:null,change24h:null,series:[]})),error:error instanceof Error?error.message:String(error)};console.error(output.error);process.exitCode=2;}}
await fs.writeFile(OUT,JSON.stringify(output,null,2)+'\n');
