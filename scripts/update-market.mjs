import {readFile, writeFile, rename} from 'node:fs/promises';
import {collectMarket} from '../js/market-data.mjs';

const file = new URL('../data/market.json', import.meta.url);
let previous = {};
try {previous=JSON.parse(await readFile(file,'utf8'));} catch (error) {if(error.code !== 'ENOENT') throw error;}
async function getJson(url) {
  let lastError;
  for(let attempt=0;attempt<3;attempt++) {
    try {
      const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Nowfeed market updater'},signal:AbortSignal.timeout(15_000)});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch(error) {lastError=error;if(attempt<2) await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}
  }
  throw lastError;
}
const {output,failed}=await collectMarket(previous,getJson);
const temporary=new URL('../data/market.json.tmp',import.meta.url);
await writeFile(temporary,JSON.stringify(output,null,2)+'\n','utf8');
await rename(temporary,file);
console.log(`Market collection complete; retained previous quotes for: ${failed.join(', ') || 'none'}`);
if(failed.length) process.exitCode=1;
