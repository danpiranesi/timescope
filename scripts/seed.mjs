// Seeds the Komoro community and the original 16-location collection.
// Usage: DATABASE_URL=... node scripts/seed.mjs   (or `npm run seed` with .env.local present)
import { readFileSync, existsSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { randomBytes } from 'node:crypto';
import { POIS } from '../src/pois.js';

if (!process.env.DATABASE_URL && existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
const sql = neon(process.env.DATABASE_URL);

const [community] = await sql`
  INSERT INTO communities (slug, name, region, lat, lng)
  VALUES ('komoro', '小諸 Komoro', 'Nagano, Japan', 36.3275, 138.4267)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id, slug`;

const existing = await sql`SELECT id FROM collections WHERE slug = 'komoro-history'`;
if (existing.length) {
  console.log('Seed collection already exists; skipping.');
  process.exit(0);
}

const [col] = await sql`
  INSERT INTO collections (slug, community_id, owner_id, title, description, is_public, edit_key)
  VALUES ('komoro-history', ${community.id}, NULL, 'Layers of Komoro',
          'Twenty places within an hour of Komoro: the hole castle and its station, post towns on the old roads to Edo, the temples at Bessho, and the volcano whose ash made the soil.',
          true, ${randomBytes(12).toString('base64url')})
  RETURNING id`;

await sql.transaction(POIS.map((p, i) => sql`
  INSERT INTO pins (collection_id, key, title, title_en, description, history, fun_fact, year, lat, lng, color, wiki, source, related, sort_order)
  VALUES (${col.id}, ${p.id}, ${p.title}, ${p.titleEn}, ${p.desc}, ${p.history}, ${p.funFact}, ${p.year}, ${p.lat}, ${p.lng}, ${p.color}, ${p.wiki}, 'seed', ${p.related}, ${i})`));

console.log(`Seeded community ${community.slug} with ${POIS.length} pins in collection komoro-history.`);
