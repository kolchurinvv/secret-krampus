import { createMemo, createSignal, For, Show } from "solid-js";
import type { AdminPerson, ContestKind } from "../../shared/types";
import { Avatar } from "../components/Avatar";
import { confirmDialog } from "../components/Feedback";
import { api } from "../lib/api";
import { plural, useAdmin } from "./context";

function StarCell(props: { person: AdminPerson }) {
  const { run, busy } = useAdmin();
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  const p = () => props.person;

  const save = async () => {
    const n = Number.parseInt(draft(), 10);
    setEditing(false);
    if (!Number.isFinite(n) || n < 0 || n === p().stars) return;
    await run(() => api.post("/api/admin/stars/set", { participantId: p().id, count: n }), `${p().name} now has ${n} ⭐`);
  };

  return (
    <div class="sk-starcell">
      <button
        class="circle transparent small"
        title="−1 star"
        aria-label={`Remove a star from ${p().name}`}
        disabled={busy() || p().stars === 0}
        onClick={() => void run(() => api.post("/api/admin/stars/remove-one", { participantId: p().id }), `−1 ⭐ ${p().name}`)}
      >
        <i>remove</i>
      </button>
      <Show
        when={editing()}
        fallback={
          <button
            class="sk-starcount"
            title="Tap to set the score"
            onClick={() => {
              setDraft(String(p().stars));
              setEditing(true);
            }}
          >
            ⭐ {p().stars}
          </button>
        }
      >
        <input
          class="sk-starinput"
          type="number"
          inputmode="numeric"
          min="0"
          value={draft()}
          ref={(el) =>
            queueMicrotask(() => {
              el.focus();
              el.select();
            })
          }
          onInput={(e) => setDraft(e.currentTarget.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setEditing(false);
          }}
          aria-label={`Stars for ${p().name}`}
        />
      </Show>
    </div>
  );
}

