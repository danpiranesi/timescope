import React, { useEffect, useReducer } from 'react';

const listeners = new Set();

export function navigate(to, { replace = false } = {}) {
  window.history[replace ? 'replaceState' : 'pushState'](null, '', to);
  listeners.forEach((l) => l());
  window.scrollTo(0, 0);
}

export function useLocation() {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    window.addEventListener('popstate', force);
    return () => {
      listeners.delete(force);
      window.removeEventListener('popstate', force);
    };
  }, []);
  return {
    pathname: window.location.pathname,
    search: new URLSearchParams(window.location.search),
  };
}

/** Match '/c/:slug/edit' style patterns. Returns params or null. */
export function matchRoute(pattern, pathname) {
  const pp = pattern.split('/').filter(Boolean);
  const path = pathname.split('/').filter(Boolean);
  if (pp.length !== path.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(path[i]);
    else if (pp[i] !== path[i]) return null;
  }
  return params;
}

export function Link({ to, children, style, onClick, ...rest }) {
  return (
    <a
      href={to}
      style={{ color: 'inherit', textDecoration: 'none', ...style }}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onClick?.(e);
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
