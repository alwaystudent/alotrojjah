import React, { useEffect, useMemo, useState } from 'react';
import { User, signInWithPopup } from 'firebase/auth';
import {
  Smartphone,
  Tablet,
  Monitor,
  Globe,
  Clock,
  Download,
  RefreshCw,
  Search,
  ShieldCheck,
  LogIn,
  Trash2,
  FileSpreadsheet,
  Activity,
  Laptop,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Language } from '@/src/data/quranData';
import { auth, googleProvider } from '@/src/firebase';
import {
  APP_OWNER_EMAIL,
  DeviceTelemetryRecord,
  TelemetryDeviceType,
  deleteOwnerTelemetryRecord,
  getCountryFlagEmoji,
  isAppOwnerUser,
  subscribeOwnerDeviceTelemetry,
} from '@/src/utils/deviceTelemetry';

interface OwnerDashboardSectionProps {
  lang: Language;
  authUser: User | null;
}

type InstallFilter = 'all' | 'installed' | 'web';
type SortKey = 'updatedAt' | 'totalSessionSeconds' | 'totalSessions' | 'country';

function formatDurationHuman(totalSeconds: number, lang: Language): string {
  const sec = Math.max(0, Math.round(totalSeconds));
  if (sec < 60) {
    return lang === 'ar' ? `${sec} ث` : `${sec}s`;
  }
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (mins < 60) {
    return lang === 'ar'
      ? remSec > 0
        ? `${mins} د ${remSec} ث`
        : `${mins} د`
      : remSec > 0
      ? `${mins}m ${remSec}s`
      : `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return lang === 'ar'
    ? remMins > 0
      ? `${hours} س ${remMins} د`
      : `${hours} س`
    : remMins > 0
    ? `${hours}h ${remMins}m`
    : `${hours}h`;
}

function getDeviceTypeLabel(type: TelemetryDeviceType, lang: Language): string {
  if (type === 'mobile') return lang === 'ar' ? 'هاتف محمول' : 'Mobile';
  if (type === 'tablet') return lang === 'ar' ? 'جهاز لوحي' : 'Tablet';
  return lang === 'ar' ? 'حاسوب' : 'Desktop';
}

function getInstallSourceLabel(source: DeviceTelemetryRecord['installSource'], lang: Language): string {
  if (source === 'standalone') return lang === 'ar' ? 'تطبيق مثبت' : 'Standalone App';
  if (source === 'pwa_prompt') return lang === 'ar' ? 'تثبيت مباشر' : 'Direct Install';
  return lang === 'ar' ? 'المتصفح' : 'Web Browser';
}

const DEVICE_COLORS: Record<TelemetryDeviceType, string> = {
  mobile: '#C88A14',
  tablet: '#4A6144',
  desktop: '#2D2218',
};

const CustomDashboardTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="p-2.5 rounded-xl bg-[#FFFDF9] border border-[#C88A14] shadow-md text-xs space-y-1 z-50">
      {label && (
        <p className="font-bold text-[#2D2218] border-b border-[#EFE9DC] pb-1">{label}</p>
      )}
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-center justify-between gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-[#5C4B3B]">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.color || entry.payload?.fill || '#C88A14' }}
            />
            <span>{entry.name}:</span>
          </span>
          <span className="font-bold font-mono-tabular text-[#2D2218]">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export const OwnerDashboardSection: React.FC<OwnerDashboardSectionProps> = ({ lang, authUser }) => {
  const isAr = lang === 'ar';
  const isOwner = isAppOwnerUser(authUser);

  const [records, setRecords] = useState<DeviceTelemetryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState<number>(0);

  const [installFilter, setInstallFilter] = useState<InstallFilter>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<'all' | TelemetryDeviceType>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortKey>('updatedAt');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOwner) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    const unsubscribe = subscribeOwnerDeviceTelemetry(
      (data) => {
        setRecords(data);
        setLoading(false);
      },
      (err) => {
        setLoadError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOwner, refreshNonce]);

  const handleOwnerSignIn = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('popup-closed-by-user')) {
        setAuthError(
          isAr
            ? 'تعذر إتمام تسجيل الدخول عبر Google. حاول مجدداً.'
            : 'Could not complete Google Sign-In. Please try again.'
        );
      }
    } finally {
      setAuthBusy(false);
    }
  };

  // Distinct countries for dropdown
  const availableCountries = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    records.forEach((r) => {
      const code = r.countryCode || 'UN';
      if (!map.has(code)) {
        map.set(code, {
          code,
          name: isAr ? r.countryNameAr || code : r.countryNameEn || code,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [records, isAr]);

  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return records
      .filter((r) => {
        if (installFilter === 'installed' && !r.installed) return false;
        if (installFilter === 'web' && r.installed) return false;
        if (countryFilter !== 'all' && r.countryCode !== countryFilter) return false;
        if (deviceTypeFilter !== 'all' && r.deviceType !== deviceTypeFilter) return false;
        if (q) {
          const hay = [
            r.deviceId,
            r.countryCode,
            r.countryNameAr,
            r.countryNameEn,
            r.osName,
            r.browserName,
            getDeviceTypeLabel(r.deviceType, lang),
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'totalSessionSeconds') {
          return (b.totalSessionSeconds || 0) - (a.totalSessionSeconds || 0);
        }
        if (sortBy === 'totalSessions') {
          return (b.totalSessions || 0) - (a.totalSessions || 0);
        }
        if (sortBy === 'country') {
          const na = isAr ? a.countryNameAr : a.countryNameEn;
          const nb = isAr ? b.countryNameAr : b.countryNameEn;
          return na.localeCompare(nb);
        }
        const ta = a.updatedAt?.toMillis?.() ?? 0;
        const tb = b.updatedAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
  }, [records, installFilter, countryFilter, deviceTypeFilter, searchTerm, sortBy, isAr, lang]);

  // Aggregate KPIs across ALL records (and filtered context)
  const kpiStats = useMemo(() => {
    const totalDevices = records.length;
    const installedDevices = records.filter((r) => r.installed).length;
    const webOnlyDevices = totalDevices - installedDevices;
    const installRate = totalDevices > 0 ? Math.round((installedDevices / totalDevices) * 100) : 0;

    const totalSessions = records.reduce((s, r) => s + (r.totalSessions || 0), 0);
    const totalSeconds = records.reduce((s, r) => s + (r.totalSessionSeconds || 0), 0);
    const avgSecondsPerSession = totalSessions > 0 ? Math.round(totalSeconds / totalSessions) : 0;
    const avgSecondsPerDevice = totalDevices > 0 ? Math.round(totalSeconds / totalDevices) : 0;

    const countrySet = new Set(records.map((r) => r.countryCode || 'UN').filter((c) => c !== 'UN'));

    return {
      totalDevices,
      installedDevices,
      webOnlyDevices,
      installRate,
      totalSessions,
      totalSeconds,
      avgSecondsPerSession,
      avgSecondsPerDevice,
      activeCountriesCount: countrySet.size || (records.length > 0 ? 1 : 0),
    };
  }, [records]);

  // Country Aggregation
  const countryStats = useMemo(() => {
    const map = new Map<
      string,
      {
        countryCode: string;
        countryName: string;
        totalDevices: number;
        installedDevices: number;
        webDevices: number;
        totalSessions: number;
        totalSeconds: number;
      }
    >();

    records.forEach((r) => {
      const code = r.countryCode || 'UN';
      const existing = map.get(code) || {
        countryCode: code,
        countryName: isAr ? r.countryNameAr || code : r.countryNameEn || code,
        totalDevices: 0,
        installedDevices: 0,
        webDevices: 0,
        totalSessions: 0,
        totalSeconds: 0,
      };
      existing.totalDevices += 1;
      if (r.installed) existing.installedDevices += 1;
      else existing.webDevices += 1;
      existing.totalSessions += r.totalSessions || 0;
      existing.totalSeconds += r.totalSessionSeconds || 0;
      map.set(code, existing);
    });

    return Array.from(map.values()).sort(
      (a, b) => b.installedDevices - a.installedDevices || b.totalDevices - a.totalDevices
    );
  }, [records, isAr]);

  const topCountryChartData = useMemo(
    () =>
      countryStats.slice(0, 8).map((c) => ({
        name: `${getCountryFlagEmoji(c.countryCode)} ${c.countryName}`,
        [isAr ? 'مثبت كتطبيق' : 'Installed']: c.installedDevices,
        [isAr ? 'عبر المتصفح' : 'Web Only']: c.webDevices,
      })),
    [countryStats, isAr]
  );

  // Device Type Breakdown
  const deviceTypeBreakdown = useMemo(() => {
    const types: TelemetryDeviceType[] = ['mobile', 'tablet', 'desktop'];
    return types.map((type) => {
      const matching = records.filter((r) => r.deviceType === type);
      const installedCount = matching.filter((r) => r.installed).length;
      const totalSeconds = matching.reduce((s, r) => s + (r.totalSessionSeconds || 0), 0);
      const totalSessions = matching.reduce((s, r) => s + (r.totalSessions || 0), 0);
      return {
        type,
        name: getDeviceTypeLabel(type, lang),
        total: matching.length,
        installed: installedCount,
        totalSeconds,
        avgSessionSeconds: totalSessions > 0 ? Math.round(totalSeconds / totalSessions) : 0,
        pct: records.length > 0 ? Math.round((matching.length / records.length) * 100) : 0,
        color: DEVICE_COLORS[type],
      };
    });
  }, [records, lang]);

  const pieDeviceData = useMemo(
    () =>
      deviceTypeBreakdown
        .filter((d) => d.total > 0)
        .map((d) => ({
          name: d.name,
          value: d.total,
          installed: d.installed,
          fill: d.color,
        })),
    [deviceTypeBreakdown]
  );

  // OS Breakdown
  const osBreakdown = useMemo(() => {
    const map = new Map<string, { osName: string; total: number; installed: number }>();
    records.forEach((r) => {
      const key = r.osName || 'Other';
      const entry = map.get(key) || { osName: key, total: 0, installed: 0 };
      entry.total += 1;
      if (r.installed) entry.installed += 1;
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [records]);

  const handleExportCSV = () => {
    const headers = [
      'Device ID',
      'Installed',
      'Install Source',
      'Device Type',
      'OS',
      'Browser',
      'Country Code',
      'Country',
      'Total Sessions',
      'Total Session Seconds',
      'Last Session Seconds',
      'Last Active ISO',
    ];
    const rows = filteredRecords.map((r) => [
      r.deviceId,
      r.installed ? 'Yes' : 'No',
      r.installSource,
      r.deviceType,
      r.osName,
      r.browserName,
      r.countryCode,
      isAr ? r.countryNameAr : r.countryNameEn,
      String(r.totalSessions || 0),
      String(r.totalSessionSeconds || 0),
      String(r.lastSessionSeconds || 0),
      r.updatedAt?.toDate ? r.updatedAt.toDate().toISOString() : '',
    ]);

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alutrujjah-owner-devices-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteRecord = async (deviceId: string) => {
    setDeletingId(deviceId);
    try {
      await deleteOwnerTelemetryRecord(deviceId);
    } finally {
      setDeletingId(null);
    }
  };

  if (!authUser || !isOwner) {
    return (
      <section className="max-w-2xl mx-auto py-8">
        <div className="rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-6 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#2D2218] text-[#EAB338] flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-extrabold font-display-islamic text-[#2D2218]">
              {isAr ? 'لوحة تحكم صاحب التطبيق' : 'App Owner Dashboard'}
            </h2>
            <p className="text-xs sm:text-sm text-[#5C4B3B] leading-relaxed">
              {!authUser
                ? isAr
                  ? `سجّل الدخول بحساب مالك التطبيق (${APP_OWNER_EMAIL}) لعرض تقرير الأجهزة المثبتة والبلدان وأنواع الأجهزة وأزمنة الجلسات.`
                  : `Sign in with the app owner account (${APP_OWNER_EMAIL}) to view installed devices, countries, device types, and session durations.`
                : isAr
                ? `هذه اللوحة مخصصة لصاحب التطبيق فقط (${APP_OWNER_EMAIL}). الحساب الحالي (${authUser.email || ''}) لا يملك صلاحية العرض.`
                : `This dashboard is restricted to the app owner (${APP_OWNER_EMAIL}). Current account (${authUser.email || ''}) is not authorized.`}
            </p>
          </div>
          {authError && (
            <p className="text-xs font-semibold text-[#A84A32] bg-[#A84A32]/10 border border-[#A84A32]/25 rounded-xl px-3 py-2">
              {authError}
            </p>
          )}
          <div className="flex justify-center">
            <button
              type="button"
              disabled={authBusy}
              onClick={handleOwnerSignIn}
              className="mustard-gradient-btn px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-[#FFFDF9] inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              <span>
                {authBusy
                  ? isAr
                    ? 'جاري تسجيل الدخول...'
                    : 'Signing in...'
                  : isAr
                  ? 'تسجيل الدخول بحساب Google'
                  : 'Sign in with Google'}
              </span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* Top Banner & Action Controls */}
      <div className="earthy-gradient-banner rounded-2xl px-4 py-4 sm:px-6 text-[#FFFDF9] border border-[#8F681E]/40 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#EAB338] shrink-0" />
            <h1 className="text-lg sm:text-xl font-extrabold font-display-islamic">
              {isAr ? 'لوحة تحكم صاحب التطبيق' : 'App Owner Dashboard'}
            </h1>
          </div>
          <p className="text-xs text-[#E6D7BE]">
            {isAr
              ? 'تقرير الأجهزة المثبتة، توزيع البلدان، أنواع الأجهزة، وأزمنة الجلسات الحية'
              : 'Installed devices report, country distribution, device types, and session durations'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setRefreshNonce((n) => n + 1)}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-[#EAB338]/35 text-xs font-bold text-[#FDE68A] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="mustard-gradient-btn px-3.5 py-2 rounded-xl text-xs font-bold text-[#FFFDF9] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isAr ? 'تصدير CSV' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl bg-[#A84A32]/10 border border-[#A84A32]/30 px-4 py-3 text-xs font-semibold text-[#A84A32]">
          {isAr
            ? `تعذر تحميل بيانات التقرير: ${loadError}`
            : `Failed to load telemetry report: ${loadError}`}
        </div>
      )}

      {/* 4-Column KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#DEC078] shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-[#5C4B3B]">
            <span>{isAr ? 'الأجهزة المثبت عليها التطبيق' : 'Installed Devices'}</span>
            <Download className="w-4 h-4 text-[#C88A14]" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-[#2D2218]">
              {kpiStats.installedDevices}
            </span>
            <span className="text-xs font-bold font-mono-tabular text-[#9E650C]">
              {kpiStats.installRate}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#EFE9DC] overflow-hidden">
            <div
              className="h-full bg-[#C88A14] transition-all duration-300"
              style={{ width: `${kpiStats.installRate}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-[#5C4B3B]">
            <span>{isAr ? 'إجمالي الأجهزة المسجلة' : 'Total Tracked Devices'}</span>
            <Smartphone className="w-4 h-4 text-[#4A6144]" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-[#2D2218]">
              {kpiStats.totalDevices}
            </span>
            <span className="text-[11px] font-semibold font-mono-tabular text-[#5C4B3B]">
              {kpiStats.webOnlyDevices} {isAr ? 'متصفح' : 'web'}
            </span>
          </div>
          <p className="text-[11px] text-[#84715E] font-mono-tabular">
            {kpiStats.totalSessions} {isAr ? 'إجمالي الجلسات' : 'total sessions'}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-[#5C4B3B]">
            <span>{isAr ? 'البلدان النشطة' : 'Active Countries'}</span>
            <Globe className="w-4 h-4 text-[#4A6144]" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-[#2D2218]">
              {kpiStats.activeCountriesCount}
            </span>
            {countryStats[0] && (
              <span className="text-xs font-semibold text-[#5C4B3B] truncate max-w-[120px]">
                {getCountryFlagEmoji(countryStats[0].countryCode)} {countryStats[0].countryName}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#84715E]">
            {isAr ? 'حسب التوزيع الجغرافي' : 'Geographic distribution'}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-[#5C4B3B]">
            <span>{isAr ? 'إجمالي زمن الجلسات' : 'Total Session Time'}</span>
            <Clock className="w-4 h-4 text-[#C88A14]" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl sm:text-2xl font-extrabold font-mono-tabular text-[#2D2218]">
              {formatDurationHuman(kpiStats.totalSeconds, lang)}
            </span>
          </div>
          <p className="text-[11px] text-[#5C4B3B] font-mono-tabular">
            {isAr ? 'متوسط الجلسة:' : 'Avg session:'}{' '}
            <strong className="text-[#4A6144]">
              {formatDurationHuman(kpiStats.avgSecondsPerSession, lang)}
            </strong>
          </p>
        </div>
      </div>

      {/* Charts & Breakdowns: Countries + Device Types */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Countries Breakdown (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-[#EFE9DC] pb-2.5">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#4A6144]" />
              <h2 className="text-sm font-extrabold text-[#2D2218]">
                {isAr ? 'توزيع الأجهزة والزمن حسب البلدان' : 'Devices & Session Time by Country'}
              </h2>
            </div>
            <span className="text-[11px] font-mono-tabular font-semibold text-[#84715E]">
              {countryStats.length} {isAr ? 'دولة' : 'countries'}
            </span>
          </div>

          {loading && records.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-xs text-[#84715E]">
              {isAr ? 'جاري تحميل بيانات البلدان...' : 'Loading country statistics...'}
            </div>
          ) : countryStats.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-xs text-[#84715E]">
              {isAr ? 'لا توجد بيانات أجهزة مسجلة بعد.' : 'No device telemetry recorded yet.'}
            </div>
          ) : (
            <>
              <div className="h-52 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topCountryChartData}
                    margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#EFE9DC" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5C4B3B' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#5C4B3B' }} />
                    <Tooltip content={<CustomDashboardTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar
                      dataKey={isAr ? 'مثبت كتطبيق' : 'Installed'}
                      stackId="a"
                      fill="#C88A14"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey={isAr ? 'عبر المتصفح' : 'Web Only'}
                      stackId="a"
                      fill="#4A6144"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto border-t border-[#EFE9DC] pt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#84715E] border-b border-[#EFE9DC]">
                      <th className="py-1.5 px-2 text-start font-bold">
                        {isAr ? 'البلد' : 'Country'}
                      </th>
                      <th className="py-1.5 px-2 text-center font-bold">
                        {isAr ? 'المثبتة' : 'Installed'}
                      </th>
                      <th className="py-1.5 px-2 text-center font-bold">
                        {isAr ? 'الإجمالي' : 'Total'}
                      </th>
                      <th className="py-1.5 px-2 text-center font-bold">
                        {isAr ? 'الجلسات' : 'Sessions'}
                      </th>
                      <th className="py-1.5 px-2 text-end font-bold">
                        {isAr ? 'زمن الجلسات' : 'Duration'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F4EFE4]">
                    {countryStats.map((c) => (
                      <tr key={c.countryCode} className="hover:bg-[#FAF6EE]">
                        <td className="py-2 px-2 font-bold text-[#2D2218] whitespace-nowrap">
                          <span className="me-1.5">{getCountryFlagEmoji(c.countryCode)}</span>
                          <span>{c.countryName}</span>
                        </td>
                        <td className="py-2 px-2 text-center font-mono-tabular font-bold text-[#9E650C]">
                          {c.installedDevices}
                        </td>
                        <td className="py-2 px-2 text-center font-mono-tabular text-[#5C4B3B]">
                          {c.totalDevices}
                        </td>
                        <td className="py-2 px-2 text-center font-mono-tabular text-[#5C4B3B]">
                          {c.totalSessions}
                        </td>
                        <td className="py-2 px-2 text-end font-mono-tabular font-semibold text-[#4A6144] whitespace-nowrap">
                          {formatDurationHuman(c.totalSeconds, lang)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Device Type & OS Breakdown (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-[#EFE9DC] pb-2.5">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-[#C88A14]" />
              <h2 className="text-sm font-extrabold text-[#2D2218]">
                {isAr ? 'أنواع الأجهزة وأنظمة التشغيل' : 'Device Types & Operating Systems'}
              </h2>
            </div>
          </div>

          {pieDeviceData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-xs text-[#84715E]">
              {isAr ? 'لا توجد بيانات بعد.' : 'No device data yet.'}
            </div>
          ) : (
            <div className="h-48 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieDeviceData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={72}
                    paddingAngle={3}
                  >
                    {pieDeviceData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomDashboardTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-Device-Type Metrics */}
          <div className="space-y-2 pt-1 border-t border-[#EFE9DC]">
            {deviceTypeBreakdown.map((item) => {
              const Icon =
                item.type === 'mobile'
                  ? Smartphone
                  : item.type === 'tablet'
                  ? Tablet
                  : Monitor;
              return (
                <div
                  key={item.type}
                  className="flex items-center justify-between gap-3 py-1.5 px-2.5 rounded-xl bg-[#FAF6EE] border border-[#EFE9DC] text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" style={{ color: item.color }} />
                    <div className="min-w-0">
                      <div className="font-bold text-[#2D2218]">{item.name}</div>
                      <div className="text-[11px] text-[#84715E] font-mono-tabular">
                        {isAr ? 'مثبت:' : 'Installed:'} {item.installed} ·{' '}
                        {isAr ? 'متوسط الجلسة:' : 'Avg:'}{' '}
                        {formatDurationHuman(item.avgSessionSeconds, lang)}
                      </div>
                    </div>
                  </div>
                  <div className="text-end shrink-0 font-mono-tabular">
                    <div className="font-extrabold text-[#2D2218]">
                      {item.total} ({item.pct}%)
                    </div>
                    <div className="text-[11px] text-[#4A6144]">
                      {formatDurationHuman(item.totalSeconds, lang)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* OS Summary Line */}
          {osBreakdown.length > 0 && (
            <div className="pt-2 border-t border-[#EFE9DC] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#5C4B3B]">
              <span className="font-bold text-[#2D2218]">
                {isAr ? 'الأنظمة:' : 'OS:'}
              </span>
              {osBreakdown.map((os, idx) => (
                <span key={os.osName} className="font-mono-tabular">
                  {os.osName}: <strong className="text-[#2D2218]">{os.total}</strong>
                  {os.installed > 0 ? ` (${os.installed} ${isAr ? 'مثبت' : 'app'})` : ''}
                  {idx < osBreakdown.length - 1 ? ' ·' : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Devices & Sessions Table */}
      <div className="rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#EFE9DC] pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#C88A14]" />
            <h2 className="text-sm font-extrabold text-[#2D2218]">
              {isAr ? 'سجل الأجهزة التفصيلي وزمن الجلسات' : 'Detailed Device & Session Duration Log'}
            </h2>
            <span className="text-xs font-mono-tabular text-[#84715E]">
              ({filteredRecords.length})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Install Filter Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE]">
              {(
                [
                  { id: 'all', label: isAr ? 'الكل' : 'All' },
                  { id: 'installed', label: isAr ? 'مثبت فقط' : 'Installed' },
                  { id: 'web', label: isAr ? 'المتصفح' : 'Web' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInstallFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    installFilter === tab.id
                      ? 'bg-[#2D2218] text-[#EAB338]'
                      : 'text-[#5C4B3B] hover:text-[#2D2218]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Country Select */}
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              aria-label={isAr ? 'تصفية حسب البلد' : 'Filter by country'}
              className="px-2.5 py-1.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs font-bold text-[#2D2218]"
            >
              <option value="all">{isAr ? 'كل البلدان' : 'All Countries'}</option>
              {availableCountries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>

            {/* Device Type Select */}
            <select
              value={deviceTypeFilter}
              onChange={(e) => setDeviceTypeFilter(e.target.value as 'all' | TelemetryDeviceType)}
              aria-label={isAr ? 'تصفية حسب نوع الجهاز' : 'Filter by device type'}
              className="px-2.5 py-1.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs font-bold text-[#2D2218]"
            >
              <option value="all">{isAr ? 'كل الأجهزة' : 'All Devices'}</option>
              <option value="mobile">{isAr ? 'هاتف محمول' : 'Mobile'}</option>
              <option value="tablet">{isAr ? 'جهاز لوحي' : 'Tablet'}</option>
              <option value="desktop">{isAr ? 'حاسوب' : 'Desktop'}</option>
            </select>

            {/* Sort Select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              aria-label={isAr ? 'ترتيب' : 'Sort by'}
              className="px-2.5 py-1.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs font-bold text-[#2D2218]"
            >
              <option value="updatedAt">{isAr ? 'الأحدث نشاطاً' : 'Most Recent'}</option>
              <option value="totalSessionSeconds">
                {isAr ? 'الأطول زمناً' : 'Longest Duration'}
              </option>
              <option value="totalSessions">{isAr ? 'الأكثر جلسات' : 'Most Sessions'}</option>
              <option value="country">{isAr ? 'حسب البلد' : 'By Country'}</option>
            </select>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#84715E] absolute top-1/2 -translate-y-1/2 start-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isAr ? 'بحث...' : 'Search...'}
                className="ps-8 pe-3 py-1.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs text-[#2D2218] w-36 sm:w-44 focus:outline-none focus:border-[#C88A14]"
              />
            </div>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#84715E]">
            {loading
              ? isAr
                ? 'جاري تحميل السجلات...'
                : 'Loading records...'
              : isAr
              ? 'لا توجد أجهزة مطابقة لمعايير التصفية الحالية.'
              : 'No devices match the selected filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#84715E] border-b border-[#EFE9DC]">
                  <th className="py-2 px-2.5 text-start font-bold">
                    {isAr ? 'نوع الجهاز والنظام' : 'Device & OS'}
                  </th>
                  <th className="py-2 px-2.5 text-start font-bold">
                    {isAr ? 'البلد' : 'Country'}
                  </th>
                  <th className="py-2 px-2.5 text-start font-bold">
                    {isAr ? 'حالة التثبيت' : 'Install Status'}
                  </th>
                  <th className="py-2 px-2.5 text-center font-bold">
                    {isAr ? 'الجلسات' : 'Sessions'}
                  </th>
                  <th className="py-2 px-2.5 text-end font-bold">
                    {isAr ? 'إجمالي الزمن' : 'Total Time'}
                  </th>
                  <th className="py-2 px-2.5 text-end font-bold">
                    {isAr ? 'آخر جلسة' : 'Last Session'}
                  </th>
                  <th className="py-2 px-2.5 text-end font-bold">
                    {isAr ? 'آخر نشاط' : 'Last Active'}
                  </th>
                  <th className="py-2 px-2 text-center font-bold">
                    {isAr ? 'إجراء' : 'Action'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4EFE4]">
                {filteredRecords.map((r) => {
                  const Icon =
                    r.deviceType === 'mobile'
                      ? Smartphone
                      : r.deviceType === 'tablet'
                      ? Tablet
                      : Monitor;
                  const lastActiveStr = r.updatedAt?.toDate
                    ? r.updatedAt.toDate().toLocaleString(isAr ? 'ar-SA' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—';

                  return (
                    <tr key={r.deviceId} className="hover:bg-[#FAF6EE]">
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Icon
                            className="w-4 h-4 shrink-0"
                            style={{ color: DEVICE_COLORS[r.deviceType] }}
                          />
                          <div>
                            <div className="font-bold text-[#2D2218]">
                              {getDeviceTypeLabel(r.deviceType, lang)} · {r.osName}
                            </div>
                            <div className="text-[11px] text-[#84715E] font-mono-tabular">
                              {r.browserName} · {r.deviceId.slice(0, 12)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-2.5 whitespace-nowrap font-semibold text-[#2D2218]">
                        <span className="me-1.5">{getCountryFlagEmoji(r.countryCode)}</span>
                        <span>{isAr ? r.countryNameAr : r.countryNameEn}</span>
                      </td>

                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <div className="font-bold">
                          <span
                            className={
                              r.installed ? 'text-[#4A6144]' : 'text-[#84715E]'
                            }
                          >
                            {r.installed
                              ? isAr
                                ? 'مثبت'
                                : 'Installed'
                              : isAr
                              ? 'غير مثبت'
                              : 'Not Installed'}
                          </span>
                          <span className="text-[#84715E] font-normal">
                            {' '}
                            · {getInstallSourceLabel(r.installSource, lang)}
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-2.5 text-center font-mono-tabular font-bold text-[#2D2218]">
                        {r.totalSessions || 1}
                      </td>

                      <td className="py-2.5 px-2.5 text-end font-mono-tabular font-bold text-[#4A6144] whitespace-nowrap">
                        {formatDurationHuman(r.totalSessionSeconds || 0, lang)}
                      </td>

                      <td className="py-2.5 px-2.5 text-end font-mono-tabular text-[#5C4B3B] whitespace-nowrap">
                        {formatDurationHuman(r.lastSessionSeconds || 0, lang)}
                      </td>

                      <td className="py-2.5 px-2.5 text-end font-mono-tabular text-[11px] text-[#5C4B3B] whitespace-nowrap">
                        {lastActiveStr}
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          disabled={deletingId === r.deviceId}
                          onClick={() => handleDeleteRecord(r.deviceId)}
                          title={isAr ? 'حذف السجل' : 'Delete record'}
                          aria-label={isAr ? 'حذف السجل' : 'Delete record'}
                          className="p-1.5 rounded-lg text-[#A84A32] hover:bg-[#A84A32]/10 cursor-pointer disabled:opacity-40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
