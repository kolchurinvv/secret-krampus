import { createMemo, createSignal, For } from "solid-js";
import type { AdminPerson } from "../../shared/types";
import { AvatarUpload } from "../components/AvatarUpload";
import { confirmDialog, toast } from "../components/Feedback";
import { InlineText } from "../components/InlineText";
import { api } from "../lib/api";
import { useMessages } from "../lib/i18n";
import { useAdmin } from "./context";
import { adminMessages } from "./messages";

function PersonRow(props: { person: AdminPerson }) {
  const { run, refetch } = useAdmin();
  const m = useMessages(adminMessages);
  const p = () => props.person;

  const patch = (body: Record<string, unknown>, success?: string) =>
    run(() => api.patch(`/api/admin/people/${p().id}`, body), success);

  const remove = async () => {
    const ok = await confirmDialog({
      title: m().deletePersonTitle(p().name),
      message: p().santa.assigned ? m().deletePersonInLoop : m().deletePersonPlain,
      confirmLabel: m().delete,
      danger: true,
    });
    if (ok) await run(() => api.del(`/api/admin/people/${p().id}`), m().personDeleted(p().name));
  };

  return (
    <li class="sk-person">
      <AvatarUpload
        endpoint={`/api/admin/people/${p().id}/avatar`}
        name={p().name}
        url={p().avatarUrl}
        class="sk-person-avatar"
        onUploaded={() => {
          toast(m().photoUpdated(p().name));
          refetch();
        }}
        onError={(m) => toast(m, "error")}
      />
      <div class="max sk-person-main">
        <InlineText
          value={p().name}
          required
          ariaLabel={m().nameOf(p().name)}
          class="sk-inline-name"
          onSave={(name) => patch({ name }, m().nameSaved)}
        />
        <InlineText
          value={p().email ?? ""}
          type="email"
          placeholder={m().noEmail}
          ariaLabel={m().emailOf(p().name)}
          class="sk-inline-email"
          onSave={(email) => patch({ email: email || null }, m().emailSaved)}
        />
        <div class="sk-person-tags">
          <span class="chip small" classList={{ fill: p().hasAccount }} title={p().hasAccount ? m().signedInTitle : m().neverSignedInTitle}>
            <i>{p().hasAccount ? "verified_user" : "person_off"}</i>
            <span>{p().hasAccount ? m().accountChip : m().noLoginChip}</span>
          </span>
          <span class="chip small" title={m().starsTitle}>
            ⭐ {p().stars}
          </span>
        </div>
      </div>
      <div class="sk-person-actions">
        <label class="switch" title={m().inSantaTitle}>
          <input
            type="checkbox"
            checked={p().inSanta}
            onChange={async (e) => {
              const input = e.currentTarget;
              const v = input.checked;
              const r = await patch(
                { inSanta: v },
                v ? m().joinedSanta(p().name) : m().leftSanta(p().name),
              );
              // Rejected (e.g. locked during voting): put the switch back.
              if (r === undefined) input.checked = p().inSanta;
            }}
          />
          <span />
        </label>
        <span class="sk-switch-label">🎅</span>
        <button class="circle transparent small" title={m().delete} aria-label={m().deleteName(p().name)} onClick={() => void remove()}>
          <i>delete</i>
        </button>
      </div>
    </li>
  );
}

export function PeopleTab() {
  const { state, run } = useAdmin();
  const m = useMessages(adminMessages);
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
    const r = await run(() => api.post("/api/admin/people", { name: n, ...(em ? { email: em } : {}) }), m().personAdded(n));
    if (r) {
      setName("");
      setEmail("");
    }
  };

  return (
    <div class="sk-stack">
      <article class="round sk-card">
        <form class="sk-stack" onSubmit={add}>
          <h6>{m().addPersonTitle}</h6>
          <p class="sk-muted small-text sk-m0">{m().addPersonHint}</p>
          <div class="sk-form-row">
            <div class="field label border round max">
              <input type="text" placeholder=" " maxlength={60} value={name()} onInput={(e) => setName(e.currentTarget.value)} />
              <label>{m().nameLabel}</label>
            </div>
            <div class="field label border round max">
              <input
                type="email"
                inputmode="email"
                placeholder=" "
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
              />
              <label>{m().emailOptional}</label>
            </div>
            <button type="submit" class="round" disabled={!name().trim()}>
              <i>person_add</i>
              <span>{m().add}</span>
            </button>
          </div>
        </form>
      </article>

      <article class="round sk-card no-padding">
        <div class="sk-list-head">
          <h6 class="max">{m().peopleCount(state().people.length)}</h6>
          <div class="field small prefix round border sk-search">
            <i>search</i>
            <input type="search" placeholder={m().filter} value={filter()} onInput={(e) => setFilter(e.currentTarget.value)} />
          </div>
        </div>
        <p class="sk-muted small-text sk-list-hint">{m().peopleHint}</p>
        <ul class="sk-people">
          <For each={people()} fallback={<li class="sk-empty">{m().nobodyYet}</li>}>
            {(p) => <PersonRow person={p} />}
          </For>
        </ul>
      </article>
    </div>
  );
}
