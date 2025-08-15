import { Router } from 'express';
import {
  getSession,
  lastPace,
  lastSplit,
  pbs,
} from '../controllers/controller';

const router = Router();

router.get('/session', getSession);
router.get('/lastpace', lastPace);
router.get('/lastsplit', lastSplit);
router.get('/pb', pbs);

export default router;
