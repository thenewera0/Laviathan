/**
 * Smart API Base URL Resolver & Fallback Fetcher for Leviathan AI.
 * Automatically resolves local vs Render Cloud vs custom host endpoints.
 */

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_LEVIATHAN_API || "http://localhost:8000";
  }

  // 1. Explicit environment variable set at build/runtime
  if (process.env.NEXT_PUBLIC_LEVIATHAN_API && process.env.NEXT_PUBLIC_LEVIATHAN_API.trim() !== "") {
    return process.env.NEXT_PUBLIC_LEVIATHAN_API.replace(/\/+$/, "");
  }

  const hostname = window.location.hostname;

  // 2. If running locally
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:8000";
  }

  // 3. If running on Render or hosted domain, use origin
  return window.location.origin.replace(/\/+$/, "");
}

export async function fetchApi(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const primaryBase = getApiBaseUrl();
  const primaryUrl = `${primaryBase}${cleanEndpoint}`;

  try {
    const res = await fetch(primaryUrl, options);
    return res;
  } catch (err) {
    console.warn(`Fetch to primary API (${primaryUrl}) encountered connection issue. Trying fallbacks...`, err);

    // Fallback 1: Relative path on current window origin
    if (typeof window !== "undefined" && primaryBase !== window.location.origin) {
      try {
        const fallbackUrl = `${window.location.origin}${cleanEndpoint}`;
        const res = await fetch(fallbackUrl, options);
        return res;
      } catch (e) {
        // Continue to fallback 2
      }
    }

    // Fallback 2: Localhost 8000
    if (primaryBase !== "http://localhost:8000") {
      try {
        const res = await fetch(`http://localhost:8000${cleanEndpoint}`, options);
        return res;
      } catch (e) {
        // Continue
      }
    }

    throw err;
  }
}
