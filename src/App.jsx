import React from 'react';
import { useLocation, matchRoute } from './router';
import HomePage from './pages/HomePage';
import CommunityPage from './pages/CommunityPage';
import CollectionPage from './pages/CollectionPage';
import EditorPage from './pages/EditorPage';
import MyPage from './pages/MyPage';
import { Page, TopNav, Button } from './components/ui';
import { navigate } from './router';

export default function App() {
  const { pathname, search } = useLocation();
  let m;

  if (pathname === '/' || pathname === '') return <HomePage />;
  if (pathname === '/me') return <MyPage />;
  if (pathname === '/new') return <EditorPage key="new" communitySlug={search.get('community')} openImport={search.get('import') === '1'} />;
  if ((m = matchRoute('/community/:slug', pathname))) return <CommunityPage slug={m.slug} />;
  if ((m = matchRoute('/c/:slug/edit', pathname))) return <EditorPage key={m.slug} slug={m.slug} />;
  if ((m = matchRoute('/c/:slug', pathname))) return <CollectionPage key={m.slug} slug={m.slug} />;

  return (
    <Page>
      <TopNav back="/" title="Not found" />
      <p>There is nothing at this address.</p>
      <Button variant="ghost" onClick={() => navigate('/')} style={{ marginTop: 12 }}>Back to communities</Button>
    </Page>
  );
}
