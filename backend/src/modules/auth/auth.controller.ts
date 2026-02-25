import { Request, Response } from 'express';
import { authService } from './auth.service';

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (err: any) {
      if (err.message === 'Invalid credentials') {
        res.status(401).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async me(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      const profile = await authService.getProfile(req.user.sub);
      res.json(profile);
    } catch (err: any) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export const authController = new AuthController();
