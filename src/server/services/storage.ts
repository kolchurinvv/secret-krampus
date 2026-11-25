// Avatar storage: Cloudflare R2 (served from the public custom domain) when
// configured, otherwise ./data/avatars served by the app at /avatars/*.
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { env, r2Configured } from "../env";

export const storageMode: "r2" | "local" = r2Configured ? "r2" : "local";
export const localAvatarDir = join(env.dataDir, "avatars");

const r2 = r2Configured
  ? new Bun.S3Client({
      endpoint: env.r2.endpoint!,
      bucket: env.r2.bucket!,
      accessKeyId: env.r2.accessKeyId!,
      secretAccessKey: env.r2.secretAccessKey!,
      region: "auto",
    })
  : null;

if (!r2) mkdirSync(localAvatarDir, { recursive: true });

export const AVATAR_TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Stores an avatar under a fresh key (so CDN caches never go stale). */
export async function putAvatar(participantId: string, data: Blob, type: string) {
  const ext = AVATAR_TYPES[type];
  if (!ext) throw new Error("unsupported image type");
  const key = `avatars/${participantId}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  if (r2) {
    await r2.write(key, data, { type });
    return { key, url: `${env.r2.publicBaseUrl}/${key}` };
  }
  const file = key.slice("avatars/".length);
  await Bun.write(join(localAvatarDir, file), data);
  return { key, url: `/avatars/${file}` };
}

export async function deleteAvatar(key: string | null | undefined) {
  if (!key) return;
  try {
    if (r2) await r2.delete(key);
    else await unlink(join(localAvatarDir, key.slice("avatars/".length)));
  } catch (err) {
    console.warn("could not delete old avatar", key, (err as Error).message);
  }
}
