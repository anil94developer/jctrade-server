export function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return 'your mobile number';
  return `******${digits.slice(-4)}`;
}

/** Strip secret OTP from documents returned to clients. */
export function sanitizeTransactionForClient(doc) {
  const o = doc?.toObject ? doc.toObject() : { ...doc };
  delete o.otpCode;
  return o;
}
