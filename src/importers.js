// Parsers for the files people export from Google Maps:
//  - Google Takeout → Maps (your places) → "Saved Places.json" (GeoJSON)
//  - Google Takeout → Saved → "<list name>.csv" (Title, Note, URL, Comment)
//  - Google My Maps → Export to KML
//  - GPX waypoints and generic GeoJSON also work.
import { geocodeSearch } from './api';

export const ACCEPTED = '.json,.geojson,.csv,.kml,.gpx,application/json,text/csv,application/vnd.google-earth.kml+xml';

export async function parseImportFile(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.kmz')) {
    throw new Error('KMZ is a zipped file. In Google My Maps choose Export to KML/KMZ and untick "Keep data up to date" so you get a plain .kml file.');
  }
  const text = await file.text();
  let pins;
  let format;
  if (name.endsWith('.kml') || text.trimStart().startsWith('<?xml') && text.includes('<kml')) {
    format = 'KML';
    pins = parseKml(text);
  } else if (name.endsWith('.gpx') || text.includes('<gpx')) {
    format = 'GPX';
    pins = parseGpx(text);
  } else if (name.endsWith('.csv') || /^\s*"?Title"?,/i.test(text)) {
    format = 'Google Maps CSV';
    pins = parseCsv(text);
  } else {
    format = 'GeoJSON';
    pins = parseGeoJson(text);
  }
  pins = pins.filter((p) => p.title);
  if (!pins.length) throw new Error(`No places found in this ${format} file.`);
  return { pins: pins.map(finishPin), format, needsGeocoding: pins.filter((p) => p.lat == null).length };
}

function finishPin(p, i) {
  return {
    localId: `import-${Date.now()}-${i}`,
    title: p.title.trim().slice(0, 200),
    desc: (p.desc || '').trim().slice(0, 2000),
    lat: p.lat,
    lng: p.lng,
    year: p.year ?? guessYear(`${p.title} ${p.desc || ''}`),
    sourceUrl: p.sourceUrl || null,
    source: p.sourceUrl && /google\./.test(p.sourceUrl) ? 'google' : 'import',
    selected: true,
  };
}

export function guessYear(text) {
  // "founded in 1888", "(1912)", "est. 1962" — only accept plausible history years.
  // When several years appear ("visited 2019, built 1490") the earliest is the history.
  const now = new Date().getFullYear();
  const years = Array.from(String(text).matchAll(/(?:^|[^\d])(1[0-9]{3}|20[0-2][0-9])(?!\d)/g))
    .map((m) => Number(m[1]))
    .filter((y) => y <= now);
  return years.length ? Math.min(...years) : null;
}

export function extractCoordsFromUrl(url) {
  if (!url) return null;
  const s = decodeURIComponent(String(url));
  const tries = [
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,       // place data blob
    /\/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,          // viewport
    /\/search\/(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/, // search by coords
    /[?&](?:q|query|ll|center|destination)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
  ];
  for (const re of tries) {
    const m = s.match(re);
    if (m) {
      const lat = Number(m[1]), lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

function parseGeoJson(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  const features = Array.isArray(data?.features) ? data.features : Array.isArray(data) ? data : [];
  return features.map((f) => {
    const props = f.properties || f || {};
    const loc = props.location || {};
    const coords = f.geometry?.type === 'Point' ? f.geometry.coordinates : null;
    const url = props.google_maps_url || props.url || props.URL || null;
    const fromUrl = extractCoordsFromUrl(url);
    const lat = coords ? Number(coords[1]) : fromUrl?.lat ?? (props.lat != null ? Number(props.lat) : null);
    const lng = coords ? Number(coords[0]) : fromUrl?.lng ?? (props.lng != null ? Number(props.lng) : null);
    const title = loc.name || props.Title || props.title || props.name || loc.address || props.Comment || '';
    const desc = [props.Comment, props.Note, props.note, props.description, loc.address].filter(Boolean).join(' · ');
    return { title, desc, lat: valid(lat, lng) ? lat : null, lng: valid(lat, lng) ? lng : null, sourceUrl: url };
  });
}

function parseCsv(text) {
  const rows = csvRows(text);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (names) => header.findIndex((h) => names.includes(h));
  const iTitle = idx(['title', 'name', 'place']);
  const iNote = idx(['note', 'notes']);
  const iUrl = idx(['url', 'link']);
  const iComment = idx(['comment', 'comments', 'description']);
  const iLat = idx(['lat', 'latitude']);
  const iLng = idx(['lng', 'lon', 'long', 'longitude']);
  const iYear = idx(['year', 'date']);
  return rows.slice(1).map((r) => {
    const url = iUrl >= 0 ? r[iUrl] : null;
    const fromUrl = extractCoordsFromUrl(url);
    let lat = iLat >= 0 ? Number(r[iLat]) : fromUrl?.lat ?? null;
    let lng = iLng >= 0 ? Number(r[iLng]) : fromUrl?.lng ?? null;
    if (!valid(lat, lng)) { lat = null; lng = null; }
    const year = iYear >= 0 ? guessYear(r[iYear]) : null;
    return {
      title: (iTitle >= 0 ? r[iTitle] : r[0]) || '',
      desc: [iNote >= 0 ? r[iNote] : '', iComment >= 0 ? r[iComment] : ''].filter(Boolean).join(' · '),
      lat, lng, year, sourceUrl: url,
    };
  });
}

function csvRows(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

function xml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('This file is not valid XML.');
  return doc;
}

function parseKml(text) {
  const doc = xml(text);
  return Array.from(doc.getElementsByTagName('Placemark')).map((pm) => {
    const coordText = pm.getElementsByTagName('coordinates')[0]?.textContent?.trim() || '';
    const [lngS, latS] = coordText.split(/\s+/)[0]?.split(',') || [];
    const lat = Number(latS), lng = Number(lngS);
    const title = pm.getElementsByTagName('name')[0]?.textContent || '';
    const rawDesc = pm.getElementsByTagName('description')[0]?.textContent || '';
    const desc = rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const when = pm.getElementsByTagName('when')[0]?.textContent;
    return { title, desc, lat: valid(lat, lng) ? lat : null, lng: valid(lat, lng) ? lng : null, year: when ? guessYear(when) : null };
  });
}

function parseGpx(text) {
  const doc = xml(text);
  return Array.from(doc.getElementsByTagName('wpt')).map((w) => {
    const lat = Number(w.getAttribute('lat')), lng = Number(w.getAttribute('lon'));
    return {
      title: w.getElementsByTagName('name')[0]?.textContent || '',
      desc: w.getElementsByTagName('desc')[0]?.textContent || '',
      lat: valid(lat, lng) ? lat : null, lng: valid(lat, lng) ? lng : null,
    };
  });
}

function valid(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

/**
 * Fill in coordinates for pins that only have a name (Takeout CSV lists often
 * carry no coordinates). Biases results toward `near`. Calls onProgress(done, total).
 */
export async function geocodeMissing(pins, { near, onProgress, signal } = {}) {
  const missing = pins.filter((p) => p.lat == null);
  const out = [...pins];
  let done = 0;
  for (const pin of missing) {
    if (signal?.aborted) break;
    try {
      const results = await geocodeSearch(pin.title, { near, limit: 1 });
      if (results[0]) {
        const i = out.findIndex((p) => p.localId === pin.localId);
        out[i] = { ...out[i], lat: results[0].lat, lng: results[0].lng, geocoded: true };
      }
    } catch {}
    done++;
    onProgress?.(done, missing.length, out);
  }
  return out;
}
