/** Base URL for the OpenMap backend API (Cloud Run in prod, local in dev). */
export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_LINK?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return "http://localhost:8080";
}

/** Build a full API URL from a path such as `/api/v1/crime/murderByState`. */
export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalized}`;
}

export function getApiHeaders(extra?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = import.meta.env.VITE_API_DEV_KEY?.trim();
  if (apiKey) headers["x-api-key"] = apiKey;
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    Object.assign(headers, extra as Record<string, string>);
  }
  return headers;
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "GET",
    headers: getApiHeaders(init?.headers),
    ...init,
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
