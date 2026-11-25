import type { PublicParticipant } from "../../shared/types";

/** Leaderboard order: most stars first, then by name. */
export function boardOrder(a: PublicParticipant, b: PublicParticipant) {
  return b.stars - a.stars || a.name.localeCompare(b.name);
}

/** Standard competition ranking over an already-sorted list: 1, 2, 2, 4. */
export function competitionRanks(sorted: readonly PublicParticipant[]) {
  const ranks = new Map<string, number>();
  let prevStars = Number.NaN;
  let prevRank = 0;
  sorted.forEach((p, i) => {
    const rank = p.stars === prevStars ? prevRank : i + 1;
    ranks.set(p.id, rank);
    prevStars = p.stars;
    prevRank = rank;
  });
  return ranks;
}

/**
 * Picks the column count that makes n tiles as large as possible inside w×h.
 * `tileAspect` is tile height / tile width (a label under an avatar makes it > 1).
 */
export function fitGrid(n: number, w: number, h: number, tileAspect: number, gap: number, maxCell: number) {
  if (n <= 0 || w <= 0 || h <= 0) return { cols: 1, cell: 0 };
  let best = { cols: 1, cell: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cellW = (w - gap * (cols - 1)) / cols;
    const cellH = (h - gap * (rows - 1)) / rows / tileAspect;
    const cell = Math.min(cellW, cellH);
    if (cell > best.cell) best = { cols, cell };
  }
  return { cols: best.cols, cell: Math.max(0, Math.min(best.cell, maxCell)) };
}

/** "https://secretkrampus.party/" → "secretkrampus.party" */
export function displayHost(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Joins names as "Anna, Boris & Clara". */
export function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** How long ago (ms) a server timestamp was, on this browser's clock; never negative. */
export function elapsedSince(localStart: number) {
  return Math.max(0, Date.now() - localStart);
}
