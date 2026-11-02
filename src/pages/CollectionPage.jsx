import React, { useEffect, useState } from 'react';
import { api, rememberEditKey, storedEditKey } from '../api';
import { navigate, useLocation } from '../router';
import ExploreView from '../components/ExploreView';
import { Page, TopNav, ErrorText, Spinner, Button } from '../components/ui';

export default function CollectionPage({ slug }) {
  const { search } = useLocation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    const linkKey = search.get('edit');
    const key = linkKey || storedEditKey(slug);
    api.collections.get(slug, key)
      .then((d) => {
        if (d.canEdit && d.collection.editKey) rememberEditKey(slug, d.collection.editKey);
        if (linkKey) navigate(`/c/${slug}`, { replace: true });
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [slug]);

  if (error) {
    return (
      <Page>
        <TopNav back="/" title="Collection" />
        <ErrorText>{error}</ErrorText>
        <Button variant="ghost" onClick={() => navigate('/')}>Back to communities</Button>
      </Page>
    );
  }
  if (!data) return <Page><TopNav back="/" title="…" /><Spinner /></Page>;

  return (
    <ExploreView
      collection={data.collection}
      community={data.community}
      pins={data.pins}
      canEdit={data.canEdit}
      onEdit={() => navigate(`/c/${slug}/edit`)}
      backTo={`/community/${data.community.slug}`}
    />
  );
}
