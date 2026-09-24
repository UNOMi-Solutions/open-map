import { getApiBaseUrl, setAuthToken, type AccountUser } from "@/lib/apiClient";

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

type GoogleCodeClient = {
  requestCode: () => void;
};

type GoogleIdentityApi = {
  accounts: {
    oauth2: {
      initCodeClient: (config: {
        client_id: string;
        scope: string;
        ux_mode?: "popup" | "redirect";
        callback: (response: { code?: string; error?: string; error_description?: string }) => void;
        error_callback?: (error: { type?: string; message?: string }) => void;
      }) => GoogleCodeClient;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

let gisLoad: Promise<void> | null = null;

function getGoogleClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || "";
}

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoad) return gisLoad;

  gisLoad = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Sign-In.")), {
        once: true,
      });
      if (window.google?.accounts?.oauth2) resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoad = null;
      reject(new Error("Failed to load Google Sign-In."));
    };
    document.head.appendChild(script);
  });

  return gisLoad;
}

/** Start downloading the GIS script so the popup is ready when the user clicks. */
export function preloadGoogleSignIn(): void {
  if (!getGoogleClientId()) return;
  void loadGis().catch(() => {
    // The click handler surfaces a real error if GIS never loads.
  });
}

function requestGoogleAuthCode(): Promise<string> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    console.warn("VITE_GOOGLE_CLIENT_ID is missing from frontend/.env");
    return Promise.reject(
      new Error("Google Sign-In is not available yet. Please sign in with email, or try again later.")
    );
  }

  return loadGis().then(
    () =>
      new Promise<string>((resolve, reject) => {
        if (!window.google?.accounts?.oauth2) {
          reject(new Error("Google Sign-In failed to initialize. Please refresh and try again."));
          return;
        }

        const client = window.google.accounts.oauth2.initCodeClient({
          client_id: clientId,
          scope: "openid email profile",
          ux_mode: "popup",
          callback: (response) => {
            if (response.code) {
              resolve(response.code);
              return;
            }
            reject(
              new Error(
                response.error_description ||
                  response.error ||
                  "Google sign-in was cancelled."
              )
            );
          },
          error_callback: (error) => {
            if (error?.type === "popup_closed") {
              reject(new Error("Google sign-in was cancelled."));
              return;
            }
            reject(new Error(error?.message || "Google sign-in failed. Please try again."));
          },
        });

        client.requestCode();
      })
  );
}

export async function signInWithGoogle(): Promise<{ token: string; user: AccountUser }> {
  const code = await requestGoogleAuthCode();
  const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || "Google sign-in failed. Please try again.");
  }
  if (!data?.token || !data?.user?.email) {
    throw new Error("Google sign-in failed. Please try again.");
  }

  setAuthToken(data.token);
  return { token: data.token, user: data.user as AccountUser };
}
