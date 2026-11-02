// Client for the Timescope API plus the anonymous "explorer" identity that
// lives in this browser. The raw token never leaves the device except as a
// request header; the server stores only its hash.

const TOKEN_KEY = 'timescope.explorer';
const EDIT_KEYS = 'timescope.editKeys';

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function explorerToken() {
  try {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t || t.length < 32) {
      t = randomHex(32);
      localStorage.setItem(TOKEN_KEY, t);
    }
    return t;
  } catch {
    if (!window.__timescopeToken) window.__timescopeToken = randomHex(32);
    return window.__timescopeToken;
  }
}

function readEditKeys() {
  try { return JSON.parse(localStorage.getItem(EDIT_KEYS) || '{}'); } catch { return {}; }
}
export function rememberEditKey(slug, key) {
  if (!slug || !key) return;
  try {
    const all = readEditKeys();
    all[slug] = key;
    localStorage.setItem(EDIT_KEYS, JSON.stringify(all));
  } catch {}
}
export function storedEditKey(slug) {
  return readEditKeys()[slug] || null;
}
export function forgetEditKey(slug) {
  try {
    const all = readEditKeys();
    delete all[slug];
    localStorage.setItem(EDIT_KEYS, JSON.stringify(all));
  } catch {}
}

async function request(path, { method = 'GET', body, editKey } = {}) {
  const headers = { 'x-explorer-token': explorerToken() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (editKey) headers['x-edit-key'] = editKey;
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  communities: {
    all: () => request('/api/communities'),
    search: (q) => request(`/api/communities?q=${encodeURIComponent(q)}`),
    nearby: (lat, lng) => request(`/api/communities?lat=${lat}&lng=${lng}`),
    create: (c) => request('/api/communities', { method: 'POST', body: c }),
    get: (slug) => request(`/api/communities/${encodeURIComponent(slug)}`),
  },
  collections: {
    create: (c) => request('/api/collections', { method: 'POST', body: c }),
    get: (slug, editKey) => request(`/api/collections/${encodeURIComponent(slug)}`, { editKey }),
    update: (slug, patch, editKey) => request(`/api/collections/${encodeURIComponent(slug)}`, { method: 'PATCH', body: patch, editKey }),
    remove: (slug) => request(`/api/collections/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
    addPins: (slug, pins, editKey) => request(`/api/collections/${encodeURIComponent(slug)}/pins`, { method: 'POST', body: { pins }, editKey }),
  },
  pins: {
    update: (id, patch, editKey) => request(`/api/pins/${id}`, { method: 'PATCH', body: patch, editKey }),
    remove: (id, editKey) => request(`/api/pins/${id}`, { method: 'DELETE', editKey }),
    notes: (id) => request(`/api/pins/${id}/notes`),
    addNote: (id, text) => request(`/api/pins/${id}/notes`, { method: 'POST', body: { text } }),
  },
  me: {
    get: () => request('/api/me'),
    update: (patch) => request('/api/me', { method: 'PATCH', body: patch }),
  },
};

// ---- Geocoding (OpenStreetMap Nominatim; 1 request/second policy) ----
let lastGeocode = 0;
async function throttled(url) {
  const wait = Math.max(0, 1100 - (Date.now() - lastGeocode));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastGeocode = Date.now();
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Geocoding failed');
  return res.json();
}

export async function geocodeSearch(q, { near, limit = 6 } = {}) {
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: String(limit), addressdetails: '1' });
  if (near) {
    const d = 0.5;
    params.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  const data = await throttled(`https://nominatim.openstreetmap.org/search?${params}`);
  return data.map(placeFromNominatim);
}

export async function geocodeReverse(lat, lng) {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', zoom: '12', addressdetails: '1' });
  const data = await throttled(`https://nominatim.openstreetmap.org/reverse?${params}`);
  if (!data || data.error) return null;
  return placeFromNominatim(data);
}

function placeFromNominatim(r) {
  const a = r.address || {};
  const locality = a.city || a.town || a.village || a.municipality || a.hamlet || a.county || r.name || r.display_name?.split(',')[0] || 'Unknown';
  const region = [a.state || a.province || a.region, a.country].filter(Boolean).join(', ');
  return {
    name: r.name && r.name !== locality && !/^\d/.test(r.name) ? r.name : locality,
    locality,
    region,
    displayName: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
    type: r.type,
  };
}

export function getCurrentPosition(options = { enableHighAccuracy: true, timeout: 12000 }) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation is not available in this browser'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || 'Could not get your location')),
      options
    );
  });
}

export function shareUrl(slug, editKey) {
  const url = new URL(`/c/${slug}`, window.location.origin);
  if (editKey) url.searchParams.set('edit', editKey);
  return url.toString();
}
