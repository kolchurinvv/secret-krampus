import type { PublicState } from "../../shared/types";

/** Where the TV gets its data: the live SSE stream, or the dev mock feed. */
export type TvSource = {
  readonly data: PublicState | null;
  /** Server timestamp (ms) → this browser's Date.now() scale. */
  toLocal: (serverMs: number) => number;
};
