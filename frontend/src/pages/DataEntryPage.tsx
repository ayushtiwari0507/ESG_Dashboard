import { useState, useEffect } from 'react';
import api from '../api/client';

interface Site { id: number; name: string; code: string; }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS = [2023,2024,2025,2026];

const TABS = [
  { key: 'energy', label: 'Energy', icon: '⚡' },
  { key: 'production', label: 'Production', icon: '🏭' },
  { key: 'water', label: 'Water', icon: '💧' },
  { key: 'waste', label: 'Waste', icon: '🗑️' },
  { key: 'etp', label: 'ETP', icon: '🧪' },
  { key: 'ghg', label: 'GHG', icon: '🌍' },
  { key: 'air', label: 'Air Emissions', icon: '🌫️' },
  { key: 'sales', label: 'Sales', icon: '📦' },
  { key: 'recovery', label: 'Recovery', icon: '♻️' },
];

function NumField({ label, unit, icon, value, onChange }: { label: string; unit: string; icon: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-dark-300 mb-2">
        {icon} {label} <span className="text-dark-500">({unit})</span>
      </label>
      <input type="number" step="0.01" min="0" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} className="w-full" />
    </div>
  );
}

function TextSelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="block text-sm font-medium text-dark-300 mb-2">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-dark-300 mb-2">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} className="w-full" placeholder={placeholder} />
    </div>
  );
}

// ── Energy Form ──
function EnergyForm({ siteId, month, year }: { siteId: number; month: number; year: number }) {
  const [fd, setFd] = useState({ electricityKwh: 0, steamMt: 0, coalMt: 0, dieselLitres: 0, foLitres: 0, lpgKg: 0, pngScm: 0, renewableKwh: 0 });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: false });
  const set = (k: string, v: number) => setFd(p => ({ ...p, [k]: v }));
  const fields = [
    { key: 'electricityKwh', label: 'Electricity', unit: 'kWh', icon: '⚡' },
    { key: 'steamMt', label: 'Steam', unit: 'MT', icon: '♨️' },
    { key: 'coalMt', label: 'Coal', unit: 'MT', icon: '⛏️' },
    { key: 'dieselLitres', label: 'Diesel', unit: 'Litres', icon: '⛽' },
    { key: 'foLitres', label: 'Furnace Oil', unit: 'Litres', icon: '🛢️' },
    { key: 'lpgKg', label: 'LPG', unit: 'kg', icon: '🔥' },
    { key: 'pngScm', label: 'PNG', unit: 'SCM', icon: '🔵' },
    { key: 'renewableKwh', label: 'Renewable', unit: 'kWh', icon: '🌱' },
  ];
  const save = async () => {
    setLoading(true); setMsg({ text: '', ok: false });
    try {
      const r = await api.post('/data/energy', { siteId, month, year, ...fd });
      setMsg({ text: `Saved! Total Energy: ${Number(r.data.totalEnergyGj).toFixed(2)} GJ`, ok: true });
    } catch (e: any) { setMsg({ text: e.response?.data?.error || 'Failed', ok: false }); }
    finally { setLoading(false); }
  };
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {fields.map(f => <NumField key={f.key} label={f.label} unit={f.unit} icon={f.icon} value={fd[f.key as keyof typeof fd]} onChange={v => set(f.key, v)} />)}
      </div>
      <Msg msg={msg} />
      <SaveBtn onClick={save} loading={loading} label="Save Energy Data" />
    </>
  );
}

// ── Production Form ──
function ProductionForm({ siteId, month, year }: { siteId: number; month: number; year: number }) {
  const [quantityMt, setQuantityMt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: false });
  const save = async () => {
    setLoading(true); setMsg({ text: '', ok: false });
    try {
      await api.post('/data/production', { siteId, month, year, quantityMt });
      setMsg({ text: `Production data saved: ${quantityMt} MT`, ok: true });
    } catch (e: any) { setMsg({ text: e.response?.data?.error || 'Failed', ok: false }); }
    finally { setLoading(false); }
  };
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <NumField label="Production Quantity" unit="MT" icon="🏭" value={quantityMt} onChange={setQuantityMt} />
      </div>
      <Msg msg={msg} />
      <SaveBtn onClick={save} loading={loading} label="Save Production Data" />
    </>
  );
}

