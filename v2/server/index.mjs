import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrepaConnector } from './prepa.mjs';

const PORT=Number(process.env.PORT||8080);
const HOST=process.env.HOST||'0.0.0.0';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PUBLIC=path.resolve(__dirname,'../public');
const prepa=new PrepaConnector({cacheMs:Number(process.env.PREPA_CACHE_MS||15000)});
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
function publicHealth(snapshot){
  const feeds=['generation','levels','history'].map(name=>({name,status:snapshot?.[name]?.status||'unavailable',lastSuccessAt:snapshot?.[name]?.lastSuccessAt||null,lastAttemptAt:snapshot?.[name]?.lastAttemptAt||null}));
  const live=feeds.filter(f=>f.status==='live').length,stale=feeds.filter(f=>f.status==='stale').length;
  return {service:'h2opr-api',version:'2.0.0-alpha.1',startedAt,now:new Date().toISOString(),status:live===3?'healthy':live+stale>0?'degraded':'unavailable',feeds};
}
async function api(req,res,url){
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'});res.end();return true;}
  if(req.method!=='GET')return false;
  if(url.pathname==='/api/v1/health'){
    let snap=null;try{snap=await prepa.getSnapshot();}catch{}
    json(res,200,publicHealth(snap));return true;
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
    json(res,404,{error:'not_found'});
  }catch(error){console.error(error);json(res,500,{error:'internal_error'});}
});
server.listen(PORT,HOST,()=>console.log(`H2O PR V2 listening on http://${HOST}:${PORT}`));
