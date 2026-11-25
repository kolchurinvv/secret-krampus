import { createSignal, type JSX } from "solid-js";
import { api } from "../lib/api";
import { locale, useMessages } from "../lib/i18n";
import { Avatar } from "./Avatar";
import { componentMessages } from "./messages";

const SIZE = 512;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Centre-crops an image file to a 512×512 square. WebP where the browser can
 * encode it; Safari silently returns PNG for webp, so fall back to JPEG there.
 */
export async function prepareAvatar(file: File): Promise<Blob> {
  const m = componentMessages[locale()];
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error(m.unsupportedImage);
    }
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const side = Math.min(w, h);
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(m.processFailed);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, SIZE, SIZE);
    let blob = await toBlob(canvas, "image/webp", 0.85);
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", 0.88);
    if (!blob) throw new Error(m.processFailed);
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The avatar itself is the upload button: tapping it opens the phone's
 * camera/library chooser (accept="image/*", deliberately no `capture`).
 */
export function AvatarUpload(props: {
  endpoint: string;
  name: string;
  url: string | null;
  class?: string;
  style?: JSX.CSSProperties;
  onUploaded?: (avatarUrl: string) => void;
  onError?: (message: string) => void;
}) {
  const [busy, setBusy] = createSignal(false);
  const m = useMessages(componentMessages);

  const onFile = async (e: Event & { currentTarget: HTMLInputElement }) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const blob = await prepareAvatar(file);
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const res = await api.upload(props.endpoint, blob, `avatar.${ext}`);
      props.onUploaded?.(res.avatarUrl);
    } catch (err) {
      props.onError?.(err instanceof Error ? err.message : m().uploadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <label class={`sk-avatar-upload ${props.class ?? ""}`} classList={{ "is-busy": busy() }} title={m().changePhoto}>
      <Avatar name={props.name} url={props.url} style={props.style} />
      <span class="sk-avatar-upload-badge" aria-hidden="true">
        <i>{busy() ? "hourglass_top" : "photo_camera"}</i>
      </span>
      <input type="file" accept="image/*" class="sk-visually-hidden" disabled={busy()} onChange={onFile} />
      <span class="sk-visually-hidden">{m().changePhotoFor(props.name)}</span>
    </label>
  );
}
