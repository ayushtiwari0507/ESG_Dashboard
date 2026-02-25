import { authorize } from '../../../middleware/authorize';
import { Request, Response, NextFunction } from 'express';

describe('authorize middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = { body: {}, query: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should return 401 if no user is attached (not authenticated)', () => {
    const middleware = authorize('admin');
    middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('should return 403 if user role is not in allowed roles', () => {
    mockReq.user = { sub: 1, email: 'user@test.com', role: 'viewer', siteIds: [1] };
    const middleware = authorize('admin', 'site_user');
    middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Forbidden: insufficient role' });
  });

  it('should call next if user role is allowed', () => {
    mockReq.user = { sub: 1, email: 'admin@test.com', role: 'admin', siteIds: [] };
    const middleware = authorize('admin', 'site_user');
    middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should allow admin access to any site', () => {
    mockReq.user = { sub: 1, email: 'admin@test.com', role: 'admin', siteIds: [] };
    mockReq.body = { siteId: 99 };
    const middleware = authorize('admin');
    middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should return 403 if site_user requests a site they do not have access to', () => {
    mockReq.user = { sub: 2, email: 'user@test.com', role: 'site_user', siteIds: [1, 2] };
    mockReq.body = { siteId: 99 };
    const middleware = authorize('admin', 'site_user');
    middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Forbidden: no access to this site' });
  });

  it('should allow site_user access to assigned site', () => {
    mockReq.user = { sub: 2, email: 'user@test.com', role: 'site_user', siteIds: [1, 2] };
    mockReq.body = { siteId: 1 };
    const middleware = authorize('admin', 'site_user');
    middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should check siteId from query params when not in body', () => {
    mockReq.user = { sub: 2, email: 'user@test.com', role: 'site_user', siteIds: [1] };
    mockReq.query = { siteId: '5' };
    const middleware = authorize('site_user');
    middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(403);
  });

  it('should accept multiple roles', () => {
    mockReq.user = { sub: 3, email: 'viewer@test.com', role: 'viewer', siteIds: [] };
    const middleware = authorize('admin', 'site_user', 'viewer');
    middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });
});
