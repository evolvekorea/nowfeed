import test from 'node:test';
import assert from 'node:assert/strict';
import {collectMarket,SOURCES,isStale,normalizeSource,validItem} from '../js/market-data.mjs';

const now='2026-10-14T02:00:00.000Z';
const raw={closePrice:'2,500.25',compareToPreviousClosePrice:'5.25',fluctuationsRatio:'0.21',compareToPreviousPrice:{name:'RISING'},marketStatus:'OPEN',localTradedAt:'2026-10-14T10:59:00+09:00'};
const fresh=()=>normalizeSource('kospi',raw,now);
const previous={updatedAt:'2026-10-14T01:00:00.000Z',kospi:{...fresh(),fetchedAt:'2026-10-14T01:00:00.000Z'},kosdaq:{...fresh(),fetchedAt:'2026-10-14T01:00:00.000Z'},usdkrw:{price:1300,fetchedAt:'2026-10-14T01:00:00.000Z'}};
test('successful sources record independent observation and collection timestamps',async()=>{
  const {output,failed}=await collectMarket(previous,async url=>url===SOURCES.usdkrw?{data:{rates:{KRW:'1400.50'}}}:raw,now);
  assert.deepEqual(failed,[]);assert.equal(output.usdkrw.price,1400.5);assert.equal(output.kospi.tradedAt,'2026-10-14T01:59:00.000Z');assert.equal(output.usdkrw.fetchedAt,now);
});
test('one failed source retains its old quote and timestamp while other sources refresh',async()=>{
  const {output,failed}=await collectMarket(previous,async url=>{if(url===SOURCES.kosdaq)throw Error('timeout');return url===SOURCES.usdkrw?{data:{rates:{KRW:'1400'}}}:raw;},now);
  assert.deepEqual(failed,['kosdaq']);assert.equal(output.kosdaq.fetchedAt,previous.kosdaq.fetchedAt);assert.equal(output.kosdaq.price,previous.kosdaq.price);assert.equal(output.kosdaq.sourceStatus,'error');assert.equal(output.kospi.fetchedAt,now);
});
test('complete outage never makes old quotes look newly collected',async()=>{
  const {output,failed}=await collectMarket(previous,async()=>{throw Error('outage');},now);
  assert.equal(failed.length,3);assert.equal(output.updatedAt,previous.updatedAt);assert.equal(output.lastAttemptAt,now);assert.equal(output.usdkrw.price,1300);
});
test('malformed or zero rates do not replace the last good exchange quote',async()=>{
  for(const value of [null,'','NaN','-1','0']){
    const {output,failed}=await collectMarket(previous,async url=>url===SOURCES.usdkrw?{data:{rates:{KRW:value}}}:raw,now);
    assert.ok(failed.includes('usdkrw'));assert.equal(output.usdkrw.price,1300);
  }
  assert.equal(validItem({price:'NaN'},'usdkrw'),false);
});
test('stale fetches and stale open-market trades are labeled delayed',()=>{
  const epoch=Date.parse(now);assert.equal(isStale(fresh(),'kospi',epoch),false);
  assert.equal(isStale({...fresh(),fetchedAt:'2026-10-13T22:00:00Z'},'kospi',epoch),true);
  assert.equal(isStale({...fresh(),tradedAt:'2026-10-13T01:00:00Z'},'kospi',epoch),true);
  assert.equal(isStale({...fresh(),sourceStatus:'error'},'kospi',epoch),true);
});
test('closed-market previous close is valid when the source was recently checked',()=>{
  assert.equal(isStale({...fresh(),marketStatus:'CLOSE',tradedAt:'2026-10-09T06:30:00Z'},'kospi',Date.parse(now)),false);
});
