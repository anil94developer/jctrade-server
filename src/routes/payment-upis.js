import { Router } from 'express';
import { PaymentUpi } from '../models/PaymentUpi.js';
import { authAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', authAdmin, async (_req, res) => {
  try {
    const list = await PaymentUpi.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', authAdmin, async (req, res) => {
  try {
    const upiId = String(req.body.upiId || '').trim();
    if (!upiId) return res.status(400).json({ message: 'UPI ID is required' });

    const qrImage = String(req.body.qrImage || '');
    if (qrImage.length > 3_000_000) {
      return res.status(400).json({ message: 'QR image too large (max ~3MB)' });
    }

    const doc = await PaymentUpi.create({
      upiId,
      label: String(req.body.label || '').trim(),
      qrImage,
      active: req.body.active !== false,
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', authAdmin, async (req, res) => {
  try {
    const doc = await PaymentUpi.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    if (req.body.upiId !== undefined) {
      const upiId = String(req.body.upiId).trim();
      if (!upiId) return res.status(400).json({ message: 'UPI ID cannot be empty' });
      doc.upiId = upiId;
    }
    if (req.body.label !== undefined) doc.label = String(req.body.label).trim();
    if (req.body.qrImage !== undefined) {
      const img = String(req.body.qrImage || '');
      if (img.length > 3_000_000) {
        return res.status(400).json({ message: 'QR image too large' });
      }
      doc.qrImage = img;
    }
    if (req.body.active !== undefined) doc.active = Boolean(req.body.active);

    await doc.save();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', authAdmin, async (req, res) => {
  try {
    const doc = await PaymentUpi.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
