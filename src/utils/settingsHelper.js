import { Setting } from '../models/Setting.js';

export async function getSetting(key, defaultValue) {
  const doc = await Setting.findOne({ key });
  return doc?.value ?? defaultValue;
}

export async function setSetting(key, value) {
  const doc = await Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
  return doc.value;
}

const PUBLIC_KEYS = [
  ['usdtPrice', 0],
  ['binancePrice', 0],
  ['walletAddress', ''],
  ['maintenanceMode', false],
  ['referralReward', 0],
  ['referralBaseUrl', ''],
  ['sellCashbackPercent', 0.4],
  ['buyCashbackPercent', 0.3],
  ['supportPhone', ''],
  ['supportTelegram', ''],
  ['supportWhatsapp', ''],
  ['supportPhoneVisible', true],
  ['supportTelegramVisible', true],
  ['supportWhatsappVisible', true],
  ['paymentQrVisible', true],
];

export async function getPublicSettings() {
  const values = await Promise.all(PUBLIC_KEYS.map(([key, def]) => getSetting(key, def)));
  const paymentQrImageRaw = await getSetting('paymentQrImage', '');
  const paymentQrImage = String(paymentQrImageRaw || '');
  const paymentQrVisible = values[14] !== false && values[14] !== 'false';
  const hasPaymentQr = paymentQrImage.length > 20;

  return {
    usdtPrice: values[0],
    binancePrice: Number(values[1]) || Number(values[0]) || 0,
    walletAddress: String(values[2] || '').trim(),
    maintenanceMode: Boolean(values[3]),
    referralReward: values[4],
    referralBaseUrl: String(values[5] || '').trim(),
    sellCashbackPercent: values[6],
    buyCashbackPercent: values[7],
    supportPhone: String(values[8] || '').trim(),
    supportTelegram: String(values[9] || '').trim(),
    supportWhatsapp: String(values[10] || '').trim(),
    supportPhoneVisible: values[11] !== false && values[11] !== 'false',
    supportTelegramVisible: values[12] !== false && values[12] !== 'false',
    supportWhatsappVisible: values[13] !== false && values[13] !== 'false',
    paymentQrVisible,
    hasPaymentQr,
    /** Included when visible so app works without a second request */
    paymentQrImage: paymentQrVisible && hasPaymentQr ? paymentQrImage : null,
  };
}

export async function getAdminSettings() {
  const pub = await getPublicSettings();
  const paymentQrImage = await getSetting('paymentQrImage', '');
  return { ...pub, paymentQrImage: paymentQrImage || '' };
}
