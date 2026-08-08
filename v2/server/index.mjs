import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrepaConnector } from './prepa.mjs';
import { UsgsReservoirConnector } from './usgs-reservoirs.mjs';
import { ResourceRegistry } from './resources.mjs';

const PORT=Number(process.env.PORT||8080);
const HOST=process.env.HOST||'0.0.0.0';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PUBLIC=path.resolve(__dirname,'../public');
const prepa=new PrepaConnector({cacheMs:Number(process.env.PREPA_CACHE_MS||15000)});
const usgsReservoirs=new UsgsReservoirConnector({cacheMs:Number(process.env.USGS_RESERVOIR_CACHE_MS||60000)});
const resources=new ResourceRegistry({cacheMs:Number(process.env.RESOURCE_CACHE_MS||30000)});
const startedAt=new Date().toISOString();

function json(res,status,body,extra={}){
  const data=JSON.stringify(body);
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','content-length':Buffer.byteLength(data),...extra});
  res.end(data);
}
function cors(req,res){
  const origin=req.headers.origin;
  const allowed=!origin||origin==='https://h20pr.com'||origin==='https://www.h20pr.com'||origin?.startsWith('http://localhost:');
  if(allowed&&origin)res.setHeader('access-control-allow-origin',origin);
  res.setHeader('vary','Origin');
}
function badRequest(res,message){json(res,400,{error:'bad_request',message});}
function notFound(res,message='Resource not found'){json(res,404,{error:'not_found',message});}
function municipalityParam(url){return (url.searchParams.get('municipality')||'').trim();}
function publicHealth(prepaSnapshot,registry,usgsSnapshot){
  const feeds=['generation','levels','history'].map(name=>({name:`prepa_${name}`,status:prepaSnapshot?.[name]?.status||'unavailable',lastSuccessAt:prepaSnapshot?.[name]?.lastSuccessAt||null,lastAttemptAt:prepaSnapshot?.[name]?.lastAttemptAt||null}));
  feeds.push({name:'usgs_aaa_reservoirs',status:usgsSnapshot?.status||'unavailable',lastSuccessAt:usgsSnapshot?.lastSuccessAt||null,lastAttemptAt:usgsSnapshot?.lastAttemptAt||null});
  const live=feeds.filter(f=>f.status==='live').length,stale=feeds.filter(f=>f.status==='stale').length;
  const sourceStatus=live===feeds.length?'healthy':live+stale>0?'degraded':'unavailable';
  const registryOk=Boolean(registry);
  return {
    service:'h2opr-api',version:'2.0.0-alpha.3',startedAt,now:new Date().toISOString(),
    status:sourceStatus==='healthy'&&registryOk?'healthy':(live+stale>0||registryOk)?'degraded':'unavailable',
    feeds,
    resourceRegistry:{status:registryOk?'loaded':'unavailable',updatedAt:registry?.updatedAt||null}
  };
}
async function api(req,res,url){
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'});res.end();return true;}
  if(req.method!=='GET')return false;

  if(url.pathname==='/api/v1/health'){
    let snap=null,registry=null,usgs=null;
    try{[snap,registry,usgs]=await Promise.all([prepa.getSnapshot(),resources.load(),usgsReservoirs.getSnapshot()]);}catch{}
    json(res,200,publicHealth(snap,registry,usgs));return true;
  }

  if(url.pathname==='/api/v1/prepa'||url.pathname.startsWith('/api/v1/prepa/')){
    const snapshot=await prepa.getSnapshot({force:url.searchParams.get('refresh')==='1'});
    if(url.pathname==='/api/v1/prepa')json(res,200,snapshot);
    else if(url.pathname==='/api/v1/prepa/generation')json(res,200,snapshot.generation);
    else if(url.pathname==='/api/v1/prepa/levels')json(res,200,snapshot.levels);
    else if(url.pathname==='/api/v1/prepa/history')json(res,200,snapshot.history);
    else return false;
    return true;
  }

  if(url.pathname==='/api/v1/reservoirs/aaa'){
    json(res,200,await usgsReservoirs.getSnapshot({force:url.searchParams.get('refresh')==='1'}));return true;
  }

  if(url.pathname==='/api/v1/municipalities'){
    json(res,200,{municipalities:await resources.municipalities()});return true;
  }

  if(url.pathname==='/api/v1/resources'||url.pathname==='/api/v1/resources/water'||url.pathname==='/api/v1/resources/help'){
    const municipality=municipalityParam(url);
    if(!municipality){badRequest(res,'municipality is required');return true;}
    let result;
    if(url.pathname==='/api/v1/resources')result=await resources.view(municipality);
    else if(url.pathname==='/api/v1/resources/water')result=await resources.water(municipality);
    else result=await resources.help(municipality);
    if(!result){notFound(res,`Unknown municipality: ${municipality}`);return true;}
    json(res,200,result);return true;
  }

  if(url.pathname==='/api/v1/rationing'){
    const municipality=municipalityParam(url);
    if(!municipality){badRequest(res,'municipality is required');return true;}
    const towns=await resources.municipalities();
    if(!towns.includes(municipality)){notFound(res,`Unknown municipality: ${municipality}`);return true;}
    const sector=(url.searchParams.get('sector')||'').trim();
    json(res,200,await resources.rationing(municipality,sector));return true;
  }

  return false;
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
async function staticFile(res,pathname){
  let rel=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
  rel=path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
  const file=path.join(PUBLIC,rel);
  if(!file.startsWith(PUBLIC))return false;
  try{const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':rel==='index.html'?'no-cache':'public, max-age=300'});res.end(body);return true;}catch{return false;}
}
const server=http.createServer(async(req,res)=>{
  cors(req,res);
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    if(await api(req,res,url))return;
    if(await staticFile(res,url.pathname))return;
    notFound(res);
  }catch(error){console.error(error);json(res,500,{error:'internal_error'});}
});
server.listen(PORT,HOST,()=>console.log(`H2O PR V2 listening on http://${HOST}:${PORT}`));
