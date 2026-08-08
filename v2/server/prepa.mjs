const SOURCES = {
  generation: 'https://operationdata.prepa.pr.gov/dataSource.js',
  levels: 'https://operationdata.prepa.pr.gov/dataLevels.js',
  history: 'https://operationdata.prepa.pr.gov/dataGraph.js'
};

function extractArray(text, name) {
  const m = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*\\[`, 'm').exec(text);
  if (!m) throw new Error(`Array ${name} not found`);
  const start = m.index + m[0].lastIndexOf('[');
  let depth=0, quote=null, escape=false;
  for(let i=start;i<text.length;i++){
    const ch=text[i];
    if(quote){ if(escape)escape=false; else if(ch==='\\')escape=true; else if(ch===quote)quote=null; continue; }
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='[')depth++;
    if(ch===']'&&--depth===0)return text.slice(start+1,i);
  }
  throw new Error(`Array ${name} is unterminated`);
}

function extractArrayAfterKey(text,key){
  const m=new RegExp(`${key}\\s*:\\s*\\[`, 'm').exec(text);if(!m)return '';
  const start=m.index+m[0].lastIndexOf('[');let depth=0,quote=null,escape=false;
  for(let i=start;i<text.length;i++){
    const ch=text[i];
    if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote=null;continue;}
    if(ch==='"'||ch==="'"){quote=ch;continue;}if(ch==='[')depth++;if(ch===']'&&--depth===0)return text.slice(start+1,i);
  }
  return '';
}

function splitObjects(text){
  const out=[];let depth=0,start=-1,quote=null,escape=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote=null;continue;}
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='{'){if(depth===0)start=i;depth++;}
    else if(ch==='}'&&--depth===0&&start>=0){out.push(text.slice(start,i+1));start=-1;}
  }
  return out;
}

function escapedKey(key){return key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function fieldString(obj,key){return obj.match(new RegExp(`["']?${escapedKey(key)}["']?\\s*:\\s*["']([^"']*)["']`,'i'))?.[1]??null;}
function fieldNumber(obj,key){const v=obj.match(new RegExp(`["']?${escapedKey(key)}["']?\\s*:\\s*([-+]?\\d+(?:\\.\\d+)?)`,'i'))?.[1];return v==null?null:Number(v);}
function assignedStrings(text,name){const expr=text.match(new RegExp(`(?:const|let|var)\\s+${name}\\s*=([^;]+);`,'m'))?.[1];if(!expr)return null;const parts=[...expr.matchAll(/["']([^"']*)["']/g)].map(m=>m[1]);return parts.length?parts.join(''):null;}

export function parseGeneration(text){
  const metrics=splitObjects(extractArray(text,'dataMetrics')).map(o=>({index:fieldString(o,'Index'),description:fieldString(o,'Desc'),value:fieldNumber(o,'value')})).filter(x=>x.description&&Number.isFinite(x.value));
  const byFuel=splitObjects(extractArray(text,'dataByFuel')).map(o=>({fuel:fieldString(o,'fuel'),value:fieldNumber(o,'value')})).filter(x=>x.fuel&&Number.isFinite(x.value));
  const sites=splitObjects(extractArray(text,'dataLoadPerSite')).map(site=>({
    index:fieldString(site,'Index'),type:fieldString(site,'Type'),name:fieldString(site,'Desc'),siteTotalMw:fieldNumber(site,'SiteTotal'),
    units:splitObjects(extractArrayAfterKey(site,'units')).map(u=>({index:fieldString(u,'Index'),name:fieldString(u,'Unit'),mw:fieldNumber(u,'MW'),mvar:fieldString(u,'MVar'),cost:fieldNumber(u,'Cost')})).filter(u=>u.name&&Number.isFinite(u.mw))
  })).filter(x=>x.name&&x.type&&Number.isFinite(x.siteTotalMw));
  if(!metrics.length&&!sites.length)throw new Error('generation parser returned no data');
  return {observedAtRaw:assignedStrings(text,'dataFechaAcualizado'),metrics,byFuel,sites};
}

export function parseLevels(text){
  const reservoirs=splitObjects(extractArray(text,'niveles')).map(o=>{const readingRaw=fieldString(o,'lectura'),differenceRaw=fieldString(o,'diferencia');return {id:fieldString(o,'embalse'),reading:readingRaw==null?null:Number(readingRaw),readingRaw,difference:differenceRaw==null?null:Number(String(differenceRaw).replace('=','0')),differenceRaw};}).filter(x=>x.id&&Number.isFinite(x.reading));
  if(!reservoirs.length)throw new Error('levels parser returned no data');
  return {observedAtRaw:assignedStrings(text,'fechaembalse'),reservoirs};
}

export function parseHistory(text){
  const points=splitObjects(extractArray(text,'dataGraph')).map(o=>({hour:fieldString(o,'Hour'),frequencyHz:fieldNumber(o,'Frequency'),generationMw:fieldNumber(o,'Generation')})).filter(x=>x.hour&&Number.isFinite(x.generationMw));
  if(!points.length)throw new Error('history parser returned no data');
  return {observedAtRaw:assignedStrings(text,'temperatura'),points};
}

async function fetchText(url){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  try{const r=await fetch(url,{signal:controller.signal,headers:{'user-agent':'H2O-PR-API/2.0 (+https://h20pr.com)','cache-control':'no-cache'}});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return await r.text();}finally{clearTimeout(timer);}
}

export class PrepaConnector{
  constructor({cacheMs=15000}={}){this.cacheMs=cacheMs;this.snapshot=null;this.updatedAt=0;this.inflight=null;}
  async getSnapshot({force=false}={}){
    const now=Date.now();if(!force&&this.snapshot&&now-this.updatedAt<this.cacheMs)return this.snapshot;if(this.inflight)return this.inflight;
    this.inflight=this.#refresh().finally(()=>{this.inflight=null;});return this.inflight;
  }
  async #feed(name,parser,previous){
    const attemptedAt=new Date().toISOString();
    try{const parsed=parser(await fetchText(SOURCES[name]));return {status:'live',sourceUrl:SOURCES[name],lastAttemptAt:attemptedAt,lastSuccessAt:attemptedAt,...parsed};}
    catch(error){if(previous?.lastSuccessAt)return {...previous,status:'stale',lastAttemptAt:attemptedAt,error:error instanceof Error?error.message:String(error)};return {status:'unavailable',sourceUrl:SOURCES[name],lastAttemptAt:attemptedAt,error:error instanceof Error?error.message:String(error)};}
  }
  async #refresh(){
    const previous=this.snapshot||{};
    const [generation,levels,history]=await Promise.all([
      this.#feed('generation',parseGeneration,previous.generation),
      this.#feed('levels',parseLevels,previous.levels),
      this.#feed('history',parseHistory,previous.history)
    ]);
    this.snapshot={schemaVersion:1,generatedAt:new Date().toISOString(),generation,levels,history};this.updatedAt=Date.now();return this.snapshot;
  }
}

export { SOURCES as PREPA_SOURCES };
