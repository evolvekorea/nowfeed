(() => {
  const formatChange = (value, direction) => {
    const number = Number(value);
    const sign = direction === 'RISING' ? '+' : direction === 'FALLING' ? '-' : '';
    return `${sign}${Math.abs(number).toFixed(2)}%`;
  };

  const setChange = (node, value, direction) => {
    if (!node) return;
    node.textContent = formatChange(value, direction);
    node.classList.toggle('up', direction === 'RISING');
    node.classList.toggle('down', direction === 'FALLING');
  };

  const loadMarket = async () => {
    try {
      const response = await fetch(`data/market.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Market request failed: ${response.status}`);
      const data = await response.json();
      document.querySelector('#kospi-price').textContent = data.kospi.price;
      document.querySelector('#kosdaq-price').textContent = data.kosdaq.price;
      document.querySelector('#usdkrw-price').textContent = Number(data.usdkrw.price).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
      setChange(document.querySelector('#kospi-change'), data.kospi.changePercent, data.kospi.direction);
      setChange(document.querySelector('#kosdaq-change'), data.kosdaq.changePercent, data.kosdaq.direction);
      document.querySelector('#market-state').textContent = data.marketStatus === 'OPEN' ? '장중' : '마감';
      document.querySelector('#market-updated').textContent = `${data.displayTime} 기준 · 최대 30분 지연될 수 있습니다.`;
    } catch {
      document.querySelector('#market-state').textContent = '지연';
      document.querySelector('#market-updated').textContent = '마지막 시세를 불러오지 못했습니다.';
    }
  };

  loadMarket();
})();
