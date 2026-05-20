import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { Admin } from '../models/Admin.js';
import { User } from '../models/User.js';
import { randomUid } from '../utils/seed.js';

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

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

    if (!idToken) {
      return res.status(400).json({ message: 'Google sign-in token is required' });
    }

    if (!googleClient) {
      return res.status(500).json({ message: 'GOOGLE_CLIENT_ID is not set on server' });
    }

    let profile;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) {
        return res.status(400).json({ message: 'Google account email not available' });
      }
      profile = {
        email: payload.email,
        name: payload.name || '',
        picture: payload.picture || '',
        sub: payload.sub,
      };
    } catch (verifyErr) {
      console.error('Google token verify error:', verifyErr.message);
      return res.status(401).json({
        message: 'Google token invalid. Use the same Client ID on server and app.',
      });
    }

    let user = await User.findOne({ email: profile.email.toLowerCase() });
    if (!user) {
      let uid = randomUid();
      while (await User.findOne({ uid })) uid = randomUid();
      user = await User.create({
        googleId: profile.sub,
        email: profile.email.toLowerCase(),
        name: profile.name || '',
        avatar: profile.picture || '',
        uid,
      });
    } else {
      if (profile.name && !user.name) user.name = profile.name;
      if (profile.picture) user.avatar = profile.picture;
      if (profile.sub) user.googleId = profile.sub;
      await user.save();
    }

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

export default router;
