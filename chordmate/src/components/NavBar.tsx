import type { MouseEvent } from "react";
import { Link, NavLink, useLocation, useMatch, useNavigate } from "react-router-dom";

const LINK_CLASSES =
  "px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 " +
  "focus-visible:outline-2 focus-visible:outline-blue-500";

/**
 * On a song page, the bar doubles as the song's toolbar: the page fills `slotRef` (see
 * NavBarPortal) and About is left out. The bar is sticky and therefore positioned, so popovers
 * from the toolbar open below it.
 */
export default function NavBar({ slotRef }: { slotRef: (element: HTMLDivElement | null) => void }) {
  const onSongPage = useMatch("/songs/:id") !== null;
  const navigate = useNavigate();
  const location = useLocation();
  // Going back returns to the list as it was left (search, scroll position). A song opened
  // directly has nothing in this app to go back to; then the link opens the list.
  const goBack = (event: MouseEvent) => {
    if (location.key !== "default") {
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
      {!onSongPage && (
        <NavLink
          to="/about"
          className={({ isActive }) => `${LINK_CLASSES} ${isActive ? "font-semibold" : ""}`}
        >
          About
        </NavLink>
      )}
    </nav>
  );
}
