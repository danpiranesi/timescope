import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { colors, fonts } from '../theme';
import { Button, Muted } from './ui';
import { shareUrl } from '../api';

export default function ShareSheet({ collection, canEdit, onClose }) {
  const viewUrl = shareUrl(collection.slug);
  const editUrl = canEdit && collection.editKey ? shareUrl(collection.slug, collection.editKey) : null;
  const [mode, setMode] = useState('view');
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);
  const url = mode === 'edit' && editUrl ? editUrl : viewUrl;
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#121A16', light: '#E8E4DC' } })
      .then((d) => alive && setQr(d))
      .catch(() => alive && setQr(null));
    return () => { alive = false; };
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link', url);
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({
        title: `${collection.title} · Timescope`,
        text: mode === 'edit' ? `Help me build "${collection.title}" on Timescope` : `Explore "${collection.title}" in AR on Timescope`,
        url,
      });
    } catch {}
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.handle} />
        <h3 style={styles.title}>Share “{collection.title}”</h3>
        {editUrl && (
          <div style={styles.tabs}>
            <button style={{ ...styles.tab, ...(mode === 'view' ? styles.tabActive : {}) }} onClick={() => setMode('view')}>Friends can explore</button>
            <button style={{ ...styles.tab, ...(mode === 'edit' ? styles.tabActive : {}) }} onClick={() => setMode('edit')}>Friends can edit</button>
          </div>
        )}
        <Muted style={{ marginBottom: 12 }}>
          {mode === 'edit'
            ? 'Anyone with this link can add, change and remove pins. Share it only with people you trust.'
            : collection.isPublic
              ? 'Anyone with the link can open this collection in AR or on the map. It is also listed on the community page.'
              : 'This collection is unlisted. Only people with the link can open it.'}
        </Muted>
        {qr && <img src={qr} alt="QR code for this collection" style={styles.qr} />}
        <div style={styles.urlBox}>{url}</div>
        <div style={styles.row}>
          <Button onClick={copy} style={{ flex: 1 }}>{copied ? '✓ Copied' : 'Copy link'}</Button>
          {canNativeShare && <Button variant="ghost" onClick={nativeShare} style={{ flex: 1 }}>Share…</Button>}
        </div>
        <Button variant="subtle" onClick={onClose} style={{ width: '100%', marginTop: 6 }}>Done</Button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
  },
  sheet: {
    width: '100%', maxWidth: 480, background: colors.bgSolid,
    borderRadius: '20px 20px 0 0', border: `1px solid ${colors.greenDark}`, borderBottom: 'none',
    padding: '10px 18px max(24px, env(safe-area-inset-bottom))', textAlign: 'center',
  },
  handle: { width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 14px' },
  title: { fontFamily: fonts.mono, fontSize: 16, color: colors.text, marginBottom: 12 },
  tabs: { display: 'flex', gap: 6, marginBottom: 12, background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 10 },
  tab: { flex: 1, padding: '8px 6px', border: 'none', borderRadius: 8, background: 'transparent', color: colors.textDim, fontFamily: fonts.mono, fontSize: 11, cursor: 'pointer' },
  tabActive: { background: colors.blueDark, color: colors.text },
  qr: { width: 180, height: 180, borderRadius: 12, margin: '0 auto 12px', display: 'block', border: `4px solid ${colors.text}` },
  urlBox: {
    fontFamily: fonts.mono, fontSize: 11, color: colors.textDim, wordBreak: 'break-all',
    background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 10, marginBottom: 12, textAlign: 'left',
  },
  row: { display: 'flex', gap: 8 },
};
