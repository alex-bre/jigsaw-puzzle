/**
 * Minimal hash router: '#/pictures/animals' → { name: 'category', params: ['animals'] }.
 * Hash URLs work from the file system and inside the Capacitor WebView without server config.
 */
export type Route =
  | { name: 'home' }
  | { name: 'pictures' }
  | { name: 'category'; categoryId: string }
  | { name: 'setup'; imageId: string }
  | { name: 'play' }
  | { name: 'settings' }
  | { name: 'credits' };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'pictures':
      return parts[1] ? { name: 'category', categoryId: parts[1] } : { name: 'pictures' };
    case 'setup':
      return parts[1] ? { name: 'setup', imageId: parts[1] } : { name: 'pictures' };
    case 'play':
      return { name: 'play' };
    case 'settings':
      return { name: 'settings' };
    case 'credits':
      return { name: 'credits' };
    default:
      return { name: 'home' };
  }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'pictures':
      return '#/pictures';
    case 'category':
      return `#/pictures/${encodeURIComponent(route.categoryId)}`;
    case 'setup':
      return `#/setup/${encodeURIComponent(route.imageId)}`;
    default:
      return `#/${route.name}`;
  }
}

/** Where "Back" leads from each screen. `setupParent` is the category the picture came from. */
export function parentRoute(route: Route, setupParent: Route): Route | null {
  switch (route.name) {
    case 'home':
      return null;
    case 'category':
      return { name: 'pictures' };
    case 'setup':
      return setupParent;
    case 'credits':
      return { name: 'settings' };
    default:
      return { name: 'home' };
  }
}

export function navigate(route: Route, { replace = false } = {}): void {
  const hash = routeToHash(route);
  if (replace) history.replaceState(null, '', hash);
  else if (location.hash !== hash) history.pushState(null, '', hash);
  window.dispatchEvent(new Event('routechange'));
}

export function onRouteChange(handler: (route: Route) => void): void {
  const fire = () => handler(parseRoute(location.hash));
  window.addEventListener('popstate', fire);
  window.addEventListener('routechange', fire);
}
