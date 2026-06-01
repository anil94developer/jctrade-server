import { Router } from 'express';
import { BuyOrder } from '../models/BuyOrder.js';
import { PaymentUpi } from '../models/PaymentUpi.js';
import { authAdmin, authUser } from '../middleware/auth.js';
import { getSetting } from '../utils/settingsHelper.js';
import { buildBuyCdmDetails, getAllowedBuyMethods, getBuyPaymentModesSetting } from '../utils/buyPaymentHelper.js';
import { parseDataTablesQuery, dataTablesResponse, parsePageQuery, pageResponse } from '../utils/pagination.js';

const router = Router();

/** Pick next active UPI (round-robin by lastAssignedAt). */
async function assignPaymentUpi() {
  const slot = await PaymentUpi.findOne({ active: true }).sort({ lastAssignedAt: 1, createdAt: 1 });
  if (!slot) return null;
  slot.lastAssignedAt = new Date();
  await slot.save();
  return slot;
}

/** User: load buy page — payment options + UPI slot and/or CDM bank details */
router.get('/checkout', authUser, async (_req, res) => {
  try {
    const maintenance = await getSetting('maintenanceMode', false);
    if (maintenance) {
      return res.status(503).json({ message: 'System is under maintenance. Please try later.' });
    }

    const buyUsdtPrice = Number(await getSetting('buyUsdtPrice', 0));
    if (!buyUsdtPrice || buyUsdtPrice <= 0) {
      return res.status(503).json({ message: 'Buy USDT price is not configured. Contact admin.' });
    }

    const buyPaymentModes = await getBuyPaymentModesSetting();
    const allowedMethods = getAllowedBuyMethods(buyPaymentModes);

    let upi = null;
    if (allowedMethods.includes('upi')) {
      const slot = await assignPaymentUpi();
      if (slot) {
        const qrImage = slot.qrImage && String(slot.qrImage).length > 20 ? slot.qrImage : null;
        upi = {
          paymentUpiId: String(slot._id),
          upiId: slot.upiId,
          label: slot.label || '',
          qrImage,
        };
      }
    }

    let cdm = null;
    if (allowedMethods.includes('cdm')) {
      cdm = await buildBuyCdmDetails();
    }

    if (allowedMethods.length === 1 && allowedMethods[0] === 'upi' && !upi) {
      return res.status(503).json({ message: 'No payment UPI available. Try again later.' });
    }
    if (allowedMethods.length === 1 && allowedMethods[0] === 'cdm' && !cdm) {
      return res.status(503).json({ message: 'CDM bank details are not configured. Contact admin.' });
    }
    if (!upi && !cdm) {
      return res.status(503).json({ message: 'No buy payment method is available. Contact admin.' });
    }

    res.json({
      buyPaymentModes,
      allowedMethods,
      buyUsdtPrice,
      binancePrice: Number(await getSetting('binancePrice', 0)) || buyUsdtPrice,
      upi,
      cdm,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/orders', authUser, async (req, res) => {
  try {
    const maintenance = await getSetting('maintenanceMode', false);
    if (maintenance) {
      return res.status(503).json({ message: 'System is under maintenance. Please try later.' });
    }

    const {
      paymentMethod: methodRaw,
      paymentUpiId,
      usdtAmount,
      phone,
      paidToUpiId,
      walletAddress,
      cdmTxnReference,
    } = req.body;

    const buyPaymentModes = await getBuyPaymentModesSetting();
    const allowedMethods = getAllowedBuyMethods(buyPaymentModes);
    const paymentMethod = String(methodRaw || 'upi').toLowerCase();

    if (!allowedMethods.includes(paymentMethod)) {
      return res.status(400).json({
        message:
          paymentMethod === 'cdm'
            ? 'CDM payment is not enabled. Use UPI or contact admin.'
            : 'UPI payment is not enabled. Use CDM or contact admin.',
      });
    }

    const usdt = Number(usdtAmount);
    const phoneStr = String(phone || '').trim();
    const wallet = String(walletAddress || '').trim();

    if (!Number.isFinite(usdt) || usdt <= 0) {
      return res.status(400).json({ message: 'Valid USDT amount is required' });
    }
    if (!phoneStr) return res.status(400).json({ message: 'Phone number is required' });
    if (!wallet) {
      return res.status(400).json({ message: 'Wallet address is required. Add it in Edit Profile.' });
    }

    const buyRate = Number(await getSetting('buyUsdtPrice', 0));
    if (!buyRate || buyRate <= 0) {
      return res.status(503).json({ message: 'Buy USDT price is not configured' });
    }

    const inrValue = Math.round(usdt * buyRate * 100) / 100;

    let orderPayload = {
      userId: req.userId,
      paymentMethod,
      usdtAmount: usdt,
      inrValue,
      buyRate,
      phone: phoneStr,
      walletAddress: wallet,
      paidToUpiId: '',
      cdmTxnReference: '',
      paymentUpiId: null,
    };

    if (paymentMethod === 'upi') {
      const paidUpi = String(paidToUpiId || '').trim();
      if (!paymentUpiId) {
        return res.status(400).json({ message: 'Payment slot is required. Reload the buy page.' });
      }
      if (!paidUpi) return res.status(400).json({ message: 'Paid-to UPI ID is required' });

      const slot = await PaymentUpi.findById(paymentUpiId);
      if (!slot || !slot.active) {
        return res.status(400).json({ message: 'Payment slot expired. Reload the buy page and pay again.' });
      }
      if (paidUpi.toLowerCase() !== slot.upiId.toLowerCase()) {
        return res.status(400).json({ message: 'Paid UPI must match the UPI shown on this page' });
      }

      orderPayload.paymentUpiId = slot._id;
      orderPayload.paidToUpiId = paidUpi;
    } else {
      const cdmRef = String(cdmTxnReference || '').trim();
      if (!cdmRef) {
        return res.status(400).json({ message: 'CDM / bank transaction reference is required' });
      }
      const cdm = await buildBuyCdmDetails();
      if (!cdm) {
        return res.status(503).json({ message: 'CDM payment is not configured' });
      }
      orderPayload.cdmTxnReference = cdmRef;
    }

    const order = await BuyOrder.create(orderPayload);

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/orders/mine', authUser, async (req, res) => {
  try {
    const { page, limit, skip } = parsePageQuery(req.query);
    const filter = { userId: req.userId };
    const [total, list] = await Promise.all([
      BuyOrder.countDocuments(filter),
      BuyOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    res.json(pageResponse(list, total, page, limit));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/orders/mine/:id', authUser, async (req, res) => {
  try {
    const order = await BuyOrder.findOne({ _id: req.params.id, userId: req.userId })
      .populate('paymentUpiId', 'upiId label')
      .lean();
    if (!order) return res.status(404).json({ message: 'Not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/orders/datatable', authAdmin, async (req, res) => {
  try {
    const { draw, start, length, search, orderDir } = parseDataTablesQuery(req.query);
    const filter = search
      ? {
          $or: [
            { phone: { $regex: search, $options: 'i' } },
            { paidToUpiId: { $regex: search, $options: 'i' } },
            { walletAddress: { $regex: search, $options: 'i' } },
            { cdmTxnReference: { $regex: search, $options: 'i' } },
            { paymentMethod: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const [recordsTotal, recordsFiltered, rows] = await Promise.all([
      BuyOrder.countDocuments(),
      BuyOrder.countDocuments(filter),
      BuyOrder.find(filter)
        .populate('userId', 'email name uid phone blocked')
        .populate('paymentUpiId', 'upiId label')
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

router.patch('/orders/:id/status', authAdmin, async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await BuyOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Not found' });

    order.status = status;
    if (adminNote !== undefined) order.adminNote = String(adminNote).trim();
    await order.save();

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
