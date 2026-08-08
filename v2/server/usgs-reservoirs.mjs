const SITES = [
  { id:'50059000', slug:'carraizo', name:'Carraízo / Lago Loíza', operator:'AAA', municipality:'Trujillo Alto' },
  { id:'50045000', slug:'la-plata', name:'La Plata', operator:'AAA', municipality:'Toa Alta' },
  { id:'50047550', slug:'cidra', name:'Cidra', operator:'AAA', municipality:'Cidra' },
  { id:'50111210', slug:'toa-vaca', name:'Toa Vaca', operator:'AAA', municipality:'Villalba' },
  { id:'50071225', slug:'fajardo', name:'Fajardo', operator:'AAA', municipality:'Fajardo' },
  { id:'50076800', slug:'rio-blanco', name:'Río Blanco / Lago Blanco', operator:'AAA', municipality:'Naguabo' }
];

const PARAMETER = '72376'; // Lake/reservoir elevation above local mean sea level, meters [OLDPR]
const SOURCE = 'https://waterservices.usgs.gov/nwis/iv/';

function latestValue(series){
  const blocks=series?.values||[];
  const values=blocks.flatMap(block=>block?.value||[]).filter(v=>v?.value!=null);
  return values.length?values[values.length-1]:null;
}

function parse(payload){
  const timeSeries=payload?.value?.timeSeries||[];
  const bySite=new Map();
  for(const series of timeSeries){
    const siteCode=series?.sourceInfo?.siteCode?.[0]?.value;
    if(!siteCode)continue;
    const point=latestValue(series);
    if(!point)continue;
    const variableCode=series?.variable?.variableCode?.[0]?.value;
    const variableDescription=series?.variable?.variableDescription||null;
    const unit=series?.variable?.unit?.unitCode||null;
    const raw=Number(point.value);
    bySite.set(siteCode,{
      siteCode,
      observedAt:point.dateTime||null,
      value:Number.isFinite(raw)?raw:null,
      unit,
      parameterCode:variableCode||null,
      parameterDescription:variableDescription,
      qualifiers:Array.isArray(point.qualifiers)?point.qualifiers:[]
    });
  }
  return SITES.map(site=>({
    ...site,
    source:'USGS',
    cooperativeOperator:'Puerto Rico Aqueduct and Sewer Authority',
    sourceUrl:`https://waterdata.usgs.gov/monitoring-location/USGS-${site.id}/`,
    reading:bySite.get(site.id)||null
  }));
}

async function fetchPayload(){
  const sites=SITES.map(s=>s.id).join(',');
  const url=`${SOURCE}?format=json&sites=${encodeURIComponent(sites)}&parameterCd=${PARAMETER}&siteStatus=all`;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{'user-agent':'H2O-PR-API/2.0 (+https://h20pr.com)','accept':'application/json','cache-control':'no-cache'}});
    if(!response.ok)throw new Error(`USGS ${response.status} ${response.statusText}`);
    return {url,payload:await response.json()};
  } finally {clearTimeout(timer);}
}

export class UsgsReservoirConnector{
  constructor({cacheMs=60000}={}){this.cacheMs=cacheMs;this.snapshot=null;this.updatedAt=0;this.inflight=null;}
  async getSnapshot({force=false}={}){
    if(!force&&this.snapshot&&Date.now()-this.updatedAt<this.cacheMs)return this.snapshot;
    if(this.inflight)return this.inflight;
    this.inflight=this.#refresh().finally(()=>{this.inflight=null;});
    return this.inflight;
  }
  async #refresh(){
    const attemptedAt=new Date().toISOString();
    try{
      const {url,payload}=await fetchPayload();
      const reservoirs=parse(payload);
      const withReadings=reservoirs.filter(r=>Number.isFinite(r.reading?.value)).length;
      if(!withReadings)throw new Error('USGS returned no current reservoir readings for configured sites');
      this.snapshot={status:'live',source:'USGS Water Services',sourceUrl:url,parameterCode:PARAMETER,parameterMeaning:'Lake or reservoir elevation above local mean sea level, meters [OLDPR]',fetchedAt:attemptedAt,lastSuccessAt:attemptedAt,reservoirs};
      this.updatedAt=Date.now();
      return this.snapshot;
    }catch(error){
      if(this.snapshot?.lastSuccessAt){
        this.snapshot={...this.snapshot,status:'stale',lastAttemptAt:attemptedAt,error:error instanceof Error?error.message:String(error)};
        this.updatedAt=Date.now();
        return this.snapshot;
      }
      this.snapshot={status:'unavailable',source:'USGS Water Services',sourceUrl:SOURCE,lastAttemptAt:attemptedAt,error:error instanceof Error?error.message:String(error),reservoirs:SITES.map(site=>({...site,source:'USGS',reading:null}))};
      this.updatedAt=Date.now();
      return this.snapshot;
    }
  }
}

export { SITES as USGS_RESERVOIR_SITES, PARAMETER as USGS_RESERVOIR_PARAMETER };
