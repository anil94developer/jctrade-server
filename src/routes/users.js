import { Router } from 'express';
import { User } from '../models/User.js';
import { Transaction } from '../models/Transaction.js';
import { authAdmin, authUser } from '../middleware/auth.js';
import { parseDataTablesQuery, dataTablesResponse } from '../utils/pagination.js';
import { getSetting } from '../utils/settingsHelper.js';

function usdtFromTransaction(tx, platformRate) {
  const u = Number(tx.usdtAmount);
  if (u > 0) return u;
  const rate = Number(platformRate);
  const val = Number(tx.value);
  if (rate > 0 && val > 0) return val / rate;
  return 0;
}

const router = Router();

const USER_COLUMNS = ['uid', 'name', 'email', 'phone', 'upiId', 'balance', 'blocked', 'createdAt'];

router.get('/me/stats', authUser, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const filter = { userId: req.userId, createdAt: { $gte: startOfDay } };
    const [inTransaction, success] = await Promise.all([
      Transaction.countDocuments({ ...filter, status: 'pending' }),
      Transaction.countDocuments({ ...filter, status: 'approved' }),
    ]);
    res.json({ inTransaction, success });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me/earnings', authUser, async (req, res) => {
  try {
    const [binancePrice, platformPrice] = await Promise.all([
      getSetting('binancePrice', 0),
      getSetting('usdtPrice', 0),
    ]);
    const binance = Number(binancePrice) || 0;
    const platform = Number(platformPrice) || 0;
    const spreadPerUsdt = Math.max(0, platform - binance);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [todayTxs, allApproved] = await Promise.all([
      Transaction.find({
        userId: req.userId,
        status: 'approved',
        createdAt: { $gte: startOfDay },
      }).lean(),
      Transaction.find({ userId: req.userId, status: 'approved' }).lean(),
    ]);

    const sumUsdt = (list) =>
      list.reduce((sum, tx) => sum + usdtFromTransaction(tx, platform), 0);

    const todayUsdtSold = sumUsdt(todayTxs);
    const totalUsdtSold = sumUsdt(allApproved);

    res.json({
      binancePrice: binance,
      platformPrice: platform,
      spreadPerUsdt,
      todayUsdtSold,
      todayEarning: spreadPerUsdt * todayUsdtSold,
      totalUsdtSold,
      totalEarning: spreadPerUsdt * totalUsdtSold,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', authUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-__v');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/me', authUser, async (req, res) => {
  try {
    const { name, phone, upiId } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(upiId !== undefined && { upiId }),
      },
      { new: true }
    ).select('-__v');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/datatable', authAdmin, async (req, res) => {
  try {
    const { draw, start, length, search, orderCol, orderDir } = parseDataTablesQuery(req.query);
    const filter = search
      ? {
          $or: [
            { email: { $regex: search, $options: 'i' } },
            { name: { $regex: search, $options: 'i' } },
            { uid: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const sortField = USER_COLUMNS[orderCol] || 'createdAt';
    const [recordsTotal, recordsFiltered, users] = await Promise.all([
      User.countDocuments(),
      User.countDocuments(filter),
      User.find(filter)
        .sort({ [sortField]: orderDir })
        .skip(start)
        .limit(length)
        .select('-__v')
        .lean(),
    ]);

    res.json(dataTablesResponse(draw, recordsTotal, recordsFiltered, users));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', authAdmin, async (_req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select('-__v');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', authAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-__v');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const transactions = await Transaction.find({ userId: user._id }).sort({ createdAt: -1 });
    res.json({ user, transactions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/block', authAdmin, async (req, res) => {
  try {
    const { blocked } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { blocked: Boolean(blocked) },
      { new: true }
    ).select('-__v');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
