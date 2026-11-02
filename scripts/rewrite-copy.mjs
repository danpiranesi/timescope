// One-off: rewrite the Komoro copy in src/pois.js and in the live database.
// Usage: node scripts/rewrite-copy.mjs            (rewrites src/pois.js)
//        node scripts/rewrite-copy.mjs --db       (also updates the komoro-history rows)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { POIS } from '../src/pois.js';

export const DESCRIPTION = 'Twenty places within an hour of Komoro: the hole castle and its station, post towns on the old roads to Edo, the temples at Bessho, and the volcano whose ash made the soil.';

const COPY = {
  'ando-center': {
    desc: 'Outdoor education centre founded by the inventor of instant ramen.',
    history: 'Opened in 2010 by the Ando Foundation, the charitable arm set up by Nissin founder Momofuku Ando. The centre runs outdoor programmes for young people on a forested hillside above Komoro, following Ando\'s view that resourcefulness is learned outdoors.',
    funFact: 'Ando was 48 and newly bankrupt when he developed Chicken Ramen in a backyard shed in 1958. He lived to 96 and said he ate it most days.',
  },
  'komoro-castle': {
    desc: 'A castle built below its own town. The stone walls still stand in Kaikoen Park.',
    history: 'The Ōi clan fortified this site around 1490. Unusually, the castle sits in a ravine below the town rather than above it, which earned it the name anajō, "hole castle". The Sengoku clan, lords of Komoro from 1590, rebuilt it in stone, and the grounds became Kaikoen Park in 1926.',
    funFact: 'From the main gate you walk downhill into the castle. Most Japanese castles make you climb.',
  },
  'komoro-station': {
    desc: 'Railway station on the old Shin\'etsu line, next door to the castle.',
    history: 'The station opened in 1888 when the Shin\'etsu Main Line reached Komoro, tying the town to Tokyo and Nagano. When the Hokuriku Shinkansen opened in 1997 it bypassed Komoro, and the local line was handed to the Shinano Railway.',
    funFact: 'The castle\'s stone walls are a short walk from the platform. Kaikoen Park begins just across the tracks.',
  },
  'nunobiki': {
    desc: 'Temple hall built into a cliff above the Chikuma River gorge.',
    history: 'Tradition dates the temple to 724. The main hall hangs off the rock face in the kakezukuri style also seen at Kiyomizu-dera in Kyoto. The small inner shrine inside it dates from 1258 and is an Important Cultural Property.',
    funFact: 'The saying "led to Zenkō-ji by a cow" starts here. An old woman chased a cow that had caught her washing on its horn all the way to Zenkō-ji in Nagano, and came home a believer.',
  },
  'toson-museum': {
    desc: 'Museum to the poet and novelist Shimazaki Tōson, who taught in Komoro.',
    history: 'Tōson came to Komoro in 1899 to teach at the Komoro Gijuku school and stayed six years. The essays he wrote here, Chikumagawa no Sketch, and his poem about the old castle made the town part of Japanese literature. The museum in Kaikoen Park holds his manuscripts and belongings.',
    funFact: 'Students across Japan still learn the opening of his Komoro poem: "By the old castle at Komoro, a traveller grieves among the white clouds."',
  },
  'manns-wine': {
    desc: 'Winery under Mount Asama, run by the soy sauce company Kikkoman.',
    history: 'Kikkoman set up Manns Wine in 1962 and opened the Komoro winery in 1973. At around 700 metres, with volcanic soil and cold nights, the slopes here suit Merlot and Chardonnay. The cellar and Japanese garden are open to visitors.',
    funFact: 'Alongside Merlot, the winery bottles Ryūgan, a pale pink grape that has been grown in Nagano since the Edo period.',
  },
  'chikuma-river': {
    desc: 'Japan\'s longest river, running below the castle bluffs.',
    history: 'The Chikuma becomes the Shinano at the Niigata border; together they run 367 km, the longest river in Japan. In 1742 the Kanpō flood drowned villages along this valley and shifted the river\'s course. The gorge below Komoro Castle is the river at its most dramatic.',
    funFact: 'Tōson\'s Chikumagawa no Sketch was written on walks along this stretch of the river.',
  },
  'asama': {
    desc: 'Active volcano, 2,568 m, that shaped everything around it.',
    history: 'Asama erupts often. The Tenmei eruption of 1783 sent a pyroclastic flow and debris avalanche through Kambara village and killed more than 1,500 people. Ash from that and earlier eruptions is the soil Komoro\'s farms and vineyards grow in.',
    funFact: 'The ash cloud of 1783 reached Edo and darkened the sky there. The eruption deepened the Tenmei famine already under way.',
  },
  'kori-fuketsu': {
    desc: 'Rock crevices that stay near freezing all year, once used as cold storage.',
    history: 'Cold air drains through the gaps in this lava-block slope and holds the hollows a few degrees above zero even in August. From the Meiji era, silkworm egg traders built storehouses over the vents to delay hatching, which let farmers raise several broods a year. Nagano\'s silk industry depended on stores like these.',
    funFact: 'The stone storehouses are still cold inside. Visitors can see their breath in midsummer.',
  },
  'takamine': {
    desc: 'Highland plateau at about 2,000 m on the shoulder of Asama.',
    history: 'The highlands were summer pasture before they were a resort. Jōshin\'etsu-kōgen National Park, created in 1949, took in the Asama volcanic area, and a ski field and mountain huts followed. The trail to Kurofu-yama starts here.',
    funFact: 'In clear weather the view takes in the Northern Alps, Yatsugatake and Mount Fuji.',
  },
  'onio-pass': {
    desc: 'Post town where the Nakasendō and the Hokkoku Kaidō parted.',
    history: 'Oiwake was the 20th station on the Nakasendō, the inland road between Edo and Kyoto. Here the Hokkoku Kaidō branched off toward Zenkō-ji and the Japan Sea, and the town grew on travellers choosing their road. It flourished from the early 1600s until the railways came. A few of the old inns remain.',
    funFact: 'Oiwake means "the fork". Oiwake-bushi, the song of the packhorse drivers here, spread along the roads and became a whole family of Japanese folk songs.',
  },
  'manaita': {
    desc: 'Plateau that supplied horses to the imperial court.',
    history: 'In the Heian period this plateau was one of the Shinano imperial pastures, the mimaki, breeding horses for the court in Kyoto. Shinano horses were prized, and the province sent them to the capital each year. Today the plateau grows lettuce and other highland vegetables on the same volcanic soil.',
    funFact: 'The local place names Mimaki and Mochizuki both come from the old horse pastures.',
  },
  'unno-juku': {
    desc: 'Post town on the Hokkoku Kaidō with a street of Edo and Meiji houses intact.',
    history: 'Unno-juku opened in 1625 as a station on the Hokkoku Kaidō. When the road traffic went, the town turned to raising silkworms, and the tall second storeys with ventilation windows date from that time. About a hundred old buildings line the single street, many with udatsu firewalls between them.',
    funFact: 'The street is a national preservation district for traditional buildings, and television period dramas often film here.',
  },
  'ueda-castle': {
    desc: 'Sanada clan castle that held off the Tokugawa twice.',
    history: 'Sanada Masayuki built the castle in 1583. He beat back a Tokugawa army in 1585, and in 1600 held up Tokugawa Hidetada\'s much larger force long enough that it missed the Battle of Sekigahara. The castle was pulled down afterwards. The Sengoku clan, later lords of Komoro too, rebuilt parts of it in the 1620s.',
    funFact: 'Hidetada\'s 38,000 men arrived late to Sekigahara because of the siege here. His father Ieyasu had already won without them.',
  },
  'bessho-onsen': {
    desc: 'Hot spring town with Kamakura-period temples, known as the Kamakura of Shinano.',
    history: 'Bessho has been a hot spring since at least the Heian period. Under the Hōjō regents in the Kamakura period it became a centre of temple-building, which is why a village this size has two National Treasures and several Important Cultural Properties.',
    funFact: 'The water is alkaline and feels slippery on the skin, which is why locals call it the beauty bath.',
  },
  'anrakuji': {
    desc: 'The only octagonal three-storey pagoda in Japan, a National Treasure.',
    history: 'Anraku-ji is a Sōtō Zen temple whose pagoda was built in the late 13th century in the Chinese Zen style of the Song period. It is the oldest Zen-style building in Japan and the country\'s only surviving octagonal pagoda.',
    funFact: 'It looks like four storeys. The lowest roof is a mokoshi, a skirt roof, so the building counts as three.',
  },
  'onioshidashi': {
    desc: 'Lava field left by the 1783 eruption of Mount Asama.',
    history: 'Lava from the Tenmei eruption of 1783 flowed down the north side of Asama and froze into the jumble of black rock that covers this slope. The park opened in 1930, and a Kannon hall was built on the lava in 1958 to remember the dead of the eruption.',
    funFact: 'The name means "demons pushed it out". People saw the rocks as boulders shoved out of the mountain by the oni said to live in the crater.',
  },
  'mikasa-hotel': {
    desc: 'Wooden Western-style hotel from 1906, an Important Cultural Property.',
    history: 'Yamamoto Naosuke opened the Mikasa in 1906 as a hotel in the Western manner, designed and built entirely by Japanese carpenters. It served Karuizawa\'s summer visitors until 1970 and was designated an Important Cultural Property in 1980.',
    funFact: 'It was nicknamed the Rokumeikan of Karuizawa, after the Tokyo hall where Meiji society learned to waltz.',
  },
  'kumano-shrine': {
    desc: 'Shrine on Usui Pass that sits across the Nagano–Gunma border.',
    history: 'The shrine on the summit of Usui Pass is said to have been founded by the legendary prince Yamato Takeru. The border runs through the middle of the main hall: the left half is Kumano Kōtai Jinja in Nagano, the right half Kumano Jinja in Gunma, and each has its own priests. Travellers on the Nakasendō prayed here before the descent.',
    funFact: 'The two halves are separate shrines with separate offering boxes, a few steps apart under one roof.',
  },
  'shiraito-falls': {
    desc: 'A 70-metre curtain of spring water seeping out of a lava cliff.',
    history: 'The falls are only about three metres high but seventy wide. No river feeds them: rain that fell on Asama seeps down through the lava and comes out of the cliff face in hundreds of threads, which is what shiraito, "white threads", describes. The spot became a resort walk as Karuizawa grew in the Taishō period.',
    funFact: 'The water is said to take about six years to pass through the mountain, and comes out at a steady 11°C all year.',
  },
};

