import { Link } from "react-router-dom";
import { TextPage } from "./TextPage.tsx";

const LINK_CLASSES = "text-blue-600 dark:text-blue-400 underline";

export default function About() {
  return (
    <TextPage title="ChordMate">
      <section className="flex flex-col gap-2">
        <p>
          Chord sheets with a built-in Spotify player, for playing along with your songs on any
          device in your network.
        </p>
        <p>
          <Link to="/help" className={LINK_CLASSES}>
            Help
          </Link>{" "}
          explains the chord sheets, the player's keys and the Spotify setup;{" "}
          <Link to="/import" className={LINK_CLASSES}>
            Import
          </Link>{" "}
          brings songs over from Ultimate Guitar.
        </p>
      </section>
    </TextPage>
  );
}
