import React, { useState, useEffect } from 'react';
import { X, BookOpen, Layers, Hash, Clock, Check, Calendar, Sparkles } from 'lucide-react';
import {
  Language,
  PlanType,
  CurriculumScope,
  DayId,
  QuranPlanItem,
  WEEK_DAYS,
  SURAH_LIST,
  JUZ_LIST,
  getTodayDayId,
  calculateMetrics,
} from '../data/quranData';
import { t } from '../data/translations';

interface PlanModalProps {
  isOpen: boolean;
  lang: Language;
  initialDay?: DayId;
  editingPlan?: QuranPlanItem | null;
  onClose: () => void;
  onSave: (plansToInsertOrUpdate: Omit<QuranPlanItem, 'id' | 'createdAt'>[], editingId?: string) => void;
}

export const PlanModal: React.FC<PlanModalProps> = ({
  isOpen,
  lang,
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

      setAyahSurah(editingPlan.ayahSurah ?? 3);
      setAyahFrom(editingPlan.ayahFrom ?? 1);
      setAyahTo(editingPlan.ayahTo ?? 15);

      setReminderTime(editingPlan.reminderTime || '05:30');
      setReminderEnabled(editingPlan.reminderEnabled ?? true);
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
      setNotes('');
      setMistakesCount(0);
    }
  }, [isOpen, editingPlan, initialDay, todayId]);

  if (!isOpen) return null;

  const selectedAyahSurahObj = SURAH_LIST.find((s) => s.number === ayahSurah) || SURAH_LIST[0];
  const maxAyahs = selectedAyahSurahObj.ayahCount;

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
    ayahFrom,
    ayahTo
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const s1 = Math.min(surahStart, effectiveSurahEnd);
    const s2 = Math.max(surahStart, effectiveSurahEnd);
    const j1 = Math.min(juzStart, effectiveJuzEnd);
    const j2 = Math.max(juzStart, effectiveJuzEnd);
    const a1 = Math.max(1, Math.min(ayahFrom, ayahTo, maxAyahs));
    const a2 = Math.min(maxAyahs, Math.max(ayahFrom, ayahTo, 1));

    const plans = selectedDays.map((day) => ({
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
      reminderTime,
      reminderEnabled,
      status: editingPlan ? editingPlan.status : ('pending' as const),
      estimatedAyahs,
      estimatedPages,
      notes: notes.trim() || undefined,
      mistakesCount,
    }));

    onSave(plans, editingPlan?.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1610]/70 backdrop-blur-xs overflow-y-auto">
      <div
        className="relative w-full max-w-2xl bg-[#FFFDF9] border border-[#D5C7B2] rounded-2xl shadow-xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="earthy-gradient-banner px-6 py-5 text-[#FDFBF7] flex items-center justify-between border-b border-[#8F681E]/30">
          <div>
            <h2 className="text-xl font-bold font-display-islamic tracking-wide">
              {editingPlan ? dict.modalEditTitle : dict.modalAddTitle}
            </h2>
            <p className="text-xs text-[#E6D7BE] mt-0.5">{dict.selectDayHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#E6D7BE] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label={dict.cancelBtn}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* 1. Day Selector with Today Option */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <label className="text-sm font-semibold text-[#261C14] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#C88A14]" />
                <span>{dict.selectDayLabel}</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDays([todayId])}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#F6E9C8] text-[#7D5306] hover:bg-[#EDD8A1] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {dict.setTodayShortcut} ({WEEK_DAYS.find((d) => d.id === todayId)?.[lang === 'ar' ? 'nameAr' : 'nameEn']})
                </button>
                {!editingPlan && (
                  <button
                    type="button"
                    onClick={() => setSelectedDays(WEEK_DAYS.map((d) => d.id))}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#EFE9DC] text-[#5C4B3B] hover:bg-[#E2D8C5] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {dict.selectAllDaysShortcut}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {WEEK_DAYS.map((day) => {
                const isSelected = selectedDays.includes(day.id);
                const isToday = day.id === todayId;
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => handleToggleDay(day.id)}
                    className={`relative py-2.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#2D2218] text-[#FFFDF9] border-[#C88A14] shadow-xs'
                        : 'bg-[#F7F3EB] text-[#5C4B3B] border-[#DDD2BE] hover:border-[#C88A14]/60'
                    }`}
                  >
                    <div className="text-xs font-semibold whitespace-nowrap">
                      {lang === 'ar' ? day.nameAr : day.shortEn}
                    </div>
                    {isToday && (
                      <div
                        className={`text-[10px] mt-0.5 font-medium ${
                          isSelected ? 'text-[#EAB338]' : 'text-[#B87D10]'
                        }`}
                      >
                        {dict.todayBadge}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Plan Type Selector: حفظ جديد | سرد | مراجعة */}
          <div>
            <label className="block text-sm font-semibold text-[#261C14] mb-2.5">
              {dict.planTypeLabel}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { id: 'new_memorization', label: dict.typeNewMem, descAr: 'حفظ آيات أو سور جديدة', descEn: 'Memorize new verses' },
                  { id: 'sard', label: dict.typeSard, descAr: 'تلاوة متواصلة لتثبيت المحفوظ', descEn: 'Continuous recitation' },
                  { id: 'review', label: dict.typeReview, descAr: 'مراجعة دورية وإتقان', descEn: 'Periodic consolidation' },
                ] as const
              ).map((tItem) => {
                const active = planType === tItem.id;
                return (
                  <button
                    key={tItem.id}
                    type="button"
                    onClick={() => setPlanType(tItem.id)}
                    className={`p-3.5 rounded-xl border text-start transition-all cursor-pointer ${
                      active
                        ? 'bg-[#FBF5E6] border-[#C88A14] text-[#261C14] shadow-xs'
                        : 'bg-[#F7F3EB]/70 border-[#DDD2BE] text-[#5C4B3B] hover:bg-[#EFE9DC]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold whitespace-nowrap">{tItem.label}</span>
                      {active && <Check className="w-4 h-4 text-[#C88A14] shrink-0" />}
                    </div>
                    <p className="text-xs text-[#84715E] mt-1 line-clamp-1">
                      {lang === 'ar' ? tItem.descAr : tItem.descEn}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Curriculum Scope Selector: سور | أجزاء | آيات */}
          <div className="p-4 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="text-sm font-semibold text-[#261C14]">
                {dict.curriculumScopeLabel}
              </label>
              <div className="flex items-center gap-1 p-1 bg-[#E8DEC8] rounded-lg">
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
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#2D2218] text-[#FFFDF9] shadow-xs'
                          : 'text-[#5C4B3B] hover:text-[#261C14]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{sc.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scope A: Surahs */}
            {scope === 'surah' && (
              <div className="space-y-3 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#5C4B3B] cursor-pointer">
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

                <div className={`grid gap-3 ${singleSurah ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                  <div>
                    <label className="block text-xs font-medium text-[#5C4B3B] mb-1">
                      {singleSurah ? dict.selectSurahForAyahs : dict.fromSurahLabel}
                    </label>
                    <select
                      value={surahStart}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSurahStart(val);
                        if (singleSurah || val > surahEnd) setSurahEnd(val);
                      }}
                      className="w-full px-3 py-2.5 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-sm text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                    >
                      {SURAH_LIST.map((s) => (
                        <option key={s.number} value={s.number}>
                          {s.number}. {lang === 'ar' ? `سورة ${s.nameAr}` : s.nameEn} ({s.ayahCount}{' '}
                          {dict.ayahsUnit})
                        </option>
                      ))}
                    </select>
                  </div>

                  {!singleSurah && (
                    <div>
                      <label className="block text-xs font-medium text-[#5C4B3B] mb-1">
                        {dict.toSurahLabel}
                      </label>
                      <select
                        value={surahEnd}
                        onChange={(e) => setSurahEnd(Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-sm text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                      >
                        {SURAH_LIST.map((s) => (
                          <option key={s.number} value={s.number}>
                            {s.number}. {lang === 'ar' ? `سورة ${s.nameAr}` : s.nameEn} ({s.ayahCount}{' '}
                            {dict.ayahsUnit})
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
              <div className="space-y-3 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#5C4B3B] cursor-pointer">
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

                <div className={`grid gap-3 ${singleJuz ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                  <div>
                    <label className="block text-xs font-medium text-[#5C4B3B] mb-1">
                      {dict.fromJuzLabel}
                    </label>
                    <select
                      value={juzStart}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setJuzStart(val);
                        if (singleJuz || val > juzEnd) setJuzEnd(val);
                      }}
                      className="w-full px-3 py-2.5 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-sm text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                    >
                      {JUZ_LIST.map((j) => (
                        <option key={j.number} value={j.number}>
                          {lang === 'ar'
                            ? `${j.nameAr} — [${j.rangeAr}]`
                            : `${j.nameEn} — [${j.rangeEn}]`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!singleJuz && (
                    <div>
                      <label className="block text-xs font-medium text-[#5C4B3B] mb-1">
                        {dict.toJuzLabel}
                      </label>
                      <select
                        value={juzEnd}
                        onChange={(e) => setJuzEnd(Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-sm text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                      >
                        {JUZ_LIST.map((j) => (
                          <option key={j.number} value={j.number}>
                            {lang === 'ar'
                              ? `${j.nameAr} — [${j.rangeAr}]`
                              : `${j.nameEn} — [${j.rangeEn}]`}
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
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-[#5C4B3B]">
                      {dict.selectSurahForAyahs}
                    </label>
                    <span className="text-xs text-[#84715E] font-mono-tabular">
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
                    className="w-full px-3 py-2.5 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-sm text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                  >
                    {SURAH_LIST.map((s) => (
                      <option key={s.number} value={s.number}>
                        {s.number}. {lang === 'ar' ? `سورة ${s.nameAr}` : s.nameEn} ({s.ayahCount}{' '}
                        {dict.ayahsUnit})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#5C4B3B] mb-1">
                      {dict.fromAyahLabel}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={maxAyahs}
                      value={ayahFrom}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(maxAyahs, Number(e.target.value) || 1));
                        setAyahFrom(val);
                        if (val > ayahTo) setAyahTo(val);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-sm font-mono-tabular text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5C4B3B] mb-1">
                      {dict.toAyahLabel}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={maxAyahs}
                      value={ayahTo}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(maxAyahs, Number(e.target.value) || 1));
                        setAyahTo(val);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-sm font-mono-tabular text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Calculated Volume Preview */}
            <div className="pt-2 border-t border-[#DDD2BE] flex items-center justify-between text-xs text-[#5C4B3B]">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#C88A14]" />
                <span>{dict.colMetrics}:</span>
              </span>
              <div className="font-mono-tabular font-semibold text-[#261C14]">
                <span>
                  {estimatedAyahs} {dict.ayahsUnit}
                </span>
                <span className="mx-1.5 text-[#84715E]">·</span>
                <span>
                  ~{estimatedPages} {dict.pagesUnit}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Daily Reminder Time & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE]">
              <label className="block text-xs font-semibold text-[#261C14] mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#C88A14]" />
                <span>{dict.reminderTimeLabel}</span>
              </label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-sm font-mono-tabular text-[#261C14] focus:outline-none focus:border-[#C88A14]"
              />
              <label className="inline-flex items-center gap-2 text-xs text-[#5C4B3B] mt-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  className="rounded border-[#C88A14] text-[#C88A14] focus:ring-[#C88A14]"
                />
                <span>{dict.enableReminderLabel}</span>
              </label>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE]">
              <label className="block text-xs font-semibold text-[#261C14] mb-2">
                {dict.mistakesLabel}
              </label>
              <input
                type="number"
                min={0}
                max={99}
                value={mistakesCount}
                onChange={(e) => setMistakesCount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-2 rounded-lg bg-[#FFFDF9] border border-[#D5C7B2] text-sm font-mono-tabular text-[#261C14] focus:outline-none focus:border-[#C88A14]"
              />
              <p className="text-[11px] text-[#84715E] mt-2">
                {lang === 'ar'
                  ? 'يساعد في حساب نسبة الإتقان والضبط في الإحصائيات'
                  : 'Used to compute recitation mastery rate in analytics'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#261C14] mb-1.5">
              {dict.notesLabel}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={dict.notesPlaceholder}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-sm text-[#261C14] placeholder-[#84715E] focus:outline-none focus:border-[#C88A14] focus:bg-[#FFFDF9]"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DDD2BE]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#D5C7B2] text-sm font-medium text-[#5C4B3B] hover:bg-[#EFE9DC] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {dict.cancelBtn}
            </button>
            <button
              type="submit"
              className="mustard-gradient-btn px-6 py-2.5 rounded-xl text-sm font-bold text-[#FFFDF9] shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              {editingPlan ? dict.updatePlanBtn : dict.savePlanBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
