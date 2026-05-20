import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    transactionHash: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    value: { type: Number, required: true },
    upiId: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'blocked'],
      default: 'pending',
    },
    blocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model('Transaction', transactionSchema);
