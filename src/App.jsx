import React, { useState, useEffect, useCallback, useRef } from 'react';
import CameraBackground from './components/CameraBackground';
import AROverlay from './components/AROverlay';
import TimelineSlider from './components/TimelineSlider';
import InfoCard from './components/InfoCard';
import MapView from './components/MapView';
import { colors, fonts } from './theme';

export default function App() {
  const [year, setYear] = useState(2024);
  const [heading, setHeading] = useState(null);
  const [pitch, setPitch] = useState(0);
  const [position, setPosition] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPoi, setSelectedPoi] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const audioCtxRef = useRef(null);

  const playTick = useCallback(() => {
    if (!audioOn) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  }, [audioOn]);

  const playOpen = useCallback(() => {
    if (!audioOn) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  }, [audioOn]);

  const requestPermissions = useCallback(async () => {
    // Init AudioContext on user gesture (iOS requirement for audio haptics)
    try { new AudioContext(); } catch (e) {}

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') {
          setError('Compass permission denied');
          return;
        }
      } catch (e) {
        setError('Compass permission failed: ' + e.message);
        return;
      }
    }

    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPermissionGranted(true);
      },
      (err) => setError('Location error: ' + err.message),
      { enableHighAccuracy: true }
    );

    navigator.geolocation.watchPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true }
    );
  }, []);

  function handleOrientation(e) {
    let h = null;
    if (e.webkitCompassHeading != null) {
      h = e.webkitCompassHeading;
    } else if (e.alpha != null) {
      h = e.absolute ? (360 - e.alpha) : e.alpha;
    }
    if (h != null) setHeading(h);
    // beta: 0 = flat, 90 = upright, >90 = tilted back
    // We map this to a pitch offset for the horizon
    if (e.beta != null) {
      // When phone is upright (beta~90), pitch=0 (horizon centered)
      // When tilted up (beta<90), pitch>0 (horizon moves down)
      // When tilted down (beta>90), pitch<0 (horizon moves up)
      setPitch(90 - e.beta);
    }
  }

  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  const handleSelectPoi = useCallback((poi) => {
    playOpen();
    setSelectedPoi(poi);
  }, [playOpen]);

  const handleYearChange = useCallback((y) => {
    playTick();
    setYear(y);
  }, [playTick]);

  if (!permissionGranted) {
    return (
      <div style={styles.startScreen}>
        <div style={styles.startCard}>
          <div style={styles.logo}>⊙</div>
          <h1 style={styles.title}>TIMESCOPE</h1>
          <p style={styles.subtitle}>explore the layers of history around you</p>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} onClick={requestPermissions}>
            Begin Exploration
          </button>
        </div>
        <div style={styles.startFooter}>
          <span style={styles.footerText}>小諸 · Komoro, Nagano</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <CameraBackground />
      <AROverlay heading={heading} pitch={pitch} position={position} year={year} onSelect={handleSelectPoi} />
      <TimelineSlider year={year} onChange={handleYearChange} />

      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={styles.topLeft}>
          {heading != null && (
            <span style={styles.compass}>{Math.round(heading)}°</span>
          )}
        </div>
        <div style={styles.topRight}>
          <button
            style={{...styles.iconBtn, color: showMap ? colors.accent : colors.text}}
            onClick={() => setShowMap(!showMap)}
          >
            ◎
          </button>
        </div>
      </div>

      {showMap && (
        <MapView
          position={position}
          heading={heading}
          year={year}
          onSelect={handleSelectPoi}
          onClose={() => setShowMap(false)}
        />
      )}

      {selectedPoi && (
        <InfoCard
          poi={selectedPoi}
          onClose={() => setSelectedPoi(null)}
          onSelectRelated={(poi) => { setSelectedPoi(poi); playOpen(); }}
        />
      )}
    </>
  );
}

const styles = {
  startScreen: {
    position: 'fixed', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: `linear-gradient(170deg, ${colors.bgSolid} 0%, ${colors.greenDark} 50%, ${colors.brownDark} 100%)`,
    fontFamily: fonts.sans,
  },
  startCard: { textAlign: 'center', color: colors.text, padding: 40 },
  logo: {
    fontSize: 48, color: colors.accent, marginBottom: 12,
    fontFamily: fonts.mono, fontWeight: 700,
  },
  title: {
    fontSize: 28, fontWeight: 800, letterSpacing: 6,
    fontFamily: fonts.mono, marginBottom: 8, color: colors.text,
  },
  subtitle: {
    fontSize: 14, color: colors.textDim, marginBottom: 36,
    fontFamily: fonts.mono, letterSpacing: 1,
  },
  error: { color: '#ff6b6b', fontSize: 13, marginBottom: 16, fontFamily: fonts.mono },
  button: {
    background: `linear-gradient(135deg, ${colors.blue} 0%, ${colors.green} 100%)`,
    color: 'white', border: `1px solid ${colors.blueLight}`,
    borderRadius: 14, padding: '16px 40px', fontSize: 16,
    fontWeight: 700, cursor: 'pointer', fontFamily: fonts.mono,
    letterSpacing: 1,
  },
  startFooter: {
    position: 'absolute', bottom: 40,
  },
  footerText: {
    color: colors.textDim, fontSize: 12, fontFamily: fonts.mono, letterSpacing: 2,
  },
  topBar: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 15,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '50px 16px 10px',
    background: 'linear-gradient(to bottom, rgba(18,26,22,0.7) 0%, transparent 100%)',
  },
  topLeft: { display: 'flex', gap: 8 },
  topRight: { display: 'flex', gap: 6 },
  compass: {
    background: colors.bg, color: colors.accent,
    padding: '5px 10px', borderRadius: 8,
    fontFamily: fonts.mono, fontSize: 13, fontWeight: 700,
    border: `1px solid ${colors.blueDark}`,
  },
  iconBtn: {
    background: colors.bg, border: `1px solid ${colors.blueDark}`,
    borderRadius: 8, width: 38, height: 38,
    fontSize: 18, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: fonts.mono,
  },
};
