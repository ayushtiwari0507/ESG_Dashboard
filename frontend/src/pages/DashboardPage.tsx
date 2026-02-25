import { useEffect, useState } from 'react';
import api from '../api/client';
import ReactECharts from 'echarts-for-react';

interface DashboardSummary {
  year: number;
  totalScope1: number;
  totalScope2: number;
  totalScope3: number;
  totalGroupEmissions: number;
  carbonIntensity: number;
  energyIntensity: number;
  waterIntensity: number;
  wasteIntensity: number;
  renewableEnergyPct: number;
  recoveryPct: number;
  productionTotal: number;
  totalEnergyGj: number;
  totalWaterKl: number;
  totalWasteMt: number;
}

interface TrendData {
  month: number;
  totalEnergyGj: number;
  electricityKwh: number;
  renewableKwh: number;
}

interface SiteComparison {
  siteName: string;
  siteCode: string;
  totalEnergyGj: number;
  productionMt: number;
  totalEmissions: number;
}

function KPICard({ label, value, unit, icon, color }: {
  label: string; value: number | string; unit: string; icon: string; color: string;
}) {
  return (
    <div className="glass-card kpi-card p-5 hover-lift">
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${color}`}>
          {unit}
        </span>
      </div>
      <p className="text-2xl font-bold text-white mb-1">
        {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value}
      </p>
      <p className="text-sm text-dark-400">{label}</p>
    </div>
  );
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trend, setTrend] = useState<TrendData[]>([]);
  const [siteComparison, setSiteComparison] = useState<SiteComparison[]>([]);
  const [year] = useState(2025);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summRes, trendRes, compRes] = await Promise.all([
          api.get(`/dashboard/summary?year=${year}`),
          api.get(`/dashboard/emissions-trend?year=${year}`),
          api.get(`/dashboard/site-comparison?year=${year}`),
        ]);
        setSummary(summRes.data);
        setTrend(trendRes.data);
        setSiteComparison(compRes.data);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [year]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  // Energy Trend Chart
  const trendOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' as const, backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#e2e8f0' } },
    legend: { data: ['Total Energy (GJ)', 'Renewable (kWh)'], textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { left: 50, right: 30, top: 40, bottom: 30 },
    xAxis: { type: 'category' as const, data: MONTH_LABELS, axisLine: { lineStyle: { color: '#334155' } }, axisLabel: { color: '#94a3b8' } },
    yAxis: [
      { type: 'value' as const, name: 'GJ', nameTextStyle: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } }, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b' } } },
      { type: 'value' as const, name: 'kWh', nameTextStyle: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } }, axisLabel: { color: '#94a3b8' }, splitLine: { show: false } },
    ],
    series: [
      {
        name: 'Total Energy (GJ)',
        type: 'bar',
        data: trend.map(t => parseFloat(t.totalEnergyGj.toFixed(2))),
        itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#059669' }] }, borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'Renewable (kWh)',
        type: 'line',
        yAxisIndex: 1,
        data: trend.map(t => parseFloat(t.renewableKwh.toFixed(2))),
        smooth: true,
        lineStyle: { color: '#3b82f6', width: 3 },
        itemStyle: { color: '#3b82f6' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59,130,246,0.2)' }, { offset: 1, color: 'rgba(59,130,246,0)' }] } },
      },
    ],
  };

  // Scope Breakdown Pie
  const scopePieOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' as const, backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#e2e8f0' } },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['50%', '55%'],
      label: { color: '#e2e8f0', fontSize: 12 },
      data: [
        { value: summary?.totalScope1 || 0, name: 'Scope 1', itemStyle: { color: '#10b981' } },
        { value: summary?.totalScope2 || 0, name: 'Scope 2', itemStyle: { color: '#3b82f6' } },
        { value: summary?.totalScope3 || 0, name: 'Scope 3', itemStyle: { color: '#f59e0b' } },
      ],
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
    }],
  };

  // Site Comparison Bar
  const comparisonOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' as const, backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#e2e8f0' } },
    grid: { left: 80, right: 30, top: 20, bottom: 30 },
    xAxis: { type: 'value' as const, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category' as const, data: siteComparison.map(s => s.siteCode), axisLabel: { color: '#94a3b8' } },
    series: [{
      type: 'bar',
      data: siteComparison.map(s => parseFloat(s.totalEnergyGj.toFixed(2))),
      itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#059669' }, { offset: 1, color: '#10b981' }] }, borderRadius: [0, 4, 4, 0] },
      barWidth: 20,
    }],
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-dark-400 mt-1">ESG Performance Overview — {year}</p>
        </div>
        <span className="px-4 py-2 rounded-xl bg-dark-800 text-dark-300 text-sm font-medium border border-dark-700">
          FY {year}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <KPICard label="Total Emissions" value={summary?.totalGroupEmissions || 0} unit="tCO₂e" icon="🌍" color="bg-primary-500/20 text-primary-400" />
        <KPICard label="Carbon Intensity" value={summary?.carbonIntensity || 0} unit="tCO₂e/MT" icon="📈" color="bg-blue-500/20 text-blue-400" />
        <KPICard label="Renewable Energy" value={`${summary?.renewableEnergyPct || 0}%`} unit="of total" icon="⚡" color="bg-amber-500/20 text-amber-400" />
        <KPICard label="Production" value={summary?.productionTotal || 0} unit="MT" icon="🏭" color="bg-purple-500/20 text-purple-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <KPICard label="Total Energy" value={summary?.totalEnergyGj || 0} unit="GJ" icon="🔥" color="bg-orange-500/20 text-orange-400" />
        <KPICard label="Energy Intensity" value={summary?.energyIntensity || 0} unit="GJ/MT" icon="⚙️" color="bg-cyan-500/20 text-cyan-400" />
        <KPICard label="Water Consumption" value={summary?.totalWaterKl || 0} unit="KL" icon="💧" color="bg-sky-500/20 text-sky-400" />
        <KPICard label="Recovery %" value={`${summary?.recoveryPct || 0}%`} unit="waste" icon="♻️" color="bg-emerald-500/20 text-emerald-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Energy Trend (Monthly)</h3>
          <ReactECharts option={trendOption} style={{ height: 320 }} />
        </div>
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">GHG Scope Breakdown</h3>
          <ReactECharts option={scopePieOption} style={{ height: 320 }} />
        </div>
      </div>

      <div className="mt-6 glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Site Comparison — Energy (GJ)</h3>
        <ReactECharts option={comparisonOption} style={{ height: 250 }} />
      </div>
    </div>
  );
}
