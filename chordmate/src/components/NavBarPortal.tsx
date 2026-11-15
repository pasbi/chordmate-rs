import { type ReactNode, useContext } from "react";
import { createPortal } from "react-dom";
import { NavBarSlotContext } from "./navBarSlot";

/** Renders `children` into the navigation bar, e.g. a page's title and toolbar buttons. */
export function NavBarPortal({ children }: { children: ReactNode }) {
  const slot = useContext(NavBarSlotContext);
  return slot ? createPortal(children, slot) : null;
}
