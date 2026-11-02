// Bulk-create Timescope collections from Google Maps saved lists.
//
// Input: a JSON file shaped like
//   [{ "list": "Want to go", "pins": [{ "title", "lat", "lng", "note"?, "url"? }] }]
// Pins in each list are clustered by area (CLUSTER_KM). Each cluster becomes
// one collection in the community nearest its centre (created if needed).
// Collections are created UNLISTED; flip them to listed in the editor.
//
// Usage:
//   node scripts/import-google-lists.mjs pins.json --dry-run
//   node scripts/import-google-lists.mjs pins.json [--api https://...] [--token-file path] [--out links.md]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const DRY = args.includes('--dry-run');
const API = flag('api', 'https://timescope-mocha.vercel.app');
const TOKEN_FILE = flag('token-file', '.timescope-import-token');
const OUT = flag('out', 'import-links.md');
const CLUSTER_KM = Number(flag('cluster-km', 40));
const MIN_PINS = Number(flag('min-pins', 3));
const SKIP_TITLES = /^(home|work|my home|my work|house|apartment|dropped pin)$/i;

// Pins that look like someone's address, a bare street, lodging or health care are
// left out: they are personal, and they are not what Timescope collections are for.
function cleanTitle(t) {
  return String(t || '')
    .replace(/\s*Recently (viewed|navigated)\s*$/i, '')
    .replace(/\s*["“].*$/, '')
    .trim();
}
function isPersonal(title, p) {
  if (p.streetAddress) return 'address';
  if (!title || SKIP_TITLES.test(title)) return 'unnamed';
  if (/^\d/.test(title) || /^〒/.test(title)) return 'address';
  if (/^[\p{L}.'’\s-]+,?\s\d+[a-z]?([-/]\d+)*$/u.test(title)) return 'address';
  if (/\b(Rd|Road|Ave|Avenue|St|Street|Lane|Ln|Gali)\b\.?($|\s*&)/i.test(title)) return 'street';
  if (/apartment|homestay|airbnb/i.test(title)) return 'lodging';
  if (/\bMRI\b|diagnostic|pharmacy|clinic\b|surgery\b/i.test(title)) return 'health';
  return null;
}

if (!input) throw new Error('Pass the pins JSON file');
const lists = JSON.parse(readFileSync(input, 'utf8'));

let token = existsSync(TOKEN_FILE) ? readFileSync(TOKEN_FILE, 'utf8').trim() : '';
if (!token) {
  token = randomBytes(32).toString('hex');
  if (!DRY) writeFileSync(TOKEN_FILE, token + '\n', { mode: 0o600 });
}

function km(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function cluster(pins) {
  const groups = [];
  for (const p of pins) {
    let best = null;
    for (const g of groups) {
      const d = km(g.center, p);
      if (d <= CLUSTER_KM && (!best || d < best.d)) best = { g, d };
    }
    if (best) {
      best.g.pins.push(p);
      const n = best.g.pins.length;
      best.g.center = { lat: best.g.pins.reduce((s, x) => s + x.lat, 0) / n, lng: best.g.pins.reduce((s, x) => s + x.lng, 0) / n };
    } else {
      groups.push({ center: { lat: p.lat, lng: p.lng }, pins: [p] });
    }
  }
  return groups.sort((a, b) => b.pins.length - a.pins.length);
}

// Admin-area names Nominatim returns where the town itself is the better label.
const RENAME = {
  Chuo: 'Tokyo',
  Lideta: 'Addis Ababa',
  Chaoyang: 'Beijing',
  'Saguache County': 'Crestone',
  "l'Hospitalet de Llobregat": 'Barcelona',
  Dzongkhag: 'Gelephu',
};

let lastGeo = 0;
const geoCache = new Map();
async function placeFor({ lat, lng }) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const wait = Math.max(0, 1100 - (Date.now() - lastGeo));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastGeo = Date.now();
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=${lat}&lon=${lng}`;
  let place = { name: `${lat.toFixed(2)}, ${lng.toFixed(2)}`, region: '' };
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'timescope-importer/1.0 (timescope-mocha.vercel.app)', 'Accept-Language': 'en' } });
    const d = await res.json();
    const a = d.address || {};
    let name = a.city || a.town || a.village || a.municipality || a.county || a.state_district || a.state || d.name || place.name;
    // Big cities come back as a ward or district; use the city people know.
    if (/^Tokyo/i.test(a.state || '') && !/^Tokyo/i.test(name) && /(ku|Chuo|Minato|Shibuya|Shinjuku|Chiyoda|Taito|Koto|Meguro|Setagaya)/i.test(name)) name = 'Tokyo';
    if (/^Greater London$/i.test(a.state_district || '')) name = 'London';
    if (a.city && a.suburb && name === a.suburb) name = a.city;
    name = name.replace(/^City of /, '').replace(/ (Municipality|District|Thromde)$/,'').replace(/^Dzongkhag /, '');
    place = {
      name: RENAME[name] || name,
      region: [a.state || a.province || a.region, a.country].filter(Boolean).join(', '),
    };
  } catch {}
  geoCache.set(key, place);
  return place;
}

async function get(path) {
  const res = await fetch(API + path, { headers: { 'x-explorer-token': token } });
  return res.json();
}

// Reuse an existing community with the same name nearby before creating one.
async function communityFor(place, center) {
  const { communities = [] } = await get(`/api/communities?lat=${center.lat}&lng=${center.lng}`);
  const want = place.name.toLowerCase();
  const match = communities.find((c) => c.distanceKm <= 40 && c.name.toLowerCase().includes(want));
  if (match) return match;
  const { community } = await call('/api/communities', { name: place.name, region: place.region, lat: center.lat, lng: center.lng });
  return community;
}

async function call(path, body, method = 'POST') {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-explorer-token': token },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${data.error || res.status}`);
  return data;
}

const DISPLAY_NAME = flag('name', null);
if (DISPLAY_NAME && !DRY) await call('/api/me', { displayName: DISPLAY_NAME }, 'PATCH');

const report = [];
let skipped = 0;
const skippedBy = {};
for (const { list, pins } of lists) {
  const clean = [];
  const seen = new Set();
  for (const raw of pins) {
    const title = cleanTitle(raw.title);
    const why = !Number.isFinite(raw.lat) || !Number.isFinite(raw.lng) ? 'no coordinates' : isPersonal(title, raw);
    if (why) { skipped++; skippedBy[why] = (skippedBy[why] || 0) + 1; continue; }
    const key = raw.url || `${raw.lat.toFixed(5)},${raw.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({ ...raw, title });
  }
  if (!clean.length) continue;
  const all = cluster(clean);
  const big = all.filter((g) => g.pins.length >= MIN_PINS);
  const small = all.filter((g) => g.pins.length < MIN_PINS);
  const groups = big.map((g) => ({ ...g, kind: 'area' }));
  if (small.length) {
    const pinsLeft = small.flatMap((g) => g.pins);
    const n = pinsLeft.length;
    // Anchor the leftovers to the list's largest area if it has one, else to their own centre.
    const center = big.length ? big[0].center : { lat: pinsLeft.reduce((a, p) => a + p.lat, 0) / n, lng: pinsLeft.reduce((a, p) => a + p.lng, 0) / n };
    groups.push({ center, pins: pinsLeft, kind: big.length ? 'elsewhere' : (small.length === 1 ? 'area' : 'scattered') });
  }
  for (const g of groups) {
    // Name the area after the real pin closest to the centre, not the centre itself.
    const anchor = g.pins.reduce((best, p) => (km(p, g.center) < km(best, g.center) ? p : best), g.pins[0]);
    const place = await placeFor(anchor);
    const anchorPlace = g.kind === 'elsewhere' ? await placeFor(big[0].pins.reduce((b, p) => (km(p, big[0].center) < km(b, big[0].center) ? p : b), big[0].pins[0])) : place;
    const title = g.kind === 'elsewhere'
      ? `${list} · elsewhere`
      : g.kind === 'scattered'
        ? list
        : list.toLowerCase() === place.name.toLowerCase() ? list : `${list} · ${place.name}`;
    const communityPlace = g.kind === 'elsewhere' ? anchorPlace : place;
    const entry = { list, title, place: communityPlace, count: g.pins.length };
    if (DRY) {
      console.log(`[dry] ${title} — ${g.pins.length} pins → community ${communityPlace.name}, ${communityPlace.region}`);
      report.push(entry);
      continue;
    }
    const community = await communityFor(communityPlace, g.center);
    const { collection } = await call('/api/collections', {
      communitySlug: community.slug,
      title,
      description: `Imported from the Google Maps list “${list}”.`,
      isPublic: false,
      pins: g.pins.map((p) => ({
        title: p.title,
        desc: p.note || '',
        lat: p.lat,
        lng: p.lng,
        source: 'google',
        sourceUrl: p.url || null,
      })),
    });
    entry.slug = collection.slug;
    entry.community = community.name;
    entry.editKey = collection.editKey;
    report.push(entry);
    console.log(`created ${collection.slug} (${g.pins.length} pins) in ${community.name}`);
  }
}

if (!DRY) {
  const lines = [
    '# Timescope import',
    '',
    `Created ${report.length} unlisted collections. Open an edit link once on any device to claim edit access there.`,
    '',
    '| Collection | Community | Places | View | Edit |',
    '| --- | --- | --- | --- | --- |',
    ...report.map((r) => `| ${r.title} | ${r.community} | ${r.count} | ${API}/c/${r.slug} | ${API}/c/${r.slug}?edit=${r.editKey} |`),
    '',
  ];
  writeFileSync(OUT, lines.join('\n'));
  console.log(`Wrote ${OUT}`);
}
console.log(`${report.length} collections, ${report.reduce((a, r) => a + r.count, 0)} pins imported, ${skipped} skipped:`, skippedBy);
