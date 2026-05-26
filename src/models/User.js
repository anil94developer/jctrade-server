import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    upiId: { type: String, default: '' },
    uid: { type: String, unique: true },
    balance: { type: Number, default: 0 },
    avatar: { type: String, default: '' },
    blocked: { type: Boolean, default: false },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    referralCreditGiven: { type: Boolean, default: false },
    referralEarnings: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