// ── Water Form ──
function WaterForm({ siteId, month, year }: { siteId: number; month: number; year: number }) {
  const [fd, setFd] = useState({ freshWaterKl: 0, recycledWaterKl: 0, dischargeKl: 0 });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: false });
  const set = (k: string, v: number) => setFd(p => ({ ...p, [k]: v }));
  const save = async () => {
    setLoading(true); setMsg({ text: '', ok: false });
    try {
      const r = await api.post('/data/water', { siteId, month, year, ...fd });
      setMsg({ text: `Saved! Consumption: ${Number(r.data.totalConsumptionKl).toFixed(2)} KL`, ok: true });
    } catch (e: any) { setMsg({ text: e.response?.data?.error || 'Failed', ok: false }); }
    finally { setLoading(false); }
  };
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <NumField label="Fresh Water" unit="KL" icon="🚰" value={fd.freshWaterKl} onChange={v => set('freshWaterKl', v)} />
        <NumField label="Recycled Water" unit="KL" icon="♻️" value={fd.recycledWaterKl} onChange={v => set('recycledWaterKl', v)} />
        <NumField label="Discharge" unit="KL" icon="🌊" value={fd.dischargeKl} onChange={v => set('dischargeKl', v)} />
      </div>
      <Msg msg={msg} />
      <SaveBtn onClick={save} loading={loading} label="Save Water Data" />
    </>
  );
}

// ── Waste Form ──
function WasteForm({ siteId, month, year }: { siteId: number; month: number; year: number }) {
  const [fd, setFd] = useState({ wasteType: 'non_hazardous', disposalMethod: 'recycled', quantityMt: 0, description: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: false });
  const save = async () => {
    setLoading(true); setMsg({ text: '', ok: false });
    try {
      await api.post('/data/waste', { siteId, month, year, ...fd, quantityMt: fd.quantityMt });
      setMsg({ text: `Waste data saved: ${fd.quantityMt} MT`, ok: true });
    } catch (e: any) { setMsg({ text: e.response?.data?.error || 'Failed', ok: false }); }
    finally { setLoading(false); }
  };
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <TextSelectField label="Waste Type" value={fd.wasteType} onChange={v => setFd(p => ({ ...p, wasteType: v }))}
          options={[{ value: 'hazardous', label: 'Hazardous' }, { value: 'non_hazardous', label: 'Non-Hazardous' }]} />
        <TextSelectField label="Disposal Method" value={fd.disposalMethod} onChange={v => setFd(p => ({ ...p, disposalMethod: v }))}
          options={[{ value: 'recycled', label: 'Recycled' }, { value: 'co_processed', label: 'Co-Processed' }, { value: 'landfilled', label: 'Landfilled' }, { value: 'incinerated', label: 'Incinerated' }, { value: 'other', label: 'Other' }]} />
        <NumField label="Quantity" unit="MT" icon="🗑️" value={fd.quantityMt} onChange={v => setFd(p => ({ ...p, quantityMt: v }))} />
        <TextField label="Description" value={fd.description} onChange={v => setFd(p => ({ ...p, description: v }))} placeholder="Optional description" />
      </div>
      <Msg msg={msg} />
      <SaveBtn onClick={save} loading={loading} label="Save Waste Data" />
    </>
  );
}

// ── ETP Form ──
function ETPForm({ siteId, month, year }: { siteId: number; month: number; year: number }) {
  const [fd, setFd] = useState({ codMgPerL: 0, bodMgPerL: 0, tssMgPerL: 0, tdsMgPerL: 0, sludgeMt: 0 });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: false });
  const set = (k: string, v: number) => setFd(p => ({ ...p, [k]: v }));
  const save = async () => {
    setLoading(true); setMsg({ text: '', ok: false });
    try {
      await api.post('/data/etp', { siteId, month, year, ...fd });
      setMsg({ text: 'ETP data saved successfully', ok: true });
    } catch (e: any) { setMsg({ text: e.response?.data?.error || 'Failed', ok: false }); }
    finally { setLoading(false); }
  };
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 mb-6">
        <NumField label="COD" unit="mg/L" icon="🧪" value={fd.codMgPerL} onChange={v => set('codMgPerL', v)} />
        <NumField label="BOD" unit="mg/L" icon="🧫" value={fd.bodMgPerL} onChange={v => set('bodMgPerL', v)} />
        <NumField label="TSS" unit="mg/L" icon="🔬" value={fd.tssMgPerL} onChange={v => set('tssMgPerL', v)} />
        <NumField label="TDS" unit="mg/L" icon="💊" value={fd.tdsMgPerL} onChange={v => set('tdsMgPerL', v)} />
        <NumField label="Sludge" unit="MT" icon="🪨" value={fd.sludgeMt} onChange={v => set('sludgeMt', v)} />
      </div>
      <Msg msg={msg} />
      <SaveBtn onClick={save} loading={loading} label="Save ETP Data" />
    </>
  );
}

