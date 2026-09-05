/**
 * Force a real file download instead of letting the browser navigate to (and
 * play) the signed URL in a new tab.
 *
 * `<a download>` is ignored for cross-origin URLs, so we fetch the bytes and
 * hand the browser a same-origin blob. If the fetch fails (CORS, offline) we
 * fall back to a direct anchor click — the signed URL already carries a
 * `Content-Disposition: attachment` header from the `song-url` function.
 *
 * Returns the downloaded bytes when available so callers can hand the same
 * file straight to the native share sheet.
 */
export async function downloadFile(url: string, filename: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    triggerAnchor(objectUrl, filename);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return blob;
  } catch {
    triggerAnchor(url, filename);
    return null;
  }
}

function triggerAnchor(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