export function ContestsTab() {
  const { state, run, busy } = useAdmin();
  const [selected, setSelected] = createSignal<ReadonlySet<string>>(new Set());
  const [newName, setNewName] = createSignal("");
  const [newKind, setNewKind] = createSignal<ContestKind>("team");
  const [sortBy, setSortBy] = createSignal<"name" | "stars">("name");

  const people = createMemo(() => {
    const list = [...state().people];
    return sortBy() === "name"
      ? list.sort((a, b) => a.name.localeCompare(b.name))
      : list.sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
  });
  const current = () => state().contests.find((c) => c.id === state().currentContestId) ?? null;
  const isSelected = (id: string) => selected().has(id);
  const toggle = (id: string) => {
    const next = new Set(selected());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const allSelected = () => people().length > 0 && people().every((p) => selected().has(p.id));
  const selectedNames = () =>
    people()
      .filter((p) => selected().has(p.id))
      .map((p) => p.name);

  const award = async () => {
    const ids = [...selected()];
    if (ids.length === 0) return;
    const names = selectedNames();
    const r = await run(
      () => api.post("/api/admin/stars/award", { participantIds: ids, contestId: state().currentContestId }),
      `+1 ⭐ ${names.length <= 3 ? names.join(", ") : plural(names.length, "person", "people")}`,
    );
    if (r) setSelected(new Set<string>());
  };

  // −1 to fix a mistaken award; people already at 0 are skipped.
  const selectedWithStars = () => people().filter((p) => selected().has(p.id) && p.stars > 0);
  const takeStar = async () => {
    const losers = selectedWithStars();
    if (losers.length === 0) return;
    const names = losers.map((p) => p.name);
    const r = await run(
      () => api.post("/api/admin/stars/remove", { participantIds: losers.map((p) => p.id) }),
      `−1 ⭐ ${names.length <= 3 ? names.join(", ") : plural(names.length, "person", "people")}`,
    );
    if (r) setSelected(new Set<string>());
  };

  const createContest = async (e: Event) => {
    e.preventDefault();
    const name = newName().trim();
    if (!name) return;
    const r = await run(
      () => api.post<{ ok: true; id?: string }>("/api/admin/contests", { name, kind: newKind() }),
      `Contest “${name}” created`,
    );
    if (r) {
      setNewName("");
      if (r.id) await run(() => api.post("/api/admin/contests/current", { id: r.id }));
    }
  };

  const setCurrent = (id: string) => run(() => api.post("/api/admin/contests/current", { id: id || null }));

  const deleteCurrent = async () => {
    const c = current();
    if (!c) return;
    const ok = await confirmDialog({
      title: `Delete “${c.name}”?`,
      message: "Stars already won in it are kept, just without the contest label.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) await run(() => api.del(`/api/admin/contests/${c.id}`), "Contest deleted");
  };

  const undo = async () => {
    const la = state().lastAward;
    if (!la) return;
    const ok = await confirmDialog({
      title: "Undo the last award?",
      message: `Removes +1 ⭐ from ${la.names.join(", ")}${la.contestName ? ` (${la.contestName})` : ""}.`,
      confirmLabel: "Undo",
    });
    if (ok) await run(() => api.post("/api/admin/stars/undo-last"), "Last award undone");
  };

  const crown = async () => {
    const l = state().leaders;
    const tie = l.names.length > 1;
    const ok = await confirmDialog({
      title: tie ? "Crown everyone tied for first?" : `Crown ${l.names[0] ?? "the leader"}?`,
      message: tie
        ? `${l.names.join(", ")} are tied on ${l.stars} ⭐. You could run a tie-breaker and award one more star first.`
        : `${l.names[0]} leads with ${l.stars} ⭐. Fanfare on the TV! 🎺`,
      confirmLabel: tie ? "Crown them all" : "Crown champion",
    });
    if (ok) await run(() => api.post("/api/admin/scene", { kind: "champion" }), "👑 Champion on the TV!");
  };

  return (
    <div class="sk-stack sk-contests">
      <article class="round sk-card">
        <h6>Contest</h6>
        <div class="sk-form-row">
          <div class="field label border round max">
            <select onChange={(e) => void setCurrent(e.currentTarget.value)}>
              <option value="" selected={!state().currentContestId}>
                — no contest label —
              </option>
              <For each={state().contests}>
                {(c) => (
                  <option value={c.id} selected={c.id === state().currentContestId}>
                    {c.name} ({c.kind})
                  </option>
                )}
              </For>
            </select>
            <label>Current contest</label>
          </div>
          <Show when={current()}>
            <button class="circle transparent" title="Delete contest" aria-label="Delete contest" onClick={() => void deleteCurrent()}>
              <i>delete</i>
            </button>
          </Show>
        </div>
        <form class="sk-form-row sk-top-gap" onSubmit={createContest}>
          <div class="field label border round max">
            <input type="text" placeholder=" " maxlength={60} value={newName()} onInput={(e) => setNewName(e.currentTarget.value)} />
            <label>New contest name</label>
          </div>
          <nav class="no-space sk-kind">
            <button
              type="button"
              class="border left-round small"
              classList={{ fill: newKind() === "individual" }}
              onClick={() => setNewKind("individual")}
            >
              <i>person</i>
              <span>Solo</span>
            </button>
            <button
              type="button"
              class="border right-round small"
              classList={{ fill: newKind() === "team" }}
              onClick={() => setNewKind("team")}
            >
              <i>groups</i>
              <span>Team</span>
            </button>
          </nav>
          <button type="submit" class="round" disabled={!newName().trim()}>
            <i>add</i>
            <span>Create</span>
          </button>
        </form>
      </article>

      <article class="round sk-card no-padding">
        <div class="sk-list-head">
          <label class="checkbox">
            <input
              type="checkbox"
              checked={allSelected()}
              onChange={() => setSelected(allSelected() ? new Set<string>() : new Set(people().map((p) => p.id)))}
            />
            <span>All</span>
          </label>
          <div class="max" />
          <button class="transparent small" onClick={() => setSortBy(sortBy() === "name" ? "stars" : "name")}>
            <i>sort</i>
            <span>{sortBy() === "name" ? "A–Z" : "Stars"}</span>
          </button>
        </div>
        <ul class="sk-people">
          <For each={people()} fallback={<li class="sk-empty">Add people first.</li>}>
            {(p) => (
              <li class="sk-person sk-person-compact sk-selectable" classList={{ "is-selected": isSelected(p.id) }}>
                <label class="checkbox sk-pick">
                  <input type="checkbox" checked={isSelected(p.id)} onChange={() => toggle(p.id)} />
                  <span />
                </label>
                <div class="sk-pick-body max" onClick={() => toggle(p.id)}>
                  <Avatar name={p.name} url={p.avatarUrl} class="sk-person-avatar-sm" />
                  <span class="sk-ellipsis">{p.name}</span>
                </div>
                <StarCell person={p} />
              </li>
            )}
          </For>
        </ul>
      </article>

      <article class="round sk-card">
        <Show when={state().lastAward}>
          {(la) => (
            <div class="sk-form-row">
              <div class="max small-text">
                <div class="sk-muted">Last award</div>
                <div>
                  +1 ⭐ {la().names.join(", ")}
                  {la().contestName ? ` · ${la().contestName}` : ""}
                </div>
              </div>
              <button class="border round small" disabled={busy()} onClick={() => void undo()}>
                <i>undo</i>
                <span>Undo</span>
              </button>
            </div>
          )}
        </Show>
        <div class="sk-top-gap">
          <Show
            when={state().leaders.names.length > 0 && state().leaders.stars > 0}
            fallback={<p class="sk-muted small-text">No stars awarded yet.</p>}
          >
            <p class="small-text sk-m0">
              <span class="sk-muted">Leading: </span>
              {state().leaders.names.join(", ")} · {state().leaders.stars} ⭐
            </p>
            <Show when={state().leaders.names.length > 1}>
              <p class="sk-note small-text">
                ⚠️ Tie at the top — run a tie-breaker and give one more star, or crown them all.
              </p>
            </Show>
          </Show>
          <button
            class="round responsive sk-top-gap"
            classList={{ border: state().championRevealed }}
            disabled={busy() || state().leaders.stars === 0}
            onClick={() => void crown()}
          >
            <i>emoji_events</i>
            <span>{state().championRevealed ? "Crown again on TV" : "Crown champion 🎺"}</span>
          </button>
        </div>
      </article>

      <Show when={selected().size > 0}>
        <div class="sk-actionbar">
          <div class="max">
            <strong>{selected().size} selected</strong>
            <div class="small-text sk-muted sk-ellipsis">{current()?.name ?? "no contest label"}</div>
          </div>
          <button class="transparent" onClick={() => setSelected(new Set<string>())}>
            Clear
          </button>
          <button
            class="round large border"
            disabled={busy() || selectedWithStars().length === 0}
            title="Take one star from each selected person (anyone at 0 is skipped)"
            onClick={() => void takeStar()}
          >
            <span>−1 ⭐</span>
          </button>
          <button class="round large" disabled={busy()} onClick={() => void award()}>
            <span>+1 ⭐</span>
          </button>
        </div>
      </Show>
    </div>
  );
}
