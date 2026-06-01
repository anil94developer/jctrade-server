import mongoose from 'mongoose';

const paymentUpiSchema = new mongoose.Schema(
  {
    upiId: { type: String, required: true, trim: true },
    label: { type: String, default: '', trim: true },
    qrImage: { type: String, default: '' },
    active: { type: Boolean, default: true },
    /** Round-robin: oldest assignment gets next user */
    lastAssignedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const PaymentUpi = mongoose.model('PaymentUpi', paymentUpiSchema);
