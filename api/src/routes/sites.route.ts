import express from 'express';
import controllers from '../controllers/index.js';
import { protect } from '../middleware/index.js';

const { sites } = controllers;
const router = express.Router();

router.use(protect);
router.get('/', sites.listSites);

export default router;
