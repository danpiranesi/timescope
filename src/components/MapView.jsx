import React, { useEffect, useRef } from 'react';
import { colors, fonts } from '../theme';

/**
 * Leaflet map of a collection's pins.
 * `position` is the user's location (optional); `center` is the fallback centre
 * (normally the community). `fullscreen` turns the modal into a full-page view.
 */
export default function MapView({ position, center, year, pins = [], onSelect, onClose, fullscreen = false, title = 'Map View' }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const start = position
      ? [position.lat, position.lng]
      : center
        ? [center.lat, center.lng]
        : pins.length
          ? [pins[0].lat, pins[0].lng]
          : [0, 0];

    const map = L.map(mapRef.current, { center: start, zoom: 13, zoomControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM', maxZoom: 18 }).addTo(map);
    mapInstanceRef.current = map;

    if (position) {
      const userIcon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;background:${colors.accent};border:2.5px solid white;border-radius:50%;box-shadow:0 0 12px ${colors.accent}88;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([position.lat, position.lng], { icon: userIcon }).addTo(map);
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = window.L;
    if (!map || !L) return;

    const visible = pins.filter((p) => p.year == null || p.year <= year);
    map.eachLayer((layer) => { if (layer._isPoiMarker) map.removeLayer(layer); });

    visible.forEach((poi) => {
      const label = poi.year ?? '·';
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;background:${poi.color};border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:${fonts.mono};font-size:${String(label).length > 3 ? 7 : 9}px;font-weight:800;color:white;box-shadow:0 2px 8px ${poi.color}66;cursor:pointer;">${label}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const marker = L.marker([poi.lat, poi.lng], { icon }).addTo(map);
      marker._isPoiMarker = true;
      marker.on('click', () => onSelect(poi));
      marker.bindTooltip(poi.title, { permanent: false, direction: 'top', className: 'timescope-tooltip', offset: [0, -16] });
    });

    if (!fittedRef.current && pins.length) {
      fittedRef.current = true;
      const pts = pins.map((p) => [p.lat, p.lng]);
      if (position) pts.push([position.lat, position.lng]);
      // The container may not have its final size on the first frame.
      setTimeout(() => {
        if (!mapInstanceRef.current) return;
        map.invalidateSize();
        map.fitBounds(L.latLngBounds(pts).pad(0.08), { maxZoom: 15 });
      }, 60);
    }
  }, [year, onSelect, pins]);

  return (
    <div style={fullscreen ? styles.fullOverlay : styles.overlay}>
      <div style={fullscreen ? styles.fullContainer : styles.container}>
        <div style={styles.header}>
          <span style={styles.headerTitle}>{title}</span>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close map">×</button>
        </div>
        <div ref={mapRef} style={styles.map} />
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 40,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
  },
  fullOverlay: { position: 'fixed', inset: 0, zIndex: 40, background: colors.bgSolid },
  container: {
    width: '92%', maxWidth: 480, height: '75vh',
    background: colors.bgSolid, borderRadius: 16, overflow: 'hidden',
    border: `1px solid ${colors.greenDark}`, display: 'flex', flexDirection: 'column',
  },
  fullContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: colors.bgSolid },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px', paddingTop: 'max(14px, env(safe-area-inset-top))',
    borderBottom: `1px solid ${colors.greenDark}`,
  },
  headerTitle: { color: colors.text, fontSize: 15, fontWeight: 700, fontFamily: fonts.mono, letterSpacing: 1 },
  closeBtn: { background: 'transparent', border: 'none', color: colors.textDim, fontSize: 22, cursor: 'pointer' },
  map: { flex: 1 },
};
