import { sql, send, error, methodNotAllowed, readBody, slugify, randomKey, uniqueSlug, getExplorer, normalizePin, pinToJson, collectionToJson } from '../_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const explorer = await getExplorer(req, { create: true });
    if (!explorer) return error(res, 401, 'Missing explorer token');
    const body = await readBody(req);
    const title = String(body.title || '').trim().slice(0, 140);
    if (!title) return error(res, 400, 'Collection needs a title');
    const description = String(body.description || '').trim().slice(0, 2000);
    const isPublic = body.isPublic !== false;

    const [community] = await sql`SELECT id, slug, name FROM communities WHERE slug = ${String(body.communitySlug || '')}`;
    if (!community) return error(res, 404, 'Community not found');

    let pins = [];
    try {
      pins = (Array.isArray(body.pins) ? body.pins : []).slice(0, 500).map((p, i) => normalizePin(p, i));
    } catch (e) {
      return error(res, 400, e.message);
    }

    const slug = await uniqueSlug('collections', slugify(title));
    const editKey = randomKey(12);
    const [col] = await sql`
      INSERT INTO collections (slug, community_id, owner_id, title, description, is_public, edit_key)
      VALUES (${slug}, ${community.id}, ${explorer.id}, ${title}, ${description}, ${isPublic}, ${editKey})
      RETURNING *`;

    let inserted = [];
    if (pins.length) {
      const results = await sql.transaction(pins.map((p) => sql`
        INSERT INTO pins (collection_id, key, title, title_en, description, history, fun_fact, year, lat, lng, color, wiki, image_url, source, source_url, related, sort_order)
        VALUES (${col.id}, ${p.key}, ${p.title}, ${p.title_en}, ${p.description}, ${p.history}, ${p.fun_fact}, ${p.year}, ${p.lat}, ${p.lng}, ${p.color}, ${p.wiki}, ${p.image_url}, ${p.source}, ${p.source_url}, ${p.related}, ${p.sort_order})
        ON CONFLICT (collection_id, key) DO NOTHING
        RETURNING *`));
      inserted = results.flat().map(pinToJson);
    }

    return send(res, 201, {
      collection: collectionToJson({ ...col, community_slug: community.slug, community_name: community.name, owner_name: explorer.display_name, pin_count: inserted.length }, { includeEditKey: true }),
      pins: inserted,
      canEdit: true,
    });
  } catch (e) {
    console.error(e);
    return error(res, 500, e.message);
  }
}
