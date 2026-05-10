import React from 'react';
import { colors, fonts } from '../theme';

const TICKS = [
  { deg: 0, label: 'N' },
  { deg: 45, label: 'NE' },
  { deg: 90, label: 'E' },
  { deg: 135, label: 'SE' },
  { deg: 180, label: 'S' },
  { deg: 225, label: 'SW' },
  { deg: 270, label: 'W' },
  { deg: 315, label: 'NW' },
];

// Minor ticks every 15°
const MINOR = Array.from({ length: 24 }, (_, i) => i * 15);

export default function CompassBar({ heading }) {
  if (heading == null) return null;

  return (
    <div style={styles.container}>
      <div style={styles.track}>
        {MINOR.map((deg) => {
          let rel = deg - heading;
          if (rel > 180) rel -= 360;
          if (rel < -180) rel += 360;
          if (Math.abs(rel) > 60) return null;

          const x = 50 + (rel / 60) * 50;
          const isMajor = TICKS.find((t) => t.deg === deg);

          return (
            <div key={deg} style={{ ...styles.tick, left: `${x}%` }}>
              <div style={{
                ...styles.tickLine,
                height: isMajor ? 10 : 5,
                background: isMajor
                  ? (deg === 0 ? '#e74c3c' : colors.text)
                  : colors.textDim,
              }} />
              {isMajor && (
                <span style={{
                  ...styles.tickLabel,
                  color: deg === 0 ? '#e74c3c' : colors.text,
                  fontWeight: deg === 0 ? 800 : 600,
                }}>
                  {isMajor.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Center indicator */}
      <div style={styles.center}>▼</div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: 44,
    left: '10%',
    right: '10%',
    height: 36,
    zIndex: 16,
    overflow: 'hidden',
  },
  track: {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: 'linear-gradient(to right, transparent 0%, rgba(18,26,22,0.6) 15%, rgba(18,26,22,0.6) 85%, transparent 100%)',
    borderRadius: 8,
  },
  tick: {
    position: 'absolute',
    top: 8,
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
    transition: 'left 0.1s linear',
  },
  tickLine: {
    width: 1.5,
    borderRadius: 1,
  },
  tickLabel: {
    fontSize: 9,
    fontFamily: fonts.mono,
    fontWeight: 600,
    letterSpacing: 1,
  },
  center: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    color: colors.accent,
    fontSize: 8,
    fontFamily: fonts.mono,
    lineHeight: 1,
  },
};
