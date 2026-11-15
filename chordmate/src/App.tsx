import { useState } from "react";
import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import SongsManager from "./components/SongsManager";
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router-dom";
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

function Layout() {
  const [navBarSlot, setNavBarSlot] = useState<HTMLElement | null>(null);
  return (
    <NavBarSlotContext.Provider value={navBarSlot}>
      <div className="flex flex-col h-full min-h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <NavBar slotRef={setNavBarSlot} />
        <div className="flex-1 flex flex-col overflow-auto">
          <Outlet />
        </div>
      </div>
    </NavBarSlotContext.Provider>
  );
}

// A data router (rather than <BrowserRouter>) is required for useBlocker, which the song page
// uses to ask before leaving with unsaved changes.
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Navigate to="/songs" replace /> },
      { path: "/about", element: <About /> },
      { path: "/songs", element: <SongsManager /> },
      { path: "/songs/:id", element: <SongDetail /> },
    ],
  },
]);

export default function App() {
  return (
    <ApolloProvider client={client}>
      <RouterProvider router={router} />
    </ApolloProvider>
  );
}
