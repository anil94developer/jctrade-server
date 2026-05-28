import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { Admin } from '../models/Admin.js';
import { User } from '../models/User.js';
import { uniqueReferralCode } from '../utils/seed.js';

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

async function upsertGoogleUser({ profile, referralCode }) {
  let user = await User.findOne({ email: profile.email.toLowerCase() });
  if (!user) {
    const uid = await uniqueReferralCode();

    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({ uid: referralCode });
      if (referrer && referrer.email !== profile.email.toLowerCase()) {
        referredBy = referrer._id;
      }
    }

    user = await User.create({
      googleId: profile.sub,
      email: profile.email.toLowerCase(),
      name: profile.name || '',
      avatar: profile.picture || '',
      uid,
      referredBy,
    });
    return user;
  }

  if (profile.name && !user.name) user.name = profile.name;
  if (profile.picture) user.avatar = profile.picture;
  if (profile.sub) user.googleId = profile.sub;
  if (!user.uid) {
    user.uid = await uniqueReferralCode();
  }
  await user.save();
  return user;
}

async function verifyGoogleToken(idToken) {
  if (!googleClient) {
    throw new Error('GOOGLE_CLIENT_ID is not set on server');
  }
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new Error('Google account email not available');
  }
  return {
    email: payload.email,
    name: payload.name || '',
    picture: payload.picture || '',
    sub: payload.sub,
  };
}

router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email: email?.toLowerCase() });
    if (!admin) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });
    res.json({ token, email: admin.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/google', async (req, res) => {
  try {
    const idToken = req.body.idToken || req.body.credential;
    const referralCode = String(req.body.referralCode || req.body.ref || '').trim();

    if (!idToken) {
      return res.status(400).json({ message: 'Google sign-in token is required' });
    }

    let profile;
    try {
      profile = await verifyGoogleToken(idToken);
    } catch (verifyErr) {
      console.error('Google token verify error:', verifyErr.message);
      return res.status(401).json({
        message: 'Google token invalid. Use the same Client ID on server and app.',
      });
    }

    const user = await upsertGoogleUser({ profile, referralCode });

    if (user.blocked) {
      return res.status(403).json({ message: 'Your account has been blocked' });
    }

    const token = jwt.sign({ id: user._id, role: 'user' }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });
    res.json({ token, user });
  } catch (err) {
    console.error('Auth google error:', err);
    res.status(500).json({ message: err.message || 'Login failed' });
  }
});

router.post('/token-login', async (req, res) => {
  try {
    const idToken = String(req.body.token || req.body.idToken || req.body.credential || '').trim();
    const referralCode = String(req.body.referralCode || req.body.ref || '').trim();

    if (!idToken) {
      return res.status(400).json({ message: 'Token is required' });
    }

    let profile;
    try {
      profile = await verifyGoogleToken(idToken);
    } catch (verifyErr) {
      console.error('Token-login verify error:', verifyErr.message);
      return res.status(401).json({
        message: 'Token invalid. Please generate a fresh login token.',
      });
    }

    const user = await upsertGoogleUser({ profile, referralCode });
    if (user.blocked) {
      return res.status(403).json({ message: 'Your account has been blocked' });
    }

    const token = jwt.sign({ id: user._id, role: 'user' }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });
    res.json({ token, user });
  } catch (err) {
    console.error('Auth token-login error:', err);
    res.status(500).json({ message: err.message || 'Login failed' });
  }
});

export default router;
