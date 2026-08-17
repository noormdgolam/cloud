"use client";

import { useEffect, useRef } from "react";

/**
 * Injects the Adsterra ad scripts on a share-link page. Only ever rendered
 * by the caller when the FILE OWNER has opted into the creator-earnings
 * program (never for a plain free or paying user's shares) — this
 * component itself doesn't know or care why, it just mounts the scripts
 * when asked to.
 *
 * Reads script URLs from NEXT_PUBLIC_* env vars rather than hardcoding
 * them, since the real Adsterra zone URLs aren't issued until the ad
 * account/zone setup is finished. Renders nothing if unset, so this is
 * silently inert until those are configured — never breaks the page.
 */
export function AdSlot() {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const sources = [
      process.env.NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC,
      process.env.NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC,
    ].filter((src): src is string => Boolean(src));

    const scripts = sources.map((src) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      document.body.appendChild(script);
      return script;
    });

    return () => {
      scripts.forEach((script) => script.remove());
    };
  }, []);

  return null;
}
