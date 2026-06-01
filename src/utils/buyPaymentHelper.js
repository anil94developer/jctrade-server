import { getSetting } from './settingsHelper.js';

export function normalizeBuyPaymentModes(value) {
  const m = String(value || 'both').toLowerCase();
  if (m === 'upi' || m === 'cdm' || m === 'both') return m;
  return 'both';
}

export function getAllowedBuyMethods(mode) {
  const m = normalizeBuyPaymentModes(mode);
  if (m === 'upi') return ['upi'];
  if (m === 'cdm') return ['cdm'];
  return ['upi', 'cdm'];
}

export async function getBuyPaymentModesSetting() {
  return normalizeBuyPaymentModes(await getSetting('buyPaymentModes', 'both'));
}

export async function buildBuyCdmDetails() {
  const bankName = String(await getSetting('buyCdmBankName', '')).trim();
  const accountNumber = String(await getSetting('buyCdmAccountNumber', '')).trim();
  const ifsc = String(await getSetting('buyCdmIfsc', '')).trim();
  const accountHolder = String(await getSetting('buyCdmAccountHolder', '')).trim();
  const instructions = String(await getSetting('buyCdmInstructions', '')).trim();
  if (!bankName || !accountNumber || !ifsc) return null;
  return { bankName, accountNumber, ifsc, accountHolder, instructions };
}
