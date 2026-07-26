/**
 * Smart API Base URL Resolver & Fallback Fetcher for Leviathan AI.
 * Automatically resolves local vs 24x7 Render Cloud backend (https://leviathan-core.onrender.com).
 */

export function getApiBaseUrl(): string {
  // 1. Explicit environment variable set at build/runtime
  if (process.env.NEXT_PUBLIC_LEVIATHAN_API && process.env.NEXT_PUBLIC_LEVIATHAN_API.trim() !== "") {
    return process.env.NEXT_PUBLIC_LEVIATHAN_API.replace(/\/+$/, "");
  }

  if (typeof window === "undefined") {
    return "https://leviathan-core.onrender.com";
  }

  const hostname = window.location.hostname;

  // 2. If running locally
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:8000";
  }

  // 3. 24x7 Cloud Backend on Render
  return "https://leviathan-core.onrender.com";
}

export async function fetchApi(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const primaryBase = getApiBaseUrl();
  const primaryUrl = `${primaryBase}${cleanEndpoint}`;

  try {
    const res = await fetch(primaryUrl, options);
    return res;
  } catch (err) {
    console.warn(`Fetch to primary API (${primaryUrl}) encountered network issue. Trying fallbacks...`, err);

    // Fallback 1: Localhost 8000 if primary is cloud
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
