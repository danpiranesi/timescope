import React, { useState, useEffect, useRef, useCallback } from 'react';
import { POIS } from '../pois';
import { colors, fonts } from '../theme';

function bearing(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function distance(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fetchWikiImage(wikiTitle) {
  return fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`
  )
    .then((r) => r.json())
    .then((data) => data.thumbnail?.source || null)
    .catch(() => null);
}

// Audio-based haptic feedback for iOS
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new AudioContext();
  return _audioCtx;
}

// Cooldown tracker: prevents repeated sounds for the same cluster
const _burstCooldowns = new Map();
const BURST_COOLDOWN_MS = 5000;

// Global sound rate limiter: max 2 sounds per second
let _lastSoundTime = 0;
const MIN_SOUND_INTERVAL_MS = 500;
function canPlaySound() {
  const now = Date.now();
  if (now - _lastSoundTime < MIN_SOUND_INTERVAL_MS) return false;
  _lastSoundTime = now;
  return true;
}

function hapticTick() {
  if (!canPlaySound()) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 4000;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.015);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.015);
  } catch (e) {}
}

function hapticPop() {
  if (!canPlaySound()) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 2400;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) {}
}

function hapticBurst(count) {
  if (!canPlaySound()) return;
  try {
    const ctx = getAudioCtx();
    for (let i = 0; i < Math.min(count, 6); i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 3200 + i * 200;
      osc.type = 'square';
      const t = ctx.currentTime + i * 0.06;
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
      osc.start(t);
      osc.stop(t + 0.02);
    }
  } catch (e) {}
}

// Generous clustering: 35° threshold, then merge overlapping clusters
function buildClusters(poiData) {
  const THRESHOLD = 35;
  const sorted = [...poiData].sort((a, b) => a.rel - b.rel);
  const clusters = [];
  const used = new Set();

  for (const item of sorted) {
    if (used.has(item.poi.id)) continue;

    const cluster = [item];
    used.add(item.poi.id);

    for (const other of sorted) {
      if (used.has(other.poi.id)) continue;
      // Check if close to ANY item already in the cluster
      const closeToCluster = cluster.some((c) => Math.abs(other.rel - c.rel) < THRESHOLD);
      if (closeToCluster) {
        cluster.push(other);
        used.add(other.poi.id);
      }
    }

    cluster.sort((a, b) => a.dist - b.dist);
    clusters.push(cluster);
  }

  // Merge pass: if cluster centers would be within 25% screen width, merge them
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const avgA = clusters[i].reduce((s, c) => s + c.rel, 0) / clusters[i].length;
        const avgB = clusters[j].reduce((s, c) => s + c.rel, 0) / clusters[j].length;
        // 40° in screen space ≈ 25% width at our 80° half-FOV
        if (Math.abs(avgA - avgB) < 40) {
          clusters[i] = [...clusters[i], ...clusters[j]].sort((a, b) => a.dist - b.dist);
          clusters.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }

  return clusters;
}

// Infinite dial component
function InfiniteDial({ items, activeIndex, onChange }) {
  const touchRef = useRef({ startY: 0, lastY: 0, accumulated: 0 });
  const containerRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    // Initialize AudioContext on first touch (iOS requirement)
    getAudioCtx();
    const y = e.touches[0].clientY;
    touchRef.current = { startY: y, lastY: y, accumulated: 0 };
  }, []);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    const y = e.touches[0].clientY;
    const delta = touchRef.current.lastY - y;
    touchRef.current.lastY = y;
    touchRef.current.accumulated += delta;

    const stepSize = 40; // pixels per step
    if (Math.abs(touchRef.current.accumulated) >= stepSize) {
      const steps = Math.sign(touchRef.current.accumulated);
      touchRef.current.accumulated -= steps * stepSize;
      onChange(steps);
      hapticTick();
    }
  }, [onChange]);

  if (items.length <= 1) return null;

  // Show a window of items around the active one
  const windowSize = 5;
  const displayItems = [];
  for (let i = -Math.floor(windowSize / 2); i <= Math.floor(windowSize / 2); i++) {
    const idx = ((activeIndex + i) % items.length + items.length) % items.length;
    displayItems.push({ item: items[idx], offset: i, idx });
  }

  return (
    <div
      ref={containerRef}
      style={dialStyles.container}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <div style={dialStyles.track}>
        {/* Notch marks */}
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} style={{
            ...dialStyles.notch,
            opacity: Math.abs(i - 7) < 2 ? 0.5 : 0.15,
          }} />
        ))}
      </div>
      <div style={dialStyles.indicator} />
      <div style={dialStyles.itemList}>
        {displayItems.map(({ item, offset, idx }) => (
          <div key={`${idx}-${offset}`} style={{
            ...dialStyles.item,
            opacity: offset === 0 ? 1 : 0.3,
            transform: `scale(${offset === 0 ? 1 : 0.7})`,
          }}>
            <div style={{
              ...dialStyles.itemDot,
              background: item.poi.color,
              width: offset === 0 ? 10 : 6,
              height: offset === 0 ? 10 : 6,
            }} />
          </div>
        ))}
      </div>
      <div style={dialStyles.label}>
        {items[activeIndex]?.poi.title}
      </div>
    </div>
  );
}

export default function AROverlay({ heading, pitch, position, year, onSelect }) {
  const [images, setImages] = useState({});
  const [clusterIndices, setClusterIndices] = useState({});
  const prevOnScreenRef = useRef(new Set());

  useEffect(() => {
    POIS.forEach((poi) => {
      if (poi.wiki && !images[poi.id]) {
        fetchWikiImage(poi.wiki).then((url) => {
          if (url) setImages((prev) => ({ ...prev, [poi.id]: url }));
        });
      }
    });
  }, []);

  const handleDialChange = useCallback((clusterId, total, direction) => {
    setClusterIndices((prev) => {
      const current = prev[clusterId] || 0;
      const next = ((current + direction) % total + total) % total;
      return { ...prev, [clusterId]: next };
    });
  }, []);

  if (heading == null || !position) return null;

  const visible = POIS.filter((p) => p.year <= year);

  const poiData = visible.map((poi) => {
    const b = bearing(position.lat, position.lng, poi.lat, poi.lng);
    const dist = distance(position.lat, position.lng, poi.lat, poi.lng);
    let rel = b - heading;
    if (rel > 180) rel -= 360;
    if (rel < -180) rel += 360;
    return { poi, rel, dist };
  });

  const onScreenData = poiData.filter((d) => Math.abs(d.rel) <= 80);
  const leftCount = poiData.filter((d) => d.rel < -80).length;
  const rightCount = poiData.filter((d) => d.rel > 80).length;

  const currentOnScreen = new Set(onScreenData.map((d) => d.poi.id));
  const prevOnScreen = prevOnScreenRef.current;

  const clusters = buildClusters(onScreenData);

  // Haptic burst when clusters enter screen (with 5s cooldown per cluster)
  const now = Date.now();
  for (const cluster of clusters) {
    const clusterIds = cluster.map((c) => c.poi.id);
    const clusterKey = clusterIds.sort().join('-');
    const newEntries = clusterIds.filter((id) => !prevOnScreen.has(id));
    const lastBurst = _burstCooldowns.get(clusterKey) || 0;
    if (newEntries.length === clusterIds.length && cluster.length > 0 && now - lastBurst > BURST_COOLDOWN_MS) {
      hapticBurst(cluster.length);
      _burstCooldowns.set(clusterKey, now);
    }
  }
  prevOnScreenRef.current = currentOnScreen;

  const horizonY = 50 + pitch * 1.8;

  // Find the biggest multi-item cluster for the dial
  const multiClusters = clusters.filter((c) => c.length > 1);
  const biggestCluster = multiClusters.length > 0
    ? multiClusters.reduce((a, b) => (a.length >= b.length ? a : b))
    : null;
  const biggestClusterId = biggestCluster
    ? biggestCluster.map((c) => c.poi.id).join('-')
    : null;

  return (
    <div style={styles.container}>
      <div style={{
        ...styles.horizonLine,
        top: `${Math.max(0, Math.min(100, horizonY))}%`,
      }} />

      {clusters.map((cluster) => {
        const clusterId = cluster.map((c) => c.poi.id).join('-');
        const activeIdx = Math.min(clusterIndices[clusterId] || 0, cluster.length - 1);

        const avgRel = cluster.reduce((s, c) => s + c.rel, 0) / cluster.length;
        const centerX = 50 + (avgRel / 80) * 50;

        const centerItem = cluster[activeIdx];
        const distOffset = Math.max(-8, Math.min(8, (Math.log10(centerItem.dist) - 3) * 4));
        const centerY = horizonY - distOffset;

        const isSingle = cluster.length === 1;
        const centerSize = isSingle ? 65 : 80;
        const satSize = 34;
        const imgUrl = images[centerItem.poi.id];
        const distLabel = centerItem.dist < 1000
          ? `${Math.round(centerItem.dist)}m`
          : `${(centerItem.dist / 1000).toFixed(1)}km`;

        const satellites = cluster.filter((_, i) => i !== activeIdx);
        const satRadius = centerSize / 2 + satSize / 2 + 10;

        return (
          <div key={clusterId} style={{
            ...styles.clusterWrap,
            left: `${centerX}%`,
            top: `${centerY}%`,
          }}>
            {satellites.map((sat, si) => {
              const angle = ((si / satellites.length) * 360 - 90) * (Math.PI / 180);
              const sx = Math.cos(angle) * satRadius;
              const sy = Math.sin(angle) * satRadius;
              const satImg = images[sat.poi.id];

              return (
                <div
                  key={sat.poi.id}
                  style={{
                    ...styles.satellite,
                    width: satSize,
                    height: satSize,
                    borderColor: sat.poi.color,
                    transform: `translate(${sx}px, ${sy}px)`,
                    boxShadow: `0 0 12px ${sat.poi.color}44`,
                  }}
                  onClick={() => {
                    const newIdx = cluster.findIndex((c) => c.poi.id === sat.poi.id);
                    hapticPop();
                    setClusterIndices((prev) => ({ ...prev, [clusterId]: newIdx }));
                  }}
                >
                  {satImg ? (
                    <img src={satImg} alt="" style={styles.circleImg} />
                  ) : (
                    <span style={{ ...styles.satYear, color: sat.poi.color }}>
                      {sat.poi.year}
                    </span>
                  )}
                </div>
              );
            })}

            <div
              style={{
                ...styles.centerCircle,
                width: centerSize,
                height: centerSize,
                borderColor: centerItem.poi.color,
                boxShadow: `0 0 28px ${centerItem.poi.color}55, 0 0 60px ${centerItem.poi.color}22`,
              }}
              onClick={() => onSelect(centerItem.poi)}
            >
              {imgUrl ? (
                <img src={imgUrl} alt={centerItem.poi.titleEn} style={styles.circleImg} />
              ) : (
                <div style={{
                  ...styles.circleFallback,
                  background: `radial-gradient(circle, ${centerItem.poi.color}44, ${centerItem.poi.color}11)`,
                }}>
                  <span style={{ ...styles.circleYear, color: centerItem.poi.color }}>
                    {centerItem.poi.year}
                  </span>
                </div>
              )}
            </div>

            <div style={{
              ...styles.label,
              top: centerSize / 2 + (isSingle ? 12 : satSize + 16),
            }}>
              <div style={styles.labelTitle}>{centerItem.poi.title}</div>
              <div style={{ ...styles.labelDist, color: centerItem.poi.color }}>{distLabel}</div>
            </div>
          </div>
        );
      })}

      {biggestCluster && (
        <InfiniteDial
          items={biggestCluster}
          activeIndex={clusterIndices[biggestClusterId] || 0}
          onChange={(dir) => handleDialChange(biggestClusterId, biggestCluster.length, dir)}
        />
      )}

      {leftCount > 0 && (
        <div style={styles.arrowLeft}>
          <span style={styles.arrowChevron}>‹</span>
          <span style={styles.arrowCount}>{leftCount}</span>
        </div>
      )}

      {rightCount > 0 && (
        <div style={styles.arrowRight}>
          <span style={styles.arrowCount}>{rightCount}</span>
          <span style={styles.arrowChevron}>›</span>
        </div>
      )}
    </div>
  );
}

const dialStyles = {
  container: {
    position: 'absolute',
    right: 8, top: '18%', bottom: '28%',
    width: 52, zIndex: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    touchAction: 'none',
  },
  track: {
    position: 'absolute',
    inset: 0,
    background: colors.bg,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: `1px solid ${colors.greenDark}`,
    borderRadius: 14,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: '12px 6px',
    overflow: 'hidden',
  },
  notch: {
    width: 12,
    height: 1.5,
    background: colors.text,
    borderRadius: 1,
  },
  indicator: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 4,
    height: 24,
    background: colors.accent,
    borderRadius: '2px 0 0 2px',
    zIndex: 2,
  },
  itemList: {
    position: 'absolute',
    left: 6,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    alignItems: 'center',
    zIndex: 1,
    pointerEvents: 'none',
  },
  item: {
    transition: 'all 0.15s ease',
  },
  itemDot: {
    borderRadius: '50%',
    transition: 'all 0.15s ease',
  },
  label: {
    position: 'absolute',
    right: 60,
    top: '50%',
    transform: 'translateY(-50%)',
    background: colors.bg,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: `1px solid ${colors.greenDark}`,
    borderRadius: 8,
    padding: '5px 10px',
    color: colors.text,
    fontSize: 10,
    fontFamily: fonts.mono,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
};

const styles = {
  container: {
    position: 'fixed', inset: 0, zIndex: 5,
    overflow: 'hidden',
  },
  horizonLine: {
    position: 'absolute',
    left: 0, right: 0, height: 1,
    background: `linear-gradient(to right, transparent 0%, ${colors.green}33 20%, ${colors.green}33 80%, transparent 100%)`,
    pointerEvents: 'none',
    transition: 'top 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)',
  },
  clusterWrap: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    transition: 'left 0.5s cubic-bezier(0.25, 0.1, 0.25, 1), top 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCircle: {
    borderRadius: '50%',
    borderWidth: 3,
    borderStyle: 'solid',
    overflow: 'hidden',
    cursor: 'pointer',
    pointerEvents: 'auto',
    position: 'relative',
    zIndex: 2,
  },
  satellite: {
    position: 'absolute',
    borderRadius: '50%',
    borderWidth: 2,
    borderStyle: 'solid',
    overflow: 'hidden',
    cursor: 'pointer',
    pointerEvents: 'auto',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)',
  },
  circleImg: {
    width: '100%', height: '100%',
    objectFit: 'cover', borderRadius: '50%',
  },
  circleFallback: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '50%',
  },
  circleYear: {
    fontSize: 13, fontWeight: 800,
    fontFamily: fonts.mono,
  },
  satYear: {
    fontSize: 8, fontWeight: 800,
    fontFamily: fonts.mono,
  },
  label: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    background: colors.bg,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderRadius: 8,
    padding: '5px 10px',
    textAlign: 'center',
    border: `1px solid rgba(74, 124, 89, 0.3)`,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    zIndex: 3,
  },
  labelTitle: {
    color: colors.text,
    fontSize: 11, fontWeight: 700,
    fontFamily: fonts.mono,
  },
  labelDist: {
    fontSize: 10, fontWeight: 700,
    fontFamily: fonts.mono,
  },
  labelCount: {
    fontSize: 9,
    color: colors.textDim,
    fontFamily: fonts.mono,
    marginTop: 2,
  },
  arrowLeft: {
    position: 'absolute',
    left: 6, top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex', alignItems: 'center', gap: 4,
    background: colors.bg,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: `1px solid ${colors.greenDark}`,
    borderRadius: 10,
    padding: '8px 10px',
    pointerEvents: 'auto',
  },
  arrowRight: {
    position: 'absolute',
    right: 6, top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex', alignItems: 'center', gap: 4,
    background: colors.bg,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: `1px solid ${colors.greenDark}`,
    borderRadius: 10,
    padding: '8px 10px',
    pointerEvents: 'auto',
  },
  arrowChevron: {
    fontSize: 22,
    fontWeight: 800,
    color: colors.accent,
    fontFamily: fonts.mono,
    lineHeight: 1,
  },
  arrowCount: {
    fontSize: 15,
    fontWeight: 800,
    color: colors.text,
    fontFamily: fonts.mono,
  },
};
