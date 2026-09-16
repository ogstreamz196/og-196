#!/usr/bin/env node
/**
 * TikTok batch renderer.
 *
 * For every track a user has paid to unlock (coins or card) that has not been
 * rendered yet, this lays the track's audio over the standard background clip,
 * trims to 3 minutes with fades, and uploads the result to the "TikTok Ready"
 * folder in Google Drive. Rendered tracks are recorded in public.tiktok_renders
 * so a re-run never repeats work.
 *
 * Usage:  node scripts/tiktok-batch.mjs [--limit 5] [--dry]
 *
 * Requires in the environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * LOVABLE_API_KEY, GOOGLE_DRIVE_API_KEY. ffmpeg must be on PATH.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const run = promisify(execFile);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
const DRIVE_KEY = process.env.GOOGLE_DRIVE_API_KEY;

const DRIVE_API = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const DRIVE_UPLOAD = "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files";
const TIKTOK_FOLDER_ID = process.env.TIKTOK_FOLDER_ID || "1YI_kGqOHxj-OsiMj9rlDCsVj20Ur68u3";
const BASE_VIDEO = process.env.BASE_VIDEO || "/mnt/user-uploads/2026-09-16-190600331.mp4";
const AUDIO_BUCKET = process.env.AUDIO_BUCKET || "song-files";
const CLIP_SECONDS = Number(process.env.CLIP_SECONDS || 180);

const args = process.argv.slice(2);
const limit = Number(args[args.indexOf("--limit") + 1]) || 10;
const dry = args.includes("--dry");

function need(name, value) {
  if (!value) throw new Error(`Missing ${name} in the environment`);
  return value;
}

const driveHeaders = () => ({
  Authorization: `Bearer ${need("LOVABLE_API_KEY", LOVABLE_API_KEY)}`,
  "X-Connection-Api-Key": need("GOOGLE_DRIVE_API_KEY", DRIVE_KEY),
});

async function sb(pathAndQuery, init = {}) {
  const res = await fetch(`${need("SUPABASE_URL", SUPABASE_URL)}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: need("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY),
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function signedAudioUrl(audioPath) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${AUDIO_BUCKET}/${encodeURI(audioPath)}`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 3600 }),
    },
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`Sign ${res.status}: ${body}`);
  return `${SUPABASE_URL}/storage/v1${JSON.parse(body).signedURL}`;
}

async function uploadToDrive(filePath, name) {
  const size = (await stat(filePath)).size;
  const start = await fetch(`${DRIVE_UPLOAD}?uploadType=resumable&supportsAllDrives=true`, {
    method: "POST",
    headers: {
      ...driveHeaders(),
      "Content-Type": "application/json",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(size),
    },
    body: JSON.stringify({ name, parents: [TIKTOK_FOLDER_ID], mimeType: "video/mp4" }),
  });
  if (!start.ok) throw new Error(`Drive init ${start.status}: ${await start.text()}`);
  const location = start.headers.get("location") || start.headers.get("Location");
  if (!location) throw new Error("Drive upload session URL missing");

  const bytes = await readFile(filePath);
  const put = await fetch(location, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(size) },
    body: bytes,
  });
  if (!put.ok) throw new Error(`Drive upload ${put.status}: ${await put.text()}`);
  const file = await put.json();
  return { id: file.id, url: `https://drive.google.com/file/d/${file.id}/view` };
}

function safeName(title, id) {
  const base = (title || "ogbot-track")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${base || "ogbot-track"}-${id.slice(0, 8)}.mp4`;
}

async function renderOne(song, workdir) {
  const audioUrl = await signedAudioUrl(song.audio_path);
  const audioFile = path.join(workdir, `${song.id}.mp3`);
  const res = await fetch(audioUrl);
  if (!res.ok) throw new Error(`Audio download ${res.status}`);
  await writeFile(audioFile, Buffer.from(await res.arrayBuffer()));

  const out = path.join(workdir, safeName(song.title, song.id));
  const fadeOutAt = Math.max(CLIP_SECONDS - 4, 1);
  await run(
    "ffmpeg",
    [
      "-y",
      "-stream_loop", "-1", "-i", BASE_VIDEO,
      "-i", audioFile,
      "-t", String(CLIP_SECONDS),
      "-map", "0:v:0", "-map", "1:a:0",
      "-an", "-sn",
      "-af", `afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutAt}:d=4`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      "-movflags", "+faststart",
      out,
    ],
    { maxBuffer: 1024 * 1024 * 32 },
  );
  return out;
}

async function main() {
  if (!existsSync(BASE_VIDEO)) throw new Error(`Background clip not found at ${BASE_VIDEO}`);

  const unlocked = await sb(
    "unlocked_songs?select=song_id&order=created_at.desc&limit=500",
  );
  const rendered = await sb("tiktok_renders?select=song_id,status");
  const done = new Set(rendered.filter((r) => r.status === "done").map((r) => r.song_id));
  const ids = [...new Set(unlocked.map((u) => u.song_id))].filter((id) => !done.has(id));

  if (ids.length === 0) {
    console.log("Nothing pending — every paid unlock already has a TikTok video.");
    return;
  }

  const songs = await sb(
    `songs?select=id,title,audio_path,status&id=in.(${ids.join(",")})&audio_path=not.is.null`,
  );
  const queue = songs.filter((s) => s.audio_path).slice(0, limit);
  console.log(`${ids.length} unlocked track(s) pending, rendering ${queue.length}.`);
  if (dry) {
    queue.forEach((s) => console.log(` - ${s.title} (${s.id})`));
    return;
  }

  const workdir = await mkdtemp(path.join(tmpdir(), "tiktok-"));
  try {
    for (const song of queue) {
      process.stdout.write(`Rendering ${song.title}... `);
      try {
        const file = await renderOne(song, workdir);
        const { id, url } = await uploadToDrive(file, path.basename(file));
        await sb("tiktok_renders", {
          method: "POST",
          body: JSON.stringify({
            song_id: song.id,
            drive_file_id: id,
            drive_url: url,
            status: "done",
            error: null,
            updated_at: new Date().toISOString(),
          }),
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        });
        await rm(file, { force: true });
        console.log(`done -> ${url}`);
      } catch (err) {
        console.log(`FAILED: ${err.message}`);
        await sb("tiktok_renders", {
          method: "POST",
          body: JSON.stringify({
            song_id: song.id,
            status: "failed",
            error: String(err.message).slice(0, 500),
            updated_at: new Date().toISOString(),
          }),
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        });
      }
    }
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
