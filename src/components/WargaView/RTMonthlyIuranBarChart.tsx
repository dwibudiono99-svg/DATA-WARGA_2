import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useRBAC } from '../../context/RBACContext';
import {
  CreditCard,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  Filter,
} from 'lucide-react';

interface RTMonthlyIuranBarChartProps {
  onNavigateIuran?: () => void;
}

export const RTMonthlyIuranBarChart: React.FC<RTMonthlyIuranBarChartProps> = ({
  onNavigateIuran,
}) => {
  const { iuranList, wargaList, infoPerumahan } = useRBAC();
  const [metricView, setMetricView] = useState<'nominal' | 'warga'>('nominal');

  // Multi-month period sequence (past 6 months)
  const monthlyData = useMemo(() => {
    const predefinedPeriods = [
      'April 2026',
      'Mei 2026',
      'Juni 2026',
      'Juli 2026',
      'Agustus 2026',
      'September 2026',
    ];

    const totalWarga = wargaList.length || 48;
    const nominalPerWarga = 150000;
    const targetNominalBulanan = totalWarga * nominalPerWarga;

    return predefinedPeriods.map((period) => {
      // Find actual entries in iuranList for this period
      const periodItems = iuranList.filter((i) => i.periodeBulan === period);

      let lunasCount = 0;
      let pendingCount = 0;
      let belumCount = 0;
      let nominalLunas = 0;
      let nominalPending = 0;

      if (periodItems.length > 0) {
        lunasCount = periodItems.filter((i) => i.statusBayar === 'Lunas').length;
        pendingCount = periodItems.filter((i) => i.statusBayar === 'Menunggu Verifikasi').length;
        belumCount = Math.max(totalWarga - lunasCount - pendingCount, 0);

        nominalLunas = periodItems
          .filter((i) => i.statusBayar === 'Lunas')
          .reduce((sum, item) => sum + item.nominal, 0);
        nominalPending = periodItems
          .filter((i) => i.statusBayar === 'Menunggu Verifikasi')
          .reduce((sum, item) => sum + item.nominal, 0);
      } else {
        // Realistic simulated trend for previous historical months
        if (period === 'April 2026') {
          lunasCount = Math.round(totalWarga * 0.96);
          belumCount = totalWarga - lunasCount;
          nominalLunas = lunasCount * nominalPerWarga;
        } else if (period === 'Mei 2026') {
          lunasCount = Math.round(totalWarga * 0.94);
          belumCount = totalWarga - lunasCount;
          nominalLunas = lunasCount * nominalPerWarga;
        } else if (period === 'Juni 2026') {
          lunasCount = Math.round(totalWarga * 0.92);
          belumCount = totalWarga - lunasCount;
          nominalLunas = lunasCount * nominalPerWarga;
        } else if (period === 'Juli 2026') {
          lunasCount = Math.round(totalWarga * 0.95);
          belumCount = totalWarga - lunasCount;
          nominalLunas = lunasCount * nominalPerWarga;
        } else if (period === 'Agustus 2026') {
          lunasCount = Math.round(totalWarga * 0.88);
          pendingCount = 2;
          belumCount = totalWarga - lunasCount - pendingCount;
          nominalLunas = lunasCount * nominalPerWarga;
          nominalPending = pendingCount * nominalPerWarga;
        }
      }

      const nominalBelum = belumCount * nominalPerWarga;
      const persentaseLunas = Math.round((lunasCount / totalWarga) * 100);

      // Short label for X-Axis (e.g. "Apr 26", "Mei 26")
      const shortMonth = period.replace(' 2026', ' \'26');

      return {
        periode: period,
        bulanLabel: shortMonth,
        'Kas Terkumpul (Rp)': nominalLunas,
        'Belum Lunas (Rp)': nominalBelum,
        'Menunggu Konfirmasi (Rp)': nominalPending,
        'Warga Lunas': lunasCount,
        'Belum Bayar': belumCount,
        'Menunggu Verifikasi': pendingCount,
        targetNominal: targetNominalBulanan,
        persentaseLunas,
        totalWarga,
      };
    });
  }, [iuranList, wargaList]);

  // Current month summary stats (September 2026)
  const currentMonthData = monthlyData[monthlyData.length - 1];

  // Custom Currency Formatter for Tooltip
  const formatRupiah = (val: number) => {
    return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6 relative overflow-hidden">
      {/* Top Header & Interactive Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight flex items-center gap-2">
                <span>Statistik Realisasi Iuran Bulanan RT</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Recharts Bar Chart
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Tren penerimaan kas & kepatuhan pembayaran iuran perumahan {infoPerumahan.namaPerumahan} (6 Bulan Terakhir)
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Controls */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 border border-slate-200">
            <button
              type="button"
              onClick={() => setMetricView('nominal')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                metricView === 'nominal'
                  ? 'bg-white text-emerald-800 shadow-xs font-black'
                  : 'hover:text-slate-900'
              }`}
            >
              Nominal (Rp)
            </button>
            <button
              type="button"
              onClick={() => setMetricView('warga')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                metricView === 'warga'
                  ? 'bg-white text-indigo-800 shadow-xs font-black'
                  : 'hover:text-slate-900'
              }`}
            >
              Jumlah Rumah (KK)
            </button>
          </div>

          {onNavigateIuran && (
            <button
              type="button"
              onClick={onNavigateIuran}
              className="btn-3d btn-3d-white text-xs px-3 py-1.5 hidden sm:flex items-center gap-1"
            >
              <span>Kelola Iuran</span>
              <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Highlight Ribbons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
              Terkumpul Bulan Ini
            </span>
            <p className="text-xl sm:text-2xl font-black text-emerald-950">
              Rp {currentMonthData['Kas Terkumpul (Rp)'].toLocaleString('id-ID')}
            </p>
            <span className="text-[10px] text-emerald-700 font-semibold block">
              {currentMonthData['Warga Lunas']} dari {currentMonthData.totalWarga} Rumah Lunas
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">
              Menunggu Verifikasi
            </span>
            <p className="text-xl sm:text-2xl font-black text-amber-950">
              {currentMonthData['Menunggu Verifikasi']} Rumah
            </p>
            <span className="text-[10px] text-amber-700 font-semibold block">
              Rp {currentMonthData['Menunggu Konfirmasi (Rp)'].toLocaleString('id-ID')} bukti transfer
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">
              Tunggakan / Belum
            </span>
            <p className="text-xl sm:text-2xl font-black text-rose-950">
              {currentMonthData['Belum Bayar']} Rumah
            </p>
            <span className="text-[10px] text-rose-700 font-semibold block">
              Rp {currentMonthData['Belum Lunas (Rp)'].toLocaleString('id-ID')} belum disetor
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
            <AlertCircle className="w-5 h-5 text-rose-600" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide">
              Kepatuhan Bulan Ini
            </span>
            <p className="text-xl sm:text-2xl font-black text-indigo-950">
              {currentMonthData.persentaseLunas}%
            </p>
            <span className="text-[10px] text-indigo-700 font-semibold block">
              Target bulanan: 100%
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* Main Recharts Bar Chart Canvas */}
      <div className="pt-2">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {metricView === 'nominal' ? (
              <BarChart
                data={monthlyData}
                margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
                barGap={6}
                barCategoryGap="25%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="bulanLabel"
                  tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(1)}Jt`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [formatRupiah(Number(value)), name]}
                  labelFormatter={(label) => `Periode: ${label}`}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '16px',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                    padding: '10px 14px',
                  }}
                  itemStyle={{ padding: '2px 0' }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  formatter={(val) => (
                    <span className="text-xs font-bold text-slate-700 mr-2">{val}</span>
                  )}
                />
                <Bar
                  dataKey="Kas Terkumpul (Rp)"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  name="Kas Masuk (Lunas)"
                />
                <Bar
                  dataKey="Menunggu Konfirmasi (Rp)"
                  fill="#f59e0b"
                  radius={[6, 6, 0, 0]}
                  name="Menunggu Verifikasi"
                />
                <Bar
                  dataKey="Belum Lunas (Rp)"
                  fill="#f43f5e"
                  radius={[6, 6, 0, 0]}
                  name="Belum Lunas"
                />
              </BarChart>
            ) : (
              <BarChart
                data={monthlyData}
                margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
                barGap={6}
                barCategoryGap="25%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="bulanLabel"
                  tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [`${value} Kepala Keluarga`, name]}
                  labelFormatter={(label) => `Periode: ${label}`}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '16px',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                    padding: '10px 14px',
                  }}
                  itemStyle={{ padding: '2px 0' }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  formatter={(val) => (
                    <span className="text-xs font-bold text-slate-700 mr-2">{val}</span>
                  )}
                />
                <Bar
                  dataKey="Warga Lunas"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  name="Warga Lunas (KK)"
                />
                <Bar
                  dataKey="Menunggu Verifikasi"
                  fill="#f59e0b"
                  radius={[6, 6, 0, 0]}
                  name="Menunggu Verifikasi"
                />
                <Bar
                  dataKey="Belum Bayar"
                  fill="#f43f5e"
                  radius={[6, 6, 0, 0]}
                  name="Belum Bayar (KK)"
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer Info Ribbon */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Tarif Iuran: <strong>Rp 150.000 / KK / Bulan</strong> (Kebersihan Sampah & Keamanan Pos Satpam 24 Jam)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>Lunas</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>Verifikasi</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span>Belum Bayar</span>
          </span>
        </div>
      </div>
    </div>
  );
};
