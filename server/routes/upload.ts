import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateJWT, AuthenticatedRequest } from './auth.js';

export const router = Router();

// Ensure uploads directory exists at root of server
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Since images are encrypted, we suffix with .enc or original ext
    const originalExt = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${originalExt || '.enc'}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.post('/', authenticateJWT, upload.single('file'), (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    return res.json({ fileUrl });
  } catch (error) {
    console.error('File upload route error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
