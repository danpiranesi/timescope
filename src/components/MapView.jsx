import React, { useEffect, useRef } from 'react';
import { POIS } from '../pois';
import { colors, fonts } from '../theme';

export default function MapView({ position, heading, year, onSelect, onClose }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const L = window.L;
    if (!L) return;

    const center = position
      ? [position.lat, position.lng]
      : [36.3275, 138.4267];

    const map = L.map(mapRef.current, {
      center,
      zoom: 14,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OSM',
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;

    // User location marker
    if (position) {
      const userIcon = L.divIcon({
        className: '',
        html: `<div style="
          width: 14px; height: 14px;
          background: ${colors.accent};
          border: 2.5px solid white;
          border-radius: 50%;
          box-shadow: 0 0 12px ${colors.accent}88;
        "></div>`,
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

    const visible = POIS.filter((p) => p.year <= year);

    // Clear old POI markers (keep user marker)
    map.eachLayer((layer) => {
      if (layer._isPoiMarker) map.removeLayer(layer);
    });

    visible.forEach((poi) => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width: 28px; height: 28px;
          background: ${poi.color};
          border: 2px solid white;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-family: ${fonts.mono};
          font-size: 7px; font-weight: 800; color: white;
          box-shadow: 0 2px 8px ${poi.color}66;
          cursor: pointer;
        ">${poi.year}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([poi.lat, poi.lng], { icon }).addTo(map);
      marker._isPoiMarker = true;
      marker.on('click', () => onSelect(poi));

      marker.bindTooltip(poi.title, {
        permanent: false,
        direction: 'top',
        className: 'timescope-tooltip',
        offset: [0, -16],
      });
    });
  }, [year, onSelect]);

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.headerTitle}>Map View</span>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
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
  container: {
    width: '92%', maxWidth: 480, height: '75vh',
    background: colors.bgSolid,
    borderRadius: 16, overflow: 'hidden',
    border: `1px solid ${colors.greenDark}`,
    display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px',
    borderBottom: `1px solid ${colors.greenDark}`,
  },
  headerTitle: {
    color: colors.text, fontSize: 15, fontWeight: 700,
    fontFamily: fonts.mono, letterSpacing: 1,
  },
  closeBtn: {
    background: 'transparent', border: 'none',
    color: colors.textDim, fontSize: 22, cursor: 'pointer',
  },
  map: {
    flex: 1,
  },
};
