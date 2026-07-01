"use client";

import { useEffect } from "react";

// Registers the service worker (/sw.js) once, after load. Guarded to
// production + secure contexts (https / localhost) so the dev server — which
// serves un-fingerprinted HMR assets — is never intercepted by a cached SW.
// Renders nothing.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // isSecureContext is true for https and localhost; false on plain http.
    if (!window.isSecureContext) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* best-effort: SW registration failure must never break the app */
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
