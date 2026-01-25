import { useEffect } from "react";
import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import SongsManager from "./components/SongsManager";
import useSystemTheme from "./hooks/useSystemTheme";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import About from "./components/About";
import SongDetail from "./components/SongDetail";

const link = new HttpLink({
  uri: `http://${window.location.hostname}:3000/graphql`, // your Rust backend
});

const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});

export default function App() {
  const theme = useSystemTheme();
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return (
    <ApolloProvider client={client}>
      <Router>
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <nav className="p-4 border-b">
            <Link to="/">Songs</Link> | <Link to="/about">About</Link>
          </nav>
          <div className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/songs" replace />} />
              <Route path="/about" element={<About />} />
              <Route path="/songs" element={<SongsManager />} />
              <Route path="songs/:id" element={<SongDetail />} />
            </Routes>
          </div>
        </div>
      </Router>
    </ApolloProvider>
  );
}
