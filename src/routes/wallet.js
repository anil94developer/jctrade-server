import { Router } from 'express';
import { WalletEntry } from '../models/WalletEntry.js';
import { authUser } from '../middleware/auth.js';
import { parsePageQuery, pageResponse } from '../utils/pagination.js';

const router = Router();

router.get('/', authUser, async (req, res) => {
  try {
    const { type } = req.query;
    const { page, limit, skip } = parsePageQuery(req.query);
    const filter = { userId: req.userId };
    if (type === 'income' || type === 'expense') filter.type = type;
    const [total, entries] = await Promise.all([
      WalletEntry.countDocuments(filter),
      WalletEntry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    res.json(pageResponse(entries, total, page, limit));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
