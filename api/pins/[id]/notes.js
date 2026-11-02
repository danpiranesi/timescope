import { sql, send, error, methodNotAllowed, readBody, query, getExplorer } from '../../_lib/db.js';

export default async function handler(req, res) {
  try {
    const { id } = query(req);
    const [pin] = await sql`SELECT id FROM pins WHERE id = ${id}::uuid`;
    if (!pin) return error(res, 404, 'Pin not found');

    if (req.method === 'GET') {
      const notes = await sql`SELECT id, author_name, text, created_at FROM pin_notes WHERE pin_id = ${pin.id} ORDER BY created_at ASC`;
      return send(res, 200, { notes: notes.map(clean) });
    }

    if (req.method === 'POST') {
      const explorer = await getExplorer(req, { create: true });
      const body = await readBody(req);
      const text = String(body.text || '').trim().slice(0, 1000);
      if (!text) return error(res, 400, 'Note cannot be empty');
      const author = explorer ? explorer.display_name : 'Explorer';
      const [note] = await sql`
        INSERT INTO pin_notes (pin_id, explorer_id, author_name, text)
        VALUES (${pin.id}, ${explorer ? explorer.id : null}, ${author}, ${text})
        RETURNING id, author_name, text, created_at`;
      return send(res, 201, { note: clean(note) });
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (e) {
    console.error(e);
    return error(res, 500, e.message);
  }
}

function clean(n) {
  return { id: n.id, author: n.author_name, text: n.text, createdAt: n.created_at };
}
