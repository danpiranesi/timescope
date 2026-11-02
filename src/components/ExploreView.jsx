import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import CameraBackground from './CameraBackground';
import AROverlay from './AROverlay';
import TimelineSlider from './TimelineSlider';
import InfoCard from './InfoCard';
import MapView from './MapView';
import CompassBar from './CompassBar';
import ShareSheet from './ShareSheet';
import { Link } from '../router';
import { colors, fonts } from '../theme';

/**
 * The AR / map explorer for one collection. Starts on a title screen, then
 * either the compass-driven AR view (phones) or a full-screen map (anywhere).
 */
export default function ExploreView({ collection, community, pins, canEdit, onEdit, backTo }) {
  const years = useMemo(() => pins.map((p) => p.year).filter((y) => y != null), [pins]);
  const hasYears = years.length > 0;
  const currentYear = new Date().getFullYear();
  const minYear = hasYears ? Math.floor(Math.min(...years) / 50) * 50 : currentYear - 1;
  const maxYear = hasYears ? Math.max(currentYear, ...years) : currentYear;

  const [mode, setMode] = useState(null); // null | 'ar' | 'map'
  const [year, setYear] = useState(maxYear);
  const [heading, setHeading] = useState(null);
  const [pitch, setPitch] = useState(0);
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [selectedPoi, setSelectedPoi] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const audioCtxRef = useRef(null);
  const watchRef = useRef(null);

  useEffect(() => { setYear(maxYear); }, [maxYear]);

  const tone = useCallback((freq, type, dur, slideTo) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur * 0.6);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur);
    } catch {}
  }, []);
  const playTick = useCallback(() => tone(660, 'sine', 0.1), [tone]);
  const playOpen = useCallback(() => tone(440, 'triangle', 0.25, 880), [tone]);

  // Smoothing + throttle: only push state updates every 100ms (10fps)
  const smoothRef = useRef({ heading: null, pitch: 0, lastUpdate: 0 });
  const SMOOTHING = 0.35;
  const THROTTLE_MS = 100;

  const handleOrientation = useCallback((e) => {
    let rawH = null;
    if (e.webkitCompassHeading != null) {
      // webkitCompassHeading points the device top — camera faces the opposite way
      rawH = (e.webkitCompassHeading + 180) % 360;
    } else if (e.alpha != null) {
      rawH = e.absolute ? (360 - e.alpha + 180) % 360 : (e.alpha + 180) % 360;
    }
    const s = smoothRef.current;
    if (rawH != null) {
      if (s.heading === null) s.heading = rawH;
      else {
        let diff = rawH - s.heading;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        s.heading = (s.heading + diff * (1 - SMOOTHING) + 360) % 360;
      }
    }
    if (e.beta != null) {
      const rawP = 90 - e.beta;
      s.pitch = s.pitch + (rawP - s.pitch) * (1 - SMOOTHING);
    }
    const now = Date.now();
    if (now - s.lastUpdate < THROTTLE_MS) return;
    s.lastUpdate = now;
    if (s.heading != null) setHeading(s.heading);
    setPitch(s.pitch);
  }, []);

  useEffect(() => () => {
    window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
    window.removeEventListener('deviceorientation', handleOrientation, true);
    if (watchRef.current != null) navigator.geolocation?.clearWatch(watchRef.current);
  }, [handleOrientation]);

  const startAR = useCallback(async () => {
    setError(null);
    try { new AudioContext(); } catch {}
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') { setError('Compass permission denied'); return; }
      } catch (e) {
        setError('Compass permission failed: ' + e.message);
        return;
      }
    }
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);

    if (!navigator.geolocation) { setError('Location is not available on this device'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setMode('ar');
      },
      (err) => setError('Location error: ' + err.message),
      { enableHighAccuracy: true }
    );
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true }
    );
  }, [handleOrientation]);

  const startMap = useCallback(() => {
    setError(null);
    setMode('map');
    navigator.geolocation?.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const handleSelectPoi = useCallback((poi) => { playOpen(); setSelectedPoi(poi); }, [playOpen]);
  const handleYearChange = useCallback((y) => { playTick(); setYear(y); }, [playTick]);

  function compassDir(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
  }

  const supportsOrientation = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
  const isTouch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);

  if (mode === null) {
    return (
      <div style={styles.startScreen}>
        <div style={styles.startTop}>
          <Link to={backTo} style={styles.backLink}>‹ {community?.name || 'Community'}</Link>
          <div style={styles.startTopRight}>
            <button style={styles.iconBtn} onClick={() => setShowShare(true)} aria-label="Share">↗</button>
            {canEdit && <button style={styles.iconBtn} onClick={onEdit} aria-label="Edit">✎</button>}
          </div>
        </div>
        <div style={styles.startCard}>
          <div style={styles.logo}>⊙</div>
          <h1 style={styles.title}>{collection.title}</h1>
          <p style={styles.subtitle}>
            {pins.length} {pins.length === 1 ? 'place' : 'places'}
            {hasYears ? (Math.min(...years) === Math.max(...years) ? ` · ${Math.min(...years)}` : ` · ${Math.min(...years)} – ${Math.max(...years)}`) : ''}
            {collection.ownerName ? ` · by ${collection.ownerName}` : ''}
          </p>
          {collection.description && <p style={styles.desc}>{collection.description}</p>}
          {error && <p style={styles.error}>{error}</p>}
          {pins.length === 0 ? (
            <p style={styles.desc}>This collection has no places yet.{canEdit ? ' Tap ✎ to add some.' : ''}</p>
          ) : (
            <div style={styles.startButtons}>
              {(supportsOrientation && isTouch) && (
                <button style={styles.button} onClick={startAR}>Begin AR Exploration</button>
              )}
              <button style={supportsOrientation && isTouch ? styles.buttonGhost : styles.button} onClick={startMap}>
                Browse on Map
              </button>
            </div>
          )}
          {!(supportsOrientation && isTouch) && pins.length > 0 && (
            <p style={styles.hint}>Open this link on a phone to point your camera at history.</p>
          )}
        </div>
        <div style={styles.startFooter}>
          <span style={styles.footerText}>TIMESCOPE · {community?.name}</span>
        </div>
        {showShare && <ShareSheet collection={collection} canEdit={canEdit} onClose={() => setShowShare(false)} />}
      </div>
    );
  }

  const center = community ? { lat: community.lat, lng: community.lng } : null;

  return (
    <>
      {mode === 'ar' && (
        <>
          <CameraBackground />
          <AROverlay heading={heading} pitch={pitch} position={position} year={year} pins={pins} onSelect={handleSelectPoi} />
          <CompassBar heading={heading} />
          <div style={styles.topBar}>
            <div style={styles.topLeft}>
              {heading != null && <span style={styles.compass}>{compassDir(heading)} {Math.round(heading)}°</span>}
            </div>
            <div style={styles.topRight}>
              <button style={styles.iconBtn} onClick={() => setShowShare(true)} aria-label="Share">↗</button>
              <button style={{ ...styles.iconBtn, color: showMap ? colors.accent : colors.text }} onClick={() => setShowMap(!showMap)} aria-label="Toggle map">◎</button>
              <button style={styles.iconBtn} onClick={() => setMode(null)} aria-label="Exit">×</button>
            </div>
          </div>
        </>
      )}

      {hasYears && (
        <TimelineSlider year={year} min={minYear} max={maxYear} onChange={handleYearChange} raised={mode === 'map'} />
      )}

      {(showMap || mode === 'map') && (
        <MapView
          position={position}
          center={center}
          year={year}
          pins={pins}
          onSelect={handleSelectPoi}
          onClose={() => (mode === 'map' ? setMode(null) : setShowMap(false))}
          fullscreen={mode === 'map'}
          title={collection.title}
        />
      )}

      {mode === 'map' && (
        <div style={styles.mapActions}>
          <button style={styles.iconBtn} onClick={() => setShowShare(true)} aria-label="Share">↗</button>
          {canEdit && <button style={styles.iconBtn} onClick={onEdit} aria-label="Edit">✎</button>}
        </div>
      )}

      {selectedPoi && (
        <InfoCard
          poi={selectedPoi}
          pins={pins}
          onClose={() => setSelectedPoi(null)}
          onSelectRelated={(poi) => { setSelectedPoi(poi); playOpen(); }}
        />
      )}

      {showShare && <ShareSheet collection={collection} canEdit={canEdit} onClose={() => setShowShare(false)} />}
    </>
  );
}

