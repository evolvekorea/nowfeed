export const SOURCES = {
  kospi: 'https://m.stock.naver.com/api/index/KOSPI/basic',
  kosdaq: 'https://m.stock.naver.com/api/index/KOSDAQ/basic',
  usdkrw: 'https://api.coinbase.com/v2/exchange-rates?currency=USD'
};
export const numberOf = value => typeof value === 'number' ? value :
  typeof value === 'string' && value.trim() ? Number(value.replaceAll(',', '')) : NaN;
export const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function validItem(item, key) {
  return !!item && Number.isFinite(numberOf(item.price)) && numberOf(item.price) > 0 &&
    (key === 'usdkrw' || (Number.isFinite(numberOf(item.changePercent)) && ['RISING', 'FALLING', 'UNCHANGED'].includes(item.direction)));
}
export function timeLabel(value) {
  if (!validTime(value)) return '기준 시각 미확인';
  return new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
}
export function isStale(item, key, now = Date.now()) {
  if (!validItem(item, key) || item.sourceStatus === 'error' || !validTime(item.fetchedAt)) return true;
  const age = now - Date.parse(item.fetchedAt);
  if (age > 90 * 60_000 || age < -5 * 60_000) return true;
  return key !== 'usdkrw' && item.marketStatus === 'OPEN' &&
    (!validTime(item.tradedAt) || now - Date.parse(item.tradedAt) > 90 * 60_000);
}
export function normalizeSource(key, raw, fetchedAt) {
  if (key === 'usdkrw') {
    const item = {price:numberOf(raw?.data?.rates?.KRW),base:'USD',quote:'KRW',fetchedAt,sourceStatus:'ok'};
    if (!validItem(item,key)) throw new Error('Invalid exchange rate');
    return item;
  }
  if (!validTime(raw?.localTradedAt) || typeof raw?.marketStatus !== 'string') throw new Error('Invalid index timestamp/status');
  const item = {price:raw.closePrice,change:raw.compareToPreviousClosePrice,changePercent:raw.fluctuationsRatio,
    direction:raw.compareToPreviousPrice?.name,marketStatus:raw.marketStatus,
    tradedAt:new Date(raw.localTradedAt).toISOString(),fetchedAt,sourceStatus:'ok'};
  if (!validItem(item,key)) throw new Error('Invalid index quote');
  return item;
}
export async function collectMarket(previous, fetchJson, now = new Date().toISOString()) {
  const keys = Object.keys(SOURCES);
  const results = await Promise.allSettled(keys.map(async key => normalizeSource(key, await fetchJson(SOURCES[key]), now)));
  const output = {...previous,lastAttemptAt:now};
  let succeeded=0;
  const failed=[];
  results.forEach((result,i) => {
    const key=keys[i];
    if (result.status === 'fulfilled') {output[key]=result.value;succeeded++;}
    else {
      failed.push(key);
      output[key]=validItem(previous[key],key) ? {...previous[key],fetchedAt:previous[key].fetchedAt || previous.updatedAt,sourceStatus:'error'} : null;
    }
  });
  if (succeeded) output.updatedAt=now;
  output.marketStatus=output.kospi?.marketStatus || previous.marketStatus || 'UNKNOWN';
  output.displayTime=output.kospi?.tradedAt ? timeLabel(output.kospi.tradedAt) : previous.displayTime;
  return {output,failed};
}
