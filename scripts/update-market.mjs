import { writeFile } from 'node:fs/promises';

const sources = {
  kospi: 'https://m.stock.naver.com/api/index/KOSPI/basic',
  kosdaq: 'https://m.stock.naver.com/api/index/KOSDAQ/basic',
  exchange: 'https://api.coinbase.com/v2/exchange-rates?currency=USD'
};

const getJson = async (url) => {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Nowfeed market updater' } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
};

const [kospi, kosdaq, exchange] = await Promise.all([
  getJson(sources.kospi), getJson(sources.kosdaq), getJson(sources.exchange)
]);

const normalizeIndex = (item) => ({
  price: item.closePrice,
  change: item.compareToPreviousClosePrice,
  changePercent: item.fluctuationsRatio,
  direction: item.compareToPreviousPrice.name
});

const tradedAt = new Date(kospi.localTradedAt);
const timeParts = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
}).formatToParts(tradedAt).reduce((parts, item) => ({ ...parts, [item.type]: item.value }), {});
const displayTime = `${timeParts.year}.${timeParts.month}.${timeParts.day} ${timeParts.hour}:${timeParts.minute}`;

const output = {
  updatedAt: new Date().toISOString(),
  displayTime,
  marketStatus: kospi.marketStatus,
  kospi: normalizeIndex(kospi),
  kosdaq: normalizeIndex(kosdaq),
  usdkrw: { price: Number(exchange.data.rates.KRW), base: 'USD', quote: 'KRW' }
};

await writeFile(new URL('../data/market.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Updated market data at ${output.updatedAt}`);
