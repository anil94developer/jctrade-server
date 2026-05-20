import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export async function authUser(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    if (payload.role !== 'user') return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.blocked) return res.status(403).json({ message: 'Your account has been blocked' });

    req.userId = user._id;
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export function authAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    if (payload.role !== 'admin') return res.status(401).json({ message: 'Unauthorized' });
    req.adminId = payload.id;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}
