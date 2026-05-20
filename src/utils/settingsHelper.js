import { Setting } from '../models/Setting.js';

export async function getSetting(key, defaultValue) {
  const doc = await Setting.findOne({ key });
  return doc?.value ?? defaultValue;
}

export async function setSetting(key, value) {
  const doc = await Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
  return doc.value;
}

export async function getPublicSettings() {
  const keys = [
    ['usdtPrice', 0],
    ['walletAddress', ''],
    ['maintenanceMode', false],
    ['referralReward', 0],
    ['supportPhone', ''],
    ['supportTelegram', ''],
    ['supportWhatsapp', ''],
    ['supportPhoneVisible', true],
    ['supportTelegramVisible', true],
    ['supportWhatsappVisible', true],
  ];

  const values = await Promise.all(keys.map(([key, def]) => getSetting(key, def)));

  return {
    usdtPrice: values[0],
    walletAddress: String(values[1] || '').trim(),
    maintenanceMode: Boolean(values[2]),
    referralReward: values[3],
    supportPhone: String(values[4] || '').trim(),
    supportTelegram: String(values[5] || '').trim(),
    supportWhatsapp: String(values[6] || '').trim(),
    supportPhoneVisible: values[7] !== false && values[7] !== 'false',
    supportTelegramVisible: values[8] !== false && values[8] !== 'false',
    supportWhatsappVisible: values[9] !== false && values[9] !== 'false',
  };
}

export async function getAdminSettings() {
  return getPublicSettings();
}
