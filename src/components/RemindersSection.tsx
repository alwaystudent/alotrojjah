import React from 'react';
import { Bell, Volume2, CheckCircle2, Clock, Send } from 'lucide-react';
import {
  Language,
  QuranPlanItem,
  WEEK_DAYS,
  formatCurriculumTitle,
  getPlanTypeLabel,
  getTodayDayId,
} from '../data/quranData';
import { t } from '../data/translations';

interface RemindersSectionProps {
  plans: QuranPlanItem[];
  lang: Language;
  notificationPermission: NotificationPermission | 'unsupported';
  soundEnabled: boolean;
  onToggleSound: () => void;
  onRequestPermission: () => void;
  onTriggerTestReminder: (plan?: QuranPlanItem) => void;
  onTogglePlanReminder: (planId: string) => void;
  onUpdatePlanReminderTime: (planId: string, newTime: string) => void;
}

export const RemindersSection: React.FC<RemindersSectionProps> = ({
  plans,
  lang,
  notificationPermission,
  soundEnabled,
  onToggleSound,
  onRequestPermission,
  onTriggerTestReminder,
  onTogglePlanReminder,
  onUpdatePlanReminderTime,
}) => {
  const dict = t(lang);
  const todayId = getTodayDayId();

  const sortedPlans = [...plans].sort((a, b) => {
    const dayIdxA = WEEK_DAYS.findIndex((d) => d.id === a.day);
    const dayIdxB = WEEK_DAYS.findIndex((d) => d.id === b.day);
    if (dayIdxA !== dayIdxB) return dayIdxA - dayIdxB;
    return a.reminderTime.localeCompare(b.reminderTime);
  });

  return (
    <section className="space-y-6">
      <div className="border-b border-[#DDD2BE] pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display-islamic text-[#261C14]">
            {dict.remindersHeading}
          </h2>
          <p className="text-sm text-[#5C4B3B] mt-1">{dict.remindersSub}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
            <button
              type="button"
              onClick={onRequestPermission}
              className="px-4 py-2 rounded-xl border border-[#C88A14] bg-[#FBF5E6] text-xs font-semibold text-[#261C14] hover:bg-[#F6E9C8] transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2"
            >
              <Bell className="w-4 h-4 text-[#C88A14]" />
              <span>{dict.enableNotificationsBtn}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onTriggerTestReminder()}
            className="mustard-gradient-btn px-4 py-2 rounded-xl text-xs font-bold text-[#FFFDF9] shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{dict.testNotificationBtn}</span>
          </button>
        </div>
      </div>

      {/* Settings Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-medium text-[#84715E]">{dict.browserPermissionStatus}</div>
            <div className="text-sm font-bold text-[#261C14] flex items-center gap-2">
              <CheckCircle2
                className={`w-4 h-4 ${
                  notificationPermission === 'granted' ? 'text-[#4A6144]' : 'text-[#C88A14]'
                }`}
              />
              <span>
                {notificationPermission === 'granted'
                  ? dict.permissionGranted
                  : notificationPermission === 'denied'
                  ? dict.permissionDenied
                  : dict.permissionDefault}
              </span>
            </div>
          </div>
          <span className="font-mono-tabular text-xs text-[#84715E]">
            {plans.filter((p) => p.reminderEnabled).length} / {plans.length}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-[#C88A14] shrink-0" />
            <span className="text-sm font-medium text-[#261C14]">{dict.soundAlertToggle}</span>
          </div>
          <button
            type="button"
            onClick={onToggleSound}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              soundEnabled
                ? 'bg-[#2D2218] text-[#FFFDF9]'
                : 'bg-[#EFE9DC] text-[#5C4B3B]'
            }`}
          >
            {soundEnabled
              ? lang === 'ar'
                ? 'مفعّل'
                : 'Enabled'
              : lang === 'ar'
              ? 'صامت'
              : 'Muted'}
          </button>
        </div>
      </div>

      {/* Scheduled Reminders Table */}
      <div className="rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] overflow-hidden">
        <div className="px-6 py-4 bg-[#F7F3EB] border-b border-[#DDD2BE] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#261C14]">{dict.upcomingRemindersTitle}</h3>
          <span className="text-xs text-[#84715E] font-mono-tabular">
            {sortedPlans.length} {lang === 'ar' ? 'مواعيد مجدولة' : 'scheduled sessions'}
          </span>
        </div>

        <div className="divide-y divide-[#EFE9DC]">
          {sortedPlans.map((plan) => {
            const dayInfo = WEEK_DAYS.find((d) => d.id === plan.day);
            const isToday = plan.day === todayId;
            return (
              <div
                key={plan.id}
                className={`px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 transition-colors ${
                  isToday ? 'bg-[#FBF5E6]/60' : 'hover:bg-[#F7F3EB]/60'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#261C14]">
                    <span>{formatCurriculumTitle(plan, lang)}</span>
                    {isToday && (
                      <span className="text-xs font-semibold text-[#C88A14]">
                        · {dict.todayBadge}
                      </span>
                    )}
                  </div>
                  {/* Unboxed metadata with · separators */}
                  <div className="flex items-center gap-2 text-xs text-[#84715E]">
                    <span>{dayInfo ? (lang === 'ar' ? dayInfo.nameAr : dayInfo.nameEn) : ''}</span>
                    <span aria-hidden="true">·</span>
                    <span>{getPlanTypeLabel(plan.planType, lang)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">
                      {plan.estimatedAyahs} {dict.ayahsUnit}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#C88A14]" />
                    <input
                      type="time"
                      value={plan.reminderTime}
                      onChange={(e) => onUpdatePlanReminderTime(plan.id, e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-[#F7F3EB] border border-[#DDD2BE] text-xs font-mono-tabular text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => onTogglePlanReminder(plan.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      plan.reminderEnabled
                        ? 'bg-[#4A6144] text-white'
                        : 'bg-[#EFE9DC] text-[#84715E]'
                    }`}
                  >
                    {plan.reminderEnabled
                      ? lang === 'ar'
                        ? 'التنبيه مفعّل'
                        : 'Active'
                      : lang === 'ar'
                      ? 'متوقف'
                      : 'Paused'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onTriggerTestReminder(plan)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#DDD2BE] text-xs font-medium text-[#5C4B3B] hover:border-[#C88A14] hover:text-[#261C14] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {lang === 'ar' ? 'تجربة' : 'Test'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
