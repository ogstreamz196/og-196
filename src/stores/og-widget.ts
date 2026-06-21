import { useSyncExternalStore } from "react";

/**
 * Tiny external store so any page can open the floating OG Bot widget
 * with an optional seeded starter prompt. Used by the "With OG" entry
 * on the library so users can co-write a song with the bot for free.
 */
type State = {
  open: boolean;
  seed: string | null;
};

let state: State = { open: false, seed: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function getSnapshot() {
  return state;
}

function getServerSnapshot(): State {
  return { open: false, seed: null };
}

export const ogWidget = {
  open(seed?: string) {
    state = { open: true, seed: seed ?? null };
    emit();
  },
  close() {
    state = { ...state, open: false };
    emit();
  },
  consumeSeed(): string | null {
    const s = state.seed;
    if (s !== null) {
      state = { ...state, seed: null };
      emit();
    }
    return s;
  },
};

export function useOgWidgetState() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
