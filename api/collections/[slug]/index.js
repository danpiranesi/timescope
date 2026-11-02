import { sql, send, error, methodNotAllowed, readBody, query, getExplorer, editKeyFrom, canEdit, pinToJson, collectionToJson } from '../../_lib/db.js';

async function loadCollection(slug) {
  const [row] = await sql`
    SELECT col.*, c.slug AS community_slug, c.name AS community_name, c.lat AS community_lat, c.lng AS community_lng,
           e.display_name AS owner_name
    FROM collections col
    JOIN communities c ON c.id = col.community_id
    LEFT JOIN explorers e ON e.id = col.owner_id
    WHERE col.slug = ${slug}`;
  return row || null;
}

export default async function handler(req, res) {
  try {
    const { slug } = query(req);
    const col = await loadCollection(slug);
    if (!col) return error(res, 404, 'Collection not found');
    const explorer = await getExplorer(req);
    const editable = canEdit(col, explorer, editKeyFrom(req));

    if (req.method === 'GET') {
      const pins = await sql`SELECT * FROM pins WHERE collection_id = ${col.id} ORDER BY sort_order ASC, created_at ASC`;
      return send(res, 200, {
        collection: collectionToJson({ ...col, pin_count: pins.length }, { includeEditKey: editable }),
        community: { slug: col.community_slug, name: col.community_name, lat: col.community_lat, lng: col.community_lng },
        pins: pins.map(pinToJson),
        canEdit: editable,
        isOwner: !!(explorer && col.owner_id === explorer.id),
      });
    }

    if (req.method === 'PATCH') {
      if (!editable) return error(res, 403, 'You cannot edit this collection');
      const body = await readBody(req);
      const title = body.title != null ? String(body.title).trim().slice(0, 140) : null;
      if (title !== null && !title) return error(res, 400, 'Title cannot be empty');
      const description = body.description != null ? String(body.description).trim().slice(0, 2000) : null;
      const isPublic = typeof body.isPublic === 'boolean' ? body.isPublic : null;
      const [updated] = await sql`
        UPDATE collections SET
          title = COALESCE(${title}, title),
          description = COALESCE(${description}, description),
          is_public = COALESCE(${isPublic}, is_public),
          updated_at = now()
        WHERE id = ${col.id} RETURNING *`;
      return send(res, 200, { collection: collectionToJson({ ...updated, community_slug: col.community_slug, community_name: col.community_name, owner_name: col.owner_name }, { includeEditKey: true }) });
    }

    if (req.method === 'DELETE') {
      const isOwner = explorer && col.owner_id === explorer.id;
      if (!isOwner) return error(res, 403, 'Only the owner can delete a collection');
      await sql`DELETE FROM collections WHERE id = ${col.id}`;
      return send(res, 200, { deleted: true });
    }

    return methodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
  } catch (e) {
    console.error(e);
    return error(res, 500, e.message);
  }
}
