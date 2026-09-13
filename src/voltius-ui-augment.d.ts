/** Runtime @voltius/ui matches host `useAutosave` (object form). Published
 *  `@voltius/plugin-types` still documents a simpler (value, save) stub. */
declare module "@voltius/ui" {
  export type SaveState = "idle" | "dirty" | "saving" | "saved";

  export function useAutosave(opts: {
    onSave: () => void | Promise<void>;
    canSave?: () => boolean;
    delay?: number;
  }): {
    schedule: () => (() => void) | undefined;
    markDirty: () => void;
    flushAndClose: (onClose: () => void) => void;
    flush: () => void;
    saveState: SaveState;
  };
}
