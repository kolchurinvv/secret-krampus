import type { Context } from "hono";
import { UserError } from "../errors";
import { setAvatar } from "../services/participants";
import { AVATAR_TYPES, MAX_AVATAR_BYTES, putAvatar } from "../services/storage";

/** Recognises the image by its first bytes rather than trusting the browser. */
function sniff(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Handles a multipart "file" upload and stores it as `participantId`'s avatar. */
export async function handleAvatarUpload(c: Context, participantId: string) {
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File)) throw new UserError("Attach an image as 'file'.");
  if (file.size > MAX_AVATAR_BYTES) throw new UserError("That image is too big (max 2 MB).");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type || !AVATAR_TYPES[type]) throw new UserError("Use a JPEG, PNG or WebP image.");
  const stored = await putAvatar(participantId, new Blob([bytes], { type }), type);
  await setAvatar(participantId, stored);
  return c.json({ ok: true, avatarUrl: stored.url });
}
