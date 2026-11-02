import { sql, send, error, methodNotAllowed, query, getExplorer, collectionToJson } from '../_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const { slug } = query(req);
    const [community] = await sql`SELECT id, slug, name, region, lat, lng FROM communities WHERE slug = ${slug}`;
    if (!community) return error(res, 404, 'Community not found');

    const explorer = await getExplorer(req);
    const explorerId = explorer ? explorer.id : null;
    const rows = await sql`
      SELECT col.*, c.slug AS community_slug, c.name AS community_name, e.display_name AS owner_name,
             (SELECT COUNT(*) FROM pins p WHERE p.collection_id = col.id) AS pin_count
      FROM collections col
      JOIN communities c ON c.id = col.community_id
      LEFT JOIN explorers e ON e.id = col.owner_id
      WHERE col.community_id = ${community.id}
        AND (col.is_public OR col.owner_id = ${explorerId}::uuid)
      ORDER BY col.updated_at DESC`;
    return send(res, 200, {
      community,
      collections: rows.map((r) => ({ ...collectionToJson(r), isMine: explorerId != null && r.owner_id === explorerId })),
    });
  } catch (e) {
    console.error(e);
    return error(res, 500, e.message);
  }
}
