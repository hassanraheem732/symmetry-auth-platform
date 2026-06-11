// apps/api/src/index.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { json } from "express";

// Config
import { env } from "./config/env";

// Database
import { db, testConnection } from "./db";

// Routes
import authRoutes from "./auth/auth.routes";
import productsRoutes from "./products/products.routes";
import adminRoutes from "./admin/admin.routes";
import apiKeysRoutes from "./admin/api-keys.routes";

// Middleware
import { errorHandler } from "./middleware/error.middleware";
import { requireAuth } from "./middleware/auth.middleware";
import { validateApiKey } from "./middleware/api-key.middleware";

// GraphQL
import { typeDefs, resolvers } from "./graphql/schema";
import { createGraphQLContext } from "./graphql/context";

// Passport Strategies
import "./auth/strategies/local.strategy";
import "./auth/strategies/google.strategy";
import "./auth/strategies/github.strategy";
import "./auth/strategies/jwt.strategy";

const app = express();

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// ========== GRAPHQL SETUP ==========
const graphqlServer = new ApolloServer({
  typeDefs,
  resolvers,
});

await graphqlServer.start();
app.use(
  "/graphql",
  expressMiddleware(graphqlServer, {
    context: createGraphQLContext,
  })
);

// ========== ROUTES ==========

// Public routes
app.use("/auth", authRoutes);

// API routes (API key required)
app.use("/api", validateApiKey);
app.use("/api/products", productsRoutes);

// Protected routes (JWT + RBAC)
app.use("/admin", requireAuth, adminRoutes);
app.use("/admin/api-keys", requireAuth, apiKeysRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV
  });
});

// Root endpoint
app.get("/", (_req, res) => {
  res.json({
    name: "Symmetry Group Auth Platform",
    version: "1.0.0",
    endpoints: {
      auth: "/auth",
      api: "/api",
      graphql: "/graphql",
      admin: "/admin",
      health: "/health"
    }
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use(errorHandler);

// ========== START SERVER ==========
await testConnection();

app.listen(env.PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║   🚀 SYMMETRY GROUP - Auth Platform                       ║
╠═══════════════════════════════════════════════════════════╣
║   📍 Server:    http://localhost:${env.PORT}               ║
║   🔐 Auth:      http://localhost:${env.PORT}/auth          ║
║   📦 API:       http://localhost:${env.PORT}/api           ║
║   🎯 GraphQL:   http://localhost:${env.PORT}/graphql       ║
║   🛡️ Admin:     http://localhost:${env.PORT}/admin         ║
║   ❤️ Health:    http://localhost:${env.PORT}/health        ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;