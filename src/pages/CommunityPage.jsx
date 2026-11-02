import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { navigate } from '../router';
import { Page, TopNav, Button, Card, Muted, ErrorText, Spinner, SectionTitle, Pill } from '../components/ui';
import { colors, fonts } from '../theme';

export default function CommunityPage({ slug }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    api.communities.get(slug).then(setData).catch((e) => setError(e.message));
  }, [slug]);

  if (error) return <Page><TopNav back="/" title="Community" /><ErrorText>{error}</ErrorText></Page>;
  if (!data) return <Page><TopNav back="/" title="…" /><Spinner /></Page>;

  const { community, collections } = data;
  return (
    <Page>
      <TopNav back="/" title={community.name} subtitle={community.region} />

      <div style={styles.actions}>
        <Button onClick={() => navigate(`/new?community=${community.slug}`)} style={{ flex: 1 }}>+ New collection</Button>
        <Button variant="ghost" onClick={() => navigate(`/new?community=${community.slug}&import=1`)} style={{ flex: 1 }}>Import Google Maps pins</Button>
      </div>

      <SectionTitle>Collections in {community.name}</SectionTitle>
      {collections.length === 0 && (
        <Card>
          <div style={styles.emptyTitle}>Nothing here yet</div>
          <Muted>Be the first to map the history of {community.name}. Make a collection by hand or import the pins you have saved in Google Maps.</Muted>
        </Card>
      )}
      {collections.map((c) => <CollectionCard key={c.id} c={c} />)}
    </Page>
  );
}

export function CollectionCard({ c, actions }) {
  return (
    <Card onClick={actions ? undefined : () => navigate(`/c/${c.slug}`)}>
      <div style={styles.cardRow}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={styles.cardTitle}>{c.title}</div>
          {c.description && <Muted style={styles.cardDesc}>{c.description}</Muted>}
          <div style={styles.meta}>
            <span>{c.pinCount ?? 0} {c.pinCount === 1 ? 'place' : 'places'}</span>
            {c.ownerName && <span>· by {c.ownerName}</span>}
            {c.communityName && actions && <span>· {c.communityName}</span>}
          </div>
        </div>
        <div style={styles.pills}>
          {c.isMine && <Pill color={colors.brownLight}>Yours</Pill>}
          {c.isPublic === false && <Pill color={colors.textDim}>Unlisted</Pill>}
        </div>
      </div>
      {actions && <div style={styles.actionRow}>{actions}</div>}
    </Card>
  );
}

const styles = {
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  cardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontFamily: fonts.mono, fontWeight: 700, fontSize: 16, marginBottom: 4 },
  cardDesc: { fontSize: 13, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  meta: { display: 'flex', gap: 6, fontFamily: fonts.mono, fontSize: 11, color: colors.textDim, flexWrap: 'wrap' },
  pills: { display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' },
  emptyTitle: { fontFamily: fonts.mono, fontWeight: 700, fontSize: 15, marginBottom: 6 },
  actionRow: { display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' },
};
