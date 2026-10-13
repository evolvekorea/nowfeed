(() => {
  const list=document.querySelector('#housing-list'),updated=document.querySelector('#housing-updated');
  if(!list||!updated)return;
  const el=(tag,text,cls)=>{const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;};
  let last=null,busy=false;
  function render(data,failed=false) {
    const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
    const items=data.items.filter(p=>typeof p.endDate==='string'&&p.endDate>=today&&/^https:\/\/www\.applyhome\.co\.kr\//.test(p.url)).sort((a,b)=>Number(a.startDate>today)-Number(b.startDate>today)||a.endDate.localeCompare(b.endDate));
    list.replaceChildren();
    for(const p of items.slice(0,Number(list.dataset.limit)||3)) {
      const upcoming=p.startDate>today;
      const date=upcoming?p.startDate:p.endDate;
      const a=el('a','','house');a.href=p.url;a.target='_blank';a.rel='noopener noreferrer';
      const day=el('span',date.slice(5).replace('-','/'),`deadline${upcoming?' upcoming':''}`);day.append(el('br',''),el('b',upcoming?'시작':date===today?'오늘 마감':'마감'));
      const text=el('span','');text.append(el('small',`${p.region} · ${p.households}세대`),el('strong',p.name));a.append(day,text,el('b','↗'));list.append(a);
    }
    if(!items.length)list.append(el('p','현재 표시할 접수 중·예정 공고가 없습니다.','notice'));
    const age=Date.now()-Date.parse(data.updatedAt);
    updated.textContent=`한국부동산원 청약홈 · ${data.displayTime} 수집${failed||!Number.isFinite(age)||age>48*3600_000?' · 갱신 지연':''}`;
  }
  async function load(){
    if(busy)return;busy=true;
    try{const response=await fetch(`/data/housing.json?v=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(12_000)});if(!response.ok)throw Error('Housing unavailable');const data=await response.json();if(!Array.isArray(data.items))throw Error('Invalid housing data');render(data);last=data;}
    catch{if(last)render(last,true);else{list.replaceChildren(el('p','일정을 불러오지 못했습니다. 청약홈에서 공고를 확인해 주세요.','notice'));updated.textContent='청약 일정 수신 지연';}}
    finally{busy=false;}
  }
  load();setInterval(()=>{if(!document.hidden)load();},15*60_000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
})();
