import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * A page besides the songs (Import, Help, About): one readable column under a title, with × to
 * close it and return to the songs.
 */
export function TextPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="w-full px-4 py-4 md:max-w-xl md:mx-auto flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        <Link
          to="/songs"
          title="Close"
          aria-label="Close"
          className="-mr-2 w-10 h-10 shrink-0 flex items-center justify-center rounded text-2xl leading-none text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          ×
        </Link>
      </div>
      {children}
    </div>
  );
}
