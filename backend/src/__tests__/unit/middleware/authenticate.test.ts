import { authenticate } from '../../../middleware/authenticate';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Mock config and logger
jest.mock('../../../config/env', () => ({
  config: { jwt: { secret: 'test-secret-key-for-unit-tests' } },
}));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('authenticate middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should return 401 if no authorization header', () => {
    authenticate(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing or invalid authorization header' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 if authorization header does not start with Bearer', () => {
    mockReq.headers = { authorization: 'Basic abc123' };
    authenticate(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 for invalid JWT token', () => {
    mockReq.headers = { authorization: 'Bearer invalid-token' };
    authenticate(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });

  it('should call next and attach user for valid token', () => {
    const payload = { sub: 1, email: 'test@test.com', role: 'admin', siteIds: [1, 2] };
    const token = jwt.sign(payload, 'test-secret-key-for-unit-tests', { expiresIn: '1h' });
    mockReq.headers = { authorization: `Bearer ${token}` };

    authenticate(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user).toBeDefined();
    expect(mockReq.user!.sub).toBe(1);
    expect(mockReq.user!.email).toBe('test@test.com');
    expect(mockReq.user!.role).toBe('admin');
  });

  it('should return 401 for expired token', () => {
    const payload = { sub: 1, email: 'test@test.com', role: 'admin', siteIds: [] };
    const token = jwt.sign(payload, 'test-secret-key-for-unit-tests', { expiresIn: '0s' });
    mockReq.headers = { authorization: `Bearer ${token}` };

    // Small delay to ensure token is expired
    authenticate(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });
});
