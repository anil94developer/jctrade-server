import mongoose from 'mongoose';

const walletEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    category: { type: String, default: 'sell' },
    amount: { type: Number, required: true },
    balance: { type: Number, required: true },
    title: { type: String, required: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  },
  { timestamps: true }
);

export const WalletEntry = mongoose.model('WalletEntry', walletEntrySchema);
