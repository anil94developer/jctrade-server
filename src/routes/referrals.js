import { Router } from 'express';
import { User } from '../models/User.js';
import { authAdmin, authUser } from '../middleware/auth.js';
import { getSetting } from '../utils/settingsHelper.js';

const router = Router();

function buildReferralLink(baseUrl, uid) {
  const base = String(baseUrl || '').trim().replace(/\/$/, '');
  if (!base) return '';
  return `${base}${base.includes('?') ? '&' : '?'}ref=${encodeURIComponent(uid)}`;
}

router.get('/me', authUser, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('uid referralEarnings');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const [referralBaseUrl, referralReward, sellCashbackPercent, buyCashbackPercent] = await Promise.all([
      getSetting('referralBaseUrl', ''),
      getSetting('referralReward', 0),
      getSetting('sellCashbackPercent', 0.4),
      getSetting('buyCashbackPercent', 0.3),
    ]);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const team = await User.find({ referredBy: user._id })
      .select('name email uid createdAt referralCreditGiven')
      .sort({ createdAt: -1 })
      .lean();

    const totalTeamRebates = user.referralEarnings || 0;
    const todayTeamRebates = team
      .filter((m) => m.referralCreditGiven && new Date(m.createdAt) >= startOfDay)
      .reduce((sum, m) => sum + Number(referralReward), 0);

    res.json({
      referralCode: user.uid,
      referralLink: buildReferralLink(referralBaseUrl, user.uid),
      referralReward: Number(referralReward),
      sellCashbackPercent,
      buyCashbackPercent,
      totalTeamRebates,
      todayTeamRebates,
      teamCount: team.length,
      team: team.map((m) => ({
        _id: m._id,
        name: m.name,
        email: m.email,
        uid: m.uid,
        joinedAt: m.createdAt,
        rewarded: Boolean(m.referralCreditGiven),
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/admin/summary', authAdmin, async (_req, res) => {
  try {
    const [totalUsers, referredUsers, totalPaid] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ referredBy: { $ne: null } }),
      User.aggregate([{ $group: { _id: null, total: { $sum: '$referralEarnings' } } }]),
    ]);
    res.json({
      totalUsers,
      referredUsers,
      totalReferralPaid: totalPaid[0]?.total || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/admin/team', authAdmin, async (_req, res) => {
  try {
    const users = await User.find({ referredBy: { $ne: null } })
      .populate('referredBy', 'uid email name')
      .select('uid email name referredBy referralCreditGiven referralEarnings createdAt')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
