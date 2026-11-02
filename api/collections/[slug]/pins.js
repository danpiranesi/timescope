import { sql, send, error, methodNotAllowed, readBody, query, getExplorer, editKeyFrom, canEdit, normalizePin, pinToJson } from '../../_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const { slug } = query(req);
    const [col] = await sql`SELECT * FROM collections WHERE slug = ${slug}`;
    if (!col) return error(res, 404, 'Collection not found');
    const explorer = await getExplorer(req);
    if (!canEdit(col, explorer, editKeyFrom(req))) return error(res, 403, 'You cannot edit this collection');

    const body = await readBody(req);
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM pins WHERE collection_id = ${col.id}`;
    const offset = Number(count);
    let pins;
    try {
      pins = (Array.isArray(body.pins) ? body.pins : [body]).slice(0, 500).map((p, i) => normalizePin({ ...p, sortOrder: p.sortOrder ?? offset + i }, offset + i));
    } catch (e) {
      return error(res, 400, e.message);
    }
    if (!pins.length) return error(res, 400, 'No pins supplied');

    const results = await sql.transaction(pins.map((p) => sql`
      INSERT INTO pins (collection_id, key, title, title_en, description, history, fun_fact, year, lat, lng, color, wiki, image_url, source, source_url, related, sort_order)
      VALUES (${col.id}, ${p.key}, ${p.title}, ${p.title_en}, ${p.description}, ${p.history}, ${p.fun_fact}, ${p.year}, ${p.lat}, ${p.lng}, ${p.color}, ${p.wiki}, ${p.image_url}, ${p.source}, ${p.source_url}, ${p.related}, ${p.sort_order})
      ON CONFLICT (collection_id, key) DO UPDATE SET key = pins.key || '-' || substr(md5(random()::text), 1, 4)
      RETURNING *`));
    await sql`UPDATE collections SET updated_at = now() WHERE id = ${col.id}`;
    return send(res, 201, { pins: results.flat().map(pinToJson) });
  } catch (e) {
    console.error(e);
    return error(res, 500, e.message);
  }
}
