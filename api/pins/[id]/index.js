import { sql, send, error, methodNotAllowed, readBody, query, getExplorer, editKeyFrom, canEdit, pinToJson } from '../../_lib/db.js';

export default async function handler(req, res) {
  try {
    const { id } = query(req);
    const [pin] = await sql`SELECT * FROM pins WHERE id = ${id}::uuid`;
    if (!pin) return error(res, 404, 'Pin not found');
    const [col] = await sql`SELECT * FROM collections WHERE id = ${pin.collection_id}`;
    const explorer = await getExplorer(req);
    if (!canEdit(col, explorer, editKeyFrom(req))) return error(res, 403, 'You cannot edit this pin');

    if (req.method === 'PATCH') {
      const b = await readBody(req);
      const str = (v, max) => (v == null ? null : String(v).trim().slice(0, max));
      let year = b.year === undefined ? undefined : (b.year === null || b.year === '' ? null : Math.round(Number(b.year)));
      if (year !== undefined && year !== null && !Number.isFinite(year)) year = null;
      const lat = b.lat != null ? Number(b.lat) : null;
      const lng = b.lng != null ? Number(b.lng) : null;
      if ((lat != null && Math.abs(lat) > 90) || (lng != null && Math.abs(lng) > 180)) return error(res, 400, 'Invalid coordinates');
      const color = /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : null;
      const title = str(b.title, 200);
      if (title === '') return error(res, 400, 'Title cannot be empty');
      const related = Array.isArray(b.related) ? b.related.map(String).slice(0, 20) : null;

      const [updated] = await sql`
        UPDATE pins SET
          title = COALESCE(${title}, title),
          title_en = COALESCE(${str(b.titleEn, 200)}, title_en),
          description = COALESCE(${str(b.desc, 2000)}, description),
          history = COALESCE(${str(b.history, 8000)}, history),
          fun_fact = COALESCE(${str(b.funFact, 2000)}, fun_fact),
          year = CASE WHEN ${year === undefined} THEN year ELSE ${year ?? null} END,
          lat = COALESCE(${lat}, lat),
          lng = COALESCE(${lng}, lng),
          color = COALESCE(${color}, color),
          wiki = CASE WHEN ${b.wiki === undefined} THEN wiki ELSE ${str(b.wiki, 300) || null} END,
          image_url = CASE WHEN ${b.imageUrl === undefined} THEN image_url ELSE ${str(b.imageUrl, 1000) || null} END,
          related = COALESCE(${related}, related),
          sort_order = COALESCE(${Number.isFinite(Number(b.sortOrder)) && b.sortOrder != null ? Number(b.sortOrder) : null}, sort_order)
        WHERE id = ${pin.id} RETURNING *`;
      await sql`UPDATE collections SET updated_at = now() WHERE id = ${col.id}`;
      return send(res, 200, { pin: pinToJson(updated) });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM pins WHERE id = ${pin.id}`;
      await sql`UPDATE collections SET updated_at = now() WHERE id = ${col.id}`;
      return send(res, 200, { deleted: true });
    }

    return methodNotAllowed(res, ['PATCH', 'DELETE']);
  } catch (e) {
    console.error(e);
    return error(res, 500, e.message);
  }
}
