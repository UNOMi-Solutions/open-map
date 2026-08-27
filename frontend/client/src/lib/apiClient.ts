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

/** localStorage key for the logged-in user's JWT. */
const AUTH_TOKEN_KEY = "openmap_auth_token";

/** Persists (or clears) the JWT issued at login so the session survives refresh. */
export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // localStorage may be unavailable (private mode); auth simply won't persist.
  }
}

/** Returns the stored JWT, or null when the user isn't logged in. */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getApiHeaders(extra?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = import.meta.env.VITE_API_DEV_KEY?.trim();
  if (apiKey) headers["x-api-key"] = apiKey;
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    Object.assign(headers, extra as Record<string, string>);
  }
  return headers;
}

/** Reads a JSON error message from a failed response, falling back to status text. */
async function readError(res: Response): Promise<{ message: string; body: any }> {
  let body: any = null;
  let message = res.statusText;
  try {
    body = await res.json();
    message = body?.error || body?.message || message;
  } catch {
    // Non-JSON body; keep the status text.
  }
  return { message, body };
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

/** Error thrown by profile API helpers; exposes the backend error code + status. */
export class ApiError extends Error {
  status: number;
  code?: string;
  body: any;
  constructor(message: string, status: number, body: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.code;
    this.body = body;
  }
}

async function request<T>(method: string, path: string, payload?: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method,
    headers: getApiHeaders(),
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const { message, body } = await readError(res);
    throw new ApiError(message, res.status, body);
  }
  return res.json() as Promise<T>;
}

// ---- Saved map profiles ----

export interface SavedProfile {
  id: string;
  name: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProfilesResponse {
  profiles: SavedProfile[];
  plan: string;
  limit: number;
  count: number;
  remaining: number;
}

/** Fetches the current user (email, plan, verified) from the stored JWT. */
export function fetchMe(): Promise<{ user: { email: string; verified: boolean; plan: string | null } }> {
  return request("GET", "/api/v1/auth/me");
}

export function listProfiles(): Promise<ProfilesResponse> {
  return request("GET", "/api/v1/profiles");
}

export function createProfile(
  name: string,
  config: Record<string, unknown>
): Promise<{ profile: SavedProfile } & Omit<ProfilesResponse, "profiles">> {
  return request("POST", "/api/v1/profiles", { name, config });
}

export function updateProfile(
  id: string,
  data: { name?: string; config?: Record<string, unknown> }
): Promise<{ profile: SavedProfile } & Omit<ProfilesResponse, "profiles">> {
  return request("PUT", `/api/v1/profiles/${id}`, data);
}

export function deleteProfile(
  id: string
): Promise<{ success: boolean } & Omit<ProfilesResponse, "profiles">> {
  return request("DELETE", `/api/v1/profiles/${id}`);
}
