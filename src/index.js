import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { seedDefaults } from './utils/seed.js';
import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import usersRoutes from './routes/users.js';
import transactionsRoutes from './routes/transactions.js';
import walletRoutes from './routes/wallet.js';
import dashboardRoutes from './routes/dashboard.js';
import referralRoutes from './routes/referrals.js';
import bannerRoutes from './routes/banners.js';
import paymentUpiRoutes from './routes/payment-upis.js';
import buyRoutes from './routes/buy.js';
import { initSocket } from './socket.js';

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 4000;

/** Comma-separated list; if unset, all origins allowed (dev + multi-frontend). */
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : null;

const corsOptions = {
  origin(origin, callback) {
    if (!CORS_ORIGINS || CORS_ORIGINS.length === 0) {
      callback(null, true);
      return;
    }
    if (!origin) {
      callback(null, true);
      return;
    }
    callback(null, CORS_ORIGINS.includes(origin));
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  credentials: false,
  maxAge: 86400,
};

const corsMiddleware = cors(corsOptions);
app.set('trust proxy', 1);
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/payment-upis', paymentUpiRoutes);
app.use('/api/buy', buyRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Ensure CORS headers on errors (avoids misleading "blocked by CORS" in the browser)
app.use((err, req, res, _next) => {
  corsMiddleware(req, res, () => {
    const status = err.status && Number.isInteger(err.status) ? err.status : 500;
    const message = err.message || 'Server error';
    if (status >= 500) console.error(err);
    res.status(status).json({ message });
  });
});

async function start() {
  await connectDB();
  await seedDefaults();
  initSocket(httpServer);
  httpServer.listen(PORT, () => console.log(`API + WebSocket running on http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
