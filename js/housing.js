(() => {
  const list = document.querySelector('#housing-list');
  const updated = document.querySelector('#housing-updated');
  if (!list || !updated) return;

  const formatDate = (date) => {
    const [, month, day] = date.split('-');
    return { month: `${Number(month)}월`, day: Number(day) };
  };

  const renderItem = (item) => {
    const link = document.createElement('a');
    link.className = 'housing-item';
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const date = formatDate(item.startDate);
    const dateNode = document.createElement('span');
    dateNode.className = 'housing-date';
    dateNode.textContent = String(date.day);
    const month = document.createElement('small');
    month.textContent = date.month;
    dateNode.append(month);

    const copy = document.createElement('span');
    copy.className = 'housing-copy';
    const meta = document.createElement('span');
    const status = document.createElement('b');
    status.className = `housing-status ${item.status === '접수 예정' ? 'upcoming' : ''}`;
    status.textContent = item.status;
    meta.append(status, document.createTextNode(`${item.region} · ${item.type}`));
    const title = document.createElement('strong');
    title.textContent = item.name;
    const detail = document.createElement('small');
    detail.textContent = `${item.startDate.replaceAll('-', '.')}–${item.endDate.slice(5).replace('-', '.')} · ${Number(item.households || 0).toLocaleString('ko-KR')}세대`;
    copy.append(meta, title, detail);
    link.append(dateNode, copy);
    return link;
  };

  const loadHousing = async () => {
    try {
      const response = await fetch(`data/housing.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Housing request failed: ${response.status}`);
      const data = await response.json();
      list.replaceChildren(...data.items.slice(0, 5).map(renderItem));
      if (!data.items.length) list.innerHTML = '<p>현재 접수 예정인 APT 공고가 없습니다.</p>';
      updated.textContent = `한국부동산원 청약홈 · ${data.displayTime} 갱신`;
    } catch {
      list.innerHTML = '<p>청약 일정을 불러오지 못했습니다. 청약홈에서 확인해 주세요.</p>';
      updated.textContent = '한국부동산원 청약홈 공식 데이터';
    }
  };

  loadHousing();
})();
