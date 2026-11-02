# Timescope

Point your phone at the past. Timescope is an AR history explorer: pick your community, open a collection of historical places, and see them anchored to their real compass bearings over your camera feed, or browse them on a map and scrub through time.

**Live:** [timescope-mocha.vercel.app](https://timescope-mocha.vercel.app)

## What it does

- **Communities** — search for your town or use your location. Each community has its own page of collections. Anyone can start a new community for a place that doesn't have one yet.
- **Collections** — a set of historical places with a year, a story, a fun fact and a colour. Browse the ones others have made for your area or create your own.
- **Import from Google Maps** — drop in a Google Takeout export (`Saved Places.json` or a saved-list `.csv`), a My Maps `.kml`, or a `.gpx` file. Places without coordinates are looked up by name. Years are guessed from notes like "built 1490" and can be edited afterwards.
- **Share with friends** — every collection has a view link and QR code. Owners can also hand out an *edit link* that lets friends add and change places from their own phones.
- **Explore** — AR view with compass clustering, the infinite dial, edge arrows and audio haptics (phones), or a full-screen map (anywhere). The timeline slider filters places by year. Tap any place for its story, photos and shared notes.

## How identity works

There are no accounts. Each browser gets an anonymous *explorer* token stored locally; the server keeps only its hash. Collections you create belong to that token. Edit links carry a separate key, so sharing one never exposes your identity. "My collections" (`/me`) lists what you have made on this device and lets you pick a display name for notes.

## Tech stack

- React 18 + Vite, no router library (see `src/router.jsx`)
- Vercel serverless functions in `api/` (Node, ESM)
- Neon Postgres via `@neondatabase/serverless` (schema below)
- Leaflet for maps, OpenStreetMap Nominatim for geocoding, Wikipedia REST API for images
- DeviceOrientation + Geolocation + Web Audio APIs for the AR view

## Development

```bash
npm install
npm run dev:full      # vercel dev: API functions + Vite on http://localhost:3000
```

`npm run dev` runs Vite alone (no API). To test the camera and compass on a phone over your LAN, run `npm run dev:full` in one terminal and `npm run dev:lan` in another: the second serves Vite over HTTPS on port 5173 and proxies `/api` to the first.

Environment: `DATABASE_URL` (Neon connection string). `vercel env pull .env.local` fetches it once you are logged in to the linked project.

### Database

Tables: `communities`, `explorers`, `collections`, `pins`, `pin_notes`. The schema lives in the Neon project `timescope`; `scripts/seed.mjs` (`npm run seed`) creates the Komoro community and the original 20-place "Layers of Komoro" collection from `src/pois.js`.

### API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/communities?lat&lng` or `?q` | List, nearby or search communities |
| POST | `/api/communities` | Create (dedupes within 5 km) |
| GET | `/api/communities/:slug` | Community + its collections |
| POST | `/api/collections` | Create a collection (with optional pins) |
| GET/PATCH/DELETE | `/api/collections/:slug` | Read (with pins), update, delete (owner only) |
| POST | `/api/collections/:slug/pins` | Bulk add pins |
| PATCH/DELETE | `/api/pins/:id` | Edit or remove a pin |
| GET/POST | `/api/pins/:id/notes` | Shared notes on a place |
| GET/PATCH | `/api/me` | Explorer profile and own collections |

Write requests send `x-explorer-token`; collaborators send `x-edit-key` (or `?edit=`) instead.

## Deployment

Deployed on Vercel (`dan-schmidts-projects/timescope`). Push to `main` to deploy production, or `vercel --prod`. `vercel.json` rewrites non-file paths to `index.html` for client-side routing.

## Project structure

```
api/
  _lib/db.js             # Neon client, auth helpers, serialisers
  communities/           # list/create, [slug]
  collections/           # create, [slug]/index, [slug]/pins
  pins/[id]/             # index (edit/delete), notes
  me.js
scripts/seed.mjs         # Seeds Komoro
src/
  App.jsx                # Routes
  router.jsx             # Tiny history router
  api.js                 # API client, explorer token, geocoding
  importers.js           # Google Maps / KML / GPX parsers + geocoder
  pois.js                # Original Komoro data (seed only)
  pages/                 # Home, Community, Collection, Editor, My
  components/
    ExploreView.jsx      # Title screen → AR or map explorer
    AROverlay.jsx        # Compass-based AR view with clustering + dial
    MapView.jsx          # Leaflet map
    InfoCard.jsx         # Place detail with shared notes
    ShareSheet.jsx       # Links + QR
    ui.jsx               # Shared primitives
    CameraBackground.jsx, CompassBar.jsx, TimelineSlider.jsx
    HistoryOverlay.jsx, HistoryScene.jsx   # legacy, unused
```
