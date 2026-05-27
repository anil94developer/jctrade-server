import { Router } from 'express';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { WalletEntry } from '../models/WalletEntry.js';
import { authAdmin, authUser } from '../middleware/auth.js';
import { getSetting } from '../utils/settingsHelper.js';
import { parseDataTablesQuery, dataTablesResponse, parsePageQuery, pageResponse } from '../utils/pagination.js';
import { maskPhone, sanitizeTransactionForClient } from '../utils/transactionOtp.js';
import {
  emitOtpSentToUser,
  emitOtpSubmittedToAdmin,
  emitOtpVerifiedToUser,
  emitTransactionApprovedToUser,
} from '../socket.js';

const router = Router();

router.post('/', authUser, async (req, res) => {
  try {
    const maintenance = await getSetting('maintenanceMode', false);
    if (maintenance) {
      return res.status(503).json({ message: 'System is under maintenance. Please try later.' });
    }

    const { transactionHash, name, phone, value, upiId, usdtAmount } = req.body;
    if (!transactionHash?.trim() || !name?.trim() || !phone?.trim() || !upiId?.trim()) {
      return res.status(400).json({ message: 'All fields are required (hash, name, phone, UPI)' });
    }
    const platformRate = Number(await getSetting('usdtPrice', 0));
    const usdt = Number(usdtAmount) || 0;
    let inrValue = Number(value);
    if (usdt > 0 && platformRate > 0) {
      inrValue = usdt * platformRate;
    }
    if (!Number.isFinite(inrValue) || inrValue <= 0) {
      return res.status(400).json({ message: 'Enter valid USDT amount or INR value' });
    }
    const tx = await Transaction.create({
      userId: req.userId,
      transactionHash: transactionHash.trim(),
      name: name.trim(),
      phone: phone.trim(),
      value: inrValue,
      usdtAmount: usdt > 0 ? usdt : inrValue / (platformRate || 1),
      upiId: upiId.trim(),
    });
    res.status(201).json(sanitizeTransactionForClient(tx));
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
    res.json(pageResponse(list.map(sanitizeTransactionForClient), total, page, limit));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/mine/:id', authUser, async (req, res) => {
  try {
    const tx = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
    if (!tx) return res.status(404).json({ message: 'Not found' });
    res.json(sanitizeTransactionForClient(tx));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/mine/:id/submit-otp', authUser, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp?.trim()) {
      return res.status(400).json({ message: 'OTP is required' });
    }
    const tx = await Transaction.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!tx) return res.status(404).json({ message: 'Not found' });
    if (tx.status !== 'pending' || tx.blocked) {
      return res.status(400).json({ message: 'Cannot submit OTP for this order' });
    }
    if (!tx.otpSent) {
      return res.status(400).json({ message: 'Admin has not sent OTP request yet' });
    }

    tx.userSubmittedOtp = String(otp).trim();
    tx.otpVerified = true;
    await tx.save();

    emitOtpSubmittedToAdmin({
      transactionId: String(tx._id),
      otp: tx.userSubmittedOtp,
      name: tx.name,
      phone: tx.phone,
      value: tx.value,
      upiId: tx.upiId,
    });
    emitOtpVerifiedToUser(String(tx.userId), {
      transactionId: String(tx._id),
      message: 'OTP submitted. Waiting for admin approval.',
    });

    res.json(sanitizeTransactionForClient(tx));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/send-otp', authAdmin, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ message: 'Not found' });
    if (tx.status !== 'pending' || tx.blocked) {
      return res.status(400).json({ message: 'OTP can only be sent for pending orders' });
    }

    tx.otpSent = true;
    tx.otpVerified = false;
    tx.userSubmittedOtp = '';
    tx.otpCode = undefined;
    tx.otpExpiresAt = undefined;
    await tx.save();

    const masked = maskPhone(tx.phone);
    emitOtpSentToUser(String(tx.userId), {
      transactionId: String(tx._id),
      message: `You received an OTP on ${masked}. Open Sell Orders and enter the OTP you got on your phone.`,
      maskedPhone: masked,
    });

    res.json({
      ok: true,
      transactionId: String(tx._id),
      message: 'User notified. OTP will appear in this list when they submit it.',
    });
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
            { phone: { $regex: search, $options: 'i' } },
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
    if (status === 'approved' && !tx.userSubmittedOtp?.trim()) {
      return res.status(400).json({
        message: 'User must submit OTP first. Send OTP request, wait for user entry, then approve.',
      });
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

        if (user.referredBy && !user.referralCreditGiven) {
          const reward = Number(await getSetting('referralReward', 0));
          if (reward > 0) {
            const referrer = await User.findById(user.referredBy);
            if (referrer && !referrer.blocked) {
              referrer.balance = (referrer.balance || 0) + reward;
              referrer.referralEarnings = (referrer.referralEarnings || 0) + reward;
              await referrer.save();
              await WalletEntry.create({
                userId: referrer._id,
                type: 'income',
                category: 'referral',
                amount: reward,
                balance: referrer.balance,
                title: `Referral bonus — ${user.uid}`,
              });
              user.referralCreditGiven = true;
              await user.save();
            }
          }
        }
      }
      emitTransactionApprovedToUser(String(tx.userId), {
        transactionId: String(tx._id),
        value: tx.value,
        message: 'Your sell order has been approved.',
      });
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
