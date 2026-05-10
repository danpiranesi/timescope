import React, { useState, useEffect } from 'react';
import { getRelatedPois } from '../pois';
import { colors, fonts } from '../theme';

function fetchWikiImage(wikiTitle) {
  return fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`
  )
    .then((r) => r.json())
    .then((data) => data.thumbnail?.source || null)
    .catch(() => null);
}

export default function InfoCard({ poi, onClose, onSelectRelated }) {
  const [image, setImage] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [userImages, setUserImages] = useState([]);
  const related = getRelatedPois(poi.id);

  useEffect(() => {
    setImage(null);
    if (poi.wiki) {
      fetchWikiImage(poi.wiki).then((url) => url && setImage(url));
    }
  }, [poi.id]);

  const handleAddImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const url = URL.createObjectURL(file);
        setUserImages((prev) => [...prev, url]);
      }
    };
    input.click();
  };

  const handleComment = () => {
    if (!commentText.trim()) return;
    setComments((prev) => [...prev, { text: commentText, time: new Date().toLocaleTimeString() }]);
    setCommentText('');
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={onClose}>×</button>

        {/* Hero image */}
        <div style={styles.imageSection}>
          {image ? (
            <img src={image} alt={poi.titleEn} style={styles.heroImage} />
          ) : (
            <div style={{...styles.heroPlaceholder, background: `linear-gradient(135deg, ${poi.color}33, ${colors.bgSolid})`}}>
              <span style={{...styles.placeholderText, color: poi.color}}>{poi.title}</span>
            </div>
          )}
          <div style={styles.imageOverlay}>
            <span style={{...styles.yearBadge, background: poi.color}}>{poi.year}</span>
          </div>
        </div>

        {/* User images */}
        {userImages.length > 0 && (
          <div style={styles.userImageRow}>
            {userImages.map((url, i) => (
              <img key={i} src={url} alt="User photo" style={styles.userThumb} />
            ))}
          </div>
        )}

        {/* Add image button */}
        <button style={styles.addImageBtn} onClick={handleAddImage}>
          + Add Photo
        </button>

        <div style={styles.body}>
          {/* Title */}
          <h2 style={styles.title}>{poi.title}</h2>
          <h3 style={styles.titleEn}>{poi.titleEn}</h3>
          <p style={styles.desc}>{poi.desc}</p>

          {/* Comments */}
          <div style={styles.commentSection}>
            <div style={styles.commentInputRow}>
              <input
                type="text"
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                style={styles.commentInput}
              />
              <button style={styles.commentBtn} onClick={handleComment}>→</button>
            </div>
            {comments.map((c, i) => (
              <div key={i} style={styles.comment}>
                <span style={styles.commentTime}>{c.time}</span>
                <span style={styles.commentText}>{c.text}</span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={styles.divider} />

          {/* History */}
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>⟐ History</h4>
            <p style={styles.sectionText}>{poi.history}</p>
          </div>

          {/* Fun fact */}
          <div style={{...styles.section, ...styles.funFact}}>
            <h4 style={{...styles.sectionTitle, color: colors.brownLight}}>☆ Fun Fact</h4>
            <p style={{...styles.sectionText, fontStyle: 'italic'}}>{poi.funFact}</p>
          </div>

          {/* Related */}
          {related.length > 0 && (
            <div style={styles.section}>
              <h4 style={styles.sectionTitle}>◈ Related Locations</h4>
              <div style={styles.relatedRow}>
                {related.map((r) => (
                  <button
                    key={r.id}
                    style={{...styles.relatedChip, borderColor: r.color}}
                    onClick={() => onSelectRelated(r)}
                  >
                    <span style={{...styles.relatedDot, background: r.color}} />
                    <span style={styles.relatedName}>{r.title}</span>
                    <span style={styles.relatedYear}>{r.year}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 50,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
  },
  card: {
    width: '100%', maxWidth: 480,
    maxHeight: '88vh',
    background: colors.bgSolid,
    borderRadius: '20px 20px 0 0',
    overflow: 'auto',
    position: 'relative',
    WebkitOverflowScrolling: 'touch',
    border: `1px solid ${colors.greenDark}`,
    borderBottom: 'none',
  },
  closeBtn: {
    position: 'absolute', top: 12, right: 14, zIndex: 2,
    background: 'rgba(0,0,0,0.5)', border: 'none',
    color: 'white', width: 32, height: 32, borderRadius: '50%',
    fontSize: 20, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  imageSection: {
    position: 'relative', width: '100%', height: 220,
  },
  heroImage: {
    width: '100%', height: '100%', objectFit: 'cover',
  },
  heroPlaceholder: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 28, fontFamily: fonts.mono, fontWeight: 700,
  },
  imageOverlay: {
    position: 'absolute', bottom: 12, left: 14,
  },
  yearBadge: {
    color: 'white', padding: '4px 12px', borderRadius: 6,
    fontFamily: fonts.mono, fontWeight: 800, fontSize: 14,
  },
  userImageRow: {
    display: 'flex', gap: 6, padding: '10px 14px 0', overflowX: 'auto',
  },
  userThumb: {
    width: 60, height: 60, borderRadius: 8, objectFit: 'cover',
    border: `1px solid ${colors.greenDark}`,
  },
  addImageBtn: {
    margin: '10px 14px 0', padding: '8px 16px',
    background: 'transparent',
    border: `1px dashed ${colors.green}`,
    borderRadius: 8, color: colors.green,
    fontFamily: fonts.mono, fontSize: 12, fontWeight: 700,
    cursor: 'pointer', width: 'calc(100% - 28px)',
  },
  body: { padding: '16px 18px 32px' },
  title: {
    fontSize: 22, fontWeight: 800, color: colors.text,
    fontFamily: fonts.mono, marginBottom: 2,
  },
  titleEn: {
    fontSize: 14, fontWeight: 500, color: colors.textDim,
    fontFamily: fonts.sans, marginBottom: 10,
  },
  desc: {
    fontSize: 14, color: colors.text, lineHeight: 1.5,
    fontFamily: fonts.sans, marginBottom: 14,
  },
  commentSection: {
    marginBottom: 8,
  },
  commentInputRow: {
    display: 'flex', gap: 6, marginBottom: 8,
  },
  commentInput: {
    flex: 1, padding: '8px 12px',
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${colors.blueDark}`,
    borderRadius: 8, color: colors.text,
    fontFamily: fonts.sans, fontSize: 13,
    outline: 'none',
  },
  commentBtn: {
    background: colors.blue, border: 'none',
    borderRadius: 8, width: 36, color: 'white',
    fontSize: 16, cursor: 'pointer', fontFamily: fonts.mono,
  },
  comment: {
    padding: '6px 0', borderBottom: `1px solid rgba(255,255,255,0.05)`,
  },
  commentTime: {
    fontSize: 10, color: colors.textDim, fontFamily: fonts.mono,
    marginRight: 8,
  },
  commentText: {
    fontSize: 13, color: colors.text, fontFamily: fonts.sans,
  },
  divider: {
    height: 1, background: `linear-gradient(to right, transparent, ${colors.green}44, transparent)`,
    margin: '16px 0',
  },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 13, fontWeight: 800, color: colors.accent,
    fontFamily: fonts.mono, letterSpacing: 1,
    marginBottom: 8, textTransform: 'uppercase',
  },
  sectionText: {
    fontSize: 14, color: colors.text, lineHeight: 1.6,
    fontFamily: fonts.sans,
  },
  funFact: {
    background: `rgba(139, 105, 20, 0.1)`,
    border: `1px solid ${colors.brownDark}`,
    borderRadius: 12, padding: 14,
  },
  relatedRow: {
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  relatedChip: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid',
    borderRadius: 10,
    cursor: 'pointer',
    width: '100%',
  },
  relatedDot: {
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
  },
  relatedName: {
    flex: 1, fontSize: 13, color: colors.text,
    fontFamily: fonts.mono, fontWeight: 600, textAlign: 'left',
  },
  relatedYear: {
    fontSize: 11, color: colors.textDim, fontFamily: fonts.mono,
  },
};
