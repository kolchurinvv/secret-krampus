import { createEffect, createSignal } from "solid-js";

/**
 * A text input that saves on Enter or blur (only when changed) and reverts on
 * Escape. While it isn't focused it follows the server value, so SSE-driven
 * refetches don't clobber what someone is typing.
 */
export function InlineText(props: {
  value: string;
  onSave: (value: string) => Promise<unknown> | void;
  placeholder?: string;
  type?: "text" | "email";
  class?: string;
  ariaLabel?: string;
  required?: boolean;
}) {
  const [draft, setDraft] = createSignal(props.value);
  const [focused, setFocused] = createSignal(false);
  const [saving, setSaving] = createSignal(false);

  createEffect(() => {
    const v = props.value;
    if (!focused() && !saving()) setDraft(v);
  });

  const commit = async () => {
    const next = draft().trim();
    if (next === props.value.trim()) return;
    if (props.required && !next) {
      setDraft(props.value);
      return;
    }
    setSaving(true);
    try {
      await props.onSave(next);
    } catch {
      setDraft(props.value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      class={`sk-inline ${props.class ?? ""}`}
      classList={{ "is-saving": saving() }}
      type={props.type ?? "text"}
      value={draft()}
      placeholder={props.placeholder}
      aria-label={props.ariaLabel}
      autocomplete="off"
      onFocus={() => setFocused(true)}
      onInput={(e) => setDraft(e.currentTarget.value)}
      onBlur={() => {
        setFocused(false);
        void commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(props.value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
