import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';

import { connectDB } from './db.js';
import { typeDefs } from './graphql/typeDefs.js';
import { resolvers } from './graphql/resolvers.js';

const PORT = process.env.PORT || 4000;

const app = express();
const httpServer = http.createServer(app);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  // Habilitados explícitamente: Apollo los desactiva por defecto con NODE_ENV=production (Render)
  introspection: true,
  plugins: [
    ApolloServerPluginLandingPageLocalDefault({ embed: true }), // Apollo Sandbox embebido en /graphql
    ApolloServerPluginDrainHttpServer({ httpServer }),
  ],
});

await connectDB();
await server.start();

app.get('/', (_req, res) => res.redirect('/graphql'));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/graphql', cors(), express.json(), expressMiddleware(server));

await new Promise((resolve) => httpServer.listen({ port: PORT, host: '0.0.0.0' }, resolve));
console.log(`Servidor GraphQL listo en http://localhost:${PORT}/graphql`);
