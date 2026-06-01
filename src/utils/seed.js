import bcrypt from 'bcryptjs';
import { Admin } from '../models/Admin.js';
import { Setting } from '../models/Setting.js';
import { User } from '../models/User.js';

export async function seedDefaults() {
  const email = process.env.ADMIN_EMAIL || 'admin@jctrade.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const existing = await Admin.findOne({ email });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await Admin.create({ email, passwordHash });
    console.log(`Admin created: ${email}`);
  }

  const defaults = [
    { key: 'usdtPrice', value: 105 },
    { key: 'buyUsdtPrice', value: 106 },
    { key: 'buyPaymentModes', value: 'both' },
    { key: 'buyCdmBankName', value: '' },
    { key: 'buyCdmAccountNumber', value: '' },
    { key: 'buyCdmIfsc', value: '' },
    { key: 'buyCdmAccountHolder', value: '' },
    { key: 'buyCdmInstructions', value: 'Deposit cash at CDM using the account below. Enter the transaction reference when submitting your buy request.' },
    { key: 'binancePrice', value: 99 },
    { key: 'walletAddress', value: '' },
    { key: 'maintenanceMode', value: false },
    { key: 'referralReward', value: 50 },
    { key: 'referralBaseUrl', value: '' },
    { key: 'sellCashbackPercent', value: 0.4 },
    { key: 'buyCashbackPercent', value: 0.3 },
    { key: 'paymentQrVisible', value: true },
    { key: 'paymentQrImage', value: '' },
    { key: 'supportPhone', value: '' },
    { key: 'supportTelegram', value: '' },
    { key: 'supportWhatsapp', value: '' },
    { key: 'supportPhoneVisible', value: true },
    { key: 'supportTelegramVisible', value: true },
    { key: 'supportWhatsappVisible', value: true },
  ];
  for (const d of defaults) {
    const exists = await Setting.findOne({ key: d.key });
    if (!exists) {
      await Setting.create(d);
      console.log(`Default setting: ${d.key}`);
    }
  }

  const withoutUid = await User.find({ $or: [{ uid: null }, { uid: '' }] });
  for (const u of withoutUid) {
    u.uid = await uniqueReferralCode();
    await u.save();
    console.log(`Referral code assigned: ${u.email} → ${u.uid}`);
  }

  await syncSupportVisibility();
}

/** If contact value exists but "visible" was saved false, turn visible on so the app shows it. */
export async function syncSupportVisibility() {
  const pairs = [
    ['supportPhone', 'supportPhoneVisible'],
    ['supportTelegram', 'supportTelegramVisible'],
    ['supportWhatsapp', 'supportWhatsappVisible'],
  ];
  for (const [valueKey, visibleKey] of pairs) {
    const valueDoc = await Setting.findOne({ key: valueKey });
    const visibleDoc = await Setting.findOne({ key: visibleKey });
    const value = String(valueDoc?.value || '').trim();
    if (value && visibleDoc?.value === false) {
      await Setting.findOneAndUpdate({ key: visibleKey }, { value: true }, { upsert: true });
      console.log(`Support visibility fixed: ${visibleKey} → true`);
    }
  }
}

/** Legacy numeric UID — prefer generateReferralCode for new users */
function randomUid() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** 8-char lowercase alphanumeric referral code (e.g. sr9yvrd7) */
export function generateReferralCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function uniqueReferralCode() {
  let code = generateReferralCode();
  while (await User.findOne({ uid: code })) {
    code = generateReferralCode();
  }
  return code;
}

export { randomUid };
