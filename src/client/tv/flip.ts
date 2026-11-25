// FLIP ("First, Last, Invert, Play") in 3D for the leaderboard.
// Positions come from offsetLeft/offsetTop, which ignore transforms, so a
// running animation never skews the next measurement.

export type Pos = { x: number; y: number };

export function layoutPos(el: HTMLElement): Pos {
  return { x: el.offsetLeft, y: el.offsetTop };
}

const DURATION = 1400;
const EASING = "cubic-bezier(.25,.8,.25,1)";

/**
 * Animates an element from its old layout position (dx/dy away) into place.
 * "rise": the overtaker lifts toward the viewer and glides over the others.
 * "sink": an overtaken card drops back while the overtaker passes, then returns.
 */
export function flip(el: HTMLElement, dx: number, dy: number, kind: "rise" | "sink") {
  for (const a of el.getAnimations()) if (a.id === "flip") a.cancel();
  const frames: Keyframe[] =
    kind === "rise"
      ? [
          { transform: `translate3d(${dx}px, ${dy}px, 0) rotateX(0deg)`, boxShadow: "0 0 0 rgba(0,0,0,0)" },
          {
            offset: 0.18,
            transform: `translate3d(${dx}px, ${dy}px, 120px) rotateX(-7deg)`,
            boxShadow: "0 40px 80px rgba(0,0,0,.6)",
          },
          {
            offset: 0.78,
            transform: `translate3d(${dx * 0.06}px, ${dy * 0.06}px, 120px) rotateX(-3deg)`,
            boxShadow: "0 40px 80px rgba(0,0,0,.6)",
          },
          { transform: "translate3d(0, 0, 0) rotateX(0deg)", boxShadow: "0 0 0 rgba(0,0,0,0)" },
        ]
      : [
          { transform: `translate3d(${dx}px, ${dy}px, 0) rotateX(0deg)`, filter: "brightness(1)" },
          { offset: 0.2, transform: `translate3d(${dx}px, ${dy}px, -60px) rotateX(6deg)`, filter: "brightness(.6)" },
          { offset: 0.8, transform: "translate3d(0, 0, -60px) rotateX(3deg)", filter: "brightness(.7)" },
          { transform: "translate3d(0, 0, 0) rotateX(0deg)", filter: "brightness(1)" },
        ];
  if (kind === "rise") el.style.zIndex = "10";
  const anim = el.animate(frames, { duration: DURATION, easing: EASING });
  anim.id = "flip";
  const done = () => {
    if (kind === "rise") el.style.zIndex = "";
  };
  anim.addEventListener("finish", done);
  anim.addEventListener("cancel", done);
}

/** A newcomer to the board fades up out of the depth. */
export function enter(el: HTMLElement) {
  el.animate(
    [
      { opacity: 0, transform: "translate3d(0, 30px, -200px) scale(.85)" },
      { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
    ],
    { duration: 700, easing: "ease-out" },
  );
}
