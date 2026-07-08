import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { router as authRouter, JWT_SECRET } from './routes/auth.js';
import { router as cryptoRouter } from './routes/crypto.js';
import { router as uploadRouter } from './routes/upload.js';
import { router as messagesRouter } from './routes/messages.js';
import { prisma } from './database/prisma.js';
const app = express();
const server = http.createServer(app);
const allowedOrigins = [
    'https://duochamber22.vercel.app',
    'https://duochamber22-fpkb85uk5-demodesks-projects.vercel.app'
];
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or postman)
        if (!origin)
            return callback(null, true);
        // Check if origin matches allowed list, ends with .vercel.app, or is local dev
        if (allowedOrigins.includes(origin) ||
            origin.endsWith('.vercel.app') ||
            origin.startsWith('http://localhost:') ||
            origin.startsWith('http://127.0.0.1:')) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};
const io = new Server(server, {
    cors: corsOptions
});
// Configure Middlewares
app.use(cors(corsOptions));
app.use(express.json());
// Ensure uploads folder exists and serve it statically
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));
// Mount REST Endpoints
app.use('/api/auth', authRouter);
app.use('/api/crypto', cryptoRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/messages', messagesRouter);
// Root Health Check
app.get('/', (req, res) => {
    res.status(200).json({ status: 'healthy', message: 'DuoChat Server is running' });
});
// Map of userId -> socket.id
const activeUsers = new Map();
// Socket.io JWT Authentication Middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
        return next(new Error('Authentication error: Token is required'));
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        socket.data = { userId: payload.id, username: payload.username };
        next();
    }
    catch (error) {
        return next(new Error('Authentication error: Invalid or expired token'));
    }
});
// Socket Connections Handler
io.on('connection', (socket) => {
    const userId = socket.data.userId;
    const username = socket.data.username;
    console.log(`User connected: ${username} (${userId}), socket: ${socket.id}`);
    activeUsers.set(userId, socket.id);
    // Notify other users that someone went online
    socket.broadcast.emit('presence:state', { userId, status: 'online' });
    // Handle Presence check requests
    socket.on('presence:get', ({ targetUserId }, callback) => {
        const isOnline = activeUsers.has(targetUserId);
        callback({ status: isOnline ? 'online' : 'offline' });
    });
    // 1. Real-Time Chat Messaging
    socket.on('message:send', async ({ recipientId, encryptedPayload, nonce }, callback) => {
        try {
            if (!recipientId || !encryptedPayload || !nonce) {
                return callback?.({ error: 'Invalid payload' });
            }
            // Save encrypted message in SQLite database
            const msg = await prisma.message.create({
                data: {
                    senderId: userId,
                    recipientId,
                    encryptedPayload,
                    nonce
                }
            });
            const messageObj = {
                id: msg.id,
                senderId: userId,
                recipientId,
                encryptedPayload,
                nonce,
                timestamp: msg.timestamp
            };
            // Send to recipient if online
            const recipientSocketId = activeUsers.get(recipientId);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('message:receive', messageObj);
            }
            // Confirm success to sender
            callback?.({ success: true, message: messageObj });
        }
        catch (err) {
            console.error('Error sending message:', err);
            callback?.({ error: 'Failed to save/send message' });
        }
    });
    // 2. Typing Indicators
    socket.on('typing:start', ({ recipientId }) => {
        const recipientSocketId = activeUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('typing:state', { senderId: userId, isTyping: true });
        }
    });
    socket.on('typing:stop', ({ recipientId }) => {
        const recipientSocketId = activeUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('typing:state', { senderId: userId, isTyping: false });
        }
    });
    // 3. WebRTC Signaling Relay for Voice Calling
    socket.on('call:initiate', ({ recipientId }) => {
        const recipientSocketId = activeUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('call:request', { senderId: userId, senderUsername: username });
        }
    });
    socket.on('call:accept', ({ recipientId }) => {
        const recipientSocketId = activeUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('call:accept', { senderId: userId });
        }
    });
    socket.on('call:reject', ({ recipientId }) => {
        const recipientSocketId = activeUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('call:reject', { senderId: userId });
        }
    });
    socket.on('webrtc:offer', ({ recipientId, sdp }) => {
        const recipientSocketId = activeUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('webrtc:offer', { senderId: userId, sdp });
        }
    });
    socket.on('webrtc:answer', ({ recipientId, sdp }) => {
        const recipientSocketId = activeUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('webrtc:answer', { senderId: userId, sdp });
        }
    });
    socket.on('webrtc:ice-candidate', ({ recipientId, candidate }) => {
        const recipientSocketId = activeUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('webrtc:ice-candidate', { senderId: userId, candidate });
        }
    });
    socket.on('call:end', ({ recipientId }) => {
        const recipientSocketId = activeUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('call:end', { senderId: userId });
        }
    });
    // 4. Mood Updates
    socket.on('mood:update', ({ recipientId, mood }) => {
        const recipientSocketId = activeUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('mood:state', { senderId: userId, mood });
        }
    });
    // Handle Disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${username} (${userId}), socket: ${socket.id}`);
        activeUsers.delete(userId);
        socket.broadcast.emit('presence:state', { userId, status: 'offline' });
    });
});
const PORT = process.env.PORT || 10000;
server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`DuoChat Server running on port ${PORT}`);
});
