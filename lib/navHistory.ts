// Signed-in pages on this tab's history since the last full load. Module state survives
// client-side navigation and resets on reload, which is when browser history becomes unknown.
const visited: string[] = [];

/** Record a page view. Returning to the previous page counts as going back. */
export function trackVisit(path: string): void {
  if (visited.at(-1) === path) return;          // same page again (dev StrictMode runs effects twice)
  if (visited.at(-2) === path) visited.pop();   // came back, via our button or the browser's
  else visited.push(path);
}

/** True when Back can safely use browser history without leaving the app. */
export const canGoBack = (): boolean => visited.length > 1;

/** Forget the history (sign-in pages, or after jumping up to a parent page). */
export function resetVisits(): void {
  visited.length = 0;
}
