"use client";

// Shared by both drive-picker.ts and photos-picker.ts — loads Google
// Identity Services once, wraps the OAuth token flow, and caches the token
// in an in-memory module-scoped variable only (never localStorage/
// sessionStorage — this is a live, sensitive-scope token; Web Storage would
// make it readable by any XSS on the page, which a module-private variable
// isn't).

/// <reference path="./google-globals.d.ts" />

type GoogleImportConfig = { clientId: string; apiKey: string; projectNumber: string };

let gsiLoadPromise: Promise<void> | null = null;

function loadGsi(): Promise<void> {
  if (gsiLoadPromise) return gsiLoadPromise;
  gsiLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Couldn't load Google Identity Services."));
    document.head.appendChild(script);
  });
  return gsiLoadPromise;
}

let configPromise: Promise<GoogleImportConfig> | null = null;

export async function getGoogleImportConfig(): Promise<GoogleImportConfig> {
  if (!configPromise) {
    configPromise = fetch("/api/config/google-import").then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // Don't cache a failure — a transient network error shouldn't
        // permanently poison every later attempt this session.
        configPromise = null;
        throw new Error(body.error ?? "Google import isn't available.");
      }
      return res.json();
    });
  }
  return configPromise;
}

let cachedToken: { token: string; expiresAt: number; scopes: Set<string> } | null = null;

export async function getGoogleAccessToken(scopes: string[]): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000 && scopes.every((s) => cachedToken!.scopes.has(s))) {
    return cachedToken.token;
  }

  await loadGsi();
  const config = await getGoogleImportConfig();
  const hadPriorToken = cachedToken !== null;

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: scopes.join(" "),
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error === "popup_closed_by_user" ? "Cancelled." : "Google sign-in failed."));
          return;
        }
        cachedToken = {
          token: response.access_token,
          expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
          scopes: new Set(scopes),
        };
        resolve(response.access_token);
      },
      error_callback: (err) => reject(new Error(err?.message ?? "Google sign-in failed.")),
    });
    // Only force the explicit consent screen on this browser session's very
    // first request — renewals (or requests for an additional scope after
    // one's already been granted) use a silent/empty prompt so Google can
    // skip straight to issuing a token when it already has authorization.
    client.requestAccessToken({ prompt: hadPriorToken ? "" : "consent" });
  });
}
