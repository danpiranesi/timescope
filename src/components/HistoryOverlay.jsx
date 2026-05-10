import React from 'react';

const EVENTS = [
  { year: 1490, title: '小諸城築城', desc: 'Komoro Castle constructed by the Ōi clan' },
  { year: 1600, title: '戦国時代', desc: 'Castle fortified under Sengoku Tadamasa after Sekigahara' },
  { year: 1742, title: '千曲川大洪水', desc: 'Great flood devastates the Chikuma River valley' },
  { year: 1870, title: '明治維新', desc: 'Feudal domains abolished — Komoro modernizes' },
  { year: 1890, title: '島崎藤村', desc: 'Shimazaki Toson lives in Komoro, writes Chikumagawa no Sketch' },
  { year: 1910, title: '信濃鉄道開通', desc: 'Shinano Railway reaches Komoro Station' },
  { year: 1950, title: '戦後復興', desc: 'Post-war rebuilding and agricultural revival' },
  { year: 2000, title: '懐古園整備', desc: 'Kaikoen Park restoration and tourism growth' },
];

export default function HistoryOverlay({ year }) {
  const visible = EVENTS.filter((e) => e.year <= year);
  const current = [...visible].reverse()[0];

  return (
    <div style={styles.container}>
      {current && (
        <div style={styles.hero}>
          <div style={styles.heroYear}>{current.year}</div>
          <div style={styles.heroTitle}>{current.title}</div>
          <div style={styles.heroDesc}>{current.desc}</div>
        </div>
      )}
      <div style={styles.timeline}>
        {visible.map((e) => (
          <div
            key={e.year}
            style={{
              ...styles.chip,
              opacity: e === current ? 1 : 0.6,
            }}
          >
            <span style={styles.chipYear}>{e.year}</span> {e.title}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 5,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    pointerEvents: 'none',
    fontFamily: 'system-ui, sans-serif',
  },
  hero: {
    margin: '60px 20px 0',
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: 16,
    padding: '20px 24px',
    color: 'white',
  },
  heroYear: {
    fontSize: 14,
    fontWeight: 700,
    color: '#4a90d9',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 15,
    opacity: 0.85,
    lineHeight: 1.4,
  },
  timeline: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '0 16px',
    marginBottom: 100,
  },
  chip: {
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    color: 'white',
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 8,
  },
  chipYear: {
    fontWeight: 700,
    color: '#4a90d9',
  },
};
