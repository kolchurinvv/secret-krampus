import { createMemo } from "solid-js";
import type { PublicState } from "../../../shared/types";
import { AvatarWall, Qr, RollingNumber } from "../Bits";
import { displayHost } from "../util";

/** Last-minute sign-ups: a big QR code and everyone who has joined so far. */
export function LobbyScene(props: { data: PublicState }) {
  const people = createMemo(() => [...props.data.participants].sort((a, b) => a.createdAt - b.createdAt));
  return (
    <div class="sc-lobby">
      <div class="sc-lobby-left">
        <div class="sc-lobby-heading">Join the party!</div>
        <Qr url={props.data.publicUrl} class="sc-lobby-qr" />
        <div class="sc-lobby-url">{displayHost(props.data.publicUrl)}</div>
        <div class="sc-lobby-hint">Scan, sign up, get a Secret Santa match 🎁</div>
      </div>
      <div class="sc-lobby-right">
        <div class="sc-lobby-count">
          <RollingNumber value={props.data.participants.length} class="sc-lobby-count-num" />
          <span>{props.data.participants.length === 1 ? "elf has" : "elves have"} signed up</span>
        </div>
        <AvatarWall people={people()} />
      </div>
    </div>
  );
}
