import { errorHandler } from '../../../middleware/errorHandler';
import { Request, Response, NextFunction } from 'express';

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

describe('errorHandler middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = { path: '/api/test', method: 'GET' };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should return 500 with generic message in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('DB connection failed');
    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Internal server error',
      message: undefined,
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('should include error message in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const err = new Error('Specific bug info');
    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Internal server error',
      message: 'Specific bug info',
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('should log error details', () => {
    const logger = require('../../../config/logger').default;
    const err = new Error('Test error');
    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(logger.error).toHaveBeenCalledWith('Unhandled error', expect.objectContaining({
      error: 'Test error',
      path: '/api/test',
      method: 'GET',
    }));
  });
});
