import { Router } from 'express';
import { authAdmin } from '../middleware/auth.js';
import {
  getPublicSettings,
  getAdminSettings,
  setSetting,
  getSetting,
} from '../utils/settingsHelper.js';

const router = Router();

router.get('/public', async (_req, res) => {
  try {
    res.json(await getPublicSettings());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/usdt-price', async (_req, res) => {
  try {
    const price = await getSetting('usdtPrice', 0);
    res.json({ price });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', authAdmin, async (_req, res) => {
  try {
    res.json(await getAdminSettings());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/', authAdmin, async (req, res) => {
  try {
    const {
      walletAddress,
      usdtPrice,
      maintenanceMode,
      referralReward,
      supportPhone,
      supportTelegram,
      supportWhatsapp,
      supportPhoneVisible,
      supportTelegramVisible,
      supportWhatsappVisible,
    } = req.body;

    if (walletAddress !== undefined) {
      await setSetting('walletAddress', String(walletAddress).trim());
    }
    if (usdtPrice !== undefined) {
      const p = Number(usdtPrice);
      if (Number.isNaN(p)) return res.status(400).json({ message: 'Invalid USDT price' });
      await setSetting('usdtPrice', p);
    }
    if (maintenanceMode !== undefined) {
      await setSetting('maintenanceMode', Boolean(maintenanceMode));
    }
    if (referralReward !== undefined) {
      const r = Number(referralReward);
      if (Number.isNaN(r)) return res.status(400).json({ message: 'Invalid referral value' });
      await setSetting('referralReward', r);
    }
    if (supportPhone !== undefined) {
      await setSetting('supportPhone', String(supportPhone).trim());
    }
    if (supportTelegram !== undefined) {
      await setSetting('supportTelegram', String(supportTelegram).trim());
    }
    if (supportWhatsapp !== undefined) {
      await setSetting('supportWhatsapp', String(supportWhatsapp).trim());
    }
    if (supportPhoneVisible !== undefined) {
      await setSetting('supportPhoneVisible', Boolean(supportPhoneVisible));
    }
    if (supportTelegramVisible !== undefined) {
      await setSetting('supportTelegramVisible', Boolean(supportTelegramVisible));
    }
    if (supportWhatsappVisible !== undefined) {
      await setSetting('supportWhatsappVisible', Boolean(supportWhatsappVisible));
    }

    res.json(await getAdminSettings());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/usdt-price', authAdmin, async (req, res) => {
  try {
    const { price } = req.body;
    if (price == null || Number.isNaN(Number(price))) {
      return res.status(400).json({ message: 'Valid price required' });
    }
    const value = await setSetting('usdtPrice', Number(price));
    res.json({ price: value });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
