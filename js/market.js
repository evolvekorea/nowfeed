import {validItem, numberOf, timeLabel, isStale} from './market-data.mjs';

const state=document.querySelector('#market-state');
if(state) {
  const keys=['kospi','kosdaq','usdkrw'];
  const cacheKey='nowfeed-market-v2';
  let last=null, busy=false;
  const set=(id,text)=>{const node=document.getElementById(id);if(node) node.textContent=text;};
  function render(data,networkError=false) {
    let delayed=networkError;
    keys.forEach(key=>{
      const item=data[key];
      if(!validItem(item,key)){set(`${key}-price`,'확인 중');set(`${key}-time`,'데이터 수신 대기');delayed=true;return;}
      const stale=isStale(item,key);
      delayed ||= stale;
      set(`${key}-price`,numberOf(item.price).toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2})+(key==='usdkrw'?'원':''));
      set(`${key}-time`,`${key==='usdkrw'?'수집':'지수 기준'} ${timeLabel(key==='usdkrw'?item.fetchedAt:item.tradedAt)}${stale?' · 지연':''}`);
      const change=document.getElementById(`${key}-change`);
      if(change){change.textContent=`${item.direction==='RISING'?'+':item.direction==='FALLING'?'−':''}${Math.abs(numberOf(item.changePercent)).toFixed(2)}%`;change.className=item.direction==='RISING'?'up':item.direction==='FALLING'?'down':'';}
    });
    state.textContent=delayed?'갱신 지연':data.kospi?.marketStatus==='OPEN'?'장중':'장 마감';
    state.classList.toggle('delayed',delayed);
    set('market-updated',`${delayed?'마지막 확인 값':'수집'} · ${timeLabel(data.updatedAt)}`);
    set('market-message',networkError?'새 시세를 불러오지 못해 마지막 값을 표시합니다.':delayed?'일부 시세 갱신이 지연되고 있습니다. 항목별 기준 시각을 확인해 주세요.':'지수는 장 마감 후 종가를 표시합니다. 화면은 5분마다 다시 확인합니다.');
  }
  async function loadMarket() {
    if(busy) return;
    busy=true;
    const button=document.querySelector('#market-refresh');if(button)button.disabled=true;
    try {
      const response=await fetch(`/data/market.json?v=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(12_000)});
      if(!response.ok)throw new Error('Market fetch failed');
      const data=await response.json();
      if(!keys.some(key=>validItem(data[key],key)))throw new Error('Invalid market data');
      keys.forEach(key=>{if(!validItem(data[key],key)&&validItem(last?.[key],key))data[key]={...last[key],sourceStatus:'error'};});
      last=data;render(data);
      try{localStorage.setItem(cacheKey,JSON.stringify(data));}catch{}
    }catch{
      if(last)render(last,true);
      else {state.textContent='수신 지연';set('market-message','시세를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.');}
    }finally{busy=false;if(button)button.disabled=false;}
  }
  try{const cached=JSON.parse(localStorage.getItem(cacheKey));if(cached&&keys.some(key=>validItem(cached[key],key))){last=cached;render(last,true);}}catch{}
  document.querySelector('#market-refresh')?.addEventListener('click',loadMarket);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadMarket();});
  setInterval(()=>{if(!document.hidden)loadMarket();},5*60_000);
  loadMarket();
}
