(() => {
  const statusNode = document.querySelector('#weather-status');
  const tempNode = document.querySelector('#weather-temp');
  const iconNode = document.querySelector('#weather-icon');
  if (!statusNode || !tempNode || !iconNode) return;

  const descriptions = [
    { codes: [0], label: '맑음', day: '☀', night: '☾' },
    { codes: [1, 2], label: '구름 조금', day: '🌤', night: '☁' },
    { codes: [3], label: '흐림', day: '☁', night: '☁' },
    { codes: [45, 48], label: '안개', day: '🌫', night: '🌫' },
    { codes: [51, 53, 55, 56, 57], label: '이슬비', day: '🌦', night: '🌧' },
    { codes: [61, 63, 65, 66, 67, 80, 81, 82], label: '비', day: '🌧', night: '🌧' },
    { codes: [71, 73, 75, 77, 85, 86], label: '눈', day: '🌨', night: '🌨' },
    { codes: [95, 96, 99], label: '뇌우', day: '⛈', night: '⛈' }
  ];

  const setWeather = (current, daily) => {
    const condition = descriptions.find((item) => item.codes.includes(current.weather_code)) || descriptions[2];
    tempNode.textContent = `${Math.round(current.temperature_2m)}°`;
    statusNode.textContent = `${condition.label} · 체감 ${Math.round(current.apparent_temperature)}°`;
    iconNode.textContent = current.is_day ? condition.day : condition.night;
    const cardIcon = document.querySelector('#weather-card-icon');
    const cardTemp = document.querySelector('#weather-card-temp');
    const cardLabel = document.querySelector('#weather-card-label');
    const cardFeels = document.querySelector('#weather-card-feels');
    const high = document.querySelector('#weather-high');
    const low = document.querySelector('#weather-low');
    const humidity = document.querySelector('#weather-humidity');
    const updated = document.querySelector('#weather-updated');
    if (cardIcon) cardIcon.textContent = current.is_day ? condition.day : condition.night;
    if (cardTemp) cardTemp.textContent = `${Math.round(current.temperature_2m)}°`;
    if (cardLabel) cardLabel.textContent = condition.label;
    if (cardFeels) cardFeels.textContent = `체감 ${Math.round(current.apparent_temperature)}°`;
    if (high) high.textContent = `${Math.round(daily.temperature_2m_max[0])}°`;
    if (low) low.textContent = `${Math.round(daily.temperature_2m_min[0])}°`;
    if (humidity) humidity.textContent = `${current.relative_humidity_2m}%`;
    if (updated) updated.textContent = `Open-Meteo·CAMS 제공 · ${current.time.slice(11, 16)} 기준`;
  };

  const gradePm10 = (value) => value <= 30 ? ['좋음', 'good'] : value <= 80 ? ['보통', 'normal'] : value <= 150 ? ['나쁨', 'bad'] : ['매우 나쁨', 'very-bad'];
  const gradePm25 = (value) => value <= 15 ? ['좋음', 'good'] : value <= 35 ? ['보통', 'normal'] : value <= 75 ? ['나쁨', 'bad'] : ['매우 나쁨', 'very-bad'];
  const gradeUv = (value) => value < 3 ? ['낮음', 'good'] : value < 6 ? ['보통', 'normal'] : value < 8 ? ['높음', 'bad'] : ['매우 높음', 'very-bad'];

  const setAirQuality = (current) => {
    const fields = [
      ['#air-pm10', '#air-pm10-grade', current.pm10, gradePm10],
      ['#air-pm25', '#air-pm25-grade', current.pm2_5, gradePm25],
      ['#air-uv', '#air-uv-grade', current.uv_index, gradeUv]
    ];
    fields.forEach(([valueSelector, gradeSelector, rawValue, grader]) => {
      const valueNode = document.querySelector(valueSelector);
      const gradeNode = document.querySelector(gradeSelector);
      if (!valueNode || !gradeNode || !Number.isFinite(rawValue)) return;
      const [label, className] = grader(rawValue);
      valueNode.textContent = Number(rawValue).toFixed(valueSelector === '#air-uv' ? 1 : 0);
      gradeNode.textContent = label;
      gradeNode.className = className;
    });
  };

  const loadWeather = async () => {
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=Asia%2FSeoul';
      const airUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=37.5665&longitude=126.9780&current=pm10,pm2_5,uv_index&timezone=Asia%2FSeoul';
      const [weatherResponse, airResponse] = await Promise.all([
        fetch(url, { headers: { Accept: 'application/json' } }),
        fetch(airUrl, { headers: { Accept: 'application/json' } })
      ]);
      if (!weatherResponse.ok) throw new Error(`Weather request failed: ${weatherResponse.status}`);
      const data = await weatherResponse.json();
      if (!data.current || !data.daily) throw new Error('Weather data is missing');
      setWeather(data.current, data.daily);
      if (airResponse.ok) {
        const airData = await airResponse.json();
        if (airData.current) setAirQuality(airData.current);
      }
    } catch {
      statusNode.textContent = '날씨를 불러올 수 없음';
      tempNode.textContent = '--°';
      iconNode.textContent = '☁';
      const cardLabel = document.querySelector('#weather-card-label');
      const updated = document.querySelector('#weather-updated');
      if (cardLabel) cardLabel.textContent = '날씨를 불러올 수 없음';
      if (updated) updated.textContent = '잠시 후 다시 확인해 주세요.';
    }
  };

  loadWeather();
})();
