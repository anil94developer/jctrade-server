import { Setting } from '../models/Setting.js';
import { buildBuyCdmDetails, getAllowedBuyMethods, getBuyPaymentModesSetting } from './buyPaymentHelper.js';

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
  ['buyUsdtPrice', 0],
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

  const sellPrice = Number(values[0]) || 0;
  const buyPrice = Number(values[1]) || sellPrice;
  const buyPaymentModes = await getBuyPaymentModesSetting();
  const allowedBuyMethods = getAllowedBuyMethods(buyPaymentModes);
  const buyCdm = allowedBuyMethods.includes('cdm') ? await buildBuyCdmDetails() : null;

  return {
    usdtPrice: sellPrice,
    buyUsdtPrice: buyPrice,
    binancePrice: Number(values[2]) || sellPrice || 0,
    walletAddress: String(values[3] || '').trim(),
    maintenanceMode: Boolean(values[4]),
    referralReward: values[5],
    referralBaseUrl: String(values[6] || '').trim(),
    sellCashbackPercent: values[7],
    buyCashbackPercent: values[8],
    supportPhone: String(values[9] || '').trim(),
    supportTelegram: String(values[10] || '').trim(),
    supportWhatsapp: String(values[11] || '').trim(),
    supportPhoneVisible: values[12] !== false && values[12] !== 'false',
    supportTelegramVisible: values[13] !== false && values[13] !== 'false',
    supportWhatsappVisible: values[14] !== false && values[14] !== 'false',
    paymentQrVisible,
    hasPaymentQr,
    /** Included when visible so app works without a second request */
    paymentQrImage: paymentQrVisible && hasPaymentQr ? paymentQrImage : null,
    buyPaymentModes,
    allowedBuyMethods,
    hasBuyCdm: Boolean(buyCdm),
  };
}

export async function getAdminSettings() {
  const pub = await getPublicSettings();
  const paymentQrImage = await getSetting('paymentQrImage', '');
  const buyCdm = await buildBuyCdmDetails();
  return {
    ...pub,
    paymentQrImage: paymentQrImage || '',
    buyCdmBankName: String(await getSetting('buyCdmBankName', '')),
    buyCdmAccountNumber: String(await getSetting('buyCdmAccountNumber', '')),
    buyCdmIfsc: String(await getSetting('buyCdmIfsc', '')),
    buyCdmAccountHolder: String(await getSetting('buyCdmAccountHolder', '')),
    buyCdmInstructions: String(await getSetting('buyCdmInstructions', '')),
    hasBuyCdm: Boolean(buyCdm),
  };
}
