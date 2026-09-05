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
