import { For, Show } from "solid-js";
import type { PublicState } from "../../../shared/types";
import { Avatar } from "../../components/Avatar";
import { displayHost } from "../util";

/** Default scene: the party name, the admin's announcement, a row of faces. */
export function TitleScene(props: { data: PublicState }) {
  const people = () => props.data.participants;
  return (
    <div class="sc-title">
      <div class="sc-title-ornaments" aria-hidden="true">
        <span>🎄</span>
        <span>😈</span>
        <span>🎁</span>
      </div>
      <div class="sc-title-main">Secret Krampus</div>
      <Show
        when={props.data.scene.message.trim()}
        fallback={<div class="sc-title-sub">{displayHost(props.data.publicUrl)}</div>}
      >
        <div class="sc-title-message">{props.data.scene.message}</div>
      </Show>
      <Show when={people().length > 0}>
        <div class="sc-title-strip" style={{ "--n": Math.min(people().length, 24) }}>
          <For each={people().slice(0, 24)}>
            {(p, i) => (
              <span class="sc-title-face" style={{ "animation-delay": `${(i() % 6) * -0.4}s` }}>
                <Avatar name={p.name} url={p.avatarUrl} class="sc-title-avatar" />
              </span>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
