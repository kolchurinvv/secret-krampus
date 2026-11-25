// Solid-controlled snackbar + confirm dialog (BeerCSS styling, no data-ui).
import { createSignal, Show } from "solid-js";
import { useMessages } from "../lib/i18n";
import { componentMessages } from "./messages";

type Toast = { id: number; message: string; kind: "info" | "error" };
const [toastState, setToastState] = createSignal<Toast | null>(null);
let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(message: string, kind: Toast["kind"] = "info") {
  clearTimeout(toastTimer);
  setToastState({ id: ++toastSeq, message, kind });
  toastTimer = setTimeout(() => setToastState(null), kind === "error" ? 6000 : 3000);
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

type ConfirmRequest = {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
};
const [confirmState, setConfirmState] = createSignal<ConfirmRequest | null>(null);

/** Promise-based confirm dialog. Resolves true when the user confirms. */
export function confirmDialog(opts: Omit<ConfirmRequest, "resolve">): Promise<boolean> {
  confirmState()?.resolve(false);
  return new Promise((resolve) => setConfirmState({ ...opts, resolve }));
}

function closeConfirm(ok: boolean) {
  const req = confirmState();
  setConfirmState(null);
  req?.resolve(ok);
}

/** Render once per page. */
export function FeedbackHost() {
  const m = useMessages(componentMessages);
  return (
    <>
      <div
        class="snackbar"
        classList={{ active: !!toastState(), error: toastState()?.kind === "error" }}
        role="status"
        aria-live="polite"
        onClick={() => setToastState(null)}
      >
        <div class="max">{toastState()?.message}</div>
      </div>
      <div class="overlay" classList={{ active: !!confirmState() }} onClick={() => closeConfirm(false)} />
      <dialog class="sk-confirm" classList={{ active: !!confirmState() }} aria-modal="true">
        <Show when={confirmState()}>
          {(req) => (
            <>
              <h6>{req().title}</h6>
              <Show when={req().message}>
                <p>{req().message}</p>
              </Show>
              <nav class="right-align no-space">
                <button class="transparent link" onClick={() => closeConfirm(false)}>
                  {m().cancel}
                </button>
                <button classList={{ error: !!req().danger }} onClick={() => closeConfirm(true)}>
                  {req().confirmLabel ?? m().ok}
                </button>
              </nav>
            </>
          )}
        </Show>
      </dialog>
    </>
  );
}
