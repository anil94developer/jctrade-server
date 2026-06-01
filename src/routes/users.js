import { Router } from 'express';
import { User } from '../models/User.js';
import { Transaction } from '../models/Transaction.js';
import { authAdmin, authUser } from '../middleware/auth.js';
import { parseDataTablesQuery, dataTablesResponse } from '../utils/pagination.js';
const router = Router();

const USER_COLUMNS = ['uid', 'name', 'email', 'phone', 'upiId', 'balance', 'blocked', 'createdAt'];

function sumInrValues(txs) {
  return txs.reduce((sum, tx) => sum + (Number(tx.value) || 0), 0);
}

router.get('/me/stats', authUser, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayFilter = { userId: req.userId, createdAt: { $gte: startOfDay } };
    const [pendingToday, approvedToday] = await Promise.all([
      Transaction.find({ ...todayFilter, status: 'pending' }).lean(),
      Transaction.find({ ...todayFilter, status: 'approved' }).lean(),
    ]);
    res.json({
      inTransaction: pendingToday.length,
      success: approvedToday.length,
      inTransactionAmount: sumInrValues(pendingToday),
      successAmount: sumInrValues(approvedToday),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me/earnings', authUser, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const userFilter = { userId: req.userId };

    const [pendingToday, approvedToday, pendingAll, approvedAll] = await Promise.all([
      Transaction.find({ ...userFilter, status: 'pending', createdAt: { $gte: startOfDay } }).lean(),
      Transaction.find({ ...userFilter, status: 'approved', createdAt: { $gte: startOfDay } }).lean(),
      Transaction.find({ ...userFilter, status: 'pending' }).lean(),
      Transaction.find({ ...userFilter, status: 'approved' }).lean(),
    ]);

    res.json({
      todayInTransactionAmount: sumInrValues(pendingToday),
      todaySuccessAmount: sumInrValues(approvedToday),
      inTransactionAmount: sumInrValues(pendingAll),
      successAmount: sumInrValues(approvedAll),
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
    const { name, phone, upiId, walletAddress } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(upiId !== undefined && { upiId }),
        ...(walletAddress !== undefined && { walletAddress: String(walletAddress).trim() }),
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
