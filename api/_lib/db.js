import { neon } from '@neondatabase/serverless';
import { createHash, randomBytes } from 'node:crypto';

export const sql = neon(process.env.DATABASE_URL);

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function error(res, status, message) {
  send(res, status, { error: message });
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  error(res, 405, `Method not allowed. Use ${allowed.join(' or ')}.`);
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

export function query(req) {
  const url = new URL(req.url, 'http://localhost');
  return Object.fromEntries(url.searchParams.entries());
}

export function slugify(text) {
  const base = String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'place';
}

export function randomKey(bytes = 12) {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Resolve the anonymous explorer identity from the x-explorer-token header.
 * The raw token never leaves the device; only its hash is stored.
 */
export async function getExplorer(req, { create = false } = {}) {
  const token = req.headers['x-explorer-token'];
  if (!token || String(token).length < 16) return null;
  const hash = hashToken(token);
  const rows = await sql`SELECT id, display_name FROM explorers WHERE token_hash = ${hash}`;
  if (rows.length) return rows[0];
  if (!create) return null;
  const inserted = await sql`
    INSERT INTO explorers (token_hash) VALUES (${hash})
    ON CONFLICT (token_hash) DO UPDATE SET token_hash = EXCLUDED.token_hash
    RETURNING id, display_name`;
  return inserted[0];
}

export function editKeyFrom(req) {
  return req.headers['x-edit-key'] || query(req).edit || null;
}

export function canEdit(collection, explorer, editKey) {
  if (explorer && collection.owner_id && collection.owner_id === explorer.id) return true;
  if (editKey && editKey === collection.edit_key) return true;
  return false;
}

export async function uniqueSlug(table, base) {
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const rows = table === 'communities'
      ? await sql`SELECT 1 FROM communities WHERE slug = ${slug}`
      : await sql`SELECT 1 FROM collections WHERE slug = ${slug}`;
    if (!rows.length) return slug;
    slug = `${base}-${randomKey(3).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export function pinToJson(row) {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    titleEn: row.title_en,
    desc: row.description,
    history: row.history,
    funFact: row.fun_fact,
    year: row.year,
    lat: row.lat,
    lng: row.lng,
    color: row.color,
    wiki: row.wiki,
    imageUrl: row.image_url,
    source: row.source,
    sourceUrl: row.source_url,
    related: row.related || [],
    sortOrder: row.sort_order,
  };
}

export function collectionToJson(row, { includeEditKey = false } = {}) {
  const out = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    isPublic: row.is_public,
    communitySlug: row.community_slug,
    communityName: row.community_name,
    ownerName: row.owner_name || null,
    ownerId: row.owner_id || null,
    pinCount: row.pin_count != null ? Number(row.pin_count) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeEditKey) out.editKey = row.edit_key;
  return out;
}

const PALETTE = ['#e74c3c', '#f39c12', '#2ecc71', '#9b59b6', '#1abc9c', '#e91e63', '#3498db', '#FF5722', '#607D8B', '#8BC34A', '#795548', '#9C27B0', '#00BCD4', '#FFC107', '#C62828', '#0097A7'];

export function normalizePin(input, index = 0) {
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error(`Pin ${index + 1} has invalid coordinates`);
  }
  const title = String(input.title || '').trim().slice(0, 200);
  if (!title) throw new Error(`Pin ${index + 1} needs a title`);
  let year = input.year == null || input.year === '' ? null : Number(input.year);
  if (year != null && (!Number.isFinite(year) || year < -10000 || year > 2100)) year = null;
  const color = /^#[0-9a-fA-F]{6}$/.test(input.color || '') ? input.color : PALETTE[index % PALETTE.length];
  return {
    key: slugify(input.key || title) + (input.key ? '' : `-${index}`),
    title,
    title_en: String(input.titleEn || '').trim().slice(0, 200),
    description: String(input.desc || '').trim().slice(0, 2000),
    history: String(input.history || '').trim().slice(0, 8000),
    fun_fact: String(input.funFact || '').trim().slice(0, 2000),
    year: year == null ? null : Math.round(year),
    lat,
    lng,
    color,
    wiki: input.wiki ? String(input.wiki).slice(0, 300) : null,
    image_url: input.imageUrl ? String(input.imageUrl).slice(0, 1000) : null,
    source: ['manual', 'google', 'seed', 'import'].includes(input.source) ? input.source : 'manual',
    source_url: input.sourceUrl ? String(input.sourceUrl).slice(0, 1000) : null,
    related: Array.isArray(input.related) ? input.related.map(String).slice(0, 20) : [],
    sort_order: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : index,
  };
}
