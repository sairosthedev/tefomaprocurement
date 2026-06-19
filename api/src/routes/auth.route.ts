import express from 'express';
import controllers from '../controllers/index.js';
import { protect } from '../middleware/index.js';

const { auth } = controllers;
const router = express.Router();

router.post('/login', auth.login);
router.post('/verify-otp', auth.verifyOtp);
router.post('/register', auth.register);
router.get('/me', protect, auth.getMe);

export default router;
