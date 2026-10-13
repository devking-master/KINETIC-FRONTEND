import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { connectDB, getDatabaseStatus } from './config/db';
import apiRouter from './routes/api';
import { initSocket } from './services/socketService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── CORS Configuration ──
// FRONTEND_URL can hold one origin, or several comma-separated
// (e.g. "https://kinetic-frontend-ecru.vercel.app,https://my-preview-branch.vercel.app")
// so you can whitelist new deploy previews without touching this code.
const extraOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, '')) // trim whitespace + trailing slash
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  ...extraOrigins,
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/+$/, '');
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    console.warn(`[Kinetic CORS] Blocked origin: ${origin}`);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── Security Headers (Helmet) ──
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

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
  });
});

// ── API Routes ──
app.use('/api', apiRouter);

// ── 404 Handler ──
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ── Global Error Handler ──
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Kinetic Error]:', err.stack || err.message);
  res.status(500).json({
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  });
});

export const httpServer = http.createServer(app);
initSocket(httpServer, allowedOrigins);

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
