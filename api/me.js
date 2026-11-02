import { sql, send, error, methodNotAllowed, readBody, getExplorer, collectionToJson } from './_lib/db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const explorer = await getExplorer(req, { create: true });
      if (!explorer) return error(res, 401, 'Missing explorer token');
      const rows = await sql`
        SELECT col.*, c.slug AS community_slug, c.name AS community_name, ${explorer.display_name} AS owner_name,
               (SELECT COUNT(*) FROM pins p WHERE p.collection_id = col.id) AS pin_count
        FROM collections col
        JOIN communities c ON c.id = col.community_id
        WHERE col.owner_id = ${explorer.id}
        ORDER BY col.updated_at DESC`;
      return send(res, 200, {
        explorer: { id: explorer.id, displayName: explorer.display_name },
        collections: rows.map((r) => collectionToJson(r, { includeEditKey: true })),
      });
    }

    if (req.method === 'PATCH') {
      const explorer = await getExplorer(req, { create: true });
      if (!explorer) return error(res, 401, 'Missing explorer token');
      const body = await readBody(req);
      const name = String(body.displayName || '').trim().slice(0, 40);
      if (!name) return error(res, 400, 'Name cannot be empty');
      const [updated] = await sql`UPDATE explorers SET display_name = ${name} WHERE id = ${explorer.id} RETURNING id, display_name`;
      await sql`UPDATE pin_notes SET author_name = ${name} WHERE explorer_id = ${explorer.id}`;
      return send(res, 200, { explorer: { id: updated.id, displayName: updated.display_name } });
    }

    return methodNotAllowed(res, ['GET', 'PATCH']);
  } catch (e) {
    console.error(e);
    return error(res, 500, e.message);
  }
}
