import { isLocale } from "../../shared/i18n";
import { SCENES, type SceneKind } from "../../shared/types";
import { UserError } from "../errors";
import { notify } from "../events";
import { leaders } from "./scores";
import { getState, patchState } from "./state";
import { tr } from "../messages";

/** Switches the TV. Krampus/champion also reveal (and re-trigger the animation). */
export function setScene(kind: unknown, message?: unknown) {
  if (typeof kind !== "string" || !SCENES.includes(kind as SceneKind)) throw new UserError(tr().unknownScene);
  const k = kind as SceneKind;
  const patch: Parameters<typeof patchState>[0] = { scene: k, sceneStartedAt: new Date() };
  if (typeof message === "string") patch.sceneMessage = message.trim().slice(0, 280);
  if (k === "krampus") {
    const s = getState();
    if (s.voteStatus !== "done") throw new UserError(tr().krampusNotDecided, 409);
    if (s.krampusIds.length === 0) throw new UserError(tr().noKrampus, 409);
    patch.revealedKrampus = true;
  }
  if (k === "champion") {
    const l = leaders();
    if (l.ids.length === 0) throw new UserError(tr().noStarsYet, 409);
    patch.championIds = l.ids;
    patch.championStars = l.stars;
    patch.revealedChampion = true;
  }
  patchState(patch);
  notify();
}

/** Switches the language for every screen and every email from now on. */
export function setLocale(locale: unknown) {
  if (!isLocale(locale)) throw new UserError(tr().badLocale);
  patchState({ locale });
  notify();
}

export function setMessage(message: unknown) {
  if (typeof message !== "string") throw new UserError(tr().messageNotText);
  patchState({ sceneMessage: message.trim().slice(0, 280) });
  notify();
}
