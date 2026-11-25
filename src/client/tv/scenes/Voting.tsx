import { createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import type { PublicGift, PublicState } from "../../../shared/types";
import { Avatar } from "../../components/Avatar";
import { AvatarWall, ProgressRing, Qr } from "../Bits";
import { displayHost, fitGrid } from "../util";

/** Krampus voting: progress, who has voted, and the tie-break gifts. */
export function VotingScene(props: { data: PublicState }) {
  const v = () => props.data.voting;
  const voters = createMemo(() =>
    props.data.participants.filter((p) => p.canVote).sort((a, b) => a.name.localeCompare(b.name)),
  );
  const isOpen = () => v().status === "open";
  const isTie = () => isOpen() && v().round >= 2;
  const isDone = () => v().status === "done";
  const notStarted = () => !isOpen() && !isDone();

  return (
    <div class="sc-vote" classList={{ "is-tie": isTie(), "is-done": isDone() }}>
      <div class="sc-vote-head">
        <Switch>
          <Match when={isDone()}>
            <div class="sc-vote-title">All votes are in…</div>
            <div class="sc-vote-sub">Who is the Secret Krampus? 🥁</div>
          </Match>
          <Match when={isTie()}>
            <div class="sc-vote-title">It's a tie! 😱 Round {v().round}</div>
            <div class="sc-vote-sub">Everyone rates these gifts on {displayHost(props.data.publicUrl)}</div>
          </Match>
          <Match when={isOpen()}>
            <div class="sc-vote-title">Rate your Secret Santa gift! 🎁</div>
            <div class="sc-vote-sub">Open {displayHost(props.data.publicUrl)} on your phone</div>
          </Match>
          <Match when={notStarted()}>
            <div class="sc-vote-title">Gift voting opens soon 🎁</div>
            <div class="sc-vote-sub">Get your phones ready</div>
          </Match>
        </Switch>
      </div>

      <Switch>
        <Match when={isDone()}>
          <div class="sc-vote-mystery" aria-hidden="true">
            <span>😈</span>
          </div>
        </Match>
        <Match when={isTie()}>
          {/* Tied gifts take the big left area; progress + voters stack on the right. */}
          <div class="sc-vote-tie">
            <GiftWall gifts={v().gifts} />
            <div class="sc-vote-tie-side">
              <ProgressRing value={v().votedCount} total={v().voters} label="voted" />
              <AvatarWall people={voters()} mark={(p) => (p.voted ? "check" : "dim")} maxCellFraction={0.6} />
            </div>
          </div>
        </Match>
        <Match when={true}>
          <div class="sc-vote-body">
            <div class="sc-vote-side">
              <ProgressRing value={v().votedCount} total={v().voters} label="voted" />
              <Show when={isOpen()}>
                <Qr url={props.data.publicUrl} class="sc-vote-qr" />
              </Show>
            </div>
            <AvatarWall people={voters()} mark={(p) => (p.voted ? "check" : "dim")} />
          </div>
        </Match>
      </Switch>
    </div>
  );
}

/** The tied gifts as cards sized to fill their box, whether there are 2 or 5. */
function GiftWall(props: { gifts: PublicGift[] }) {
  let box!: HTMLDivElement;
  const [size, setSize] = createSignal({ w: 0, h: 0 });
  onMount(() => {
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ w: r.width, h: r.height });
    });
    ro.observe(box);
    onCleanup(() => ro.disconnect());
  });
  const layout = createMemo(() => {
    const { w, h } = size();
    const gap = Math.max(12, w * 0.03);
    // A card is a little taller than wide (avatar + a two-line name).
    return { ...fitGrid(props.gifts.length, w, h, 1.12, gap, h), gap };
  });
  return (
    <div class="sc-vote-giftwall" ref={box}>
      <div
        class="sc-vote-giftgrid"
        style={{
          "grid-template-columns": `repeat(${layout().cols}, ${layout().cell}px)`,
          gap: `${layout().gap}px`,
          "--cell": `${layout().cell}px`,
        }}
      >
        <For each={props.gifts}>
          {(g, i) => (
            <div class="sc-vote-gift" style={{ "animation-delay": `${i() * 120}ms` }}>
              <span class="sc-vote-gift-emoji">🎁</span>
              <Avatar name={g.forName} url={g.forAvatarUrl} class="sc-vote-gift-avatar" />
              <div class="sc-vote-gift-name">{g.forName}'s gift</div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
