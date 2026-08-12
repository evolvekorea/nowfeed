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

  const setWeather = (current) => {
    const condition = descriptions.find((item) => item.codes.includes(current.weather_code)) || descriptions[2];
    tempNode.textContent = `${Math.round(current.temperature_2m)}°`;
    statusNode.textContent = `${condition.label} · 체감 ${Math.round(current.apparent_temperature)}°`;
    iconNode.textContent = current.is_day ? condition.day : condition.night;
  };

  const loadWeather = async () => {
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m,apparent_temperature,is_day,weather_code&timezone=Asia%2FSeoul';
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
      const data = await response.json();
      if (!data.current) throw new Error('Weather data is missing');
      setWeather(data.current);
    } catch {
      statusNode.textContent = '날씨를 불러올 수 없음';
      tempNode.textContent = '--°';
      iconNode.textContent = '☁';
    }
  };

  loadWeather();
})();
