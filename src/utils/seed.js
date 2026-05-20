import bcrypt from 'bcryptjs';
import { Admin } from '../models/Admin.js';
import { Setting } from '../models/Setting.js';

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
    { key: 'usdtPrice', value: 92.5 },
    { key: 'walletAddress', value: '' },
    { key: 'maintenanceMode', value: false },
    { key: 'referralReward', value: 0 },
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
}

function randomUid() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export { randomUid };
