(() => {
  if(!document.querySelector('#weather-card-temp'))return;
  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
  const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(12_000)});if(!r.ok)throw Error('Weather source unavailable');return r.json();};
  let weatherSeen=false,airSeen=false,busy=false;
  const weatherUrl='https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m,apparent_temperature,is_day,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1&timezone=Asia%2FSeoul';
  const airUrl='https://air-quality-api.open-meteo.com/v1/air-quality?latitude=37.5665&longitude=126.9780&current=pm10,pm2_5&timezone=Asia%2FSeoul';
  async function load() {
    if(busy)return;busy=true;
    const [weather,air]=await Promise.allSettled([get(weatherUrl),get(airUrl)]);
    let weatherOk=false,airOk=false;
    if(weather.status==='fulfilled') {
      const {current:c,daily:d}=weather.value;
      if(Number.isFinite(c?.temperature_2m)&&typeof c.time==='string'&&d?.temperature_2m_max&&d?.temperature_2m_min){
        const code=c.weather_code;
        const label=code===0?'맑음':code<3?'구름 조금':code===3?'흐림':code<50?'안개':code>=95?'뇌우':[71,73,75,77,85,86].includes(code)?'눈':'비';
        set('weather-card-temp',`${Math.round(c.temperature_2m)}°`);
        set('weather-card-label',`${label} · 체감 ${Math.round(c.apparent_temperature)}°`);
        set('weather-card-icon',code===0?(c.is_day?'☀':'☾'):label==='비'?'☂':label==='눈'?'❄':'☁');
        set('weather-high',`${Math.round(d.temperature_2m_max[0])}°`);set('weather-low',`${Math.round(d.temperature_2m_min[0])}°`);
        const rain=d.precipitation_probability_max?.[0];
        set('weather-rain',Number.isFinite(rain)?`${rain}%`:'확인 중');
        set('weather-tip',Number.isFinite(rain)?rain>=50?'☂ 비 예보가 있으니 우산을 챙겨보세요.':'오늘의 강수확률과 대기질을 확인하세요.':'강수확률을 확인하고 있습니다.');
        set('weather-updated',`Open-Meteo · CAMS · ${c.time.replace('T',' ')} KST 기준`);
        weatherSeen=weatherOk=true;
      }
    }
    if(air.status==='fulfilled'&&Number.isFinite(air.value.current?.pm10)) {
      const n=air.value.current.pm10;
      const [label,level]=n<=30?['좋음','good']:n<=80?['보통','normal']:n<=150?['나쁨','bad']:['매우 나쁨','very-bad'];
      set('air-pm10-grade',label);document.querySelector('#air-pm10-grade').className=level;airSeen=airOk=true;
    }
    if(!weatherOk){if(!weatherSeen)set('weather-card-label','날씨 수신 지연');set('weather-tip',weatherSeen?'날씨 갱신이 지연되어 마지막 확인 값을 표시합니다.':'날씨를 불러오지 못했습니다. 잠시 후 다시 확인합니다.');}
    if(!airOk)set('air-pm10-grade',airSeen?'갱신 지연':'수신 지연');
    busy=false;
  }
  load();setInterval(()=>{if(!document.hidden)load();},15*60_000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
})();
