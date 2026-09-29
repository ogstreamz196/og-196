import { toast } from "sonner";

const SITE_URL = "https://www.ogstreamz.co.uk";

/**
 * Open the device share sheet for a finished track.
 *
 * Preference order:
 *  1. Share the actual audio file (WhatsApp / Messages / AirDrop receive the MP3)
 *  2. Share a link (site link — signed audio URLs expire)
 *  3. Copy the link to the clipboard as a last resort
 */
export async function shareTrack({
  title,
  blob,
  filename,
  url = SITE_URL,
}: {
  title: string;
  blob?: Blob | null;
  filename: string;
  url?: string;
}): Promise<void> {
  const text = `🎧 "${title}" — made with OG Bot on OG Streamz`;
  const nav = typeof navigator !== "undefined" ? navigator : undefined;

  // Inside the phone app the web share sheet can't send files, so save the MP3
  // to the app cache and open the native Android/iOS share sheet with it.
  if (blob) {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Share")) {
        const [{ Filesystem, Directory }, { Share }] = await Promise.all([
          import("@capacitor/filesystem"),
          import("@capacitor/share"),
        ]);
        const data = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
          r.onerror = () => reject(r.error);
          r.readAsDataURL(blob);
        });
        const safeName = filename.replace(/[^\w.\- ]+/g, "_") || "og-track.mp3";
        const saved = await Filesystem.writeFile({
          path: safeName,
          data,
          directory: Directory.Cache,
        });
        await Share.share({ title, text, files: [saved.uri], dialogTitle: "Share your track" });
        return;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/cancel/i.test(msg)) return;
    }
  }

  try {
    if (blob && nav?.share && typeof nav.canShare === "function") {
      const file = new File([blob], filename, { type: blob.type || "audio/mpeg" });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title, text });
        return;
      }
    }
    if (nav?.share) {
      await nav.share({ title, text, url });
      return;
    }
  } catch (e) {
    // User dismissed the sheet — that is not an error worth shouting about.
    if (e instanceof DOMException && e.name === "AbortError") return;
  }

  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast.success("Share link copied — paste it anywhere");
  } catch {
    toast("Sharing isn't supported on this device");
  }
}
