import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import type { AdminPerson } from "../../shared/types";
import { Avatar } from "../components/Avatar";
import { confirmDialog } from "../components/Feedback";
import { api } from "../lib/api";
import { countOf, plural, timeAgo, useAdmin } from "./context";

function GiverStatus(props: { person: AdminPerson }) {
  const s = () => props.person.santa;
  return (
    <Switch>
      <Match when={!s().assigned}>
        <span class="chip small" title="Not in the loop yet — press Assign">
          🕒 waiting
        </span>
      </Match>
      <Match when={s().emailError}>
        <span class="chip small error-border error-text" title={s().emailError ?? ""}>
          ✗ failed
        </span>
      </Match>
      <Match when={s().emailSentAt}>
        <span class="chip small" title={new Date(s().emailSentAt!).toLocaleString()}>
          ✓ sent {timeAgo(s().emailSentAt!)}
        </span>
      </Match>
      <Match when={true}>
        <span class="chip small" title="Assigned, email not sent yet">
          ⏳ pending
        </span>
      </Match>
    </Switch>
  );
}

export function SantaTab() {
  const { state, run, busy } = useAdmin();
  const [preferred, setPreferred] = createSignal<string>("");

  const s = () => state().santa;
  const pool = createMemo(() =>
    state()
      .people.filter((p) => p.inSanta)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  const assignedPeople = createMemo(() => pool().filter((p) => p.santa.assigned));
  const showPreferred = () => s().waiting > 0 && s().assigned > 0;

  const assign = async () => {
    const first = s().assigned === 0;
    if (first) {
      const ok = await confirmDialog({
        title: `Draw names for ${plural(s().pool, "person", "people")}?`,
        message: "Everyone in the pool gets a match. Emails go out only when you press “Send pending emails”.",
        confirmLabel: "Draw names",
      });
      if (!ok) return;
    }
    const pref = preferred();
    await run(
      () =>
        api.post<{ ok: true; newGivers?: unknown; changedGivers?: unknown }>("/api/admin/santa/assign", {
          preferredGiverId: showPreferred() && pref ? pref : null,
        }),
      (r) => {
        const n = countOf(r.newGivers);
        const c = countOf(r.changedGivers);
        return first
          ? `Names drawn for ${plural(n, "person", "people")} 🎲`
          : `${plural(n, "late joiner")} added${c ? `, ${plural(c, "person", "people")} re-assigned` : ""}`;
      },
    );
    setPreferred("");
  };

  const sendPending = () =>
    run(
      () => api.post<{ ok: true; sent?: number; failed?: number }>("/api/admin/santa/send-pending"),
      (r) => `📧 ${plural(r.sent ?? 0, "email")} sent${r.failed ? ` · ${r.failed} failed` : ""}`,
    );

  const resend = (p: AdminPerson) =>
    run(() => api.post(`/api/admin/santa/resend/${p.id}`), `Email re-sent to ${p.name}`);

  const reshuffle = async () => {
    const ok = await confirmDialog({
      title: "Reshuffle everyone?",
      message:
        "Every single match changes and EVERYONE needs a new email. Only do this if nobody has shopped yet.",
      confirmLabel: "Reshuffle everyone",
      danger: true,
    });
    if (ok) await run(() => api.post("/api/admin/santa/reshuffle"), "Everyone has a new match — send the emails!");
  };

  return (
    <div class="sk-stack">
      <article class="round sk-card">
        <h6>Secret Santa</h6>
        <div class="sk-chips">
          <span class="chip">🎅 {s().pool} in the pool</span>
          <span class="chip">🔗 {s().assigned} assigned</span>
          <span class="chip" classList={{ fill: s().waiting > 0 }}>
            🕒 {s().waiting} waiting
          </span>
          <span class="chip" classList={{ fill: s().pendingEmails > 0 }}>
            📧 {s().pendingEmails} emails pending
          </span>
        </div>
        <Show when={s().drawDoneAt}>
          <p class="sk-muted small-text">First draw {timeAgo(s().drawDoneAt!)}. The pairs stay secret — even from you.</p>
        </Show>
        <Show when={s().locked}>
          <p class="sk-note">
            🔒 Krampus voting has started, so the Secret Santa is locked. Reset voting (Krampus tab) to change it.
          </p>
        </Show>

        <Show when={showPreferred()}>
          <div class="field label border round sk-top-gap">
            <select onChange={(e) => setPreferred(e.currentTarget.value)} disabled={s().locked}>
              <option value="" selected={preferred() === ""}>
                Random (keeps you blind)
              </option>
              <For each={assignedPeople()}>
                {(p) => (
                  <option value={p.id} selected={preferred() === p.id}>
                    {p.name}
                  </option>
                )}
              </For>
            </select>
            <label>Who gets re-assigned for the late joiners?</label>
          </div>
          <p class="sk-muted small-text sk-m0">
            Late joiners are slotted into the loop after this person, so only they get a new match (and a “plot twist”
            email). Picking someone tells you they now gift a newcomer.
          </p>
        </Show>

        <div class="sk-button-stack sk-top-gap">
          <button
            class="round large responsive"
            disabled={busy() || s().locked || s().waiting === 0 || (s().assigned === 0 && s().pool < 3)}
            onClick={() => void assign()}
          >
            <i>shuffle</i>
            <span>
              {s().assigned === 0
                ? "Assign gifters ↔ receivers"
                : s().waiting > 0
                  ? `Assign ${plural(s().waiting, "late joiner")}`
                  : "Everyone is assigned ✓"}
            </span>
          </button>
          <Show when={s().assigned === 0 && s().pool < 3}>
            <p class="sk-muted small-text sk-m0 center-align">Needs at least 3 people in the pool.</p>
          </Show>
          <button
            class="round large responsive"
            classList={{ border: s().pendingEmails === 0 }}
            disabled={busy() || s().pendingEmails === 0}
            onClick={() => void sendPending()}
          >
            <i>send</i>
            <span>Send pending emails ({s().pendingEmails})</span>
          </button>
          <p class="sk-muted small-text sk-m0 center-align">
            Sends to everyone who's new or whose match changed — nobody gets a duplicate.
          </p>
        </div>
      </article>

      <article class="round sk-card no-padding">
        <h6 class="sk-list-title">Email delivery</h6>
        <ul class="sk-people">
          <For each={pool()} fallback={<li class="sk-empty">Nobody in the Secret Santa yet.</li>}>
            {(p) => (
              <li class="sk-person sk-person-compact">
                <Avatar name={p.name} url={p.avatarUrl} class="sk-person-avatar-sm" />
                <div class="max sk-person-main">
                  <div class="sk-ellipsis">
                    <strong>{p.name}</strong>
                  </div>
                  <div class="sk-person-tags">
                    <GiverStatus person={p} />
                    <Show when={p.santa.changed}>
                      <span class="chip small" title="Their match changed after the first draw">
                        🔀 changed
                      </span>
                    </Show>
                    <Show when={!p.email}>
                      <span class="chip small" title="No email address — tell them in person">
                        no email
                      </span>
                    </Show>
                  </div>
                  <Show when={p.santa.emailError}>
                    <div class="sk-error small-text">{p.santa.emailError}</div>
                  </Show>
                </div>
                <Show when={p.santa.assigned && p.email}>
                  <button
                    class="circle transparent small"
                    title="Resend email"
                    aria-label={`Resend email to ${p.name}`}
                    disabled={busy()}
                    onClick={() => void resend(p)}
                  >
                    <i>forward_to_inbox</i>
                  </button>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </article>

      <article class="round sk-card sk-danger">
        <h6>Danger zone</h6>
        <p class="sk-muted small-text">
          Throws away every match and draws a completely new loop. Everyone needs a new email afterwards.
        </p>
        <button
          class="round error"
          disabled={busy() || s().locked || s().assigned === 0}
          onClick={() => void reshuffle()}
        >
          <i>restart_alt</i>
          <span>Reshuffle everyone</span>
        </button>
      </article>
    </div>
  );
}
