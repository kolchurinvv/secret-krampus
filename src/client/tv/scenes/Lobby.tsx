import { createMemo } from "solid-js";
import type { PublicState } from "../../../shared/types";
import { useMessages } from "../../lib/i18n";
import { AvatarWall, fitText, Qr, RollingNumber } from "../Bits";
import { tvMessages } from "../messages";
import { displayHost } from "../util";

/** Last-minute sign-ups: a big QR code and everyone who has joined so far. */
export function LobbyScene(props: { data: PublicState }) {
  const m = useMessages(tvMessages);
  const people = createMemo(() => [...props.data.participants].sort((a, b) => a.createdAt - b.createdAt));
  return (
    <div class="sc-lobby">
      <div class="sc-lobby-left">
        <div class="sc-lobby-heading" ref={fitText}>
          {m().lobbyHeading}
        </div>
        <Qr url={props.data.publicUrl} class="sc-lobby-qr" />
        <div class="sc-lobby-url">{displayHost(props.data.publicUrl)}</div>
        <div class="sc-lobby-hint">{m().lobbyHint}</div>
      </div>
      <div class="sc-lobby-right">
        <div class="sc-lobby-count">
          <RollingNumber value={props.data.participants.length} class="sc-lobby-count-num" />
          <span>{m().signedUp(props.data.participants.length)}</span>
        </div>
        <AvatarWall people={people()} />
      </div>
    </div>
  );
}
