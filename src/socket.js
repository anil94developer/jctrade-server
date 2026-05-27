import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.role === 'admin') {
        socket.isAdmin = true;
        socket.userId = null;
      } else if (payload.role === 'user') {
        socket.isAdmin = false;
        socket.userId = String(payload.id);
      } else {
        return next(new Error('Unauthorized'));
      }
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.isAdmin) {
      socket.join('admin');
    }
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }
  });

  return io;
}

export function getIO() {
  return io;
}

export function emitOtpSentToUser(userId, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit('otp:sent', payload);
}

export function emitOtpSubmittedToAdmin(payload) {
  if (!io) return;
  io.to('admin').emit('otp:submitted', payload);
}

export function emitOtpVerifiedToUser(userId, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit('otp:verified', payload);
}

export function emitTransactionApprovedToUser(userId, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit('transaction:approved', payload);
}
