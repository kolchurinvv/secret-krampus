import { createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import type { PublicGift, PublicState } from "../../../shared/types";
import { Avatar } from "../../components/Avatar";
import { useMessages } from "../../lib/i18n";
import { tvMessages } from "../messages";
import { AvatarWall, fitText, ProgressRing, Qr } from "../Bits";
import { displayHost, fitGrid } from "../util";

/** Krampus voting: progress, who has voted, and the tie-break gifts. */
export function VotingScene(props: { data: PublicState }) {
  const m = useMessages(tvMessages);
  const v = () => props.data.voting;
  const host = () => displayHost(props.data.publicUrl);
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
            <div class="sc-vote-title" ref={fitText}>
              {m().votingDoneTitle}
            </div>
            <div class="sc-vote-sub">{m().votingDoneSub}</div>
          </Match>
          <Match when={isTie()}>
            <div class="sc-vote-title" ref={fitText}>
              {m().tieTitle(v().round)}
            </div>
            <div class="sc-vote-sub">{m().tieSub(host())}</div>
          </Match>
          <Match when={isOpen()}>
            <div class="sc-vote-title" ref={fitText}>
              {m().openTitle}
            </div>
            <div class="sc-vote-sub">{m().openSub(host())}</div>
          </Match>
          <Match when={notStarted()}>
            <div class="sc-vote-title" ref={fitText}>
              {m().soonTitle}
            </div>
            <div class="sc-vote-sub">{m().soonSub}</div>
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
              <ProgressRing value={v().votedCount} total={v().voters} label={m().voted} />
              <AvatarWall people={voters()} mark={(p) => (p.voted ? "check" : "dim")} maxCellFraction={0.6} />
            </div>
          </div>
        </Match>
        <Match when={true}>
          <div class="sc-vote-body">
            <div class="sc-vote-side">
              <ProgressRing value={v().votedCount} total={v().voters} label={m().voted} />
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
  const m = useMessages(tvMessages);
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
              <div class="sc-vote-gift-name">{m().giftFor(g.forName)}</div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