// ── GHG Form (simplified — scope 1/2 direct entry) ──
function GHGForm({ siteId, month, year }: { siteId: number; month: number; year: number }) {
  const [fd, setFd] = useState({ scope: 'scope_1', sourceDescription: '', activityData: 0, activityUnitId: 1, emissionFactorId: 1, co2eTonnes: 0 });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: false });
  const save = async () => {
    setLoading(true); setMsg({ text: '', ok: false });
    try {
      await api.post('/data/ghg', { siteId, month, year, ...fd, activityData: fd.activityData, co2eTonnes: fd.co2eTonnes });
      setMsg({ text: `GHG emission saved: ${fd.co2eTonnes} tCO2e`, ok: true });
    } catch (e: any) { setMsg({ text: e.response?.data?.error || 'Failed', ok: false }); }
    finally { setLoading(false); }
  };
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
        <TextSelectField label="Scope" value={fd.scope} onChange={v => setFd(p => ({ ...p, scope: v }))}
          options={[{ value: 'scope_1', label: 'Scope 1 (Direct)' }, { value: 'scope_2', label: 'Scope 2 (Indirect)' }, { value: 'scope_3', label: 'Scope 3 (Value Chain)' }]} />
        <TextField label="Source Description" value={fd.sourceDescription} onChange={v => setFd(p => ({ ...p, sourceDescription: v }))} placeholder="e.g. Diesel Generator" />
        <NumField label="Activity Data" unit="qty" icon="📊" value={fd.activityData} onChange={v => setFd(p => ({ ...p, activityData: v }))} />
        <NumField label="CO2e" unit="tonnes" icon="🌍" value={fd.co2eTonnes} onChange={v => setFd(p => ({ ...p, co2eTonnes: v }))} />
      </div>
      <Msg msg={msg} />
      <SaveBtn onClick={save} loading={loading} label="Save GHG Data" />
    </>
  );
}

// ── Air Emissions Form ──
function AirEmissionsForm({ siteId, month, year }: { siteId: number; month: number; year: number }) {
  const [fd, setFd] = useState({ soxKg: 0, noxKg: 0, pmKg: 0, vocKg: 0, stackId: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: false });
  const set = (k: string, v: number) => setFd(p => ({ ...p, [k]: v }));
  const save = async () => {
    setLoading(true); setMsg({ text: '', ok: false });
    try {
      await api.post('/data/air-emissions', { siteId, month, year, ...fd });
      setMsg({ text: 'Air emissions data saved', ok: true });
    } catch (e: any) { setMsg({ text: e.response?.data?.error || 'Failed', ok: false }); }
    finally { setLoading(false); }
  };
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 mb-6">
        <NumField label="SOx" unit="kg" icon="🌫️" value={fd.soxKg} onChange={v => set('soxKg', v)} />
        <NumField label="NOx" unit="kg" icon="🌫️" value={fd.noxKg} onChange={v => set('noxKg', v)} />
        <NumField label="PM" unit="kg" icon="🌫️" value={fd.pmKg} onChange={v => set('pmKg', v)} />
        <NumField label="VOC" unit="kg" icon="🌫️" value={fd.vocKg} onChange={v => set('vocKg', v)} />
        <TextField label="Stack ID" value={fd.stackId} onChange={v => setFd(p => ({ ...p, stackId: v }))} placeholder="e.g. STK-01" />
      </div>
      <Msg msg={msg} />
      <SaveBtn onClick={save} loading={loading} label="Save Air Emissions Data" />
    </>
  );
}

// ── Sales Form ──
function SalesForm({ siteId, month, year }: { siteId: number; month: number; year: number }) {
  const [fd, setFd] = useState({ quantityMt: 0, revenueLkr: 0 });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: false });
  const save = async () => {
    setLoading(true); setMsg({ text: '', ok: false });
    try {
      await api.post('/data/sales', { siteId, month, year, ...fd });
      setMsg({ text: `Sales data saved: ${fd.quantityMt} MT`, ok: true });
    } catch (e: any) { setMsg({ text: e.response?.data?.error || 'Failed', ok: false }); }
    finally { setLoading(false); }
  };
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <NumField label="Sales Quantity" unit="MT" icon="📦" value={fd.quantityMt} onChange={v => setFd(p => ({ ...p, quantityMt: v }))} />
        <NumField label="Revenue" unit="Lakhs" icon="💰" value={fd.revenueLkr} onChange={v => setFd(p => ({ ...p, revenueLkr: v }))} />
      </div>
      <Msg msg={msg} />
      <SaveBtn onClick={save} loading={loading} label="Save Sales Data" />
    </>
  );
}

