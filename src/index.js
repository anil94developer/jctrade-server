import 'dotenv/config';
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

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/dashboard', dashboardRoutes);

async function start() {
  await connectDB();
  await seedDefaults();
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
