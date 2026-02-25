import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../../api/client';

describe('API Client', () => {
  it('exposes an axios-like API', () => {
    expect(api).toBeDefined();
    // api is mocked at module level in other tests; here just verify the import
    expect(typeof api.get).toBe('function');
    expect(typeof api.post).toBe('function');
  });
});
