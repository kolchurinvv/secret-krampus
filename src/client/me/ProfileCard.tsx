import { createEffect, createSignal, Show } from "solid-js";
import type { MeState } from "../../shared/types";
import { AvatarUpload } from "../components/AvatarUpload";
import { errorMessage, toast } from "../components/Feedback";
import { api } from "../lib/api";

export function ProfileCard(props: { me: MeState; onSaved: () => void; highlight?: boolean }) {
  const p = () => props.me.participant;
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
      toast("Please tell us your name 🙂", "error");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/api/me", { name: name().trim(), wishlist: wishlist() });
      setNameDirty(false);
      setWishDirty(false);
      toast("Saved ✓");
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
        <Show when={props.highlight} fallback={<h6>Your profile</h6>}>
          <h5 class="sk-display">What should we call you? 🎅</h5>
          <p class="sk-muted sk-m0">Your name shows up on the TV and on the leaderboard.</p>
        </Show>
        <div class="sk-profile-row">
          <AvatarUpload
            endpoint="/api/me/avatar"
            name={p().name || "?"}
            url={p().avatarUrl}
            class="sk-profile-avatar"
            onUploaded={() => {
              toast("Looking good! 📸");
              props.onSaved();
            }}
            onError={(m) => toast(m, "error")}
          />
          <div class="max sk-muted small-text">
            Tap your picture to add a photo — it shows on the leaderboard and (gulp) in the Krampus reveal.
          </div>
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
          <label>Name</label>
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
          <label>Wishlist / gift hints</label>
        </div>
        <p class="sk-muted small-text sk-m0">Your Secret Santa sees your wishlist (but not who they are to you 🤫).</p>
        <nav class="right-align">
          <button type="submit" class="round" disabled={saving() || !changed()}>
            <i>save</i>
            <span>{saving() ? "Saving…" : "Save"}</span>
          </button>
        </nav>
      </form>
    </article>
  );
}
