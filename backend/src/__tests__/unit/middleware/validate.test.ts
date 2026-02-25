import { validate } from '../../../middleware/validate';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

describe('validate middleware', () => {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
  });

  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = { body: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should call next() for valid input', () => {
    mockReq.body = { email: 'test@example.com', name: 'Test User' };
    const middleware = validate(schema);
    middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid email', () => {
    mockReq.body = { email: 'not-an-email', name: 'Test' };
    const middleware = validate(schema);
    middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation error',
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'email' }),
        ]),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 400 for missing required field', () => {
    mockReq.body = { email: 'test@example.com' };
    const middleware = validate(schema);
    middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation error',
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'name' }),
        ]),
      })
    );
  });

  it('should mutate req.body with parsed/coerced values', () => {
    const numSchema = z.object({ count: z.number().default(5) });
    mockReq.body = {};
    const middleware = validate(numSchema);
    middleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockReq.body).toEqual({ count: 5 });
    expect(mockNext).toHaveBeenCalled();
  });
});
