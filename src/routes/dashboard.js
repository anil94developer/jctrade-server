import { Router } from 'express';
import { User } from '../models/User.js';
import { Transaction } from '../models/Transaction.js';
import { Setting } from '../models/Setting.js';
import { authAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/stats', authAdmin, async (_req, res) => {
  try {
    const [usersCount, transactionsCount, pendingCount, setting] = await Promise.all([
      User.countDocuments(),
      Transaction.countDocuments(),
      Transaction.countDocuments({ status: 'pending' }),
      Setting.findOne({ key: 'usdtPrice' }),
    ]);
    const recent = await Transaction.find()
      .populate('userId', 'email name uid')
      .sort({ createdAt: -1 })
      .limit(5);
    res.json({
      usersCount,
      transactionsCount,
      pendingCount,
      usdtPrice: setting?.value ?? 0,
      recent,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
