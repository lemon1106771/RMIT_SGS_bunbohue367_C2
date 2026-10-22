/** Tide's DPoP secureFetch needs an absolute URL to sign as `htu`. */
export function ownApiUrl(path: string, origin: string): string {
  const url = new URL(path, origin);
  if (url.origin !== origin || !url.pathname.startsWith("/api/")) {
    throw new Error("API calls must use a same-origin /api/ path");
  }
  return url.href;
}
