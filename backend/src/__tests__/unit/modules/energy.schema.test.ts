import { createEnergySchema } from '../../../modules/data-entry/energy/energy.schema';

describe('energy schema validation', () => {
  const validPayload = {
    siteId: 1,
    month: 6,
    year: 2025,
    electricityKwh: 50000,
    steamMt: 100,
    coalMt: 200,
    dieselLitres: 500,
    foLitres: 0,
    lpgKg: 0,
    pngScm: 0,
    renewableKwh: 10000,
  };

  it('should accept valid energy data', () => {
    const result = createEnergySchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('should reject month < 1', () => {
    const result = createEnergySchema.safeParse({ ...validPayload, month: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject month > 12', () => {
    const result = createEnergySchema.safeParse({ ...validPayload, month: 13 });
    expect(result.success).toBe(false);
  });

  it('should reject year < 2000', () => {
    const result = createEnergySchema.safeParse({ ...validPayload, year: 1999 });
    expect(result.success).toBe(false);
  });

  it('should reject negative electricity value', () => {
    const result = createEnergySchema.safeParse({ ...validPayload, electricityKwh: -100 });
    expect(result.success).toBe(false);
  });

  it('should default numeric fields to 0', () => {
    const result = createEnergySchema.safeParse({ siteId: 1, month: 1, year: 2025 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.electricityKwh).toBe(0);
      expect(result.data.coalMt).toBe(0);
    }
  });

  it('should reject missing siteId', () => {
    const { siteId, ...noSiteId } = validPayload;
    const result = createEnergySchema.safeParse(noSiteId);
    expect(result.success).toBe(false);
  });
});