const missing = POIS.filter((p) => !COPY[p.id]).map((p) => p.id);
if (missing.length) throw new Error('No copy for: ' + missing.join(', '));

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const merged = POIS.map((p) => ({ ...p, ...COPY[p.id] }));

const file = `export const POIS = [\n${merged.map((p) => `  {
    id: ${q(p.id)},
    lat: ${p.lat}, lng: ${p.lng},
    title: ${q(p.title)},
    titleEn: ${q(p.titleEn)},
    desc: ${q(p.desc)},
    history: ${q(p.history)},
    funFact: ${q(p.funFact)},
    year: ${p.year},
    color: ${q(p.color)},
    related: [${p.related.map(q).join(', ')}],
    wiki: ${q(p.wiki)},
  },`).join('\n')}
];

export function getRelatedPois(poiId) {
  const poi = POIS.find((p) => p.id === poiId);
  if (!poi) return [];
  return poi.related.map((id) => POIS.find((p) => p.id === id)).filter(Boolean);
}
`;
writeFileSync('src/pois.js', file);
console.log(`Rewrote src/pois.js (${merged.length} places).`);

if (process.argv.includes('--db')) {
  if (!process.env.DATABASE_URL && existsSync('.env.local')) {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) process.env[m[1]] = m[2];
    }
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  const [col] = await sql`SELECT id FROM collections WHERE slug = 'komoro-history'`;
  if (!col) throw new Error('komoro-history not found');
  const results = await sql.transaction([
    sql`UPDATE collections SET description = ${DESCRIPTION}, updated_at = now() WHERE id = ${col.id}`,
    ...merged.map((p) => sql`
      UPDATE pins SET description = ${p.desc}, history = ${p.history}, fun_fact = ${p.funFact}
      WHERE collection_id = ${col.id} AND key = ${p.id}`),
  ]);
  console.log(`Updated collection description and ${results.length - 1} pin rows.`);
}
