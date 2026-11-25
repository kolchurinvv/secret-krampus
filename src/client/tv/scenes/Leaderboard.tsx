import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, untrack } from "solid-js";
import type { PublicParticipant, PublicState } from "../../../shared/types";
import { Avatar } from "../../components/Avatar";
import { useMessages } from "../../lib/i18n";
import { RollingNumber } from "../Bits";
import { enter, flip, layoutPos, type Pos } from "../flip";
import { tvMessages } from "../messages";
import { boardOrder, competitionRanks, joinNames } from "../util";

/** Live 3D leaderboard. Overtakes slide over the cards they pass. */
export function LeaderboardScene(props: { data: PublicState }) {
  const m = useMessages(tvMessages);
  const sorted = createMemo(() => [...props.data.participants].sort(boardOrder));
  const ranks = createMemo(() => competitionRanks(sorted()));
  const cols = createMemo(() => {
    const n = sorted().length;
    return n <= 8 ? 1 : n <= 18 ? 2 : 3;
  });
  // Keep at least 5 row slots so a small party doesn't get giant cards.
  const rows = createMemo(() => Math.max(5, Math.ceil(sorted().length / cols())));
  /** Changes only when the visual order or grid shape changes. */
  const orderKey = createMemo(() => `${cols()}x${rows()}:${sorted().map((p) => p.id).join("|")}`);

  const els = new Map<string, HTMLElement>();
  let grid!: HTMLDivElement;
  let prevPos = new Map<string, Pos>();
  let prevIndex = new Map<string, number>();

  const record = () => {
    const order = untrack(sorted);
    prevPos = new Map();
    for (const p of order) {
      const el = els.get(p.id);
      if (el) prevPos.set(p.id, layoutPos(el));
    }
    prevIndex = new Map(order.map((p, i) => [p.id, i]));
  };

  // Effects run after Solid has moved the DOM nodes, so the new layout is
  // already in place: compare it with the previous one and animate the gap.
  createEffect(
    on(orderKey, () => {
      const order = untrack(sorted);
      const first = prevPos.size === 0;
      order.forEach((p, i) => {
        const el = els.get(p.id);
        if (!el || first) return;
        const from = prevPos.get(p.id);
        if (!from) return enter(el);
        const to = layoutPos(el);
        const dx = from.x - to.x;
        const dy = from.y - to.y;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        flip(el, dx, dy, i < (prevIndex.get(p.id) ?? i) ? "rise" : "sink");
      });
      record();
    }),
  );

  onMount(() => {
    // Window/grid resizes move everything: re-measure, don't animate.
    const ro = new ResizeObserver(() => record());
    ro.observe(grid);
    onCleanup(() => ro.disconnect());
  });

  const contestName = () => props.data.contest.current?.name;
  const banner = createAwardBanner(() => props.data);

  return (
    <div class="sc-lb">
      {/* The award banner takes the header's place while it shows. */}
      <div class="sc-lb-head" classList={{ "has-banner": !!banner() }}>
        <div class="sc-lb-head-content">
          {/* Ranked by total stars across every contest; "Now playing" only labels the current one. */}
          <div class="sc-lb-title">{m().standings}</div>
          <Show when={contestName()}>
            <div class="sc-lb-contest">
              {m().nowPlaying} <strong>{contestName()}</strong>
            </div>
          </Show>
        </div>
        <Show when={banner()} keyed>
          {(b) => (
            <div class="sc-lb-banner">
              <span class="sc-lb-banner-star">⭐</span>
              <span class="sc-lb-banner-title">{b.title}</span>
              <span class="sc-lb-banner-names">{b.names}</span>
            </div>
          )}
        </Show>
      </div>
      <div class="sc-lb-stage">
        <div
          class="sc-lb-grid"
          ref={grid}
          style={{
            "grid-template-columns": `repeat(${cols()}, minmax(0, 1fr))`,
            "grid-template-rows": `repeat(${rows()}, minmax(0, 1fr))`,
          }}
        >
          <For each={sorted()}>
            {(p) => (
              <LeaderCard
                p={p}
                rank={ranks().get(p.id) ?? 0}
                ref={(el) => {
                  els.set(p.id, el);
                  onCleanup(() => els.get(p.id) === el && els.delete(p.id));
                }}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

function LeaderCard(props: { p: PublicParticipant; rank: number; ref: (el: HTMLElement) => void }) {
  type Floater = { id: number; n: number };
  const [floaters, setFloaters] = createSignal<Floater[]>([]);
  const [bumped, setBumped] = createSignal(false);
  let seq = 0;
  let last = untrack(() => props.p.stars);
  createEffect(() => {
    const s = props.p.stars;
    if (s > last) {
      const f = { id: ++seq, n: s - last };
      setFloaters((fs) => [...fs, f]);
      setTimeout(() => setFloaters((fs) => fs.filter((x) => x.id !== f.id)), 2000);
      setBumped(false);
      requestAnimationFrame(() => setBumped(true));
      setTimeout(() => setBumped(false), 1200);
    }
    last = s;
  });
  const tier = () => (props.p.stars > 0 && props.rank <= 3 ? `tier-${props.rank}` : "");
  const starIcons = () => Math.min(props.p.stars, 10);

  return (
    <div class={`sc-lb-card ${tier()}`} classList={{ "is-bumped": bumped() }} ref={props.ref}>
      <div class="sc-lb-card-inner">
        <div class="sc-lb-rank">{props.rank}</div>
        <Avatar name={props.p.name} url={props.p.avatarUrl} class="sc-lb-avatar" />
        <div class="sc-lb-name">{props.p.name}</div>
        <div class="sc-lb-stars" aria-hidden="true">
          <For each={Array.from({ length: starIcons() })}>{() => <span>⭐</span>}</For>
        </div>
        <div class="sc-lb-score">
          <RollingNumber value={props.p.stars} />
          <span class="sc-lb-score-star">★</span>
        </div>
      </div>
      <For each={floaters()}>{(f) => <div class="sc-lb-floater">+{f.n} ⭐</div>}</For>
    </div>
  );
}

/** "⭐ Carol karaoke — Anna, Boris & Clara" for a few seconds after each award. */
function createAwardBanner(data: () => PublicState) {
  const m = useMessages(tvMessages);
  const [banner, setBanner] = createSignal<{ key: string; title: string; names: string } | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  createEffect(
    on(
      () => data().lastAward?.batchId,
      (batchId) => {
        const award = untrack(() => data().lastAward);
        if (!batchId || !award) return;
        const byId = new Map(untrack(() => data().participants).map((p) => [p.id, p.name]));
        const names = award.participantIds.map((id) => byId.get(id)).filter((n): n is string => !!n);
        if (names.length === 0) return;
        setBanner({ key: batchId, title: award.contestName ?? m().oneStar, names: joinNames(names, m().and) });
        clearTimeout(timer);
        timer = setTimeout(() => setBanner(null), 6000);
      },
      { defer: true },
    ),
  );
  onCleanup(() => clearTimeout(timer));
  return banner;
}
