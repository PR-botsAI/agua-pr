import fs from 'node:fs/promises';

const OUT = new URL('../data/live.json', import.meta.url);
const AAA_RESERVOIRS = 'https://www.acueductos.pr.gov/infraestructura/niveles-de-los-embalses';
const AAA_HOME = 'https://www.acueductos.pr.gov/';

const strip = (s='') => s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const absolute = (u) => new URL(u, AAA_HOME).href;

async function readPrevious(){
  try{return JSON.parse(await fs.readFile(OUT,'utf8'));}catch{return {serviceUpdates:[]};}
}

async function findReservoirChart(previous){
  try{
    const html = await (await fetch(AAA_RESERVOIRS,{headers:{'user-agent':'H2O-PR-data-refresh/1.0'}})).text();
    const matches = [...html.matchAll(/https:\/\/appweb\.acueductospr\.com\/AAA_Embalses\/ImageFiles\/current_chart_([0-9]+)\.png/gi)];
    if(!matches.length) throw new Error('No chart URL found');
    const [url, stamp] = matches.at(-1);
    const y=stamp.slice(0,4),m=stamp.slice(4,6),d=stamp.slice(6,8),hh=stamp.slice(8,10),mm=stamp.slice(10,12),ss=stamp.slice(12,14)||'00';
    const iso=`${y}-${m}-${d}T${hh}:${mm}:${ss}-04:00`;
    const label = new Intl.DateTimeFormat('es-PR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Puerto_Rico'}).format(new Date(iso));
    return {chartUrl:url,observedAt:iso,observedLabel:`Gráfica oficial AAA · ${label}`,source:AAA_RESERVOIRS};
  }catch(err){
    console.warn('Reservoir refresh failed:',err.message);
    return previous.reservoir;
  }
}

async function findAreciboUpdates(previous){
  try{
    const html = await (await fetch(AAA_HOME,{headers:{'user-agent':'H2O-PR-data-refresh/1.0'}})).text();
    const links = [...new Set([...html.matchAll(/href=["']([^"']*\/comunicados\/[^"'#?]+)["']/gi)].map(m=>absolute(m[1])))].slice(0,24);
    const found=[];
    for(const url of links){
      try{
        const articleHtml = await (await fetch(url,{headers:{'user-agent':'H2O-PR-data-refresh/1.0'}})).text();
        const text=strip(articleHtml);
        if(!/\bArecibo\b/i.test(text)) continue;
        const h1=articleHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || articleHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || 'Comunicado AAA relacionado con Arecibo';
        const title=strip(h1).replace(/^Comunicado de Prensa\s*/i,'').trim() || 'Comunicado AAA relacionado con Arecibo';
        const dateMatch=text.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+20\d{2}[^.]{0,30}/i);
        found.push({title,dateLabel:dateMatch?.[0]?.trim() || 'Fuente oficial AAA',url});
        if(found.length>=4) break;
      }catch{}
    }
    return found.length ? found : previous.serviceUpdates || [];
  }catch(err){
    console.warn('AAA communications refresh failed:',err.message);
    return previous.serviceUpdates || [];
  }
}

const previous=await readPrevious();
const [reservoir,serviceUpdates]=await Promise.all([findReservoirChart(previous),findAreciboUpdates(previous)]);
const output={
  ...previous,
  updatedAt:new Date().toISOString(),
  reservoir,
  serviceUpdates,
  sources:{
    aaaReservoirs:AAA_RESERVOIRS,
    aaaPhone:'https://www.acueductos.pr.gov/servicios/centro-telefonico',
    nws:'https://api.weather.gov',
    reportaloSJ:'https://www.reportalosj.com/mapa'
  }
};
await fs.writeFile(OUT,JSON.stringify(output,null,2)+'\n');
console.log('Updated',OUT.pathname);
