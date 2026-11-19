import React, { useState } from 'react';
import {
  Language,
  QuranPlanItem,
  MemorizationReport,
  QuranRandomQuizItem,
  WEEK_DAYS,
  getTodayDayId,
  getPlanTypeLabel,
  getScopeLabel,
} from '@/src/data/quranData';
import { t } from '@/src/data/translations';
import {
  Award,
  Sparkles,
  BookOpen,
  Calendar,
  Clock,
  Play,
  Bell,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Check,
  AlertCircle,
  BarChart3,
  ExternalLink,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#96701E] shadow-md text-xs space-y-1 font-sans text-right z-50"
        dir="rtl"
      >
        <p className="font-bold text-[#0E5C3E] border-b border-[#EAF0E7] pb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: entry.color || entry.fill }}
              />
              <span className="text-[#4B5650]">{entry.name}:</span>
            </div>
            <span className="font-bold font-mono-tabular text-[#161E19]">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

interface AnalyticsSectionProps {
  plans: QuranPlanItem[];
  reports?: MemorizationReport[];
  quizzes?: QuranRandomQuizItem[];
  lang: Language;
  onStartQuiz?: (quiz: QuranRandomQuizItem) => void;
  onViewReport?: (report: MemorizationReport) => void;
}

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
  plans,
  reports = [],
  quizzes = [],
  lang,
  onStartQuiz,
  onViewReport,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'reports'>('overview');
  const [progressChartMode, setProgressChartMode] = useState<'cumulative' | 'daily'>('cumulative');
  const dict = t(lang);
  const todayId = getTodayDayId();

  const totalPlans = plans.length;
  const completedPlans = plans.filter((p) => p.status === 'completed').length;
  const completionRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

  const totalPlannedAyahs = plans.reduce((acc, p) => acc + p.estimatedAyahs, 0);
  const completedAyahs = plans
    .filter((p) => p.status === 'completed')
    .reduce((acc, p) => acc + p.estimatedAyahs, 0);

  const totalPlannedPages = Math.round(plans.reduce((acc, p) => acc + p.estimatedPages, 0) * 10) / 10;
  const completedPages =
    Math.round(
      plans
        .filter((p) => p.status === 'completed')
        .reduce((acc, p) => acc + p.estimatedPages, 0) * 10
    ) / 10;

  const activeDaysCount = new Set(plans.map((p) => p.day)).size;

  const totalMistakes = plans
    .filter((p) => p.status === 'completed')
    .reduce((acc, p) => acc + (p.mistakesCount || 0), 0);
  const accuracyRate =
    completedAyahs > 0
      ? Math.max(85, Math.min(100, Math.round(((completedAyahs - totalMistakes) / completedAyahs) * 1000) / 10))
      : 100;

  // Daily breakdown for bar chart
  const dailyData = WEEK_DAYS.map((day) => {
    const dayPlans = plans.filter((p) => p.day === day.id);
    const plannedAyahs = dayPlans.reduce((s, p) => s + p.estimatedAyahs, 0);
    const doneAyahs = dayPlans
      .filter((p) => p.status === 'completed')
      .reduce((s, p) => s + p.estimatedAyahs, 0);
    const doneCount = dayPlans.filter((p) => p.status === 'completed').length;
    return {
      day,
      totalCount: dayPlans.length,
      doneCount,
      plannedAyahs,
      doneAyahs,
      isToday: day.id === todayId,
    };
  });

  const maxDailyAyahs = Math.max(100, ...dailyData.map((d) => d.plannedAyahs));

  // Distribution by Plan Type
  const typeCategories = [
    {
      type: 'sard' as const,
      color: '#96701E',
      bgClass: 'bg-[#96701E]',
    },
    {
      type: 'new_memorization' as const,
      color: '#0E6340',
      bgClass: 'bg-[#0E6340]',
    },
    {
      type: 'review' as const,
      color: '#9C4A32',
      bgClass: 'bg-[#9C4A32]',
    },
  ].map((cat) => {
    const matching = plans.filter((p) => p.planType === cat.type);
    const done = matching.filter((p) => p.status === 'completed');
    const ayahs = matching.reduce((s, p) => s + p.estimatedAyahs, 0);
    const pct = totalPlans > 0 ? Math.round((matching.length / totalPlans) * 100) : 0;
    return {
      ...cat,
      label: getPlanTypeLabel(cat.type, lang),
      count: matching.length,
      doneCount: done.length,
      ayahs,
      pct,
    };
  });

  // Scope distribution
  const scopeStats = (['surah', 'juz', 'ayah'] as const).map((sc) => {
    const matching = plans.filter((p) => p.scope === sc);
    const done = matching.filter((p) => p.status === 'completed');
    const pct = matching.length > 0 ? Math.round((done.length / matching.length) * 100) : 0;
    return {
      scope: sc,
      label: getScopeLabel(sc, lang),
      total: matching.length,
      done: done.length,
      pct,
    };
  });

  // Recharts Data 1: Daily distribution across week days (توزيع الحفظ حسب أيام الأسبوع)
  const rechartsDailyData = WEEK_DAYS.map((day) => {
    const dayPlans = plans.filter((p) => p.day === day.id);
    const plannedAyahs = dayPlans.reduce((s, p) => s + p.estimatedAyahs, 0);
    const doneAyahs = dayPlans
      .filter((p) => p.status === 'completed')
      .reduce((s, p) => s + p.estimatedAyahs, 0);
    const doneCount = dayPlans.filter((p) => p.status === 'completed').length;
    const totalCount = dayPlans.length;
    const dayLabel = lang === 'ar' ? day.nameAr : day.shortEn;
    const rate = plannedAyahs > 0 ? Math.round((doneAyahs / plannedAyahs) * 100) : 0;
    return {
      name: dayLabel,
      short: lang === 'ar' ? day.shortAr : day.shortEn,
      'الآيات المخططة': plannedAyahs,
      'المحفوظ المنجز': doneAyahs,
      plannedAyahs,
      doneAyahs,
      doneCount,
      totalCount,
      rate,
      isToday: day.id === todayId,
    };
  });

  // Recharts Data 2: Weekly progress rate & cumulative trajectory (معدل تقدم الحفظ الأسبوعي)
  let accumPlanned = 0;
  let accumDone = 0;
  const rechartsWeeklyProgressData = WEEK_DAYS.map((day) => {
    const dayPlans = plans.filter((p) => p.day === day.id);
    const planned = dayPlans.reduce((s, p) => s + p.estimatedAyahs, 0);
    const done = dayPlans
      .filter((p) => p.status === 'completed')
      .reduce((s, p) => s + p.estimatedAyahs, 0);
    accumPlanned += planned;
    accumDone += done;
    return {
      day: lang === 'ar' ? day.nameAr : day.shortEn,
      short: lang === 'ar' ? day.shortAr : day.shortEn,
      'الآيات المنجزة': done,
      'الآيات المخططة': planned,
      'التراكمي المنجز': accumDone,
      'المستهدف الأسبوعي': accumPlanned,
      rate: accumPlanned > 0 ? Math.min(100, Math.round((accumDone / accumPlanned) * 100)) : 0,
      isToday: day.id === todayId,
    };
  });

  // Recharts Data 3: Distribution by Plan Type (نسبة الإنجاز وتوزيع الأنواع)
  const rechartsPieData = typeCategories
    .filter((cat) => cat.count > 0 || cat.ayahs > 0)
    .map((cat) => ({
      name: cat.label,
      value: cat.ayahs > 0 ? cat.ayahs : cat.count,
      count: cat.count,
      doneCount: cat.doneCount,
      color: cat.color,
    }));

  return (
    <section className="space-y-3.5">
      {/* Sub-tab Navigation (Overview vs Memorization Reports & Quizzes) */}
      <div className="p-1 rounded-xl bg-[#EAF0E7]/70 border border-[#C5CEBF] flex items-center gap-1">
        <button
          type="button"
          onClick={() => setActiveSubTab('overview')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'overview'
              ? 'bg-[#FFFFFF] text-[#161E19] shadow-xs'
              : 'text-[#4B5650] hover:text-[#161E19]'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-[#96701E]" />
          <span>{lang === 'ar' ? 'الإحصائيات العامة والرسوم البيانية' : 'General Statistics'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('reports')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'reports'
              ? 'bg-[#FFFFFF] text-[#161E19] shadow-xs'
              : 'text-[#4B5650] hover:text-[#161E19]'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-[#0E6340]" />
          <span>{lang === 'ar' ? 'تقارير إتمام الحفظ والاختبارات العشوائية' : 'Memorization Reports & Quizzes'}</span>
          {reports.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono-tabular bg-[#0E6340] text-white">
              {reports.length}
            </span>
          )}
        </button>
      </div>

      {activeSubTab === 'overview' ? (
        <div className="space-y-3.5">
          {/* 4-Column Compact KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#C5CEBF]">
          <div className="text-xs font-semibold text-[#6A766E]">{dict.kpiCompletionRate}</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono-tabular text-[#161E19]">
              {completionRate}%
            </span>
            <span className="text-[11px] font-mono-tabular text-[#4B5650]">
              {completedPlans}/{totalPlans}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-[#EAF0E7] overflow-hidden">
            <div
              className="h-full bg-[#96701E] transition-all duration-300"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#C5CEBF]">
          <div className="text-xs font-semibold text-[#6A766E]">{dict.kpiTotalAyahs}</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono-tabular text-[#161E19]">
              {completedAyahs}
            </span>
            <span className="text-[11px] font-mono-tabular text-[#4B5650]">
              / {totalPlannedAyahs} {dict.ayahsUnit}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-[#6A766E] flex items-center gap-1">
            <span>{dict.accuracyRateLabel}:</span>
            <span className="font-mono-tabular font-semibold text-[#0E6340]">{accuracyRate}%</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#C5CEBF]">
          <div className="text-xs font-semibold text-[#6A766E]">{dict.kpiTotalPages}</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono-tabular text-[#161E19]">
              {completedPages}
            </span>
            <span className="text-[11px] font-mono-tabular text-[#4B5650]">
              / {totalPlannedPages} {dict.pagesUnit}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-[#EAF0E7] overflow-hidden">
            <div
              className="h-full bg-[#0E6340] transition-all duration-300"
              style={{
                width: `${
                  totalPlannedPages > 0
                    ? Math.min(100, Math.round((completedPages / totalPlannedPages) * 100))
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#C5CEBF]">
          <div className="text-xs font-semibold text-[#6A766E]">{dict.kpiActiveDays}</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono-tabular text-[#161E19]">
              {activeDaysCount}/7
            </span>
            <span className="text-[11px] text-[#96701E] font-semibold">
              {Math.round((activeDaysCount / 7) * 100)}%
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1">
            {WEEK_DAYS.map((d) => {
              const hasPlan = plans.some((p) => p.day === d.id);
              const allDone =
                hasPlan &&
                plans.filter((p) => p.day === d.id).every((p) => p.status === 'completed');
              return (
                <div
                  key={d.id}
                  title={lang === 'ar' ? d.nameAr : d.nameEn}
                  className={`h-1.5 flex-1 rounded-xs ${
                    allDone
                      ? 'bg-[#0E6340]'
                      : hasPlan
                      ? 'bg-[#96701E]'
                      : 'bg-[#D3DDD0]'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RECHARTS SECTION 1: WEEKLY MEMORIZATION PROGRESS RATE & TRAJECTORY        */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#C5CEBF] space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAF0E7] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0E6340]/15 border border-[#0E6340]/30 flex items-center justify-center text-[#0E6340]">
              <TrendingUp className="w-4 h-4 text-[#0E6340]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#161E19] font-display-islamic">
                {lang === 'ar'
                  ? 'معدل تقدم الحفظ الأسبوعي والمسار التراكمي'
                  : 'Weekly Memorization Progress & Trajectory'}
              </h3>
              <p className="text-[11px] text-[#6A766E]">
                {lang === 'ar'
                  ? `متابعة وتيرة الإنجاز الفعلي للآيات المحفوظة (${completedAyahs} آية منجزة من إجمالي ${totalPlannedAyahs})`
                  : `Actual vs target verse memorization pace (${completedAyahs} of ${totalPlannedAyahs})`}
              </p>
            </div>
          </div>

          {/* Mode Switcher: Cumulative vs Daily */}
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#F4F5EE] border border-[#C5CEBF]">
            <button
              type="button"
              onClick={() => setProgressChartMode('cumulative')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                progressChartMode === 'cumulative'
                  ? 'bg-[#0E6340] text-white shadow-xs'
                  : 'text-[#4B5650] hover:text-[#161E19]'
              }`}
            >
              {lang === 'ar' ? 'المسار التراكمي' : 'Cumulative'}
            </button>
            <button
              type="button"
              onClick={() => setProgressChartMode('daily')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                progressChartMode === 'daily'
                  ? 'bg-[#96701E] text-white shadow-xs'
                  : 'text-[#4B5650] hover:text-[#161E19]'
              }`}
            >
              {lang === 'ar' ? 'الوتيرة اليومية' : 'Daily'}
            </button>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="w-full h-56 pt-2" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rechartsWeeklyProgressData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="progressDoneColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0E6340" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#0E6340" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="progressTargetColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#96701E" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#96701E" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAF0E7" vertical={false} />
              <XAxis dataKey="short" tick={{ fill: '#4B5650', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6A766E', fontSize: 10 }} />
              <Tooltip content={<CustomChartTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 6, fontSize: 11 }}
              />
              {progressChartMode === 'cumulative' ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="التراكمي المنجز"
                    stroke="#0E6340"
                    strokeWidth={2.5}
                    fill="url(#progressDoneColor)"
                    activeDot={{ r: 5, fill: '#0E6340' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="المستهدف الأسبوعي"
                    stroke="#96701E"
                    strokeWidth={1.8}
                    strokeDasharray="4 4"
                    fill="url(#progressTargetColor)"
                  />
                </>
              ) : (
                <>
                  <Area
                    type="monotone"
                    dataKey="الآيات المنجزة"
                    stroke="#0E6340"
                    strokeWidth={2.5}
                    fill="url(#progressDoneColor)"
                    activeDot={{ r: 5, fill: '#0E6340' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="الآيات المخططة"
                    stroke="#96701E"
                    strokeWidth={1.5}
                    fill="url(#progressTargetColor)"
                  />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RECHARTS SECTION 2: BAR CHART (DAILY DISTRIBUTION) & PIE (COMPLETION RATE)*/}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Daily Distribution Bar Chart (7 Columns) */}
        <div className="lg:col-span-7 p-4 rounded-xl bg-[#FFFFFF] border border-[#C5CEBF] flex flex-col justify-between space-y-3 shadow-2xs">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAF0E7] pb-2">
              <h3 className="text-sm font-bold text-[#161E19] font-display-islamic">
                {lang === 'ar'
                  ? 'توزيع الحفظ حسب أيام الأسبوع'
                  : 'Daily Memorization Distribution'}
              </h3>
              <span className="text-[11px] text-[#6A766E]">
                {lang === 'ar' ? 'مقارنة المخطط والمنجز لكل يوم' : 'Planned vs completed per day'}
              </span>
            </div>

            {/* Recharts BarChart */}
            <div className="w-full h-60 pt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rechartsDailyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EAF0E7" vertical={false} />
                  <XAxis dataKey="short" tick={{ fill: '#4B5650', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6A766E', fontSize: 10 }} />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: 6, fontSize: 11 }}
                  />
                  <Bar
                    dataKey="الآيات المخططة"
                    fill="#C5CEBF"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="المحفوظ المنجز"
                    fill="#96701E"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Today Indicator Strip */}
          <div className="pt-2 border-t border-[#EAF0E7] flex items-center justify-between text-[11px] text-[#6A766E]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#96701E]" />
              <strong className="text-[#0E5C3E]">
                {WEEK_DAYS.find((d) => d.id === todayId)?.nameAr || 'اليوم'}:
              </strong>
              <span>
                {rechartsDailyData.find((d) => d.isToday)?.doneAyahs || 0} من{' '}
                {rechartsDailyData.find((d) => d.isToday)?.plannedAyahs || 0} آية
              </span>
            </span>
            <span className="font-mono-tabular">
              {activeDaysCount}/7 {lang === 'ar' ? 'أيام مفعّلة' : 'active days'}
            </span>
          </div>
        </div>

        {/* Completion Rate & Type Distribution Pie Chart (5 Columns) */}
        <div className="lg:col-span-5 p-4 rounded-xl bg-[#FFFFFF] border border-[#C5CEBF] space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#EAF0E7] pb-2">
            <h3 className="text-sm font-bold text-[#161E19] font-display-islamic">
              {lang === 'ar' ? 'نسبة الإنجاز وتوزيع الأنواع' : 'Completion Rate & Plan Types'}
            </h3>
            <span className="px-2 py-0.5 rounded-md bg-[#0E6340]/15 text-[#0E6340] font-bold text-xs font-mono-tabular">
              {completionRate}% {lang === 'ar' ? 'مكتمل' : 'Done'}
            </span>
          </div>

          {/* Recharts Pie Chart & Center Gauge */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-36 h-36 shrink-0 mx-auto" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rechartsPieData.length > 0 ? rechartsPieData : [{ name: 'خطة', value: 1, color: '#C5CEBF' }]}
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {rechartsPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Metrics */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-xl font-bold font-mono-tabular text-[#161E19]">
                  {completionRate}%
                </span>
                <span className="text-[10px] text-[#6A766E]">
                  {completedPlans}/{totalPlans}
                </span>
              </div>
            </div>

            {/* Legend & Breakdown */}
            <div className="flex-1 w-full space-y-2">
              {typeCategories.map((cat) => (
                <div
                  key={cat.type}
                  className="flex items-center justify-between text-xs border-b border-[#EAF0E7] pb-1.5 last:border-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-xs shrink-0 ${cat.bgClass}`} />
                    <span className="font-semibold text-[#161E19]">{cat.label}</span>
                  </div>
                  <div className="font-mono-tabular text-[#4B5650] text-[11px]">
                    <span>
                      {cat.doneCount}/{cat.count}
                    </span>
                    <span className="mx-1 text-[#6A766E]">·</span>
                    <span>
                      {cat.ayahs} {dict.ayahsUnit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scope Completion Bars */}
          <div className="pt-2 border-t border-[#C5CEBF] space-y-2">
            <h4 className="text-xs font-bold text-[#4B5650]">{dict.chartScopeTitle}</h4>
            {scopeStats.map((sc) => (
              <div key={sc.scope} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-[#161E19]">{sc.label}</span>
                  <span className="font-mono-tabular text-[#4B5650]">
                    {sc.done}/{sc.total} ({sc.pct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#EAF0E7] overflow-hidden">
                  <div
                    className="h-full bg-[#0E5C3E] transition-all duration-300"
                    style={{ width: `${sc.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
      ) : (
        /* ========================================================================= */
        /* MEMORIZATION REPORTS & SCHEDULED RANDOM QUIZZES VIEW                      */
        /* ========================================================================= */
        <div className="space-y-3.5">
          {/* 4 KPI Cards for Memorization & Quizzes */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#C5CEBF]">
              <div className="text-xs font-semibold text-[#6A766E]">إجمالي التقارير المعتمدة</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono-tabular text-[#161E19]">
                  {reports.length}
                </span>
                <span className="text-[11px] text-[#4B5650]">مقرر تم إنجازه</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#0E6340]/30">
              <div className="text-xs font-semibold text-[#0E6340]">🟩 متقن (اختبار أسبوعي)</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono-tabular text-[#0E6340]">
                  {reports.filter((r) => r.evaluation === 'muthabbat').length}
                </span>
                <span className="text-[11px] text-[#4B5650]">كل 7 أيام</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#96701E]/30">
              <div className="text-xs font-semibold text-[#8A6518]">🟨 متردد (كل 3 أيام)</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono-tabular text-[#8A6518]">
                  {reports.filter((r) => r.evaluation === 'mutaraddid').length}
                </span>
                <span className="text-[11px] text-[#4B5650]">كل 3 أيام</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#A84A32]/30">
              <div className="text-xs font-semibold text-[#A84A32]">🟥 متفلت (اليوم الموالي)</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono-tabular text-[#A84A32]">
                  {reports.filter((r) => r.evaluation === 'mutafallit').length}
                </span>
                <span className="text-[11px] text-[#4B5650]">مكثف غداً</span>
              </div>
            </div>
          </div>

          {/* Upcoming Scheduled Random Tests Card */}
          <div className="rounded-xl bg-[#FFFFFF] border border-[#C5CEBF] overflow-hidden">
            <div className="px-4 py-2.5 bg-[#FBF5E6] border-b border-[#E8D29F] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#96701E]" />
                <h3 className="text-xs font-bold text-[#161E19]">
                  {lang === 'ar'
                    ? 'الاختبارات العشوائية المجدولة لتثبيت الحفظ (مع التذكير)'
                    : 'Scheduled Random Retention Tests'}
                </h3>
              </div>
              <span className="text-xs text-[#6A766E] font-mono-tabular">
                {quizzes.length} اختبار
              </span>
            </div>

            {quizzes.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#6A766E]">
                {lang === 'ar'
                  ? 'لا توجد اختبارات عشوائية مجدولة حالياً. عند إتمام مراحل الحفظ واعتماد التقييم يتم توليد الاختبار وجدولته تلقائياً.'
                  : 'No scheduled random tests. They are automatically scheduled upon completing a memorization plan.'}
              </div>
            ) : (
              <div className="divide-y divide-[#EAF0E7]">
                {quizzes.map((quiz) => {
                  const isDueToday =
                    new Date(quiz.dueDateTimestamp).toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={quiz.id}
                      className={`px-4 py-3 flex flex-wrap items-center justify-between gap-2 transition-colors ${
                        isDueToday ? 'bg-[#FBF5E6]/70' : 'hover:bg-[#F4F5EE]/60'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            quiz.evaluation === 'muthabbat'
                              ? 'bg-[#0E6340]'
                              : quiz.evaluation === 'mutaraddid'
                              ? 'bg-[#96701E]'
                              : 'bg-[#A84A32]'
                          }`}
                        />
                        <span className="font-bold text-[#161E19]">
                          سورة {quiz.surahNameAr} ({quiz.ayahFrom} - {quiz.ayahTo})
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#EAF0E7] text-[#4B5650] text-[10.5px] font-semibold">
                          {quiz.frequencyLabelAr}
                        </span>
                        <span className="text-[#6A766E] text-[11px] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#96701E]" />
                          <span>الموعد: {quiz.scheduledDateFormatted}</span>
                          <span className="mx-1">·</span>
                          <Clock className="w-3 h-3 text-[#96701E]" />
                          <span>الساعة {quiz.reminderTime}</span>
                        </span>
                        {isDueToday && (
                          <span className="text-[10px] font-bold text-[#0E6340] px-1.5 py-0.5 rounded-sm bg-[#0E6340]/15">
                            حان اليوم!
                          </span>
                        )}
                        {quiz.score !== undefined && (
                          <span className="text-[10px] font-bold text-[#96701E] font-mono-tabular">
                            النتيجة السابقة: {quiz.score}%
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onStartQuiz && onStartQuiz(quiz)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#96701E] hover:bg-[#B3780C] text-white text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>{lang === 'ar' ? 'بدء الاختبار الآن' : 'Start Quiz'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Certified Memorization Reports List */}
          <div className="rounded-xl bg-[#FFFFFF] border border-[#C5CEBF] overflow-hidden">
            <div className="px-4 py-2.5 bg-[#F4F5EE] border-b border-[#C5CEBF] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0E6340]" />
                <h3 className="text-xs font-bold text-[#161E19]">
                  {lang === 'ar'
                    ? 'سجل تقارير إتمام الحفظ الثلاثية المعتمدة'
                    : 'Certified Memorization Reports History'}
                </h3>
              </div>
              <span className="text-xs text-[#6A766E] font-mono-tabular">
                {reports.length} تقرير
              </span>
            </div>

            {reports.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6A766E] space-y-2">
                <Award className="w-8 h-8 text-[#C5CEBF] mx-auto" />
                <p>
                  {lang === 'ar'
                    ? 'لم يتم تسجيل أي تقارير حفظ بعد. ستظهر التقارير هنا تلقائياً عند إتمام مراحل الحفظ الثلاث واعتماد التقييم.'
                    : 'No reports recorded yet. They will appear here once you complete the 3 memorization stages.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EAF0E7]">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 hover:bg-[#FBF5E6]/40 transition-colors flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                            report.evaluation === 'muthabbat'
                              ? 'bg-[#0E6340] text-white'
                              : report.evaluation === 'mutaraddid'
                              ? 'bg-[#96701E] text-white'
                              : 'bg-[#A84A32] text-white'
                          }`}
                        >
                          {report.evaluation === 'muthabbat'
                            ? '🟩 مُتقَن'
                            : report.evaluation === 'mutaraddid'
                            ? '🟨 مُتردِّد'
                            : '🟥 مُتفلِّت'}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-[#0E5C3E] font-display-islamic">
                          سورة {report.surahNameAr} (الآيات {report.ayahFrom} - {report.ayahTo})
                        </h4>
                        <span className="text-[#6A766E] text-[11px]">
                          ({report.ayahCount} آية · {report.pagesCount} صفحة)
                        </span>
                      </div>

                      <div className="text-[11px] text-[#4B5650] flex flex-wrap items-center gap-2">
                        <span>القارئ: {report.reciterName}</span>
                        <span>·</span>
                        <span>تاريخ الإتمام: {report.formattedDate}</span>
                        <span>·</span>
                        <span className="text-[#96701E] font-semibold">
                          الاختبار المجدول: {report.randomQuizSchedule.frequencyLabelAr}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onViewReport && onViewReport(report)}
                        className="px-3 py-1.5 rounded-xl border border-[#C5CEBF] bg-[#FFFFFF] hover:bg-[#EAF0E7] text-xs font-bold text-[#161E19] transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#96701E]" />
                        <span>عرض التقرير</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
