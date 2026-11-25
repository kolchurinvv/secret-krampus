import { createMemo, createSignal, For } from "solid-js";
import type { AdminPerson } from "../../shared/types";
import { AvatarUpload } from "../components/AvatarUpload";
import { confirmDialog, toast } from "../components/Feedback";
import { InlineText } from "../components/InlineText";
import { api } from "../lib/api";
import { plural, useAdmin } from "./context";

function PersonRow(props: { person: AdminPerson }) {
  const { run, refetch } = useAdmin();
  const p = () => props.person;

  const patch = (body: Record<string, unknown>, success?: string) =>
    run(() => api.patch(`/api/admin/people/${p().id}`, body), success);

  const remove = async () => {
    const ok = await confirmDialog({
      title: `Delete ${p().name}?`,
      message: p().santa.assigned
        ? "They're in the Secret Santa loop — their giver will be re-matched and get a new email. Their stars are deleted too."
        : "Their stars are deleted too. This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) await run(() => api.del(`/api/admin/people/${p().id}`), `${p().name} deleted`);
  };

  return (
    <li class="sk-person">
      <AvatarUpload
        endpoint={`/api/admin/people/${p().id}/avatar`}
        name={p().name}
        url={p().avatarUrl}
        class="sk-person-avatar"
        onUploaded={() => {
          toast(`Photo updated for ${p().name}`);
          refetch();
        }}
        onError={(m) => toast(m, "error")}
      />
      <div class="max sk-person-main">
        <InlineText
          value={p().name}
          required
          ariaLabel={`Name of ${p().name}`}
          class="sk-inline-name"
          onSave={(name) => patch({ name }, "Name saved")}
        />
        <InlineText
          value={p().email ?? ""}
          type="email"
          placeholder="no email"
          ariaLabel={`Email of ${p().name}`}
          class="sk-inline-email"
          onSave={(email) => patch({ email: email || null }, "Email saved")}
        />
        <div class="sk-person-tags">
          <span class="chip small" classList={{ fill: p().hasAccount }} title={p().hasAccount ? "Has signed in" : "Never signed in"}>
            <i>{p().hasAccount ? "verified_user" : "person_off"}</i>
            <span>{p().hasAccount ? "account" : "no login"}</span>
          </span>
          <span class="chip small" title="Stars">
            ⭐ {p().stars}
          </span>
        </div>
      </div>
      <div class="sk-person-actions">
        <label class="switch" title="In the Secret Santa draw">
          <input
            type="checkbox"
            checked={p().inSanta}
            onChange={async (e) => {
              const input = e.currentTarget;
              const v = input.checked;
              const r = await patch(
                { inSanta: v },
                v ? `${p().name} joins the Secret Santa` : `${p().name} left the Secret Santa`,
              );
              // Rejected (e.g. locked during voting): put the switch back.
              if (r === undefined) input.checked = p().inSanta;
            }}
          />
          <span />
        </label>
        <span class="sk-switch-label">🎅</span>
        <button class="circle transparent small" title="Delete" aria-label={`Delete ${p().name}`} onClick={() => void remove()}>
          <i>delete</i>
        </button>
      </div>
    </li>
  );
}

export function PeopleTab() {
  const { state, run } = useAdmin();
  const [name, setName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [filter, setFilter] = createSignal("");

  const people = createMemo(() => {
    const f = filter().trim().toLowerCase();
    return [...state().people]
      .filter((p) => !f || p.name.toLowerCase().includes(f) || (p.email ?? "").includes(f))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  const add = async (e: Event) => {
    e.preventDefault();
    const n = name().trim();
    if (!n) return;
    const em = email().trim().toLowerCase();
    const r = await run(() => api.post("/api/admin/people", { name: n, ...(em ? { email: em } : {}) }), `${n} added`);
    if (r) {
      setName("");
      setEmail("");
    }
  };

  return (
    <div class="sk-stack">
      <article class="round sk-card">
        <form class="sk-stack" onSubmit={add}>
          <h6>Add a person</h6>
          <p class="sk-muted small-text sk-m0">
            For guests without a login (contest-only), or to pre-create someone — they're linked when they sign up with
            the same email.
          </p>
          <div class="sk-form-row">
            <div class="field label border round max">
              <input type="text" placeholder=" " maxlength={60} value={name()} onInput={(e) => setName(e.currentTarget.value)} />
              <label>Name</label>
            </div>
            <div class="field label border round max">
              <input
                type="email"
                inputmode="email"
                placeholder=" "
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
              />
              <label>Email (optional)</label>
            </div>
            <button type="submit" class="round" disabled={!name().trim()}>
              <i>person_add</i>
              <span>Add</span>
            </button>
          </div>
        </form>
      </article>

      <article class="round sk-card no-padding">
        <div class="sk-list-head">
          <h6 class="max">{plural(state().people.length, "person", "people")}</h6>
          <div class="field small prefix round border sk-search">
            <i>search</i>
            <input type="search" placeholder="Filter" value={filter()} onInput={(e) => setFilter(e.currentTarget.value)} />
          </div>
        </div>
        <p class="sk-muted small-text sk-list-hint">Tap a photo to change it · edit names inline · 🎅 = in the Secret Santa</p>
        <ul class="sk-people">
          <For each={people()} fallback={<li class="sk-empty">Nobody here yet.</li>}>
            {(p) => <PersonRow person={p} />}
          </For>
        </ul>
      </article>
    </div>
  );
}
