import { Request, Response, NextFunction } from 'express';

export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({ error: 'Forbidden: insufficient role' });
      return;
    }

    // Site-level access check for non-admin users
    if (user.role !== 'admin') {
      const requestedSiteId = parseInt(req.body?.siteId || req.query?.siteId as string, 10);
      if (requestedSiteId && !user.siteIds.includes(requestedSiteId)) {
        res.status(403).json({ error: 'Forbidden: no access to this site' });
        return;
      }
    }

    next();
  };
}
