import mongoose from 'mongoose';

const buyOrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    paymentMethod: { type: String, enum: ['upi', 'cdm'], required: true, default: 'upi' },
    paymentUpiId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentUpi', default: null },
    usdtAmount: { type: Number, required: true },
    inrValue: { type: Number, required: true },
    buyRate: { type: Number, required: true },
    phone: { type: String, required: true, trim: true },
    /** User wallet to receive USDT */
    walletAddress: { type: String, required: true, trim: true },
    /** UPI ID user paid to (must match assigned slot) */
    paidToUpiId: { type: String, default: '', trim: true },
    /** Bank / CDM transaction reference when paid via CDM */
    cdmTxnReference: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    adminNote: { type: String, default: '' },
  },
  { timestamps: true }
);

export const BuyOrder = mongoose.model('BuyOrder', buyOrderSchema);
