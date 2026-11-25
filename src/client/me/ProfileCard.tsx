import { createEffect, createSignal, Show } from "solid-js";
import type { MeState } from "../../shared/types";
import { AvatarUpload } from "../components/AvatarUpload";
import { errorMessage, toast } from "../components/Feedback";
import { api } from "../lib/api";
import { useMessages } from "../lib/i18n";
import { meMessages } from "./messages";

export function ProfileCard(props: { me: MeState; onSaved: () => void; highlight?: boolean }) {
  const p = () => props.me.participant;
  const m = useMessages(meMessages);
  const [name, setName] = createSignal(p().name);
  const [wishlist, setWishlist] = createSignal(p().wishlist);
  const [saving, setSaving] = createSignal(false);
  // Follow server values until the user starts editing a field.
  const [nameDirty, setNameDirty] = createSignal(false);
  const [wishDirty, setWishDirty] = createSignal(false);

  createEffect(() => {
    const n = p().name;
    if (!nameDirty()) setName(n);
  });
  createEffect(() => {
    const w = p().wishlist;
    if (!wishDirty()) setWishlist(w);
  });

  const changed = () => name().trim() !== p().name || wishlist() !== p().wishlist;

  const save = async (e: Event) => {
    e.preventDefault();
    if (!name().trim()) {
      toast(m().needName, "error");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/api/me", { name: name().trim(), wishlist: wishlist() });
      setNameDirty(false);
      setWishDirty(false);
      toast(m().saved);
      props.onSaved();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <article class="round sk-card" classList={{ "sk-card-highlight": !!props.highlight }}>
      <form class="sk-stack" onSubmit={save}>
        <Show when={props.highlight} fallback={<h6>{m().profileTitle}</h6>}>
          <h5 class="sk-display">{m().whatName}</h5>
          <p class="sk-muted sk-m0">{m().nameShows}</p>
        </Show>
        <div class="sk-profile-row">
          <AvatarUpload
            endpoint="/api/me/avatar"
            name={p().name || "?"}
            url={p().avatarUrl}
            class="sk-profile-avatar"
            onUploaded={() => {
              toast(m().lookingGood);
              props.onSaved();
            }}
            onError={(m) => toast(m, "error")}
          />
          <div class="max sk-muted small-text">{m().photoHint}</div>
        </div>
        <div class="field label border round">
          <input
            type="text"
            autocomplete="name"
            maxlength={60}
            placeholder=" "
            value={name()}
            onInput={(e) => {
              setNameDirty(true);
              setName(e.currentTarget.value);
            }}
          />
          <label>{m().nameField}</label>
        </div>
        <div class="field label border round textarea">
          <textarea
            rows={3}
            maxlength={1000}
            placeholder=" "
            value={wishlist()}
            onInput={(e) => {
              setWishDirty(true);
              setWishlist(e.currentTarget.value);
            }}
          />
          <label>{m().wishlistField}</label>
        </div>
        <p class="sk-muted small-text sk-m0">{m().wishlistNote}</p>
        <nav class="right-align">
          <button type="submit" class="round" disabled={saving() || !changed()}>
            <i>save</i>
            <span>{saving() ? m().saving : m().save}</span>
          </button>
        </nav>
      </form>
    </article>
  );
}
