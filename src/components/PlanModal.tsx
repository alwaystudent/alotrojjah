import React, { useState, useEffect, useMemo } from 'react';
import { X, BookOpen, Layers, Hash, Clock, Check, Calendar, Sparkles, Repeat } from 'lucide-react';
import {
  Language,
  PlanType,
  CurriculumScope,
  DayId,
  QuranPlanItem,
  CalendarMode,
  WEEK_DAYS,
  SURAH_LIST,
  JUZ_LIST,
  getTodayDayId,
  getWeekDayDate,
  formatCalendarDate,
  calculateMetrics,
} from '@/src/data/quranData';
import { t } from '@/src/data/translations';

interface PlanModalProps {
  isOpen: boolean;
  lang: Language;
  calendarMode?: CalendarMode;
  initialDay?: DayId;
  editingPlan?: QuranPlanItem | null;
  onClose: () => void;
  onSave: (plansToInsertOrUpdate: Omit<QuranPlanItem, 'id' | 'createdAt'>[], editingId?: string) => void;
}

export const PlanModal: React.FC<PlanModalProps> = ({
  isOpen,
  lang,
  calendarMode = 'both',
  initialDay,
  editingPlan,
  onClose,
  onSave,
}) => {
  const dict = t(lang);
  const todayId = getTodayDayId();

  const [selectedDays, setSelectedDays] = useState<DayId[]>([initialDay || todayId]);
  const [planType, setPlanType] = useState<PlanType>('sard');
  const [scope, setScope] = useState<CurriculumScope>('surah');

  // Surah scope state
  const [singleSurah, setSingleSurah] = useState<boolean>(true);
  const [surahStart, setSurahStart] = useState<number>(2);
  const [surahEnd, setSurahEnd] = useState<number>(2);

  // Juz scope state
  const [singleJuz, setSingleJuz] = useState<boolean>(true);
  const [juzStart, setJuzStart] = useState<number>(30);
  const [juzEnd, setJuzEnd] = useState<number>(30);

  // Ayah scope state
  const [ayahSurah, setAyahSurah] = useState<number>(3);
  const [ayahFrom, setAyahFrom] = useState<number>(1);
  const [ayahTo, setAyahTo] = useState<number>(15);

  // Reminder & details
  const [reminderTime, setReminderTime] = useState<string>('05:30');
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(true);
  const [repeatWeekly, setRepeatWeekly] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [mistakesCount, setMistakesCount] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    if (editingPlan) {
      setSelectedDays([editingPlan.day]);
      setPlanType(editingPlan.planType);
      setScope(editingPlan.scope);

      const sStart = editingPlan.surahStart ?? 2;
      const sEnd = editingPlan.surahEnd ?? sStart;
      setSurahStart(sStart);
      setSurahEnd(sEnd);
      setSingleSurah(sStart === sEnd);

      const jStart = editingPlan.juzStart ?? 30;
      const jEnd = editingPlan.juzEnd ?? jStart;
      setJuzStart(jStart);
      setJuzEnd(jEnd);
      setSingleJuz(jStart === jEnd);

      const aSurah = editingPlan.ayahSurah ?? 3;
      const surahObj = SURAH_LIST.find((s) => s.number === aSurah);
      const sMaxA = surahObj ? surahObj.ayahCount : 200;
      const aFrom = Math.max(1, Math.min(sMaxA, editingPlan.ayahFrom ?? 1));
      const aTo = Math.max(aFrom, Math.min(sMaxA, editingPlan.ayahTo ?? Math.min(15, sMaxA)));

      setAyahSurah(aSurah);
      setAyahFrom(aFrom);
      setAyahTo(aTo);

      setReminderTime(editingPlan.reminderTime || '05:30');
      setReminderEnabled(editingPlan.reminderEnabled ?? true);
      setRepeatWeekly(editingPlan.repeatWeekly ?? true);
      setNotes(editingPlan.notes || '');
      setMistakesCount(editingPlan.mistakesCount ?? 0);
    } else {
      setSelectedDays([initialDay || todayId]);
      setPlanType('sard');
      setScope('surah');
      setSingleSurah(true);
      setSurahStart(18);
      setSurahEnd(18);
      setSingleJuz(true);
      setJuzStart(30);
      setJuzEnd(30);
      setAyahSurah(2);
      setAyahFrom(1);
      setAyahTo(20);
      setReminderTime('06:00');
      setReminderEnabled(true);
      setRepeatWeekly(true);
      setNotes('');
      setMistakesCount(0);
    }
  }, [isOpen, editingPlan, initialDay, todayId]);

  const selectedAyahSurahObj = SURAH_LIST.find((s) => s.number === ayahSurah) || SURAH_LIST[0];
  const maxAyahs = selectedAyahSurahObj.ayahCount;
  const safeAyahFrom = Math.max(1, Math.min(maxAyahs, ayahFrom));
  const safeAyahTo = Math.max(safeAyahFrom, Math.min(maxAyahs, ayahTo));

  const ayahOptions = useMemo(
    () => Array.from({ length: maxAyahs }, (_, idx) => idx + 1),
    [maxAyahs]
  );
  const toAyahOptions = useMemo(
    () => ayahOptions.filter((num) => num >= safeAyahFrom),
    [ayahOptions, safeAyahFrom]
  );

  if (!isOpen) return null;

  const handleToggleDay = (dayId: DayId) => {
    if (editingPlan) {
      setSelectedDays([dayId]);
      return;
    }
    if (selectedDays.includes(dayId)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== dayId));
      }
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const effectiveSurahEnd = singleSurah ? surahStart : surahEnd;
  const effectiveJuzEnd = singleJuz ? juzStart : juzEnd;

  const { estimatedAyahs, estimatedPages } = calculateMetrics(
    scope,
    surahStart,
    effectiveSurahEnd,
    juzStart,
    effectiveJuzEnd,
    ayahSurah,
    safeAyahFrom,
    safeAyahTo
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const s1 = Math.min(surahStart, effectiveSurahEnd);
    const s2 = Math.max(surahStart, effectiveSurahEnd);
    const j1 = Math.min(juzStart, effectiveJuzEnd);
    const j2 = Math.max(juzStart, effectiveJuzEnd);
    const a1 = Math.max(1, Math.min(safeAyahFrom, safeAyahTo, maxAyahs));
    const a2 = Math.min(maxAyahs, Math.max(safeAyahFrom, safeAyahTo, 1));

    const targetDays = selectedDays.length > 0 ? selectedDays : [initialDay || todayId];

    const plans = targetDays.map((day) => ({
      day,
      planType,
      scope,
      surahStart: scope === 'surah' ? s1 : undefined,
      surahEnd: scope === 'surah' ? s2 : undefined,
      juzStart: scope === 'juz' ? j1 : undefined,
      juzEnd: scope === 'juz' ? j2 : undefined,
      ayahSurah: scope === 'ayah' ? ayahSurah : undefined,
      ayahFrom: scope === 'ayah' ? a1 : undefined,
      ayahTo: scope === 'ayah' ? a2 : undefined,
      reminderTime: reminderTime || '05:30',
      reminderEnabled,
      repeatWeekly,
      status: editingPlan ? editingPlan.status : ('pending' as const),
      estimatedAyahs,
      estimatedPages,
      notes: notes.trim() || undefined,
      mistakesCount: Number(mistakesCount) || 0,
    }));

    onSave(plans, editingPlan?.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-[#1E1610]/70 backdrop-blur-xs overflow-y-auto">
      <div
        className="relative w-full max-w-lg bg-[#FFFDF9] border border-[#D5C7B2] rounded-2xl shadow-xl overflow-hidden my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="earthy-gradient-banner px-4 py-3 text-[#FDFBF7] flex items-center justify-between border-b border-[#8F681E]/30">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base sm:text-lg font-bold font-display-islamic">
              {editingPlan ? dict.modalEditTitle : dict.modalAddTitle}
            </h2>
            <span className="text-[11px] text-[#E6D7BE]">· {dict.selectDayHint}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#E6D7BE] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label={dict.cancelBtn}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 max-h-[82vh] overflow-y-auto">
          {/* 1. Day Selector with Today Option */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-bold text-[#261C14] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#C88A14]" />
                <span>{dict.selectDayLabel}</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedDays([todayId])}
                  className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[#F6E9C8] text-[#7D5306] hover:bg-[#EDD8A1] transition-colors cursor-pointer"
                >
                  {dict.setTodayShortcut}
                </button>
                {!editingPlan && (
                  <button
                    type="button"
                    onClick={() => setSelectedDays(WEEK_DAYS.map((d) => d.id))}
                    className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[#EFE9DC] text-[#5C4B3B] hover:bg-[#E2D8C5] transition-colors cursor-pointer"
                  >
                    {dict.selectAllDaysShortcut}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {WEEK_DAYS.map((day) => {
                const isSelected = selectedDays.includes(day.id);
                const isToday = day.id === todayId;
                const dateStr = formatCalendarDate(getWeekDayDate(day.id), lang, calendarMode, {
                  compact: true,
                });
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => handleToggleDay(day.id)}
                    className={`py-1.5 px-0.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-[#2D2218] text-[#FFFDF9] border-[#C88A14]'
                        : 'bg-[#F7F3EB] text-[#5C4B3B] border-[#DDD2BE] hover:border-[#C88A14]/60'
                    }`}
                  >
                    <div className="text-[11px] font-bold truncate">
                      {lang === 'ar' ? day.nameAr : day.shortEn}
                    </div>
                    <div
                      className={`text-[8.5px] font-mono-tabular leading-none truncate max-w-full px-0.5 ${
                        isSelected ? 'text-[#EAB338]' : 'text-[#84715E]'
                      }`}
                    >
                      {dateStr}
                    </div>
                    {isToday && (
                      <div
                        className={`text-[9px] font-medium leading-none ${
                          isSelected ? 'text-[#EAB338]' : 'text-[#B87D10]'
                        }`}
                      >
                        •
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Plan Type Selector: حفظ | سرد | مراجعة */}
          <div>
            <label className="block text-xs font-bold text-[#261C14] mb-1.5">
              {dict.planTypeLabel}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'new_memorization', label: dict.typeNewMem },
                  { id: 'sard', label: dict.typeSard },
                  { id: 'review', label: dict.typeReview },
                ] as const
              ).map((tItem) => {
                const active = planType === tItem.id;
                return (
                  <button
                    key={tItem.id}
                    type="button"
                    onClick={() => setPlanType(tItem.id)}
                    className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      active
                        ? 'bg-[#FBF5E6] border-[#C88A14] text-[#261C14] shadow-2xs'
                        : 'bg-[#F7F3EB]/70 border-[#DDD2BE] text-[#5C4B3B] hover:bg-[#EFE9DC]/60'
                    }`}
                  >
                    <span className="text-xs font-bold whitespace-nowrap">{tItem.label}</span>
                    {active && <Check className="w-3.5 h-3.5 text-[#C88A14] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Curriculum Scope Selector: سور | أجزاء | آيات */}
          <div className="p-3 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-[#261C14]">
                {dict.curriculumScopeLabel}
              </label>
              <div className="flex items-center gap-1 p-0.5 bg-[#E8DEC8] rounded-lg">
                {(
                  [
                    { id: 'surah', label: dict.scopeSurah, icon: BookOpen },
                    { id: 'juz', label: dict.scopeJuz, icon: Layers },
                    { id: 'ayah', label: dict.scopeAyah, icon: Hash },
                  ] as const
                ).map((sc) => {
                  const Icon = sc.icon;
                  const active = scope === sc.id;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setScope(sc.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-[#2D2218] text-[#FFFDF9]'
                          : 'text-[#5C4B3B] hover:text-[#261C14]'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{sc.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scope A: Surahs */}
            {scope === 'surah' && (
              <div className="space-y-2">
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C4B3B] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={singleSurah}
                    onChange={(e) => {
                      setSingleSurah(e.target.checked);
                      if (e.target.checked) setSurahEnd(surahStart);
                    }}
                    className="rounded border-[#C88A14] text-[#C88A14] focus:ring-[#C88A14]"
                  />
                  <span>{dict.singleSurahToggle}</span>
                </label>

                <div className={`grid gap-2 ${singleSurah ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  <div>
                    <label className="block text-[11px] font-medium text-[#5C4B3B] mb-0.5">
                      {singleSurah ? dict.selectSurahForAyahs : dict.fromSurahLabel}
                    </label>
                    <select
                      value={surahStart}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSurahStart(val);
                        if (singleSurah || val > surahEnd) setSurahEnd(val);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-xs text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                    >
                      {SURAH_LIST.map((s) => (
                        <option key={s.number} value={s.number}>
                          {s.number}. {lang === 'ar' ? `سورة ${s.nameAr}` : s.nameEn} ({s.ayahCount})
                        </option>
                      ))}
                    </select>
                  </div>

                  {!singleSurah && (
                    <div>
                      <label className="block text-[11px] font-medium text-[#5C4B3B] mb-0.5">
                        {dict.toSurahLabel}
                      </label>
                      <select
                        value={surahEnd}
                        onChange={(e) => setSurahEnd(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-xs text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                      >
                        {SURAH_LIST.map((s) => (
                          <option key={s.number} value={s.number}>
                            {s.number}. {lang === 'ar' ? `سورة ${s.nameAr}` : s.nameEn} ({s.ayahCount})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Scope B: Juz */}
            {scope === 'juz' && (
              <div className="space-y-2">
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C4B3B] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={singleJuz}
                    onChange={(e) => {
                      setSingleJuz(e.target.checked);
                      if (e.target.checked) setJuzEnd(juzStart);
                    }}
                    className="rounded border-[#C88A14] text-[#C88A14] focus:ring-[#C88A14]"
                  />
                  <span>{dict.singleJuzToggle}</span>
                </label>

                <div className={`grid gap-2 ${singleJuz ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  <div>
                    <label className="block text-[11px] font-medium text-[#5C4B3B] mb-0.5">
                      {dict.fromJuzLabel}
                    </label>
                    <select
                      value={juzStart}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setJuzStart(val);
                        if (singleJuz || val > juzEnd) setJuzEnd(val);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-xs text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                    >
                      {JUZ_LIST.map((j) => (
                        <option key={j.number} value={j.number}>
                          {lang === 'ar' ? `${j.nameAr} (${j.rangeAr})` : `${j.nameEn} (${j.rangeEn})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!singleJuz && (
                    <div>
                      <label className="block text-[11px] font-medium text-[#5C4B3B] mb-0.5">
                        {dict.toJuzLabel}
                      </label>
                      <select
                        value={juzEnd}
                        onChange={(e) => setJuzEnd(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-xs text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                      >
                        {JUZ_LIST.map((j) => (
                          <option key={j.number} value={j.number}>
                            {lang === 'ar' ? `${j.nameAr} (${j.rangeAr})` : `${j.nameEn} (${j.rangeEn})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Scope C: Ayahs */}
            {scope === 'ayah' && (
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[11px] font-medium text-[#5C4B3B]">
                      {dict.selectSurahForAyahs}
                    </label>
                    <span className="text-[11px] text-[#84715E] font-mono-tabular">
                      {dict.maxAyahHint} {maxAyahs}
                    </span>
                  </div>
                  <select
                    value={ayahSurah}
                    onChange={(e) => {
                      const newSurahNum = Number(e.target.value);
                      const targetS = SURAH_LIST.find((s) => s.number === newSurahNum);
                      setAyahSurah(newSurahNum);
                      setAyahFrom(1);
                      setAyahTo(Math.min(15, targetS ? targetS.ayahCount : 7));
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-xs text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                  >
                    {SURAH_LIST.map((s) => (
                      <option key={s.number} value={s.number}>
                        {s.number}. {lang === 'ar' ? `سورة ${s.nameAr}` : s.nameEn} ({s.ayahCount})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-[#5C4B3B] mb-0.5">
                      {dict.fromAyahLabel}
                    </label>
                    <select
                      value={safeAyahFrom}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(maxAyahs, Number(e.target.value) || 1));
                        setAyahFrom(val);
                        if (val > ayahTo) setAyahTo(val);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-xs font-mono-tabular text-[#261C14] focus:outline-none focus:border-[#C88A14] cursor-pointer"
                    >
                      {ayahOptions.map((num) => (
                        <option key={num} value={num}>
                          {lang === 'ar' ? `الآية ${num}` : `Ayah ${num}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#5C4B3B] mb-0.5">
                      {dict.toAyahLabel}
                    </label>
                    <select
                      value={safeAyahTo}
                      onChange={(e) => {
                        const val = Math.max(
                          safeAyahFrom,
                          Math.min(maxAyahs, Number(e.target.value) || safeAyahFrom)
                        );
                        setAyahTo(val);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-xs font-mono-tabular text-[#261C14] focus:outline-none focus:border-[#C88A14] cursor-pointer"
                    >
                      {toAyahOptions.map((num) => (
                        <option key={num} value={num}>
                          {lang === 'ar' ? `الآية ${num}` : `Ayah ${num}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Calculated Volume Preview */}
            <div className="pt-1.5 border-t border-[#DDD2BE] flex items-center justify-between text-xs text-[#5C4B3B]">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#C88A14]" />
                <span>{dict.colMetrics}:</span>
              </span>
              <div className="font-mono-tabular font-semibold text-[#261C14]">
                <span>
                  {estimatedAyahs} {dict.ayahsUnit}
                </span>
                <span className="mx-1 text-[#84715E]">·</span>
                <span>
                  ~{estimatedPages} {dict.pagesUnit}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Compact Row: Reminder Time, Mistakes, and Notes */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE]">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-[#261C14] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#C88A14]" />
                  <span>{dict.reminderTimeLabel}</span>
                </label>
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  title={dict.enableReminderLabel}
                  className="rounded border-[#C88A14] text-[#C88A14] focus:ring-[#C88A14] cursor-pointer"
                />
              </div>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full px-2 py-1 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-xs font-mono-tabular text-[#261C14] focus:outline-none focus:border-[#C88A14]"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE]">
              <label className="block text-[11px] font-bold text-[#261C14] mb-1">
                {dict.mistakesLabel}
              </label>
              <input
                type="number"
                min={0}
                max={99}
                value={mistakesCount}
                onChange={(e) => setMistakesCount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-2 py-1 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-xs font-mono-tabular text-[#261C14] focus:outline-none focus:border-[#C88A14]"
              />
            </div>

            <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE]">
              <label className="block text-[11px] font-bold text-[#261C14] mb-1">
                {dict.notesLabel}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={dict.notesPlaceholder}
                className="w-full px-2 py-1 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-xs text-[#261C14] placeholder-[#84715E] focus:outline-none focus:border-[#C88A14]"
              />
            </div>
          </div>

          {/* 5. Weekly Repetition Option (خاصية تكرار الخطة أسبوعياً) */}
          <div className="p-2.5 rounded-xl bg-[#FBF5E6] border border-[#C88A14]/40 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#C88A14]/15 flex items-center justify-center text-[#9E6A0C] shrink-0">
                <Repeat className="w-3.5 h-3.5" />
              </div>
              <div>
                <label
                  htmlFor="repeatWeeklyCheck"
                  className="text-xs font-bold text-[#261C14] cursor-pointer block"
                >
                  {dict.repeatWeeklyLabel}
                </label>
                <span className="text-[10.5px] text-[#84715E] block leading-tight">
                  {dict.repeatWeeklyHint}
                </span>
              </div>
            </div>
            <input
              id="repeatWeeklyCheck"
              type="checkbox"
              checked={repeatWeekly}
              onChange={(e) => setRepeatWeekly(e.target.checked)}
              className="w-4 h-4 rounded border-[#C88A14] text-[#C88A14] focus:ring-[#C88A14] cursor-pointer"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DDD2BE]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-[#D5C7B2] text-xs font-semibold text-[#5C4B3B] hover:bg-[#EFE9DC] transition-colors cursor-pointer"
            >
              {dict.cancelBtn}
            </button>
            <button
              type="submit"
              className="mustard-gradient-btn px-5 py-1.5 rounded-xl text-xs font-bold text-[#FFFDF9] shadow-2xs transition-all cursor-pointer"
            >
              {editingPlan ? dict.updatePlanBtn : dict.savePlanBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
