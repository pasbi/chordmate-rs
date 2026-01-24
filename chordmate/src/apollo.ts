import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

export const client = new ApolloClient({
  link: new HttpLink({
    uri: '/graphql', // served by your Rust backend
  }),
  cache: new InMemoryCache(),
});
