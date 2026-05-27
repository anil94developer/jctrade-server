import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    transactionHash: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    value: { type: Number, required: true },
    usdtAmount: { type: Number, default: 0 },
    upiId: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'blocked'],
      default: 'pending',
    },
    blocked: { type: Boolean, default: false },
    otpSent: { type: Boolean, default: false },
    otpVerified: { type: Boolean, default: false },
    otpCode: { type: String, select: false },
    otpExpiresAt: { type: Date },
    userSubmittedOtp: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model('Transaction', transactionSchema);
