import { Router } from 'express';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { WalletEntry } from '../models/WalletEntry.js';
import { authAdmin, authUser } from '../middleware/auth.js';
import { getSetting } from '../utils/settingsHelper.js';
import { parseDataTablesQuery, dataTablesResponse, parsePageQuery, pageResponse } from '../utils/pagination.js';

const router = Router();

router.post('/', authUser, async (req, res) => {
  try {
    const maintenance = await getSetting('maintenanceMode', false);
    if (maintenance) {
      return res.status(503).json({ message: 'System is under maintenance. Please try later.' });
    }

    const { transactionHash, name, value, upiId } = req.body;
    if (!transactionHash?.trim() || !name?.trim() || value == null || !upiId?.trim()) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const tx = await Transaction.create({
      userId: req.userId,
      transactionHash: transactionHash.trim(),
      name: name.trim(),
      value: Number(value),
      upiId: upiId.trim(),
    });
    res.status(201).json(tx);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/mine', authUser, async (req, res) => {
  try {
    const { page, limit, skip } = parsePageQuery(req.query);
    const filter = { userId: req.userId };
    const [total, list] = await Promise.all([
      Transaction.countDocuments(filter),
      Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    res.json(pageResponse(list, total, page, limit));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/mine/:id', authUser, async (req, res) => {
  try {
    const tx = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
    if (!tx) return res.status(404).json({ message: 'Not found' });
    res.json(tx);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/datatable', authAdmin, async (req, res) => {
  try {
    const { draw, start, length, search, orderDir } = parseDataTablesQuery(req.query);
    const filter = search
      ? {
          $or: [
            { transactionHash: { $regex: search, $options: 'i' } },
            { name: { $regex: search, $options: 'i' } },
            { upiId: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const [recordsTotal, recordsFiltered, rows] = await Promise.all([
      Transaction.countDocuments(),
      Transaction.countDocuments(filter),
      Transaction.find(filter)
        .populate('userId', 'email name uid phone upiId blocked')
        .sort({ createdAt: orderDir })
        .skip(start)
        .limit(length)
        .lean(),
    ]);

    res.json(dataTablesResponse(draw, recordsTotal, recordsFiltered, rows));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', authAdmin, async (_req, res) => {
  try {
    const list = await Transaction.find()
      .populate('userId', 'email name uid phone upiId blocked')
      .sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/status', authAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ message: 'Not found' });
    if (tx.blocked) {
      return res.status(400).json({ message: 'Transaction is blocked. Unblock first.' });
    }

    const prev = tx.status;
    tx.status = status;
    await tx.save();

    if (status === 'approved' && prev !== 'approved') {
      const user = await User.findById(tx.userId);
      if (user && !user.blocked) {
        user.balance = (user.balance || 0) + tx.value;
        await user.save();
        await WalletEntry.create({
          userId: user._id,
          type: 'income',
          category: 'sell',
          amount: tx.value,
          balance: user.balance,
          title: 'Sell-USDT',
          transactionId: tx._id,
        });
      }
    }

    res.json(tx);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/block', authAdmin, async (req, res) => {
  try {
    const { blocked } = req.body;
    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ message: 'Not found' });

    tx.blocked = Boolean(blocked);
    tx.status = blocked ? 'blocked' : tx.status === 'blocked' ? 'pending' : tx.status;
    await tx.save();
    res.json(tx);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