// ── Recovery Form ──
function RecoveryForm({ siteId, month, year }: { siteId: number; month: number; year: number }) {
  const [fd, setFd] = useState({ materialName: '', quantityMt: 0, revenueLkr: 0 });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: false });
  const save = async () => {
    setLoading(true); setMsg({ text: '', ok: false });
    try {
      await api.post('/data/recovery', { siteId, month, year, ...fd });
      setMsg({ text: `Recovery data saved: ${fd.quantityMt} MT of ${fd.materialName}`, ok: true });
    } catch (e: any) { setMsg({ text: e.response?.data?.error || 'Failed', ok: false }); }
    finally { setLoading(false); }
  };
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <TextField label="Material Name" value={fd.materialName} onChange={v => setFd(p => ({ ...p, materialName: v }))} placeholder="e.g. Fly Ash, Iron Scrap" />
        <NumField label="Quantity" unit="MT" icon="♻️" value={fd.quantityMt} onChange={v => setFd(p => ({ ...p, quantityMt: v }))} />
        <NumField label="Revenue" unit="Lakhs" icon="💰" value={fd.revenueLkr} onChange={v => setFd(p => ({ ...p, revenueLkr: v }))} />
      </div>
      <Msg msg={msg} />
      <SaveBtn onClick={save} loading={loading} label="Save Recovery Data" />
    </>
  );
}

// ── Shared UI ──
function Msg({ msg }: { msg: { text: string; ok: boolean } }) {
  if (!msg.text) return null;
  const cls = msg.ok
    ? 'bg-primary-500/10 border-primary-500/30 text-primary-400'
    : 'bg-red-500/10 border-red-500/30 text-red-400';
  return (
    <div className={`${cls} border px-4 py-3 rounded-lg mb-6 text-sm flex items-center gap-2`}>
      <span>{msg.ok ? '✅' : '❌'}</span> {msg.text}
    </div>
  );
}

function SaveBtn({ onClick, loading, label }: { onClick: () => void; loading: boolean; label: string }) {
  return (
    <div className="flex justify-end">
      <button type="button" onClick={onClick} disabled={loading} className="btn-primary px-8">
        {loading ? 'Saving...' : `💾 ${label}`}
      </button>
    </div>
  );
}

// ── Main DataEntryPage ──
export default function DataEntryPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(2025);
  const [activeTab, setActiveTab] = useState('energy');

  useEffect(() => {
    api.get('/sites').then(res => {
      setSites(res.data);
      if (res.data.length > 0) setSiteId(res.data[0].id.toString());
    });
  }, []);

  const formProps = { siteId: parseInt(siteId) || 0, month, year };

  const renderForm = () => {
    switch (activeTab) {
      case 'energy': return <EnergyForm {...formProps} />;
      case 'production': return <ProductionForm {...formProps} />;
      case 'water': return <WaterForm {...formProps} />;
      case 'waste': return <WasteForm {...formProps} />;
      case 'etp': return <ETPForm {...formProps} />;
      case 'ghg': return <GHGForm {...formProps} />;
      case 'air': return <AirEmissionsForm {...formProps} />;
      case 'sales': return <SalesForm {...formProps} />;
      case 'recovery': return <RecoveryForm {...formProps} />;
      default: return null;
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Data Entry</h1>
      <p className="text-dark-400 mb-6">Environmental & sustainability data capture</p>

      {/* Period & Site selector */}
      <div className="glass-card p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">📍 Period & Site</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Site</label>
            <select value={siteId} onChange={e => setSiteId(e.target.value)} className="w-full">
              {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Month</label>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="w-full">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Year</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-full">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.key
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                : 'text-dark-400 hover:text-white hover:bg-dark-800 border border-dark-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Active form */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          {TABS.find(t => t.key === activeTab)?.icon} {TABS.find(t => t.key === activeTab)?.label} Data
        </h3>
        {renderForm()}
      </div>
    </div>
  );
}
