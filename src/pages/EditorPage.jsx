import React, { useEffect, useRef, useState } from 'react';
import { api, rememberEditKey, storedEditKey, forgetEditKey, geocodeSearch, getCurrentPosition } from '../api';
import { navigate } from '../router';
import { parseImportFile, geocodeMissing, ACCEPTED } from '../importers';
import { Page, TopNav, Button, Card, Field, Input, TextArea, Muted, ErrorText, Spinner, SectionTitle, Toggle, Pill } from '../components/ui';
import ShareSheet from '../components/ShareSheet';
import { colors, fonts } from '../theme';

const PALETTE = ['#e74c3c', '#f39c12', '#2ecc71', '#9b59b6', '#1abc9c', '#e91e63', '#3498db', '#FF5722', '#607D8B', '#8BC34A', '#795548', '#9C27B0', '#00BCD4', '#FFC107', '#C62828', '#0097A7'];

let localCounter = 0;
const newLocalId = () => `local-${Date.now()}-${localCounter++}`;

/**
 * Create a new collection (`/new?community=slug`) or edit an existing one
 * (`/c/:slug/edit`). In edit mode every pin change is saved to the API as it
 * is made; in create mode pins are held locally until "Create collection".
 */
export default function EditorPage({ slug, communitySlug, openImport = false }) {
  const isEdit = !!slug;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [community, setCommunity] = useState(null);
  const [collection, setCollection] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [editKey, setEditKey] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [pins, setPins] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [showImport, setShowImport] = useState(openImport);
  const [showAdd, setShowAdd] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedNote, setSavedNote] = useState(null);
  const dirtyRef = useRef(new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (isEdit) {
          const key = storedEditKey(slug);
          const d = await api.collections.get(slug, key);
          if (!alive) return;
          if (!d.canEdit) {
            setError('You do not have edit access to this collection. Ask its owner for an edit link.');
            setLoading(false);
            return;
          }
          rememberEditKey(slug, d.collection.editKey);
          setEditKey(d.collection.editKey);
          setCollection(d.collection);
          setIsOwner(d.isOwner);
          setCommunity(d.community);
          setTitle(d.collection.title);
          setDescription(d.collection.description || '');
          setIsPublic(d.collection.isPublic);
          setPins(d.pins.map((p) => ({ ...p, localId: p.id })));
        } else {
          if (!communitySlug) throw new Error('Pick a community first.');
          const d = await api.communities.get(communitySlug);
          if (!alive) return;
          setCommunity(d.community);
        }
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug, communitySlug]);

  const flash = (msg) => { setSavedNote(msg); setTimeout(() => setSavedNote(null), 1800); };

  async function addPins(list) {
    setSaveError(null);
    const prepared = list.map((p, i) => ({
      title: p.title, titleEn: p.titleEn || '', desc: p.desc || '', history: p.history || '', funFact: p.funFact || '',
      year: p.year ?? null, lat: p.lat, lng: p.lng,
      color: p.color || PALETTE[(pins.length + i) % PALETTE.length],
      source: p.source || 'manual', sourceUrl: p.sourceUrl || null,
    }));
    if (isEdit) {
      try {
        const { pins: created } = await api.collections.addPins(slug, prepared, editKey);
        setPins((prev) => [...prev, ...created.map((p) => ({ ...p, localId: p.id }))]);
        flash(`Added ${created.length} ${created.length === 1 ? 'place' : 'places'}`);
      } catch (e) {
        setSaveError(e.message);
        throw e;
      }
    } else {
      setPins((prev) => [...prev, ...prepared.map((p) => ({ ...p, localId: newLocalId() }))]);
    }
  }

  function changePin(localId, patch) {
    setPins((prev) => prev.map((p) => (p.localId === localId ? { ...p, ...patch } : p)));
    dirtyRef.current.add(localId);
  }

  async function commitPin(localId) {
    if (!isEdit || !dirtyRef.current.has(localId)) return;
    const pin = pins.find((p) => p.localId === localId);
    if (!pin || !pin.id) return;
    dirtyRef.current.delete(localId);
    try {
      const { pin: saved } = await api.pins.update(pin.id, {
        title: pin.title, titleEn: pin.titleEn, desc: pin.desc, history: pin.history, funFact: pin.funFact,
        year: pin.year === '' ? null : pin.year, lat: pin.lat, lng: pin.lng, color: pin.color,
      }, editKey);
      setPins((prev) => prev.map((p) => (p.localId === localId ? { ...saved, localId } : p)));
      flash('Saved');
    } catch (e) {
      setSaveError(e.message);
      dirtyRef.current.add(localId);
    }
  }

  async function removePin(pin) {
    if (!window.confirm(`Remove “${pin.title}” from this collection?`)) return;
    if (isEdit && pin.id) {
      try { await api.pins.remove(pin.id, editKey); } catch (e) { setSaveError(e.message); return; }
    }
    setPins((prev) => prev.filter((p) => p.localId !== pin.localId));
    if (expanded === pin.localId) setExpanded(null);
  }

  async function save() {
    if (!title.trim()) { setSaveError('Give your collection a title.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      if (isEdit) {
        for (const id of Array.from(dirtyRef.current)) await commitPin(id);
        const { collection: updated } = await api.collections.update(slug, { title: title.trim(), description: description.trim(), isPublic }, editKey);
        setCollection(updated);
        navigate(`/c/${slug}`);
      } else {
        const payload = {
          communitySlug: community.slug, title: title.trim(), description: description.trim(), isPublic,
          pins: pins.map((p) => ({ ...p, year: p.year === '' ? null : p.year })),
        };
        const d = await api.collections.create(payload);
        rememberEditKey(d.collection.slug, d.collection.editKey);
        navigate(`/c/${d.collection.slug}`);
      }
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCollection() {
    if (!window.confirm(`Delete “${collection.title}” and all ${pins.length} of its places? This cannot be undone.`)) return;
    try {
      await api.collections.remove(slug);
      forgetEditKey(slug);
      navigate(`/community/${community.slug}`);
    } catch (e) {
      setSaveError(e.message);
    }
  }

  const backTo = isEdit ? `/c/${slug}` : community ? `/community/${community.slug}` : '/';

  if (loading) return <Page><TopNav back={backTo} title="…" /><Spinner /></Page>;
  if (error) return <Page><TopNav back={backTo} title={isEdit ? 'Edit collection' : 'New collection'} /><ErrorText>{error}</ErrorText></Page>;

  return (
    <Page>
      <TopNav
        back={backTo}
        title={isEdit ? 'Edit collection' : 'New collection'}
        subtitle={community?.name}
        right={isEdit && <Button small variant="ghost" onClick={() => setShowShare(true)}>Share</Button>}
      />

      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`e.g. Old ${community?.name?.split(' ').pop() || 'town'} walking tour`} maxLength={140} />
      </Field>
      <Field label="Description" hint="What ties these places together? Shown on the collection's title screen.">
        <TextArea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      </Field>
      <Toggle checked={isPublic} onChange={setIsPublic} label={isPublic ? `Listed on the ${community?.name} community page` : 'Unlisted — only people with the link can open it'} />

      <SectionTitle right={<span style={styles.count}>{pins.length}</span>}>Places</SectionTitle>
      <div style={styles.actions}>
        <Button variant="ghost" small onClick={() => { setShowImport((v) => !v); setShowAdd(false); }}>⇪ Import from Google Maps</Button>
        <Button variant="ghost" small onClick={() => { setShowAdd((v) => !v); setShowImport(false); }}>+ Add a place</Button>
      </div>

      {showImport && (
        <ImportPanel
          community={community}
          onAdd={async (list) => { await addPins(list); setShowImport(false); }}
          onClose={() => setShowImport(false)}
        />
      )}
      {showAdd && (
        <AddPinForm
          community={community}
          onAdd={async (pin) => { await addPins([pin]); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}

      <ErrorText>{saveError}</ErrorText>
      {savedNote && <div style={styles.saved}>✓ {savedNote}</div>}

      {pins.length === 0 && !showImport && !showAdd && (
        <Muted style={{ margin: '6px 0 12px' }}>No places yet. Import your Google Maps pins or add places one by one.</Muted>
      )}
      {pins.map((pin) => (
        <PinRow
          key={pin.localId}
          pin={pin}
          open={expanded === pin.localId}
          onToggle={() => {
            if (expanded === pin.localId) { commitPin(pin.localId); setExpanded(null); }
            else { if (expanded) commitPin(expanded); setExpanded(pin.localId); }
          }}
          onChange={(patch) => changePin(pin.localId, patch)}
          onBlur={() => commitPin(pin.localId)}
          onRemove={() => removePin(pin)}
        />
      ))}

      <div style={styles.footer}>
        <Button onClick={save} disabled={saving} style={{ width: '100%' }}>
          {saving ? 'Saving…' : isEdit ? 'Done' : pins.length ? `Create collection with ${pins.length} ${pins.length === 1 ? 'place' : 'places'}` : 'Create empty collection'}
        </Button>
        {isEdit && isOwner && (
          <Button variant="danger" small onClick={deleteCollection} style={{ width: '100%', marginTop: 10 }}>Delete collection</Button>
        )}
        {isEdit && !isOwner && (
          <Muted style={{ marginTop: 10, textAlign: 'center', fontSize: 12 }}>You are editing with a shared edit link. Only the owner can delete the collection.</Muted>
        )}
      </div>

      {showShare && collection && <ShareSheet collection={{ ...collection, editKey }} canEdit onClose={() => setShowShare(false)} />}
    </Page>
  );
}

function PinRow({ pin, open, onToggle, onChange, onBlur, onRemove }) {
  const hasLoc = pin.lat != null && pin.lng != null;
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <button type="button" onClick={onToggle} style={styles.rowHead}>
        <span style={{ ...styles.dot, background: pin.color }} />
        <span style={styles.rowTitle}>{pin.title || 'Untitled place'}</span>
        <span style={styles.rowMeta}>{pin.year ?? '—'}</span>
        {!hasLoc && <Pill color="#ff8a80">no location</Pill>}
        <span style={styles.chev}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div style={styles.rowBody} onBlur={onBlur}>
          <Field label="Name"><Input value={pin.title} onChange={(e) => onChange({ title: e.target.value })} maxLength={200} /></Field>
          <div style={styles.twoCol}>
            <Field label="Year" hint="When this place's story begins">
              <Input type="number" value={pin.year ?? ''} onChange={(e) => onChange({ year: e.target.value === '' ? null : Number(e.target.value) })} placeholder="e.g. 1888" />
            </Field>
            <Field label="Colour">
              <input type="color" value={pin.color} onChange={(e) => onChange({ color: e.target.value })} style={styles.color} />
            </Field>
          </div>
          <Field label="Alternate name" hint="e.g. the name in another language"><Input value={pin.titleEn || ''} onChange={(e) => onChange({ titleEn: e.target.value })} maxLength={200} /></Field>
          <Field label="One-line description"><Input value={pin.desc || ''} onChange={(e) => onChange({ desc: e.target.value })} maxLength={2000} /></Field>
          <Field label="History"><TextArea value={pin.history || ''} onChange={(e) => onChange({ history: e.target.value })} maxLength={8000} /></Field>
          <Field label="Fun fact"><TextArea value={pin.funFact || ''} onChange={(e) => onChange({ funFact: e.target.value })} maxLength={2000} style={{ minHeight: 56 }} /></Field>
          <LocationFields pin={pin} onChange={onChange} />
          <div style={styles.rowFooter}>
            {pin.sourceUrl && <a href={pin.sourceUrl} target="_blank" rel="noreferrer" style={styles.srcLink}>↗ {pin.source === 'google' ? 'Google Maps' : 'Source'}</a>}
            <span style={{ flex: 1 }} />
            <Button variant="danger" small onClick={onRemove}>Remove</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function LocationFields({ pin, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const useHere = async () => {
    setBusy(true); setErr(null);
    try { const p = await getCurrentPosition(); onChange({ lat: p.lat, lng: p.lng }); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <>
      <div style={styles.twoCol}>
        <Field label="Latitude"><Input type="number" step="any" value={pin.lat ?? ''} onChange={(e) => onChange({ lat: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
        <Field label="Longitude"><Input type="number" step="any" value={pin.lng ?? ''} onChange={(e) => onChange({ lng: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: -6, marginBottom: 10 }}>
        <Button variant="ghost" small type="button" onClick={useHere} disabled={busy}>{busy ? '…' : '◎ Use my location'}</Button>
        {err && <span style={{ color: '#ff8a80', fontSize: 12 }}>{err}</span>}
      </div>
    </>
  );
}

function AddPinForm({ community, onAdd, onClose }) {
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [desc, setDesc] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const near = community ? { lat: community.lat, lng: community.lng } : undefined;

  const search = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setErr(null);
    try { setResults(await geocodeSearch(q.trim(), { near, limit: 5 })); }
    catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  };
  const useHere = async () => {
    setBusy(true); setErr(null);
    try { const p = await getCurrentPosition(); setLat(String(p.lat.toFixed(6))); setLng(String(p.lng.toFixed(6))); }
    catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    const la = Number(lat), ln = Number(lng);
    if (!title.trim()) return setErr('Give the place a name.');
    if (!Number.isFinite(la) || !Number.isFinite(ln) || lat === '' || lng === '') return setErr('Pick a location: search for it, use your GPS, or type coordinates.');
    setBusy(true); setErr(null);
    try {
      await onAdd({ title: title.trim(), year: year === '' ? null : Number(year), desc: desc.trim(), lat: la, lng: ln, source: 'manual' });
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  };

  return (
    <Card style={styles.panel}>
      <div style={styles.panelHead}><span style={styles.panelTitle}>Add a place</span><button style={styles.x} onClick={onClose}>×</button></div>
      <Field label="Name"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Old post office" autoFocus /></Field>
      <div style={styles.twoCol}>
        <Field label="Year"><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="1902" /></Field>
        <Field label="One-liner"><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What is it?" /></Field>
      </div>
      <div style={styles.label}>Location</div>
      <form onSubmit={search} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search near ${community?.name || 'here'}`} />
        <Button type="submit" variant="ghost" disabled={busy || !q.trim()}>Find</Button>
      </form>
      {results && (
        <div style={{ marginBottom: 8 }}>
          {results.length === 0 && <Muted>Nothing found. Try adding the town name.</Muted>}
          {results.map((r, i) => (
            <button key={i} type="button" style={styles.result} onClick={() => { setLat(String(r.lat)); setLng(String(r.lng)); if (!title) setTitle(r.name); setResults(null); }}>
              <div style={{ fontWeight: 600 }}>{r.name}</div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>{r.displayName}</div>
            </button>
          ))}
        </div>
      )}
      <div style={styles.twoCol}>
        <Field label="Latitude"><Input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} /></Field>
        <Field label="Longitude"><Input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button variant="ghost" small type="button" onClick={useHere} disabled={busy}>◎ Use my location</Button>
        <span style={{ flex: 1 }} />
        <Button type="button" onClick={submit} disabled={busy}>{busy ? '…' : 'Add place'}</Button>
      </div>
      <ErrorText>{err}</ErrorText>
    </Card>
  );
}

function ImportPanel({ community, onAdd, onClose }) {
  const [parsed, setParsed] = useState(null);
  const [err, setErr] = useState(null);
  const [geocoding, setGeocoding] = useState(null); // {done,total}
  const [adding, setAdding] = useState(false);
  const abortRef = useRef(null);
  const near = community ? { lat: community.lat, lng: community.lng } : undefined;

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setParsed(null);
    try { setParsed(await parseImportFile(file)); }
    catch (e2) { setErr(e2.message); }
    e.target.value = '';
  };

  const toggle = (localId) => setParsed((p) => ({ ...p, pins: p.pins.map((x) => (x.localId === localId ? { ...x, selected: !x.selected } : x)) }));
  const setAll = (sel) => setParsed((p) => ({ ...p, pins: p.pins.map((x) => ({ ...x, selected: sel })) }));

  const locate = async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const missing = parsed.pins.filter((p) => p.lat == null && p.selected);
    setGeocoding({ done: 0, total: missing.length });
    const updated = await geocodeMissing(parsed.pins.filter((p) => p.selected || p.lat != null), {
      near, signal: ctrl.signal,
      onProgress: (done, total, out) => { setGeocoding({ done, total }); setParsed((p) => ({ ...p, pins: p.pins.map((x) => out.find((o) => o.localId === x.localId) || x) })); },
    });
    setParsed((p) => ({ ...p, pins: p.pins.map((x) => updated.find((o) => o.localId === x.localId) || x) }));
    setGeocoding(null);
  };

  const ready = parsed ? parsed.pins.filter((p) => p.selected && p.lat != null) : [];
  const missing = parsed ? parsed.pins.filter((p) => p.selected && p.lat == null) : [];

  const add = async () => {
    setAdding(true); setErr(null);
    try { await onAdd(ready); }
    catch (e2) { setErr(e2.message); }
    finally { setAdding(false); }
  };

  return (
    <Card style={styles.panel}>
      <div style={styles.panelHead}><span style={styles.panelTitle}>Import from Google Maps</span><button style={styles.x} onClick={onClose}>×</button></div>
      {!parsed && (
        <>
          <Muted style={{ marginBottom: 10 }}>Get your pins out of Google Maps, then drop the file here:</Muted>
          <ol style={styles.steps}>
            <li><b>Saved lists</b> (Want to go, Favourites, your own lists): <a href="https://takeout.google.com/" target="_blank" rel="noreferrer" style={styles.a}>Google Takeout</a> → deselect all → tick <b>Saved</b> and <b>Maps (your places)</b> → export. You get one <code>.csv</code> per list plus <code>Saved Places.json</code>.</li>
            <li><b>My Maps</b>: open the map → ⋮ menu → <b>Export to KML/KMZ</b> → untick "Keep data up to date" → download the <code>.kml</code>.</li>
          </ol>
          <label style={styles.drop}>
            <input type="file" accept={ACCEPTED} onChange={onFile} style={{ display: 'none' }} />
            <span style={{ fontSize: 26 }}>⇪</span>
            <span>Choose a .csv, .json, .kml or .gpx file</span>
          </label>
        </>
      )}
      <ErrorText>{err}</ErrorText>
      {parsed && (
        <>
          <div style={styles.summary}>
            <span>{parsed.format} · {parsed.pins.length} places</span>
            <span style={{ flex: 1 }} />
            <button style={styles.linkBtn} onClick={() => setAll(true)}>all</button>
            <button style={styles.linkBtn} onClick={() => setAll(false)}>none</button>
            <button style={styles.linkBtn} onClick={() => setParsed(null)}>other file</button>
          </div>
          {missing.length > 0 && (
            <div style={styles.notice}>
              {missing.length} selected {missing.length === 1 ? 'place has' : 'places have'} a name but no coordinates (Google's list exports often omit them).
              {geocoding ? (
                <div style={{ marginTop: 6 }}>Looking up {geocoding.done}/{geocoding.total}… <button style={styles.linkBtn} onClick={() => abortRef.current?.abort()}>stop</button></div>
              ) : (
                <div style={{ marginTop: 6 }}><Button small variant="ghost" onClick={locate}>Find locations near {community?.name}</Button></div>
              )}
            </div>
          )}
          <div style={styles.list}>
            {parsed.pins.map((p) => (
              <label key={p.localId} style={{ ...styles.item, opacity: p.selected ? 1 : 0.45 }}>
                <input type="checkbox" checked={p.selected} onChange={() => toggle(p.localId)} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.itemTitle}>{p.title}</div>
                  <div style={styles.itemMeta}>
                    {p.lat != null ? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}${p.geocoded ? ' (looked up)' : ''}` : 'no coordinates'}
                    {p.year ? ` · ${p.year}` : ''}
                  </div>
                </span>
              </label>
            ))}
          </div>
          <Button onClick={add} disabled={adding || ready.length === 0} style={{ width: '100%', marginTop: 10 }}>
            {adding ? 'Adding…' : `Add ${ready.length} ${ready.length === 1 ? 'place' : 'places'}`}
          </Button>
          {missing.length > 0 && <Muted style={{ fontSize: 11, marginTop: 6 }}>Places without coordinates are skipped. You can set a year for each place after adding.</Muted>}
        </>
      )}
    </Card>
  );
}

const styles = {
  count: { fontFamily: fonts.mono, fontSize: 12, color: colors.textDim },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  saved: { fontFamily: fonts.mono, fontSize: 12, color: colors.greenLight, margin: '4px 0 8px' },
  footer: { marginTop: 24 },
  rowHead: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px',
    background: 'transparent', border: 'none', color: colors.text, cursor: 'pointer', textAlign: 'left',
  },
  dot: { width: 12, height: 12, borderRadius: '50%', flexShrink: 0 },
  rowTitle: { flex: 1, fontFamily: fonts.mono, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowMeta: { fontFamily: fonts.mono, fontSize: 12, color: colors.textDim },
  chev: { color: colors.textDim, fontSize: 12 },
  rowBody: { padding: '4px 14px 14px', borderTop: `1px solid ${colors.greenDark}` },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  color: { width: '100%', height: 42, border: `1px solid ${colors.blueDark}`, borderRadius: 10, background: 'transparent', padding: 2 },
  rowFooter: { display: 'flex', alignItems: 'center', gap: 8 },
  srcLink: { color: colors.accent, fontFamily: fonts.mono, fontSize: 12, textDecoration: 'none' },
  panel: { borderColor: colors.blue },
  panelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  panelTitle: { fontFamily: fonts.mono, fontWeight: 700, fontSize: 14, letterSpacing: 1 },
  x: { background: 'transparent', border: 'none', color: colors.textDim, fontSize: 22, cursor: 'pointer', lineHeight: 1 },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, marginBottom: 6 },
  result: { display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 4, background: 'rgba(255,255,255,0.05)', border: `1px solid ${colors.blueDark}`, borderRadius: 8, color: colors.text, cursor: 'pointer', fontFamily: fonts.sans, fontSize: 13 },
  steps: { paddingLeft: 18, fontSize: 13, lineHeight: 1.55, color: colors.text, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 },
  a: { color: colors.accent },
  drop: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '22px 12px',
    border: `1px dashed ${colors.green}`, borderRadius: 12, color: colors.green, cursor: 'pointer',
    fontFamily: fonts.mono, fontSize: 13,
  },
  summary: { display: 'flex', gap: 10, alignItems: 'center', fontFamily: fonts.mono, fontSize: 12, color: colors.textDim, marginBottom: 8 },
  linkBtn: { background: 'transparent', border: 'none', color: colors.accent, fontFamily: fonts.mono, fontSize: 12, cursor: 'pointer', padding: 0 },
  notice: { background: 'rgba(139,105,20,0.12)', border: `1px solid ${colors.brownDark}`, borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 8 },
  list: { maxHeight: 320, overflowY: 'auto', border: `1px solid ${colors.greenDark}`, borderRadius: 10 },
  item: { display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderBottom: `1px solid rgba(255,255,255,0.05)`, cursor: 'pointer' },
  itemTitle: { fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemMeta: { fontSize: 11, color: colors.textDim, fontFamily: fonts.mono },
};
