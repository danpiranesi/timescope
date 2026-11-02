import React from 'react';
import { colors, fonts } from '../theme';
import { Link } from '../router';

export function Page({ children, style }) {
  return (
    <div style={{ ...ui.page, ...style }}>
      <div style={ui.inner}>{children}</div>
    </div>
  );
}

export function TopNav({ back, title, subtitle, right }) {
  return (
    <div style={ui.nav}>
      <div style={ui.navLeft}>
        {back && (
          <Link to={back} style={ui.backLink} aria-label="Back">‹</Link>
        )}
        <div>
          {title && <div style={ui.navTitle}>{title}</div>}
          {subtitle && <div style={ui.navSubtitle}>{subtitle}</div>}
        </div>
      </div>
      <div style={ui.navRight}>{right}</div>
    </div>
  );
}

export function Button({ children, variant = 'primary', small, style, ...rest }) {
  const base = { ...ui.button, ...(small ? ui.buttonSmall : {}), ...ui.variants[variant], ...(rest.disabled ? ui.disabled : {}) };
  return (
    <button style={{ ...base, ...style }} {...rest}>{children}</button>
  );
}

export function Card({ children, style, onClick, as: Tag = 'div', ...rest }) {
  return (
    <Tag style={{ ...ui.card, ...(onClick ? { cursor: 'pointer' } : {}), ...style }} onClick={onClick} {...rest}>
      {children}
    </Tag>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label style={ui.field}>
      {label && <span style={ui.label}>{label}</span>}
      {children}
      {hint && <span style={ui.hint}>{hint}</span>}
    </label>
  );
}

export function Input(props) {
  return <input {...props} style={{ ...ui.input, ...props.style }} />;
}

export function TextArea(props) {
  return <textarea {...props} style={{ ...ui.input, minHeight: 72, resize: 'vertical', ...props.style }} />;
}

export function Pill({ children, color = colors.green, style }) {
  return <span style={{ ...ui.pill, borderColor: color, color, ...style }}>{children}</span>;
}

export function SectionTitle({ children, right }) {
  return (
    <div style={ui.sectionRow}>
      <h3 style={ui.sectionTitle}>{children}</h3>
      {right}
    </div>
  );
}

export function Muted({ children, style }) {
  return <p style={{ ...ui.muted, ...style }}>{children}</p>;
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <p style={ui.error}>{String(children)}</p>;
}

export function Spinner({ label = 'Loading…' }) {
  return <div style={ui.spinner}>◌ {label}</div>;
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} style={ui.toggleRow}>
      <span style={{ ...ui.toggleTrack, background: checked ? colors.green : 'rgba(255,255,255,0.12)' }}>
        <span style={{ ...ui.toggleKnob, transform: checked ? 'translateX(18px)' : 'translateX(0)' }} />
      </span>
      <span style={ui.toggleLabel}>{label}</span>
    </button>
  );
}

export const ui = {
  page: {
    height: '100%', width: '100%', overflowY: 'auto',
    background: `linear-gradient(170deg, ${colors.bgSolid} 0%, ${colors.greenDark} 60%, ${colors.brownDark} 100%)`,
    backgroundAttachment: 'fixed',
    color: colors.text, fontFamily: fonts.sans,
    WebkitOverflowScrolling: 'touch',
  },
  inner: {
    maxWidth: 560, margin: '0 auto',
    padding: 'max(16px, env(safe-area-inset-top)) 16px max(32px, env(safe-area-inset-bottom))',
  },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, minHeight: 40 },
  navLeft: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  navRight: { display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 },
  backLink: {
    width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: colors.bg, border: `1px solid ${colors.blueDark}`, color: colors.text, fontSize: 22, lineHeight: 1,
    flexShrink: 0, textDecoration: 'none',
  },
  navTitle: { fontFamily: fonts.mono, fontWeight: 800, fontSize: 17, letterSpacing: 1, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  navSubtitle: { fontFamily: fonts.mono, fontSize: 11, color: colors.textDim, letterSpacing: 1 },
  button: {
    border: `1px solid ${colors.blueLight}`, borderRadius: 12, padding: '12px 18px',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: fonts.mono, letterSpacing: 0.5,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    textDecoration: 'none', lineHeight: 1.2,
  },
  buttonSmall: { padding: '8px 12px', fontSize: 12, borderRadius: 10 },
  variants: {
    primary: { background: `linear-gradient(135deg, ${colors.blue} 0%, ${colors.green} 100%)`, color: 'white' },
    ghost: { background: colors.bg, color: colors.text, borderColor: colors.blueDark },
    subtle: { background: 'transparent', color: colors.textDim, borderColor: 'transparent' },
    danger: { background: 'rgba(231, 76, 60, 0.15)', color: '#ff8a80', borderColor: 'rgba(231, 76, 60, 0.5)' },
  },
  disabled: { opacity: 0.5, cursor: 'not-allowed' },
  card: {
    background: colors.bg, border: `1px solid ${colors.greenDark}`, borderRadius: 14,
    padding: 14, marginBottom: 10, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim },
  hint: { fontSize: 12, color: colors.textDim },
  input: {
    width: '100%', padding: '11px 12px', background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${colors.blueDark}`, borderRadius: 10, color: colors.text,
    fontFamily: fonts.sans, fontSize: 15, outline: 'none',
  },
  pill: {
    display: 'inline-block', padding: '2px 8px', borderRadius: 999, border: '1px solid',
    fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
  },
  sectionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '22px 0 10px' },
  sectionTitle: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent, fontWeight: 800 },
  muted: { color: colors.textDim, fontSize: 13, lineHeight: 1.5 },
  error: { color: '#ff8a80', fontFamily: fonts.mono, fontSize: 13, margin: '8px 0' },
  spinner: { color: colors.textDim, fontFamily: fonts.mono, fontSize: 13, padding: '20px 0', textAlign: 'center' },
  toggleRow: { display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 0', color: colors.text },
  toggleTrack: { width: 38, height: 20, borderRadius: 999, position: 'relative', transition: 'background 0.2s', flexShrink: 0 },
  toggleKnob: { position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'transform 0.2s' },
  toggleLabel: { fontFamily: fonts.sans, fontSize: 14 },
};
