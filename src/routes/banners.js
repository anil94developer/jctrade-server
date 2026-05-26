import { Router } from 'express';
import { Banner } from '../models/Banner.js';
import { authAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/public', async (_req, res) => {
  try {
    const list = await Banner.find({ enabled: true })
      .sort({ sortOrder: 1, createdAt: -1 })
      .select('title subtitle image link bgColor sortOrder')
      .lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', authAdmin, async (_req, res) => {
  try {
    const list = await Banner.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', authAdmin, async (req, res) => {
  try {
    const { title, subtitle, image, link, bgColor, enabled, sortOrder } = req.body;
    const img = String(image || '');
    if (img.length > 3_000_000) {
      return res.status(400).json({ message: 'Banner image too large' });
    }
    const banner = await Banner.create({
      title: String(title || '').trim(),
      subtitle: String(subtitle || '').trim(),
      image: img,
      link: String(link || '').trim(),
      bgColor: String(bgColor || '#FF6B35').trim(),
      enabled: enabled !== false,
      sortOrder: Number(sortOrder) || 0,
    });
    res.status(201).json(banner);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', authAdmin, async (req, res) => {
  try {
    const updates = {};
    const fields = ['title', 'subtitle', 'image', 'link', 'bgColor', 'enabled', 'sortOrder'];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        if (f === 'image') {
          const img = String(req.body.image || '');
          if (img.length > 3_000_000) {
            return res.status(400).json({ message: 'Banner image too large' });
          }
          updates.image = img;
        } else if (f === 'enabled') {
          updates.enabled = Boolean(req.body.enabled);
        } else if (f === 'sortOrder') {
          updates.sortOrder = Number(req.body.sortOrder) || 0;
        } else {
          updates[f] = String(req.body[f] || '').trim();
        }
      }
    }
    const banner = await Banner.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!banner) return res.status(404).json({ message: 'Banner not found' });
    res.json(banner);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', authAdmin, async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