const styles = {
  startScreen: {
    position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: `linear-gradient(170deg, ${colors.bgSolid} 0%, ${colors.greenDark} 50%, ${colors.brownDark} 100%)`,
    fontFamily: fonts.sans, overflowY: 'auto',
  },
  startTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    padding: 'max(14px, env(safe-area-inset-top)) 16px 0',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  startTopRight: { display: 'flex', gap: 6 },
  backLink: { color: colors.textDim, fontFamily: fonts.mono, fontSize: 13, textDecoration: 'none', padding: '8px 0' },
  startCard: { textAlign: 'center', color: colors.text, padding: '80px 28px 40px', maxWidth: 460 },
  logo: { fontSize: 48, color: colors.accent, marginBottom: 12, fontFamily: fonts.mono, fontWeight: 700 },
  title: { fontSize: 26, fontWeight: 800, letterSpacing: 2, fontFamily: fonts.mono, marginBottom: 8, color: colors.text, lineHeight: 1.2 },
  subtitle: { fontSize: 13, color: colors.textDim, marginBottom: 14, fontFamily: fonts.mono, letterSpacing: 1 },
  desc: { fontSize: 14, color: colors.text, lineHeight: 1.6, marginBottom: 28, opacity: 0.9 },
  hint: { fontSize: 12, color: colors.textDim, marginTop: 16, fontFamily: fonts.mono },
  error: { color: '#ff6b6b', fontSize: 13, marginBottom: 16, fontFamily: fonts.mono },
  startButtons: { display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch' },
  button: {
    background: `linear-gradient(135deg, ${colors.blue} 0%, ${colors.green} 100%)`,
    color: 'white', border: `1px solid ${colors.blueLight}`, borderRadius: 14, padding: '16px 40px',
    fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: fonts.mono, letterSpacing: 1,
  },
  buttonGhost: {
    background: colors.bg, color: colors.text, border: `1px solid ${colors.blueDark}`, borderRadius: 14,
    padding: '14px 40px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: fonts.mono, letterSpacing: 1,
  },
  startFooter: { position: 'absolute', bottom: 'max(24px, env(safe-area-inset-bottom))' },
  footerText: { color: colors.textDim, fontSize: 11, fontFamily: fonts.mono, letterSpacing: 2 },
  topBar: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 15,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '82px 16px 10px',
    background: 'linear-gradient(to bottom, rgba(18,26,22,0.7) 0%, transparent 100%)',
  },
  topLeft: { display: 'flex', gap: 8, alignItems: 'center' },
  topRight: { display: 'flex', gap: 6 },
  compass: {
    background: colors.bg, color: colors.accent, padding: '5px 10px', borderRadius: 8,
    fontFamily: fonts.mono, fontSize: 13, fontWeight: 700, border: `1px solid ${colors.blueDark}`,
  },
  iconBtn: {
    background: colors.bg, border: `1px solid ${colors.blueDark}`, borderRadius: 8, width: 38, height: 38,
    fontSize: 18, cursor: 'pointer', color: colors.text,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.mono,
  },
  mapActions: {
    position: 'fixed', zIndex: 45, right: 16, top: 'max(60px, calc(env(safe-area-inset-top) + 56px))',
    display: 'flex', gap: 6,
  },
};
