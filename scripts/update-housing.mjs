import { writeFile } from 'node:fs/promises';

const apiKey = process.env.APPLYHOME_API_KEY;
if (!apiKey) throw new Error('APPLYHOME_API_KEY is required');

const dateInSeoul = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const today = dateInSeoul();
const fromDate = dateInSeoul(new Date(Date.now() - (14 * 24 * 60 * 60 * 1000)));
const condition = encodeURIComponent('cond[RCRIT_PBLANC_DE::GTE]');
const url = `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail?page=1&perPage=100&${condition}=${fromDate}`;

const response = await fetch(url, {
  headers: { Authorization: `Infuser ${apiKey}`, Accept: 'application/json', 'User-Agent': 'Nowfeed housing updater' }
});
if (!response.ok) throw new Error(`ApplyHome API returned ${response.status}`);
const payload = await response.json();

const rows = payload.data
  .filter((item) => item.RCEPT_ENDDE && item.RCEPT_ENDDE >= today)
  .sort((a, b) => a.RCEPT_BGNDE.localeCompare(b.RCEPT_BGNDE))
  .slice(0, 12)
  .map((item) => ({
    id: `${item.HOUSE_MANAGE_NO}-${item.PBLANC_NO}`,
    name: item.HOUSE_NM,
    region: item.SUBSCRPT_AREA_CODE_NM,
    type: item.HOUSE_DTL_SECD_NM || item.HOUSE_SECD_NM,
    address: item.HSSPLY_ADRES,
    households: Number(item.TOT_SUPLY_HSHLDCO || 0),
    publishedDate: item.RCRIT_PBLANC_DE,
    startDate: item.RCEPT_BGNDE,
    endDate: item.RCEPT_ENDDE,
    status: item.RCEPT_BGNDE > today ? '접수 예정' : '접수 중',
    url: item.PBLANC_URL
  }));

const now = new Date();
const timeParts = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
}).formatToParts(now).reduce((parts, item) => ({ ...parts, [item.type]: item.value }), {});
const displayTime = `${timeParts.year}.${timeParts.month}.${timeParts.day} ${timeParts.hour}:${timeParts.minute}`;

const output = { updatedAt: now.toISOString(), displayTime, items: rows };
await writeFile(new URL('../data/housing.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Updated ${rows.length} housing notices at ${output.updatedAt}`);
