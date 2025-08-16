import { Router } from 'express';
import {
  elo,
  getSession,
  lastPace,
  lastSplit,
  pbs,
  resets,
} from '../controllers/controller';

const router = Router();

router.get('/session', getSession);
router.get('/lastpace', lastPace);
router.get('/lastsplit', lastSplit);
router.get('/pb', pbs);
router.get('/resets', resets);
router.get('/elo', elo);

export default router;
