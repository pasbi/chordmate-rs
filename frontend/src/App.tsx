import React, {useEffect} from 'react';
import './App.css';
import {ApolloClient, InMemoryCache, HttpLink} from "@apollo/client";
import {ApolloProvider} from "@apollo/client/react";
import SongManager from "components/SongManager";
import useSystemTheme from "hooks/useSystemTheme";

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
            <main style={{fontFamily: "sans-serif", padding: "1rem"}}>
                <h1>My GraphQL Music App</h1>
                <SongManager/>
            </main>
        </ApolloProvider>
    );
}

export default App;
