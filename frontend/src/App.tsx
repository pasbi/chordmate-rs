import React, {useEffect} from 'react';
import './App.css';
import {ApolloClient, InMemoryCache, HttpLink} from "@apollo/client";
import {ApolloProvider} from "@apollo/client/react";
import SongsManager from "components/SongsManager";
import useSystemTheme from "hooks/useSystemTheme";
import {BrowserRouter as Router, Routes, Route, Link} from "react-router-dom"
import About from "components/About";
import SongDetail from "components/SongDetail";

const link = new HttpLink({
    uri: `http://${window.location.hostname}:3000/graphql`, // your Rust backend
});

const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
})

function App() {
    const theme = useSystemTheme();
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);
    return (
        <ApolloProvider client={client}>
            <Router>
                <div>
                    <nav>
                        <Link to="/">Songs</Link> | <Link to="/about">About</Link>
                    </nav>
                    <Routes>
                        <Route path="/" element={<SongsManager/>}/>
                        <Route path="/about" element={<About/>}/>
                        <Route path="/songs/:id" element={<SongDetail/>}/>
                    </Routes>
                </div>
            </Router>
        </ApolloProvider>
    );
}

export default App;
