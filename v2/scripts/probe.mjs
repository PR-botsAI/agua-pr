import { PrepaConnector } from '../server/prepa.mjs';
const c=new PrepaConnector({cacheMs:0});
const d=await c.getSnapshot({force:true});
const summary={
  generation:d.generation.status,
  sites:d.generation.sites?.length||0,
  levels:d.levels.status,
  reservoirs:d.levels.reservoirs?.length||0,
  history:d.history.status,
  points:d.history.points?.length||0
};
console.log(JSON.stringify(summary,null,2));
if([d.generation,d.levels,d.history].every(x=>x.status==='unavailable'))process.exit(2);
if(d.generation.status==='live'&&!(d.generation.sites?.length||d.generation.metrics?.length))process.exit(3);
if(d.levels.status==='live'&&!d.levels.reservoirs?.length)process.exit(4);
if(d.history.status==='live'&&!d.history.points?.length)process.exit(5);
