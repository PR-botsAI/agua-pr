import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE=path.resolve(__dirname,'../../data/resources.json');

function normalize(value=''){
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}

function ageMinutes(iso){
  const t=Date.parse(iso||'');
  return Number.isFinite(t)?Math.max(0,Math.round((Date.now()-t)/60000)):null;
}

function zoneForMunicipality(data,name){
  return data?.nmead?.zones?.find(zone=>zone.municipalities?.includes(name))||null;
}

function localContacts(data,name){
  return Array.isArray(data?.municipalContacts?.[name])?data.municipalContacts[name]:[];
}

function helpContact(data,name){
  const local=localContacts(data,name);
  return local.find(c=>c.kind==='water')||local.find(c=>c.kind==='emergency')||local[0]||zoneForMunicipality(data,name)||null;
}

function waterPoints(data,name){
  return (data?.waterPoints||[]).filter(p=>p.municipality===name);
}

function currentCycle(data,now=Date.now()){
  const e=data?.currentEmergency;
  const start=Date.parse(e?.startedAt||'');
  const hours=Number(e?.cycleHours||0);
  if(!Number.isFinite(start)||!Number.isFinite(hours)||hours<=0||now<start)return null;
  const span=hours*3600000;
  const index=Math.floor((now-start)/span);
  return {index,zone1On:index%2===0,zone2On:index%2!==0,nextChangeAt:new Date(start+(index+1)*span).toISOString()};
}

function matchSector(data,municipality,query){
  const zones=data?.rationingZones?.[municipality];
  const q=normalize(query);
  if(!zones||!q)return null;
  let best=null;
  for(const [zone,items] of Object.entries(zones)){
    for(const item of items||[]){
      const n=normalize(item);
      let score=0;
      if(n===q)score=1000;
      else if(n.includes(q)||q.includes(n))score=100+Math.min(n.length,q.length);
      else{
        const words=q.split(/\s+/).filter(w=>w.length>3);
        score=words.filter(w=>n.includes(w)).length*10;
      }
      if(score>0&&(!best||score>best.score))best={zone,item,score};
    }
  }
  return best;
}

function rationingStatus(data,municipality,sector){
  const emergency=data?.currentEmergency;
  const affected=Boolean(emergency?.affectedMunicipalities?.includes(municipality));
  if(!affected)return {affected:false,municipality,message:'No hay un calendario de esta emergencia cargado para este municipio. Esto no confirma que el servicio esté normal.'};
  const cycle=currentCycle(data);
  if(!sector)return {affected:true,municipality,cycleHours:emergency.cycleHours||null,nextChangeAt:cycle?.nextChangeAt||null,source:emergency.source||null,message:'El municipio está dentro del plan cargado. Provee barrio, urbanización o sector para buscar la zona publicada.'};
  const match=matchSector(data,municipality,sector);
  if(!match)return {affected:true,municipality,sector,matched:false,nextChangeAt:cycle?.nextChangeAt||null,source:emergency.source||null,message:'No encontramos ese sector en la lista publicada. H2O PR no adivina la zona.'};
  const scheduledOn=cycle?(match.zone==='zone1'?cycle.zone1On:cycle.zone2On):null;
  return {affected:true,municipality,sector,matched:true,matchedSector:match.item,zone:match.zone,zoneLabel:match.zone==='zone1'?'Zona 1':'Zona 2',scheduledService:scheduledOn,nextChangeAt:cycle?.nextChangeAt||null,source:emergency.source||null,warning:'Este resultado refleja el calendario cargado; no garantiza presión o servicio real en una residencia.'};
}

export class ResourceRegistry{
  constructor({file=DEFAULT_FILE,cacheMs=30000}={}){this.file=file;this.cacheMs=cacheMs;this.data=null;this.loadedAt=0;this.loading=null;}
  async load({force=false}={}){
    if(!force&&this.data&&Date.now()-this.loadedAt<this.cacheMs)return this.data;
    if(this.loading)return this.loading;
    this.loading=(async()=>{
      const parsed=JSON.parse(await fs.readFile(this.file,'utf8'));
      this.data=parsed;this.loadedAt=Date.now();return parsed;
    })().finally(()=>{this.loading=null;});
    return this.loading;
  }
  async municipalities(){
    const data=await this.load();
    return [...new Set((data?.nmead?.zones||[]).flatMap(z=>z.municipalities||[]))].sort((a,b)=>a.localeCompare(b,'es'));
  }
  async view(municipality){
    const data=await this.load();
    const towns=await this.municipalities();
    if(!towns.includes(municipality))return null;
    const zone=zoneForMunicipality(data,municipality);
    const local=localContacts(data,municipality);
    const points=waterPoints(data,municipality);
    const mobile=data?.mobileWater?.[municipality]||null;
    return {
      municipality,
      registryUpdatedAt:data.updatedAt||null,
      registryAgeMinutes:ageMinutes(data.updatedAt),
      emergency:data.currentEmergency?{...data.currentEmergency,affected:Boolean(data.currentEmergency.affectedMunicipalities?.includes(municipality))}:null,
      waterPoints:points,
      mobileWater:mobile,
      localContacts:local,
      nmeadZone:zone,
      aaa:data.aaa||null,
      emergency911:data.emergency||null,
      health:data.health||null,
      suppliers:data.suppliers||[],
      preferredHelp:helpContact(data,municipality)
    };
  }
  async water(municipality){
    const view=await this.view(municipality);if(!view)return null;
    return {municipality,registryUpdatedAt:view.registryUpdatedAt,waterPoints:view.waterPoints,mobileWater:view.mobileWater,preferredHelp:view.preferredHelp};
  }
  async help(municipality){
    const view=await this.view(municipality);if(!view)return null;
    return {municipality,registryUpdatedAt:view.registryUpdatedAt,localContacts:view.localContacts,nmeadZone:view.nmeadZone,aaa:view.aaa,emergency911:view.emergency911,preferredHelp:view.preferredHelp};
  }
  async rationing(municipality,sector=''){
    const data=await this.load();
    return rationingStatus(data,municipality,sector);
  }
}

export { rationingStatus, matchSector, currentCycle };
