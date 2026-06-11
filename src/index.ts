import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import dotenv from "dotenv";

// Import database
import { db } from "./db";

// Import routes (EIK BAAR, SAHI JAGAH SE)
import authRoutes from './auth/auth.routes';
import productRoutes from './products/products.routes';
import categoryRoutes from './products/categories.routes'; // ✅ Category routes alag se
import adminRoutes from './admin/admin.routes';
import apiKeyRoutes from './admin/api-keys.routes';

// Import middleware
import { errorHandler } from './middleware/error.middleware';
import { requireAuth } from './middleware/auth.middleware';
import { validateApiKey } from './middleware/api-key.middleware';

// Import passport strategies
import './auth/strategies/local.strategy';
import './auth/strategies/github.strategy';
import './auth/strategies/google.strategy';
import './auth/strategies/jwt.strategy';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000; 

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// ========== ROUTES ==========

// Public routes - No auth required
app.use('/auth', authRoutes); // All auth endpoints

// API routes - API key required (for external consumers)
app.use('/api', validateApiKey);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes); // You'll create this

// Protected routes (JWT + RBAC required)
app.use('/admin', requireAuth, adminRoutes);
app.use('/admin/api-keys', requireAuth, apiKeyRoutes);

// Root endpoint
app.get("/", (_req, res) => {
  res.json({
    message: "API Running...",
    endpoints: {
      auth: "/auth",
      api: "/api",
      admin: "/admin",
      health: "/health"
    }
  });
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ 
    error: "Route not found",
    message: "The requested endpoint does not exist"
  });
});

// Error handling (HAMESHA LAST MEIN)
app.use(errorHandler);

// ========== START SERVER (SIRF EIK BAAR) ==========
const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║   🚀 Server Running Successfully!                 ║
╠═══════════════════════════════════════════════════╣
║   📍 URL:      http://localhost:${PORT}            ║
║   ❤️ Health:   http://localhost:${PORT}/health     ║
║   🔐 Auth:     http://localhost:${PORT}/auth       ║
║   📦 API:      http://localhost:${PORT}/api        ║
║   🛡️ Admin:    http://localhost:${PORT}/admin      ║
╚═══════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default app;
