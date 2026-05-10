# Timescope

AR prototype that lets you explore the history of a location by pointing your phone around. Built for mobile Safari (iOS) and Chrome (Android).

**Live:** [timescope-mocha.vercel.app](https://timescope-mocha.vercel.app)

## What it does

- Point your phone and see historical locations anchored to their real-world compass bearings
- Circles show Wikipedia images of each location, positioned on the horizon line
- Nearby locations are clustered automatically — scroll through clusters with the infinite dial on the right
- Tilt your phone up/down and the horizon tracks with the camera
- Arrows on screen edges show how many locations are in each direction
- Tap any circle to open a detail card with history, fun facts, photos, comments, and related locations
- Map view (◎ button) shows all locations on an interactive Leaflet map
- Timeline slider filters locations by year (110 AD – 2024)
- Audio haptic feedback for cluster interactions (iOS doesn't support vibration API)

## Current coverage

16 historical locations around Komoro, Nagano, Japan — centered on the Momofuku Ando Center area, spanning west to Bessho Onsen/Ueda and east to Karuizawa/Mount Asama.

## Tech stack

- React 18 + Vite
- Three.js / @react-three/fiber / @react-three/drei (available but AR is currently DOM-based)
- Leaflet for map view
- Web Audio API for haptic feedback
- DeviceOrientation API for compass + pitch tracking
- Geolocation API for positioning
- Wikipedia REST API for location images

## Development

```bash
npm install
npm run dev
```

Dev server runs on HTTPS with `--host` to expose on local network.

## Deployment

Deployed on Vercel. Push to main to auto-deploy, or manually:

```bash
npm install -g vercel
vercel login
vercel --yes --prod
```

The project is linked to `dan-schmidts-projects/timescope` on Vercel.

## Project structure

```
src/
  main.jsx              # Entry point
  App.jsx               # Main app — permissions, state, routing
  theme.js              # Colors (blue/green/brown) and fonts (Courier Prime + DM Sans)
  pois.js               # All 16 POI definitions with history, fun facts, coordinates
  components/
    AROverlay.jsx        # Compass-based AR view with clustering, dial, arrows
    CameraBackground.jsx # Rear camera video feed
    InfoCard.jsx         # Detail card with images, comments, history, related
    MapView.jsx          # Leaflet map overlay
    TimelineSlider.jsx   # Year range slider
    HistoryOverlay.jsx   # (legacy, unused)
    HistoryScene.jsx     # (legacy, unused)
```
