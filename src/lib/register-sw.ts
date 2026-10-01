/**
 * The only place the app-shell service worker is registered. Caches built
 * assets on the device so the app opens fast; pages stay network-first.
 */
const SW_PATH = "/sw.js";

async function unregisterAppSw() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => (r.active ?? r.waiting ?? r.installing)?.scriptURL.endsWith(SW_PATH))
      .map((r) => r.unregister()),
  );
}

function refused(): boolean {
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  const blocked = ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"];
  if (blocked.some((d) => h === d || h.endsWith(`.${d}`))) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

export function registerAppServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (refused()) {
    void unregisterAppSw();
    return;
  }
  const go = () => navigator.serviceWorker.register(SW_PATH, { scope: "/" }).catch(() => {});
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
}
