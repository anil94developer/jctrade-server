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

router.get('/public/payment-qr', async (_req, res) => {
  try {
    const visible = await getSetting('paymentQrVisible', true);
    if (!visible) return res.json({ image: null });
    const image = await getSetting('paymentQrImage', '');
    res.json({ image: image ? String(image) : null });
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
    const body = req.body;

    if (body.walletAddress !== undefined) {
      await setSetting('walletAddress', String(body.walletAddress).trim());
    }
    if (body.usdtPrice !== undefined) {
      const p = Number(body.usdtPrice);
      if (Number.isNaN(p)) return res.status(400).json({ message: 'Invalid USDT price' });
      await setSetting('usdtPrice', p);
    }
    if (body.binancePrice !== undefined) {
      const p = Number(body.binancePrice);
      if (Number.isNaN(p)) return res.status(400).json({ message: 'Invalid Binance price' });
      await setSetting('binancePrice', p);
    }
    if (body.maintenanceMode !== undefined) {
      await setSetting('maintenanceMode', Boolean(body.maintenanceMode));
    }
    if (body.referralReward !== undefined) {
      const r = Number(body.referralReward);
      if (Number.isNaN(r)) return res.status(400).json({ message: 'Invalid referral value' });
      await setSetting('referralReward', r);
    }
    if (body.referralBaseUrl !== undefined) {
      await setSetting('referralBaseUrl', String(body.referralBaseUrl).trim());
    }
    if (body.sellCashbackPercent !== undefined) {
      await setSetting('sellCashbackPercent', Number(body.sellCashbackPercent));
    }
    if (body.buyCashbackPercent !== undefined) {
      await setSetting('buyCashbackPercent', Number(body.buyCashbackPercent));
    }
    if (body.supportPhone !== undefined) {
      const v = String(body.supportPhone).trim();
      await setSetting('supportPhone', v);
      if (v && body.supportPhoneVisible === undefined) {
        await setSetting('supportPhoneVisible', true);
      }
    }
    if (body.supportTelegram !== undefined) {
      const v = String(body.supportTelegram).trim();
      await setSetting('supportTelegram', v);
      if (v && body.supportTelegramVisible === undefined) {
        await setSetting('supportTelegramVisible', true);
      }
    }
    if (body.supportWhatsapp !== undefined) {
      const v = String(body.supportWhatsapp).trim();
      await setSetting('supportWhatsapp', v);
      if (v && body.supportWhatsappVisible === undefined) {
        await setSetting('supportWhatsappVisible', true);
      }
    }
    if (body.supportPhoneVisible !== undefined) {
      await setSetting('supportPhoneVisible', Boolean(body.supportPhoneVisible));
    }
    if (body.supportTelegramVisible !== undefined) {
      await setSetting('supportTelegramVisible', Boolean(body.supportTelegramVisible));
    }
    if (body.supportWhatsappVisible !== undefined) {
      await setSetting('supportWhatsappVisible', Boolean(body.supportWhatsappVisible));
    }
    if (body.paymentQrVisible !== undefined) {
      await setSetting('paymentQrVisible', Boolean(body.paymentQrVisible));
    }
    if (body.paymentQrImage !== undefined) {
      const img = String(body.paymentQrImage || '');
      if (img.length > 3_000_000) {
        return res.status(400).json({ message: 'QR image too large (max ~3MB)' });
      }
      // Only replace when admin sends a new image or explicitly clears (non-empty or was cleared in UI)
      if (img.length > 0) {
        await setSetting('paymentQrImage', img);
      }
    }

    res.json(await getAdminSettings());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/payment-qr', authAdmin, async (req, res) => {
  try {
    const { image, visible } = req.body;
    if (visible !== undefined) {
      await setSetting('paymentQrVisible', Boolean(visible));
    }
    if (image !== undefined) {
      const img = String(image || '');
      if (img.length > 3_000_000) {
        return res.status(400).json({ message: 'QR image too large (max ~3MB)' });
      }
      await setSetting('paymentQrImage', img); // empty string clears QR
    }
    const paymentQrImage = await getSetting('paymentQrImage', '');
    res.json({
      ok: true,
      paymentQrVisible: await getSetting('paymentQrVisible', true),
      hasPaymentQr: Boolean(paymentQrImage && String(paymentQrImage).length > 20),
    });
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
