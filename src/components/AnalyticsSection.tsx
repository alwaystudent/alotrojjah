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
        className="p-2.5 rounded-xl bg-[#FFFDF9] border border-[#C88A14] shadow-md text-xs space-y-1 font-sans text-right z-50"
        dir="rtl"
      >
        <p className="font-bold text-[#2D2218] border-b border-[#EFE9DC] pb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: entry.color || entry.fill }}
              />
              <span className="text-[#5C4B3B]">{entry.name}:</span>
            </div>
            <span className="font-bold font-mono-tabular text-[#261C14]">{entry.value}</span>
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
      color: '#C88A14',
      bgClass: 'bg-[#C88A14]',
    },
    {
      type: 'new_memorization' as const,
      color: '#4A6144',
      bgClass: 'bg-[#4A6144]',
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
      <div className="p-1 rounded-xl bg-[#EFE9DC]/70 border border-[#DDD2BE] flex items-center gap-1">
        <button
          type="button"
          onClick={() => setActiveSubTab('overview')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'overview'
              ? 'bg-[#FFFDF9] text-[#261C14] shadow-xs'
              : 'text-[#5C4B3B] hover:text-[#261C14]'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-[#C88A14]" />
          <span>{lang === 'ar' ? 'الإحصائيات العامة والرسوم البيانية' : 'General Statistics'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('reports')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'reports'
              ? 'bg-[#FFFDF9] text-[#261C14] shadow-xs'
              : 'text-[#5C4B3B] hover:text-[#261C14]'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-[#4A6144]" />
          <span>{lang === 'ar' ? 'تقارير إتمام الحفظ والاختبارات العشوائية' : 'Memorization Reports & Quizzes'}</span>
          {reports.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono-tabular bg-[#4A6144] text-white">
              {reports.length}
            </span>
          )}
        </button>
      </div>

      {activeSubTab === 'overview' ? (
        <div className="space-y-3.5">
          {/* 4-Column Compact KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="p-3.5 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE]">
          <div className="text-xs font-semibold text-[#84715E]">{dict.kpiCompletionRate}</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono-tabular text-[#261C14]">
              {completionRate}%
            </span>
            <span className="text-[11px] font-mono-tabular text-[#5C4B3B]">
              {completedPlans}/{totalPlans}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-[#EFE9DC] overflow-hidden">
            <div
              className="h-full bg-[#C88A14] transition-all duration-300"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE]">
          <div className="text-xs font-semibold text-[#84715E]">{dict.kpiTotalAyahs}</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono-tabular text-[#261C14]">
              {completedAyahs}
            </span>
            <span className="text-[11px] font-mono-tabular text-[#5C4B3B]">
              / {totalPlannedAyahs} {dict.ayahsUnit}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-[#84715E] flex items-center gap-1">
            <span>{dict.accuracyRateLabel}:</span>
            <span className="font-mono-tabular font-semibold text-[#4A6144]">{accuracyRate}%</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE]">
          <div className="text-xs font-semibold text-[#84715E]">{dict.kpiTotalPages}</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono-tabular text-[#261C14]">
              {completedPages}
            </span>
            <span className="text-[11px] font-mono-tabular text-[#5C4B3B]">
              / {totalPlannedPages} {dict.pagesUnit}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-[#EFE9DC] overflow-hidden">
            <div
              className="h-full bg-[#4A6144] transition-all duration-300"
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

        <div className="p-3.5 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE]">
          <div className="text-xs font-semibold text-[#84715E]">{dict.kpiActiveDays}</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono-tabular text-[#261C14]">
              {activeDaysCount}/7
            </span>
            <span className="text-[11px] text-[#C88A14] font-semibold">
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
                      ? 'bg-[#4A6144]'
                      : hasPlan
                      ? 'bg-[#C88A14]'
                      : 'bg-[#E5DEC9]'
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
      <div className="p-4 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFE9DC] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#4A6144]/15 border border-[#4A6144]/30 flex items-center justify-center text-[#4A6144]">
              <TrendingUp className="w-4 h-4 text-[#4A6144]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#261C14] font-display-islamic">
                {lang === 'ar'
                  ? 'معدل تقدم الحفظ الأسبوعي والمسار التراكمي'
                  : 'Weekly Memorization Progress & Trajectory'}
              </h3>
              <p className="text-[11px] text-[#84715E]">
                {lang === 'ar'
                  ? `متابعة وتيرة الإنجاز الفعلي للآيات المحفوظة (${completedAyahs} آية منجزة من إجمالي ${totalPlannedAyahs})`
                  : `Actual vs target verse memorization pace (${completedAyahs} of ${totalPlannedAyahs})`}
              </p>
            </div>
          </div>

          {/* Mode Switcher: Cumulative vs Daily */}
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#F7F3EB] border border-[#DDD2BE]">
            <button
              type="button"
              onClick={() => setProgressChartMode('cumulative')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                progressChartMode === 'cumulative'
                  ? 'bg-[#4A6144] text-white shadow-xs'
                  : 'text-[#5C4B3B] hover:text-[#261C14]'
              }`}
            >
              {lang === 'ar' ? 'المسار التراكمي' : 'Cumulative'}
            </button>
            <button
              type="button"
              onClick={() => setProgressChartMode('daily')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                progressChartMode === 'daily'
                  ? 'bg-[#C88A14] text-white shadow-xs'
                  : 'text-[#5C4B3B] hover:text-[#261C14]'
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
                  <stop offset="5%" stopColor="#4A6144" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#4A6144" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="progressTargetColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C88A14" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#C88A14" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFE9DC" vertical={false} />
              <XAxis dataKey="short" tick={{ fill: '#5C4B3B', fontSize: 11 }} />
              <YAxis tick={{ fill: '#84715E', fontSize: 10 }} />
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
                    stroke="#4A6144"
                    strokeWidth={2.5}
                    fill="url(#progressDoneColor)"
                    activeDot={{ r: 5, fill: '#4A6144' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="المستهدف الأسبوعي"
                    stroke="#C88A14"
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
                    stroke="#4A6144"
                    strokeWidth={2.5}
                    fill="url(#progressDoneColor)"
                    activeDot={{ r: 5, fill: '#4A6144' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="الآيات المخططة"
                    stroke="#C88A14"
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
        <div className="lg:col-span-7 p-4 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] flex flex-col justify-between space-y-3 shadow-2xs">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFE9DC] pb-2">
              <h3 className="text-sm font-bold text-[#261C14] font-display-islamic">
                {lang === 'ar'
                  ? 'توزيع الحفظ حسب أيام الأسبوع'
                  : 'Daily Memorization Distribution'}
              </h3>
              <span className="text-[11px] text-[#84715E]">
                {lang === 'ar' ? 'مقارنة المخطط والمنجز لكل يوم' : 'Planned vs completed per day'}
              </span>
            </div>

            {/* Recharts BarChart */}
            <div className="w-full h-60 pt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rechartsDailyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFE9DC" vertical={false} />
                  <XAxis dataKey="short" tick={{ fill: '#5C4B3B', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#84715E', fontSize: 10 }} />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: 6, fontSize: 11 }}
                  />
                  <Bar
                    dataKey="الآيات المخططة"
                    fill="#DDD2BE"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="المحفوظ المنجز"
                    fill="#C88A14"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Today Indicator Strip */}
          <div className="pt-2 border-t border-[#EFE9DC] flex items-center justify-between text-[11px] text-[#84715E]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C88A14]" />
              <strong className="text-[#2D2218]">
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
        <div className="lg:col-span-5 p-4 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#EFE9DC] pb-2">
            <h3 className="text-sm font-bold text-[#261C14] font-display-islamic">
              {lang === 'ar' ? 'نسبة الإنجاز وتوزيع الأنواع' : 'Completion Rate & Plan Types'}
            </h3>
            <span className="px-2 py-0.5 rounded-md bg-[#4A6144]/15 text-[#4A6144] font-bold text-xs font-mono-tabular">
              {completionRate}% {lang === 'ar' ? 'مكتمل' : 'Done'}
            </span>
          </div>

          {/* Recharts Pie Chart & Center Gauge */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-36 h-36 shrink-0 mx-auto" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rechartsPieData.length > 0 ? rechartsPieData : [{ name: 'خطة', value: 1, color: '#DDD2BE' }]}
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
                <span className="text-xl font-bold font-mono-tabular text-[#261C14]">
                  {completionRate}%
                </span>
                <span className="text-[10px] text-[#84715E]">
                  {completedPlans}/{totalPlans}
                </span>
              </div>
            </div>

            {/* Legend & Breakdown */}
            <div className="flex-1 w-full space-y-2">
              {typeCategories.map((cat) => (
                <div
                  key={cat.type}
                  className="flex items-center justify-between text-xs border-b border-[#EFE9DC] pb-1.5 last:border-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-xs shrink-0 ${cat.bgClass}`} />
                    <span className="font-semibold text-[#261C14]">{cat.label}</span>
                  </div>
                  <div className="font-mono-tabular text-[#5C4B3B] text-[11px]">
                    <span>
                      {cat.doneCount}/{cat.count}
                    </span>
                    <span className="mx-1 text-[#84715E]">·</span>
                    <span>
                      {cat.ayahs} {dict.ayahsUnit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scope Completion Bars */}
          <div className="pt-2 border-t border-[#DDD2BE] space-y-2">
            <h4 className="text-xs font-bold text-[#5C4B3B]">{dict.chartScopeTitle}</h4>
            {scopeStats.map((sc) => (
              <div key={sc.scope} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-[#261C14]">{sc.label}</span>
                  <span className="font-mono-tabular text-[#5C4B3B]">
                    {sc.done}/{sc.total} ({sc.pct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#EFE9DC] overflow-hidden">
                  <div
                    className="h-full bg-[#2D2218] transition-all duration-300"
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
            <div className="p-3.5 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE]">
              <div className="text-xs font-semibold text-[#84715E]">إجمالي التقارير المعتمدة</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono-tabular text-[#261C14]">
                  {reports.length}
                </span>
                <span className="text-[11px] text-[#5C4B3B]">مقرر تم إنجازه</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FFFDF9] border border-[#4A6144]/30">
              <div className="text-xs font-semibold text-[#4A6144]">🟩 متقن (اختبار أسبوعي)</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono-tabular text-[#4A6144]">
                  {reports.filter((r) => r.evaluation === 'muthabbat').length}
                </span>
                <span className="text-[11px] text-[#5C4B3B]">كل 7 أيام</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FFFDF9] border border-[#C88A14]/30">
              <div className="text-xs font-semibold text-[#9E650C]">🟨 متردد (كل 3 أيام)</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono-tabular text-[#9E650C]">
                  {reports.filter((r) => r.evaluation === 'mutaraddid').length}
                </span>
                <span className="text-[11px] text-[#5C4B3B]">كل 3 أيام</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FFFDF9] border border-[#A84A32]/30">
              <div className="text-xs font-semibold text-[#A84A32]">🟥 متفلت (اليوم الموالي)</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono-tabular text-[#A84A32]">
                  {reports.filter((r) => r.evaluation === 'mutafallit').length}
                </span>
                <span className="text-[11px] text-[#5C4B3B]">مكثف غداً</span>
              </div>
            </div>
          </div>

          {/* Upcoming Scheduled Random Tests Card */}
          <div className="rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] overflow-hidden">
            <div className="px-4 py-2.5 bg-[#FBF5E6] border-b border-[#E8D29F] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#C88A14]" />
                <h3 className="text-xs font-bold text-[#261C14]">
                  {lang === 'ar'
                    ? 'الاختبارات العشوائية المجدولة لتثبيت الحفظ (مع التذكير)'
                    : 'Scheduled Random Retention Tests'}
                </h3>
              </div>
              <span className="text-xs text-[#84715E] font-mono-tabular">
                {quizzes.length} اختبار
              </span>
            </div>

            {quizzes.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#84715E]">
                {lang === 'ar'
                  ? 'لا توجد اختبارات عشوائية مجدولة حالياً. عند إتمام مراحل الحفظ واعتماد التقييم يتم توليد الاختبار وجدولته تلقائياً.'
                  : 'No scheduled random tests. They are automatically scheduled upon completing a memorization plan.'}
              </div>
            ) : (
              <div className="divide-y divide-[#EFE9DC]">
                {quizzes.map((quiz) => {
                  const isDueToday =
                    new Date(quiz.dueDateTimestamp).toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={quiz.id}
                      className={`px-4 py-3 flex flex-wrap items-center justify-between gap-2 transition-colors ${
                        isDueToday ? 'bg-[#FBF5E6]/70' : 'hover:bg-[#F7F3EB]/60'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            quiz.evaluation === 'muthabbat'
                              ? 'bg-[#4A6144]'
                              : quiz.evaluation === 'mutaraddid'
                              ? 'bg-[#C88A14]'
                              : 'bg-[#A84A32]'
                          }`}
                        />
                        <span className="font-bold text-[#261C14]">
                          سورة {quiz.surahNameAr} ({quiz.ayahFrom} - {quiz.ayahTo})
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#EFE9DC] text-[#5C4B3B] text-[10.5px] font-semibold">
                          {quiz.frequencyLabelAr}
                        </span>
                        <span className="text-[#84715E] text-[11px] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#C88A14]" />
                          <span>الموعد: {quiz.scheduledDateFormatted}</span>
                          <span className="mx-1">·</span>
                          <Clock className="w-3 h-3 text-[#C88A14]" />
                          <span>الساعة {quiz.reminderTime}</span>
                        </span>
                        {isDueToday && (
                          <span className="text-[10px] font-bold text-[#4A6144] px-1.5 py-0.5 rounded-sm bg-[#4A6144]/15">
                            حان اليوم!
                          </span>
                        )}
                        {quiz.score !== undefined && (
                          <span className="text-[10px] font-bold text-[#C88A14] font-mono-tabular">
                            النتيجة السابقة: {quiz.score}%
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onStartQuiz && onStartQuiz(quiz)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#C88A14] hover:bg-[#B3780C] text-white text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
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
          <div className="rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] overflow-hidden">
            <div className="px-4 py-2.5 bg-[#F7F3EB] border-b border-[#DDD2BE] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#4A6144]" />
                <h3 className="text-xs font-bold text-[#261C14]">
                  {lang === 'ar'
                    ? 'سجل تقارير إتمام الحفظ الثلاثية المعتمدة'
                    : 'Certified Memorization Reports History'}
                </h3>
              </div>
              <span className="text-xs text-[#84715E] font-mono-tabular">
                {reports.length} تقرير
              </span>
            </div>

            {reports.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#84715E] space-y-2">
                <Award className="w-8 h-8 text-[#DDD2BE] mx-auto" />
                <p>
                  {lang === 'ar'
                    ? 'لم يتم تسجيل أي تقارير حفظ بعد. ستظهر التقارير هنا تلقائياً عند إتمام مراحل الحفظ الثلاث واعتماد التقييم.'
                    : 'No reports recorded yet. They will appear here once you complete the 3 memorization stages.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EFE9DC]">
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
                              ? 'bg-[#4A6144] text-white'
                              : report.evaluation === 'mutaraddid'
                              ? 'bg-[#C88A14] text-white'
                              : 'bg-[#A84A32] text-white'
                          }`}
                        >
                          {report.evaluation === 'muthabbat'
                            ? '🟩 مُتقَن'
                            : report.evaluation === 'mutaraddid'
                            ? '🟨 مُتردِّد'
                            : '🟥 مُتفلِّت'}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-[#2D2218] font-display-islamic">
                          سورة {report.surahNameAr} (الآيات {report.ayahFrom} - {report.ayahTo})
                        </h4>
                        <span className="text-[#84715E] text-[11px]">
                          ({report.ayahCount} آية · {report.pagesCount} صفحة)
                        </span>
                      </div>

                      <div className="text-[11px] text-[#5C4B3B] flex flex-wrap items-center gap-2">
                        <span>القارئ: {report.reciterName}</span>
                        <span>·</span>
                        <span>تاريخ الإتمام: {report.formattedDate}</span>
                        <span>·</span>
                        <span className="text-[#C88A14] font-semibold">
                          الاختبار المجدول: {report.randomQuizSchedule.frequencyLabelAr}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onViewReport && onViewReport(report)}
                        className="px-3 py-1.5 rounded-xl border border-[#DDD2BE] bg-[#FFFDF9] hover:bg-[#EFE9DC] text-xs font-bold text-[#261C14] transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#C88A14]" />
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
