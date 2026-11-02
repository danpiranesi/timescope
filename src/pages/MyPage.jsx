import React, { useEffect, useState } from 'react';
import { api, rememberEditKey } from '../api';
import { navigate } from '../router';
import { Page, TopNav, Button, Card, Input, Muted, ErrorText, Spinner, SectionTitle } from '../components/ui';
import { CollectionCard } from './CommunityPage';
import ShareSheet from '../components/ShareSheet';
import { fonts } from '../theme';

export default function MyPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [sharing, setSharing] = useState(null);

  useEffect(() => {
    api.me.get()
      .then((d) => {
        setData(d);
        setName(d.explorer.displayName);
        d.collections.forEach((c) => rememberEditKey(c.slug, c.editKey));
      })
      .catch((e) => setError(e.message));
  }, []);

  async function saveName(e) {
    e.preventDefault();
    if (!name.trim() || name.trim() === data.explorer.displayName) return;
    setSavingName(true);
    try {
      const { explorer } = await api.me.update({ displayName: name.trim() });
      setData((d) => ({ ...d, explorer }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingName(false);
    }
  }

  return (
    <Page>
      <TopNav back="/" title="My collections" />
      <ErrorText>{error}</ErrorText>
      {!data && !error && <Spinner />}
      {data && (
        <>
          <Card>
            <form onSubmit={saveName} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={styles.label}>Your name on this device</div>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
              </div>
              <Button type="submit" variant="ghost" small disabled={savingName || !name.trim() || name.trim() === data.explorer.displayName} style={{ marginTop: 18 }}>
                Save
              </Button>
            </form>
            <Muted style={{ marginTop: 8, fontSize: 12 }}>
              Timescope has no accounts. Your collections are tied to this browser, and edit links let you (or friends) edit from other devices.
            </Muted>
          </Card>

          <SectionTitle>Collections you made</SectionTitle>
          {data.collections.length === 0 && (
            <Muted>You have not made a collection yet. Pick a community on the home page to start one.</Muted>
          )}
          {data.collections.map((c) => (
            <CollectionCard
              key={c.id}
              c={c}
              actions={
                <>
                  <Button small onClick={() => navigate(`/c/${c.slug}`)}>Explore</Button>
                  <Button small variant="ghost" onClick={() => navigate(`/c/${c.slug}/edit`)}>Edit</Button>
                  <Button small variant="ghost" onClick={() => setSharing(c)}>Share</Button>
                </>
              }
            />
          ))}
        </>
      )}
      {sharing && <ShareSheet collection={sharing} canEdit onClose={() => setSharing(null)} />}
    </Page>
  );
}

const styles = {
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.6, marginBottom: 6 },
};
