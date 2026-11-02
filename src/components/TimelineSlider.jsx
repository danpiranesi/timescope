import React from 'react';
import { colors, fonts } from '../theme';

export default function TimelineSlider({ year, min = 700, max = 2024, onChange, raised = false }) {
  return (
    <div style={{ ...styles.container, ...(raised ? { zIndex: 46, bottom: 'max(24px, env(safe-area-inset-bottom))' } : {}) }}>
      <span style={styles.label}>{year}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={year}
        onChange={(e) => onChange(Number(e.target.value))}
        style={styles.slider}
      />
      <div style={styles.range}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    background: colors.bg,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    padding: '10px 22px 8px',
    borderRadius: 14,
    border: `1px solid ${colors.greenDark}`,
  },
  label: {
    color: colors.accent,
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: 2,
  },
  slider: {
    width: 260,
    accentColor: colors.green,
  },
  range: {
    width: 260,
    display: 'flex',
    justifyContent: 'space-between',
    color: colors.textDim,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: 700,
  },
};
