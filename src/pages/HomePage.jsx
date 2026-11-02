import React, { useEffect, useState } from 'react';
import { api, geocodeSearch, geocodeReverse, getCurrentPosition } from '../api';
import { navigate, Link } from '../router';
import { Page, Button, Card, Input, Muted, ErrorText, Spinner, SectionTitle, Pill } from '../components/ui';
import { colors, fonts } from '../theme';

export default function HomePage() {
  const [all, setAll] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [q, setQ] = useState('');
  const [places, setPlaces] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [locating, setLocating] = useState(false);
  const [nearby, setNearby] = useState(null);
  const [here, setHere] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.communities.all().then((d) => setAll(d.communities)).catch((e) => setLoadError(e.message));
  }, []);

  async function locate() {
    setLocating(true);
    setSearchError(null);
    try {
      const pos = await getCurrentPosition();
      const [near, place] = await Promise.all([
        api.communities.nearby(pos.lat, pos.lng),
        geocodeReverse(pos.lat, pos.lng).catch(() => null),
      ]);
      setNearby(near.communities);
      setHere(place ? { ...place, name: place.locality, lat: pos.lat, lng: pos.lng } : { name: 'My location', region: '', lat: pos.lat, lng: pos.lng });
    } catch (e) {
      setSearchError(e.message);
    } finally {
      setLocating(false);
    }
  }

  async function search(e) {
    e?.preventDefault();
    const term = q.trim();
    if (!term) return;
    setSearching(true);
    setSearchError(null);
    setPlaces(null);
    try {
      const results = await geocodeSearch(term, { limit: 6 });
      setPlaces(results.filter((r) => ['city', 'town', 'village', 'suburb', 'hamlet', 'municipality', 'administrative', 'county', 'neighbourhood', 'quarter', 'island'].includes(r.type) || true));
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function choose(place) {
    setCreating(true);
    try {
      const { community } = await api.communities.create({ name: place.name, region: place.region, lat: place.lat, lng: place.lng });
      navigate(`/community/${community.slug}`);
    } catch (err) {
      setSearchError(err.message);
      setCreating(false);
    }
  }

  const matching = all && q.trim() ? all.filter((c) => (c.name + ' ' + c.region).toLowerCase().includes(q.trim().toLowerCase())) : [];

  return (
    <Page>
      <div style={styles.hero}>
        <div style={styles.logo}>⊙</div>
        <h1 style={styles.title}>TIMESCOPE</h1>
        <p style={styles.tagline}>explore the layers of history around you</p>
      </div>

      <SectionTitle>Find your community</SectionTitle>
      <Button onClick={locate} disabled={locating} style={{ width: '100%' }}>
        {locating ? 'Locating…' : '◎ Use my location'}
      </Button>

      {nearby && (
        <div style={{ marginTop: 14 }}>
          {nearby.length > 0 ? (
            <>
              <Muted style={{ marginBottom: 8 }}>Communities near you</Muted>
              {nearby.map((c) => <CommunityCard key={c.id} c={c} />)}
            </>
          ) : (
            <Muted style={{ marginBottom: 8 }}>No Timescope community near you yet.</Muted>
          )}
          {here && (
            <Card onClick={() => !creating && choose(here)} style={styles.newCard}>
              <div style={styles.cardTitle}>+ Start a community for {here.name}</div>
              <Muted>{here.region || `${here.lat.toFixed(3)}, ${here.lng.toFixed(3)}`}</Muted>
            </Card>
          )}
        </div>
      )}

      <form onSubmit={search} style={styles.searchRow}>
        <Input placeholder="Search a town, city or neighbourhood" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="ghost" disabled={searching || !q.trim()}>{searching ? '…' : 'Go'}</Button>
      </form>
      <ErrorText>{searchError}</ErrorText>

      {matching.length > 0 && (
        <>
          <Muted style={{ marginBottom: 8 }}>Existing communities</Muted>
          {matching.map((c) => <CommunityCard key={c.id} c={c} />)}
        </>
      )}
      {places && (
        <>
          <Muted style={{ margin: '10px 0 8px' }}>{places.length ? 'Places on the map' : 'No places found. Try another spelling.'}</Muted>
          {places.map((p, i) => (
            <Card key={i} onClick={() => !creating && choose(p)}>
              <div style={styles.cardTitle}>{p.name}</div>
              <Muted style={{ fontSize: 12 }}>{p.displayName}</Muted>
            </Card>
          ))}
        </>
      )}

      <SectionTitle right={<Link to="/me" style={styles.meLink}>My collections ›</Link>}>All communities</SectionTitle>
      {loadError && <ErrorText>{loadError}</ErrorText>}
      {!all && !loadError && <Spinner />}
      {all && all.length === 0 && <Muted>No communities yet. Be the first — search for your town above.</Muted>}
      {all && all.map((c) => <CommunityCard key={c.id} c={c} />)}

      <p style={styles.footer}>Point your phone at the past · timescope</p>
    </Page>
  );
}

export function CommunityCard({ c }) {
  return (
    <Card onClick={() => navigate(`/community/${c.slug}`)}>
      <div style={styles.cardRow}>
        <div style={{ minWidth: 0 }}>
          <div style={styles.cardTitle}>{c.name}</div>
          <Muted style={{ fontSize: 12 }}>{c.region}{c.distanceKm != null ? ` · ${c.distanceKm} km away` : ''}</Muted>
        </div>
        <Pill>{c.collectionCount ?? 0} {c.collectionCount === 1 ? 'collection' : 'collections'}</Pill>
      </div>
    </Card>
  );
}

const styles = {
  hero: { textAlign: 'center', padding: '28px 0 10px' },
  logo: { fontSize: 44, color: colors.accent, fontFamily: fonts.mono, fontWeight: 700, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: 800, letterSpacing: 6, fontFamily: fonts.mono, marginBottom: 6 },
  tagline: { fontSize: 13, color: colors.textDim, fontFamily: fonts.mono, letterSpacing: 1 },
  searchRow: { display: 'flex', gap: 8, marginTop: 14, marginBottom: 6 },
  cardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  cardTitle: { fontFamily: fonts.mono, fontWeight: 700, fontSize: 15, marginBottom: 2 },
  newCard: { borderStyle: 'dashed', borderColor: colors.green },
  meLink: { fontFamily: fonts.mono, fontSize: 12, color: colors.textDim },
  footer: { textAlign: 'center', color: colors.textDim, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, marginTop: 36 },
};
