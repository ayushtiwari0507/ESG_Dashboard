import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Read admin credentials from environment ──
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@esg.local';
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'System Administrator';

  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD environment variable is required for seeding. Set it in your .env file.');
  }

  // ── Sites ──
  const sites = await Promise.all([
    prisma.site.upsert({ where: { code: 'TAL' }, update: {}, create: { name: 'Taloja', code: 'TAL', location: 'Maharashtra, India', country: 'India' } }),
    prisma.site.upsert({ where: { code: 'DAM' }, update: {}, create: { name: 'Daman', code: 'DAM', location: 'Daman, India', country: 'India' } }),
    prisma.site.upsert({ where: { code: 'BAD' }, update: {}, create: { name: 'Baddi', code: 'BAD', location: 'Himachal Pradesh, India', country: 'India' } }),
    prisma.site.upsert({ where: { code: 'TIL' }, update: {}, create: { name: 'Tiljala', code: 'TIL', location: 'West Bengal, India', country: 'India' } }),
    prisma.site.upsert({ where: { code: 'SIO' }, update: {}, create: { name: 'Sion', code: 'SIO', location: 'Maharashtra, India', country: 'India' } }),
    prisma.site.upsert({ where: { code: 'IDN' }, update: {}, create: { name: 'Indonesia', code: 'IDN', location: 'Jakarta, Indonesia', country: 'Indonesia' } }),
  ]);
  console.log(`  ✅ ${sites.length} sites seeded`);

  // ── Admin User ──
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      fullName: adminName,
      role: 'admin',
    },
  });

  // Assign admin to all sites
  for (const site of sites) {
    await prisma.userSite.upsert({
      where: { userId_siteId: { userId: admin.id, siteId: site.id } },
      update: {},
      create: { userId: admin.id, siteId: site.id },
    });
  }
  console.log(`  ✅ Admin user created (${adminEmail})`);

  // ── Sample Site User ──
  // Site users should be created via the admin panel after deployment.
  // The seed only creates the admin account.
  console.log('  ℹ️  Additional users can be created via the admin panel');

  // ── Units ──
  const unitData = [
    { name: 'kWh', category: 'energy' },
    { name: 'GJ', category: 'energy' },
    { name: 'KL', category: 'volume' },
    { name: 'MT', category: 'mass' },
    { name: 'm³', category: 'volume' },
    { name: 'litres', category: 'volume' },
    { name: 'SCM', category: 'volume' },
    { name: 'kg', category: 'mass' },
    { name: 'tCO₂e', category: 'emission' },
    { name: 'mg/L', category: 'concentration' },
  ];

  for (const u of unitData) {
    await prisma.unit.upsert({
      where: { id: unitData.indexOf(u) + 1 },
      update: {},
      create: u,
    });
  }
  console.log(`  ✅ ${unitData.length} units seeded`);

  // ── Global Warming Potentials (IPCC AR6) ──
  const gwpData = [
    { gasName: 'CO2', formula: 'CO₂', gwp100yr: 1, source: 'IPCC AR6' },
    { gasName: 'CH4', formula: 'CH₄', gwp100yr: 27.9, source: 'IPCC AR6' },
    { gasName: 'N2O', formula: 'N₂O', gwp100yr: 273, source: 'IPCC AR6' },
  ];

  for (const g of gwpData) {
    await prisma.globalWarmingPotential.upsert({
      where: { id: gwpData.indexOf(g) + 1 },
      update: {},
      create: g,
    });
  }
  console.log('  ✅ GWP values seeded');

  // ── Emission Factors ──
  const kwhUnit = await prisma.unit.findFirst({ where: { name: 'kWh' } });
  const litresUnit = await prisma.unit.findFirst({ where: { name: 'litres' } });
  const kgUnit = await prisma.unit.findFirst({ where: { name: 'kg' } });
  const scmUnit = await prisma.unit.findFirst({ where: { name: 'SCM' } });
  const mtUnit = await prisma.unit.findFirst({ where: { name: 'MT' } });

  if (kwhUnit && litresUnit && kgUnit && scmUnit && mtUnit) {
    const efData = [
      { name: 'Grid Electricity - India (CEA 2024)', source: 'CEA India', scope: 'scope_2' as const, activityUnitId: kwhUnit.id, factorValue: 0.708, co2Factor: 0.708, ch4Factor: 0.00003, n2oFactor: 0.000004, validFrom: new Date('2024-01-01') },
      { name: 'Diesel Combustion', source: 'IPCC 2006', scope: 'scope_1' as const, activityUnitId: litresUnit.id, factorValue: 2.68, co2Factor: 2.68, ch4Factor: 0.0001, n2oFactor: 0.00001, validFrom: new Date('2024-01-01') },
      { name: 'LPG Combustion', source: 'IPCC 2006', scope: 'scope_1' as const, activityUnitId: kgUnit.id, factorValue: 2.983, co2Factor: 2.983, ch4Factor: 0.00005, n2oFactor: 0.0001, validFrom: new Date('2024-01-01') },
      { name: 'PNG Combustion', source: 'IPCC 2006', scope: 'scope_1' as const, activityUnitId: scmUnit.id, factorValue: 1.88, co2Factor: 1.88, ch4Factor: 0.00004, n2oFactor: 0.000003, validFrom: new Date('2024-01-01') },
      { name: 'Coal Combustion', source: 'IPCC 2006', scope: 'scope_1' as const, activityUnitId: mtUnit.id, factorValue: 2460, co2Factor: 2460, ch4Factor: 0.03, n2oFactor: 0.015, validFrom: new Date('2024-01-01') },
    ];

    for (const ef of efData) {
      await prisma.emissionFactor.upsert({
        where: { id: efData.indexOf(ef) + 1 },
        update: {},
        create: { ...ef, createdBy: admin.id },
      });
    }
    console.log('  ✅ Emission factors seeded');
  }

  // ── Sample Data for Demo ──
  // Production data for Taloja (Jan-Jun 2025)
  for (let month = 1; month <= 6; month++) {
    const qty = 3500 + Math.random() * 1000;
    await prisma.productionData.upsert({
      where: { siteId_month_year: { siteId: sites[0].id, month, year: 2025 } },
      update: {},
      create: { siteId: sites[0].id, month, year: 2025, quantityMt: parseFloat(qty.toFixed(2)), enteredBy: admin.id },
    });
  }

  // Energy data for Taloja (Jan-Jun 2025)
  for (let month = 1; month <= 6; month++) {
    const elec = 100000 + Math.random() * 50000;
    const diesel = 300 + Math.random() * 200;
    const renewable = 20000 + Math.random() * 20000;
    const png = 5000 + Math.random() * 5000;
    const totalGj = elec * 0.0036 + diesel * 0.0358 + renewable * 0.0036 + png * 0.0376;

    await prisma.energyData.upsert({
      where: { siteId_month_year: { siteId: sites[0].id, month, year: 2025 } },
      update: {},
      create: {
        siteId: sites[0].id, month, year: 2025,
        electricityKwh: parseFloat(elec.toFixed(2)),
        dieselLitres: parseFloat(diesel.toFixed(2)),
        renewableKwh: parseFloat(renewable.toFixed(2)),
        pngScm: parseFloat(png.toFixed(2)),
        totalEnergyGj: parseFloat(totalGj.toFixed(2)),
        enteredBy: admin.id,
      },
    });
  }

  // Production & Energy for Daman (Jan-Jun 2025) 
  for (let month = 1; month <= 6; month++) {
    const qty = 2000 + Math.random() * 800;
    await prisma.productionData.upsert({
      where: { siteId_month_year: { siteId: sites[1].id, month, year: 2025 } },
      update: {},
      create: { siteId: sites[1].id, month, year: 2025, quantityMt: parseFloat(qty.toFixed(2)), enteredBy: admin.id },
    });
    const elec = 70000 + Math.random() * 30000;
    const diesel = 200 + Math.random() * 150;
    const renewable = 15000 + Math.random() * 10000;
    const totalGj = elec * 0.0036 + diesel * 0.0358 + renewable * 0.0036;
    await prisma.energyData.upsert({
      where: { siteId_month_year: { siteId: sites[1].id, month, year: 2025 } },
      update: {},
      create: {
        siteId: sites[1].id, month, year: 2025,
        electricityKwh: parseFloat(elec.toFixed(2)),
        dieselLitres: parseFloat(diesel.toFixed(2)),
        renewableKwh: parseFloat(renewable.toFixed(2)),
        totalEnergyGj: parseFloat(totalGj.toFixed(2)),
        enteredBy: admin.id,
      },
    });
  }

  console.log('  ✅ Sample demo data seeded (production + energy for Taloja & Daman, Jan-Jun 2025)');
  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
