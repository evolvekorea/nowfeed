import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as helpers from '../js/market-data.mjs';

const code=(await readFile(new URL('../js/market.js',import.meta.url),'utf8')).replace(/^import .*;\n/,'');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup(responses,cached=null){
  const nodes=new Map(),events={},intervals=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',disabled:false,classList:{toggle(){}},addEventListener(name,fn){this[name]=fn;}});return nodes.get(id);};
  let calls=0;
  const context={...helpers,Date,AbortSignal,document:{hidden:false,querySelector:selector=>node(selector.slice(1)),getElementById:node,addEventListener:(name,fn)=>{events[name]=fn;}},localStorage:{getItem:()=>cached,setItem:(_,value)=>{cached=value;}},setInterval:(fn,ms)=>intervals.push({fn,ms}),fetch:async()=>{calls++;const next=responses.shift();if(next instanceof Error)throw next;return {ok:true,json:async()=>next};}};
  vm.runInNewContext(code,context);
  return {node,events,intervals,context,calls:()=>calls};
}
const quote=()=>{const now=new Date().toISOString();const index={price:'2500.25',changePercent:'0.21',direction:'RISING',marketStatus:'CLOSE',fetchedAt:now,tradedAt:now,sourceStatus:'ok'};return {updatedAt:now,kospi:{...index},kosdaq:{...index},usdkrw:{price:1400,fetchedAt:now,sourceStatus:'ok'}};};
test('network failure keeps prices visible, reports delay, and restores normal status on recovery',async()=>{
  const good=quote(),ui=setup([good,new Error('offline'),good]);await settle();
  const price=ui.node('kospi-price').textContent;
  assert.equal(price,'2,500.25');
  await ui.node('market-refresh').click();
  assert.equal(ui.node('kospi-price').textContent,price);assert.equal(ui.node('market-state').textContent,'갱신 지연');
  assert.match(ui.node('market-message').textContent,/마지막 값/);assert.equal(ui.node('market-refresh').disabled,false);
  await ui.node('market-refresh').click();assert.equal(ui.node('market-state').textContent,'장 마감');
});
test('returning to a visible tab refreshes data; hidden tabs do not poll',async()=>{
  const ui=setup([quote(),quote()]);await settle();
  assert.equal(ui.intervals[0].ms,300000);
  ui.context.document.hidden=true;ui.intervals[0].fn();assert.equal(ui.calls(),1);
  ui.context.document.hidden=false;ui.events.visibilitychange();await settle();assert.equal(ui.calls(),2);
});
test('a cached quote remains available on offline page load',async()=>{
  const ui=setup([new Error('offline')],JSON.stringify(quote()));await settle();
  assert.equal(ui.node('usdkrw-price').textContent,'1,400.00원');assert.equal(ui.node('market-state').textContent,'갱신 지연');
});
