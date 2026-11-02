import { sql, send, error, methodNotAllowed, readBody, query, slugify, distanceKm, uniqueSlug } from '../_lib/db.js';

const NEARBY_KM = 60;
const DEDUPE_KM = 5;

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { lat, lng, q } = query(req);
      const rows = await sql`
        SELECT c.id, c.slug, c.name, c.region, c.lat, c.lng, c.created_at,
               COUNT(col.id) FILTER (WHERE col.is_public) AS collection_count
        FROM communities c
        LEFT JOIN collections col ON col.community_id = c.id
        GROUP BY c.id
        ORDER BY collection_count DESC, c.name ASC`;
      let list = rows.map((r) => ({ ...r, collectionCount: Number(r.collection_count) }));
      if (q) {
        const needle = q.toLowerCase();
        list = list.filter((c) => c.name.toLowerCase().includes(needle) || c.region.toLowerCase().includes(needle));
      }
      // The default listing shows only communities with something public to see;
      // search and nearby lookups still return every community.
      if (!q && !(lat && lng)) list = list.filter((c) => c.collectionCount > 0);
      if (lat && lng) {
        const la = Number(lat), ln = Number(lng);
        list = list
          .map((c) => ({ ...c, distanceKm: distanceKm(la, ln, c.lat, c.lng) }))
          .filter((c) => c.distanceKm <= NEARBY_KM)
          .sort((a, b) => a.distanceKm - b.distanceKm);
      }
      return send(res, 200, { communities: list.map(clean) });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const name = String(body.name || '').trim().slice(0, 120);
      const region = String(body.region || '').trim().slice(0, 200);
      const lat = Number(body.lat), lng = Number(body.lng);
      if (!name) return error(res, 400, 'Community needs a name');
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return error(res, 400, 'Community needs coordinates');

      const existing = await sql`SELECT id, slug, name, region, lat, lng FROM communities`;
      const dupe = existing.find((c) => distanceKm(lat, lng, c.lat, c.lng) <= DEDUPE_KM);
      if (dupe) return send(res, 200, { community: clean(dupe), existing: true });

      const slug = await uniqueSlug('communities', slugify(name));
      const [created] = await sql`
        INSERT INTO communities (slug, name, region, lat, lng)
        VALUES (${slug}, ${name}, ${region}, ${lat}, ${lng})
        RETURNING id, slug, name, region, lat, lng`;
      return send(res, 201, { community: clean(created), existing: false });
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (e) {
    console.error(e);
    return error(res, 500, e.message);
  }
}

function clean(c) {
  return {
    id: c.id, slug: c.slug, name: c.name, region: c.region, lat: c.lat, lng: c.lng,
    collectionCount: c.collectionCount ?? undefined,
    distanceKm: c.distanceKm != null ? Math.round(c.distanceKm * 10) / 10 : undefined,
  };
}
