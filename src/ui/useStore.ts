import { createContext, useContext, useSyncExternalStore } from "react";
import type { WorkbenchState, WorkbenchStore } from "./store";

const StoreContext = createContext<WorkbenchStore | null>(null);

export const StoreProvider = StoreContext.Provider;

export function useStore(): WorkbenchStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("작업대 저장소를 찾지 못했습니다.");
  return store;
}

/** Subscribes the component tree to the store snapshot. */
export function useWorkbenchState(): WorkbenchState {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
