/**
 * Click-to-listen deep links.
 *
 * The only authority for "play this song" is the real external service — we
 * never fabricate stream URLs. Spotify's public search deep link works
 * without auth and always lands on the real catalog results for the query.
 */
export function spotifySearchUrl(title: string, artist?: string | null): string {
  const query = [artist?.trim(), title.trim()].filter(Boolean).join(" ");
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
}
