import React from 'react';
import {
  Language,
  QuranPlanItem,
  WEEK_DAYS,
  getTodayDayId,
  getPlanTypeLabel,
  getScopeLabel,
} from '../data/quranData';
import { t } from '../data/translations';

interface AnalyticsSectionProps {
  plans: QuranPlanItem[];
  lang: Language;
}

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({ plans, lang }) => {
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
      color: '#C88A14', // Mustard Gold
      bgClass: 'bg-[#C88A14]',
    },
    {
      type: 'new_memorization' as const,
      color: '#4A6144', // Olive Green
      bgClass: 'bg-[#4A6144]',
    },
    {
      type: 'review' as const,
      color: '#9C4A32', // Warm Terracotta
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

  // Donut SVG math
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  return (
    <section className="space-y-6">
      <div className="border-b border-[#DDD2BE] pb-4">
        <h2 className="text-2xl font-bold font-display-islamic text-[#261C14]">
          {dict.analyticsHeading}
        </h2>
        <p className="text-sm text-[#5C4B3B] mt-1">{dict.analyticsSub}</p>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE]">
          <div className="text-xs font-medium text-[#84715E]">{dict.kpiCompletionRate}</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono-tabular text-[#261C14]">
              {completionRate}%
            </span>
            <span className="text-xs font-mono-tabular text-[#5C4B3B]">
              {completedPlans} / {totalPlans} { dict.completedLabel }
            </span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-[#EFE9DC] overflow-hidden">
            <div
              className="h-full bg-[#C88A14] transition-all duration-300"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE]">
          <div className="text-xs font-medium text-[#84715E]">{dict.kpiTotalAyahs}</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono-tabular text-[#261C14]">
              {completedAyahs}
            </span>
            <span className="text-xs font-mono-tabular text-[#5C4B3B]">
              / {totalPlannedAyahs} {dict.ayahsUnit}
            </span>
          </div>
          <div className="mt-3 text-xs text-[#84715E] flex items-center gap-1.5">
            <span>{dict.accuracyRateLabel}:</span>
            <span className="font-mono-tabular font-semibold text-[#4A6144]">{accuracyRate}%</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE]">
          <div className="text-xs font-medium text-[#84715E]">{dict.kpiTotalPages}</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono-tabular text-[#261C14]">
              {completedPages}
            </span>
            <span className="text-xs font-mono-tabular text-[#5C4B3B]">
              / {totalPlannedPages} {dict.pagesUnit}
            </span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-[#EFE9DC] overflow-hidden">
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

        <div className="p-5 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE]">
          <div className="text-xs font-medium text-[#84715E]">{dict.kpiActiveDays}</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono-tabular text-[#261C14]">
              {activeDaysCount} / 7
            </span>
            <span className="text-xs text-[#C88A14] font-semibold">
              {Math.round((activeDaysCount / 7) * 100)}%
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1">
            {WEEK_DAYS.map((d) => {
              const hasPlan = plans.some((p) => p.day === d.id);
              const allDone =
                hasPlan &&
                plans.filter((p) => p.day === d.id).every((p) => p.status === 'completed');
              return (
                <div
                  key={d.id}
                  title={lang === 'ar' ? d.nameAr : d.nameEn}
                  className={`h-2 flex-1 rounded-xs ${
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

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Bar Chart (7 Columns) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#261C14]">{dict.chartDailyTitle}</h3>
                <p className="text-xs text-[#84715E] mt-0.5">{dict.chartDailySub}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#5C4B3B]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#E5DEC9] inline-block" />
                  <span>{dict.plannedLabel}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#C88A14] inline-block" />
                  <span>{dict.completedLabel}</span>
                </span>
              </div>
            </div>

            {/* Bar Chart Area */}
            <div className="mt-8 grid grid-cols-7 gap-3 items-end h-52 pt-6 border-b border-[#DDD2BE] pb-3">
              {dailyData.map((d) => {
                const plannedHeightPct = Math.max(
                  6,
                  Math.round((d.plannedAyahs / maxDailyAyahs) * 100)
                );
                const doneHeightPct =
                  d.plannedAyahs > 0
                    ? Math.round((d.doneAyahs / maxDailyAyahs) * 100)
                    : 0;

                return (
                  <div key={d.day.id} className="flex flex-col items-center h-full justify-end group">
                    <div className="text-[11px] font-mono-tabular text-[#5C4B3B] mb-1.5">
                      {d.doneAyahs}/{d.plannedAyahs}
                    </div>
                    <div className="relative w-full max-w-[42px] h-36 bg-[#F7F3EB] rounded-t-lg overflow-hidden flex items-end border border-[#E5DEC9]">
                      {/* Planned bar */}
                      <div
                        className="w-full bg-[#E5DEC9] transition-all duration-300 relative"
                        style={{ height: `${plannedHeightPct}%` }}
                      >
                        {/* Completed fill inside planned */}
                        <div
                          className="w-full bg-[#C88A14] absolute bottom-0 left-0 right-0 transition-all duration-300"
                          style={{
                            height:
                              d.plannedAyahs > 0
                                ? `${Math.min(100, Math.round((d.doneAyahs / d.plannedAyahs) * 100))}%`
                                : '0%',
                          }}
                        />
                      </div>
                      {doneHeightPct > 0 && <span className="sr-only">{doneHeightPct}%</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-Axis Labels */}
            <div className="grid grid-cols-7 gap-3 pt-2.5 text-center">
              {dailyData.map((d) => (
                <div key={d.day.id}>
                  <div
                    className={`text-xs font-semibold ${
                      d.isToday ? 'text-[#C88A14]' : 'text-[#261C14]'
                    }`}
                  >
                    {lang === 'ar' ? d.day.nameAr : d.day.shortEn}
                  </div>
                  <div className="text-[11px] font-mono-tabular text-[#84715E] mt-0.5">
                    {d.doneCount}/{d.totalCount}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Distribution Donut & Scope Mastery (5 Columns) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] space-y-6">
          <div>
            <h3 className="text-base font-bold text-[#261C14]">{dict.chartDistributionTitle}</h3>
            <p className="text-xs text-[#84715E] mt-0.5">{dict.chartDistributionSub}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* SVG Donut Chart */}
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke="#EFE9DC"
                  strokeWidth="16"
                />
                {typeCategories.map((cat) => {
                  const strokeDasharray = `${(cat.pct / 100) * circumference} ${circumference}`;
                  const strokeDashoffset = -((cumulativePercent / 100) * circumference);
                  cumulativePercent += cat.pct;
                  return (
                    <circle
                      key={cat.type}
                      cx="70"
                      cy="70"
                      r={radius}
                      fill="transparent"
                      stroke={cat.color}
                      strokeWidth="16"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="butt"
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold font-mono-tabular text-[#261C14]">
                  {totalPlans}
                </span>
                <span className="text-[11px] text-[#84715E]">
                  {lang === 'ar' ? 'إجمالي الخطط' : 'Total Plans'}
                </span>
              </div>
            </div>

            {/* Legend & Counts */}
            <div className="flex-1 w-full space-y-3">
              {typeCategories.map((cat) => (
                <div key={cat.type} className="flex items-center justify-between text-xs border-b border-[#EFE9DC] pb-2 last:border-none">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-xs shrink-0 ${cat.bgClass}`} />
                    <span className="font-semibold text-[#261C14]">{cat.label}</span>
                  </div>
                  <div className="font-mono-tabular text-[#5C4B3B]">
                    <span>{cat.doneCount}/{cat.count}</span>
                    <span className="mx-1.5 text-[#84715E]">·</span>
                    <span>{cat.ayahs} {dict.ayahsUnit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scope Completion Bars */}
          <div className="pt-3 border-t border-[#DDD2BE] space-y-3">
            <h4 className="text-xs font-semibold text-[#5C4B3B]">{dict.chartScopeTitle}</h4>
            {scopeStats.map((sc) => (
              <div key={sc.scope} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
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
    </section>
  );
};
