import { loginSchema } from '../../../modules/auth/auth.schema';

describe('auth schema validation', () => {
  describe('loginSchema', () => {
    it('should accept valid login input', () => {
      const result = loginSchema.safeParse({ email: 'user@example.com', password: 'secret123' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
        expect(result.data.password).toBe('secret123');
      }
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({ email: 'not-email', password: 'pass' });
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({ email: 'user@test.com', password: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing email', () => {
      const result = loginSchema.safeParse({ password: 'secret' });
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const result = loginSchema.safeParse({ email: 'user@test.com' });
      expect(result.success).toBe(false);
    });

    it('should reject null body', () => {
      const result = loginSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('should strip extra fields', () => {
      const result = loginSchema.safeParse({
        email: 'user@test.com',
        password: 'pass123',
        extra: 'ignored',
      });
      expect(result.success).toBe(true);
    });
  });
});
