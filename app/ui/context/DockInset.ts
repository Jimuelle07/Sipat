import { createContext, useContext } from 'react';

/** Height of the floating tab dock; tab screens pad their scroll end by it. 0 outside the tabs. */
export const DockInsetContext = createContext(0);

export function useDockInset(): number {
  return useContext(DockInsetContext);
}
