import { createContext } from "react";

/** The element in the navigation bar that pages can fill with their own controls. */
export const NavBarSlotContext = createContext<HTMLElement | null>(null);
