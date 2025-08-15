import { Router } from 'express';
import { getSession } from '../controllers/controller';

const router = Router();

router.get('/session', getSession);

export default router;
