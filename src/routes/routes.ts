import { Router } from 'express';
import { getSession, lastPace, lastSplit } from '../controllers/controller';

const router = Router();

router.get('/session', getSession);
router.get('/lastpace', lastPace);
router.get('/lastsplit', lastSplit);

export default router;
