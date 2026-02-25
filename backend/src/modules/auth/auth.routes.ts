import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { loginSchema } from './auth.schema';

const router = Router();

router.post('/login', validate(loginSchema), (req, res) => authController.login(req, res));
router.get('/me', authenticate, (req, res) => authController.me(req, res));

export default router;
