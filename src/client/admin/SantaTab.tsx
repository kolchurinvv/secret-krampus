import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import type { AdminPerson } from "../../shared/types";
import { Avatar } from "../components/Avatar";
import { confirmDialog } from "../components/Feedback";
import { api } from "../lib/api";
import { intlLocale, useMessages } from "../lib/i18n";
import { countOf, timeAgo, useAdmin } from "./context";
import { adminMessages } from "./messages";

function GiverStatus(props: { person: AdminPerson }) {
  const m = useMessages(adminMessages);
  const s = () => props.person.santa;
  return (
    <Switch>
      <Match when={!s().assigned}>
        <span class="chip small" title={m().waitingTitle}>
          {m().waitingChip}
        </span>
      </Match>
      <Match when={s().emailError}>
        <span class="chip small error-border error-text" title={s().emailError ?? ""}>
          {m().failedChip}
        </span>
      </Match>
      <Match when={s().emailSentAt}>
        <span class="chip small" title={new Date(s().emailSentAt!).toLocaleString(intlLocale())}>
          {m().sentChip(timeAgo(s().emailSentAt!))}
        </span>
      </Match>
      <Match when={true}>
        <span class="chip small" title={m().pendingTitle}>
          {m().pendingChip}
        </span>
      </Match>
    </Switch>
  );
}

export function SantaTab() {
  const { state, run, busy } = useAdmin();
  const m = useMessages(adminMessages);
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
        title: m().drawTitle(s().pool),
        message: m().drawMessage,
        confirmLabel: m().drawConfirm,
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
        return first ? m().namesDrawn(n) : m().lateAdded(n, c);
      },
    );
    setPreferred("");
  };

  const sendPending = () =>
    run(
      () => api.post<{ ok: true; sent?: number; failed?: number }>("/api/admin/santa/send-pending"),
      (r) => m().emailsSent(r.sent ?? 0, r.failed ?? 0),
    );

  const resend = (p: AdminPerson) =>
    run(() => api.post(`/api/admin/santa/resend/${p.id}`), m().emailResent(p.name));

  const reshuffle = async () => {
    const ok = await confirmDialog({
      title: m().reshuffleTitle,
      message: m().reshuffleMessage,
      confirmLabel: m().reshuffleConfirm,
      danger: true,
    });
    if (ok) await run(() => api.post("/api/admin/santa/reshuffle"), m().reshuffled);
  };

  return (
    <div class="sk-stack">
      <article class="round sk-card">
        <h6>{m().santaTitle}</h6>
        <div class="sk-chips">
          <span class="chip">{m().poolChip(s().pool)}</span>
          <span class="chip">{m().assignedChip(s().assigned)}</span>
          <span class="chip" classList={{ fill: s().waiting > 0 }}>
            {m().waitingCountChip(s().waiting)}
          </span>
          <span class="chip" classList={{ fill: s().pendingEmails > 0 }}>
            {m().pendingCountChip(s().pendingEmails)}
          </span>
        </div>
        <Show when={s().drawDoneAt}>
          <p class="sk-muted small-text">{m().firstDraw(timeAgo(s().drawDoneAt!))}</p>
        </Show>
        <Show when={s().locked}>
          <p class="sk-note">{m().santaLocked}</p>
        </Show>

        <Show when={showPreferred()}>
          <div class="field label border round sk-top-gap">
            <select onChange={(e) => setPreferred(e.currentTarget.value)} disabled={s().locked}>
              <option value="" selected={preferred() === ""}>
                {m().randomBlind}
              </option>
              <For each={assignedPeople()}>
                {(p) => (
                  <option value={p.id} selected={preferred() === p.id}>
                    {p.name}
                  </option>
                )}
              </For>
            </select>
            <label>{m().whoReassigned}</label>
          </div>
          <p class="sk-muted small-text sk-m0">{m().reassignHint}</p>
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
                ? m().assignFirst
                : s().waiting > 0
                  ? m().assignLate(s().waiting)
                  : m().everyoneAssigned}
            </span>
          </button>
          <Show when={s().assigned === 0 && s().pool < 3}>
            <p class="sk-muted small-text sk-m0 center-align">{m().needsThree}</p>
          </Show>
          <button
            class="round large responsive"
            classList={{ border: s().pendingEmails === 0 }}
            disabled={busy() || s().pendingEmails === 0}
            onClick={() => void sendPending()}
          >
            <i>send</i>
            <span>{m().sendPending(s().pendingEmails)}</span>
          </button>
          <p class="sk-muted small-text sk-m0 center-align">{m().sendHint}</p>
        </div>
      </article>

      <article class="round sk-card no-padding">
        <h6 class="sk-list-title">{m().emailDelivery}</h6>
        <ul class="sk-people">
          <For each={pool()} fallback={<li class="sk-empty">{m().nobodyInSanta}</li>}>
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
                      <span class="chip small" title={m().changedTitle}>
                        {m().changedChip}
                      </span>
                    </Show>
                    <Show when={!p.email}>
                      <span class="chip small" title={m().noEmailTitle}>
                        {m().noEmail}
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
                    title={m().resendTitle}
                    aria-label={m().resendTo(p.name)}
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
        <h6>{m().dangerZone}</h6>
        <p class="sk-muted small-text">{m().reshuffleHint}</p>
        <button
          class="round error"
          disabled={busy() || s().locked || s().assigned === 0}
          onClick={() => void reshuffle()}
        >
          <i>restart_alt</i>
          <span>{m().reshuffleConfirm}</span>
        </button>
      </article>
    </div>
  );
}
