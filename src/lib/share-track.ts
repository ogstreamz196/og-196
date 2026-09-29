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

  // Inside the phone app the web share sheet can't send files, so share the MP3
  // the native layer already downloaded (or write the bytes we have).
  let isNative = false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    isNative = Capacitor.isNativePlatform();
    if (isNative && Capacitor.isPluginAvailable("Share")) {
      const [{ Filesystem, Directory }, { Share }, { nativeSavedFiles, safeFileName }] =
        await Promise.all([
          import("@capacitor/filesystem"),
          import("@capacitor/share"),
          import("@/lib/download-file"),
        ]);
      let uri = nativeSavedFiles.get(filename);
      if (!uri && blob) {
        const data = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
          r.onerror = () => reject(r.error);
          r.readAsDataURL(blob);
        });
        const saved = await Filesystem.writeFile({
          path: safeFileName(filename),
          data,
          directory: Directory.Cache,
        });
        uri = saved.uri;
      }
      if (uri) {
        toast.success("Track saved to your phone (Documents › OG BOT)");
        await Share.share({ title, text, files: [uri], dialogTitle: "Share your track" });
        return;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel/i.test(msg)) return;
    console.warn("[shareTrack] native share failed", e);
  }
  if (isNative) {
    toast.error("Couldn't save the track — check your connection and try again");
    return;
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
