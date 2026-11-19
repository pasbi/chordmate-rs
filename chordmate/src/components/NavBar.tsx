import type { MouseEvent } from "react";
import { Link, NavLink, useMatch, useNavigate } from "react-router-dom";

function hasEarlierEntry() {
  const state: unknown = window.history.state;
  const index = (state as { idx?: unknown } | null)?.idx;
  return typeof index === "number" && index > 0;
}

/** The pages besides the songs, linked from the bar on every page but a song's. */
const TEXT_PAGES = [
  { path: "/import", label: "Import" },
  { path: "/help", label: "Help" },
  { path: "/about", label: "About" },
];

const LINK_CLASSES =
  "px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 " +
  "focus-visible:outline-2 focus-visible:outline-blue-500";

/**
 * On a song page, the bar doubles as the song's toolbar: the page fills `slotRef` (see
 * NavBarPortal) and the other pages' links are left out. The bar is sticky and therefore positioned, so popovers
 * from the toolbar open below it.
 */
export default function NavBar({ slotRef }: { slotRef: (element: HTMLDivElement | null) => void }) {
  const onSongPage = useMatch("/songs/:id") !== null;
  const navigate = useNavigate();
  // Going back returns to the list as it was left (search, scroll position). A song opened
  // directly, or by an import (which replaces the Ultimate Guitar page), has nothing in this app
  // to go back to; then the link opens the list. The router numbers this tab's entries in history.state.idx.
  const goBack = (event: MouseEvent) => {
    if (hasEarlierEntry()) {
      event.preventDefault();
      navigate(-1);
    }
  };
  return (
    <nav className="sticky top-0 z-10 flex items-center gap-2 h-12 px-2 sm:px-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {onSongPage ? (
        <Link
          to="/songs"
          onClick={goBack}
          title="Back to songs"
          aria-label="Back to songs"
          className={LINK_CLASSES}
        >
          ←
        </Link>
      ) : (
        <Link to="/songs" className={`${LINK_CLASSES} text-lg font-bold`}>
          ChordMate
        </Link>
      )}
      <div ref={slotRef} className="flex-1 min-w-0 flex items-center gap-2" />
      {!onSongPage &&
        TEXT_PAGES.map(({ path, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `${LINK_CLASSES} ${isActive ? "font-semibold" : ""}`}
          >
            {label}
          </NavLink>
        ))}
    </nav>
  );
}
