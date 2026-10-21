import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { validateEnv } from './config/env';
import { getAllowedOrigins, isAllowedOrigin } from './config/origins';
import { connectDB, getDatabaseStatus } from './config/db';
import apiRouter from './routes/api';
import { initSocket } from './services/socketService';
import { logMissingProviderKeys } from './services/externalMedia';
import { requestIdMiddleware, notFoundHandler, errorHandler } from './middleware/errorHandler';

dotenv.config();
validateEnv();
logMissingProviderKeys();

if (process.env.NODE_ENV !== 'production' && process.env.RENDER) {
  console.warn('[Kinetic] WARNING: Running in non-production mode on Render. Set NODE_ENV=production.');
}

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// ── CORS Configuration ──
// Allowed origins live in config/origins.ts (FRONTEND_URL may hold several, comma separated).
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman). Cookie endpoints
    // (/auth/refresh, /auth/logout) additionally require an allowed Origin header.
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) return callback(null, true);
    console.warn(`[Kinetic CORS] Blocked origin: ${origin}`);
    callback(Object.assign(new Error('CORS: origin not allowed'), { status: 403 }));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Kinetic-Client'],
  credentials: true,
}));

// ── Security Headers (Helmet) ──
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ── Request ID ──
app.use(requestIdMiddleware);

// ── Body Parsers (Cloudinary handles signed media uploads directly) ──
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// ── Health Check ──
app.get('/api/health', (_req, res) => {
  const database = getDatabaseStatus();

  res.json({
    status: database.connected ? 'ok' : 'degraded',
    platform: 'Kinetic Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database,
    providers: {
      jamendo: Boolean(process.env.JAMENDO_CLIENT_ID),
      pexels: Boolean(process.env.PEXELS_API_KEY),
    },
  });
});

// ── API Routes ──
app.use('/api', apiRouter);

// ── 404 and Error Handlers ──
app.use('/api/*', notFoundHandler);
app.use(notFoundHandler);
app.use(errorHandler);

export const httpServer = http.createServer(app);
initSocket(httpServer, getAllowedOrigins());

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`\n🎵 Kinetic Backend Server running at http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   API:    http://localhost:${PORT}/api\n`);

    connectDB().catch((err) => {
      console.error('[Kinetic] Database initialization failed:', err);
    });
  });
}

export default app;
