import { createContext, useContext, type Accessor } from "solid-js";

/**
 * False once a scene starts fading out. Reveals use it to cancel pending
 * timers, sounds and confetti immediately instead of when they unmount.
 */
export const SceneActive = createContext<Accessor<boolean>>(() => true);
export const useSceneActive = () => useContext(SceneActive);
