import { useEffect, useState } from "react";
import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import SongsManager from "./components/SongsManager";
import useSystemTheme from "./hooks/useSystemTheme";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import About from "./components/About";
import SongDetail from "./components/SongDetail";
import NavBar from "./components/NavBar";
import { NavBarSlotContext } from "./components/navBarSlot";

const link = new HttpLink({
  uri: `http://${window.location.hostname}:3000/graphql`, // your Rust backend
});

const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});

export default function App() {
  const theme = useSystemTheme();
  const [navBarSlot, setNavBarSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return (
    <ApolloProvider client={client}>
      <Router>
        <NavBarSlotContext.Provider value={navBarSlot}>
          <div className="flex flex-col h-full min-h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <NavBar slotRef={setNavBarSlot} />
            <div className="flex-1 flex flex-col overflow-auto">
              <Routes>
                <Route path="/" element={<Navigate to="/songs" replace />} />
                <Route path="/about" element={<About />} />
                <Route path="/songs" element={<SongsManager />} />
                <Route path="songs/:id" element={<SongDetail />} />
              </Routes>
            </div>
          </div>
        </NavBarSlotContext.Provider>
      </Router>
    </ApolloProvider>
  );
}
