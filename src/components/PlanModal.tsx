import React, { useState, useEffect } from 'react';
import { X, BookOpen, Layers, Hash, Clock, Check, Calendar, Sparkles, Repeat } from 'lucide-react';
import {
  Language,
  PlanType,
  CurriculumScope,
  DayId,
  QuranPlanItem,
  QuranRiwayah,
  RIWAYAH_OPTIONS,
  WEEK_DAYS,
  SURAH_LIST,
  JUZ_LIST,
  getTodayDayId,
  calculateMetrics,
} from '@/src/data/quranData';
import { t } from '@/src/data/translations';

interface PlanModalProps {
  isOpen: boolean;
  lang: Language;
  initialDay?: DayId;
  defaultRiwayah?: QuranRiwayah;
  editingPlan?: QuranPlanItem | null;
  onClose: () => void;
  onSave: (plansToInsertOrUpdate: Omit<QuranPlanItem, 'id' | 'createdAt'>[], editingId?: string) => void;
}

export const PlanModal: React.FC<PlanModalProps> = ({
  isOpen,
  lang,
  initialDay,
  defaultRiwayah = 'hafs',
  editingPlan,
  onClose,
  onSave,
}) => {
  const dict = t(lang);
  const todayId = getTodayDayId();

  const [selectedDays, setSelectedDays] = useState<DayId[]>([initialDay || todayId]);
  const [planType, setPlanType] = useState<PlanType>('sard');
  const [scope, setScope] = useState<CurriculumScope>('surah');
  const [riwayah, setRiwayah] = useState<QuranRiwayah>(defaultRiwayah);

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
  const [repeatWeekly, setRepeatWeekly] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingPlan) {
      setSelectedDays([editingPlan.day]);
      setPlanType(editingPlan.planType);
      setScope(editingPlan.scope);
      setRiwayah(editingPlan.riwayah || defaultRiwayah);

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
      setRepeatWeekly(editingPlan.repeatWeekly ?? false);
    } else {
      setSelectedDays([initialDay || todayId]);
      setPlanType('sard');
      setScope('surah');
      setRiwayah(defaultRiwayah);
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
      setRepeatWeekly(false);
    }
  }, [isOpen, editingPlan, initialDay, todayId, defaultRiwayah]);

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
      riwayah,
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
      repeatWeekly,
      mistakesCount,
    }));

    onSave(plans, editingPlan?.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-[#1E1610]/70 backdrop-blur-xs overflow-y-auto">
      <div
        className="relative w-full max-w-lg bg-[#FFFFFF] border border-[#D5C7B2] rounded-2xl shadow-xl overflow-hidden my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="earthy-gradient-banner px-4 py-3 text-[#FDFBF7] flex items-center justify-between border-b border-[#876317]/30">
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
              <label className="text-xs font-bold text-[#161E19] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#96701E]" />
                <span>{dict.selectDayLabel}</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedDays([todayId])}
                  className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[#F5ECD4] text-[#7D5306] hover:bg-[#EDD8A1] transition-colors cursor-pointer"
                >
                  {dict.setTodayShortcut}
                </button>
                {!editingPlan && (
                  <button
                    type="button"
                    onClick={() => setSelectedDays(WEEK_DAYS.map((d) => d.id))}
                    className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-[#EAF0E7] text-[#4B5650] hover:bg-[#E2D8C5] transition-colors cursor-pointer"
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
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => handleToggleDay(day.id)}
                    className={`py-1.5 px-1 rounded-lg border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0E5C3E] text-[#FFFFFF] border-[#96701E]'
                        : 'bg-[#F4F5EE] text-[#4B5650] border-[#C5CEBF] hover:border-[#96701E]/60'
                    }`}
                  >
                    <div className="text-[11px] font-bold truncate">
                      {lang === 'ar' ? day.nameAr : day.shortEn}
                    </div>
                    {isToday && (
                      <div
                        className={`text-[9px] font-medium leading-tight ${
                          isSelected ? 'text-[#E6C25A]' : 'text-[#876317]'
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
            <label className="block text-xs font-bold text-[#161E19] mb-1.5">
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
                        ? 'bg-[#FBF5E6] border-[#96701E] text-[#161E19] shadow-2xs'
                        : 'bg-[#F4F5EE]/70 border-[#C5CEBF] text-[#4B5650] hover:bg-[#EAF0E7]/60'
                    }`}
                  >
                    <span className="text-xs font-bold whitespace-nowrap">{tItem.label}</span>
                    {active && <Check className="w-3.5 h-3.5 text-[#96701E] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2b. Riwayah Selector: حفص | قالون | ورش */}
          <div>
            <label className="block text-xs font-bold text-[#161E19] mb-1.5">
              {lang === 'ar' ? 'الرواية القرآنية' : 'Quran Narration (Riwayah)'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {RIWAYAH_OPTIONS.map((rw) => {
                const active = riwayah === rw.id;
                return (
                  <button
                    key={rw.id}
                    type="button"
                    onClick={() => setRiwayah(rw.id)}
                    className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      active
                        ? 'bg-[#0E5C3E] border-[#96701E] text-[#E6C25A] shadow-2xs'
                        : 'bg-[#F4F5EE]/80 border-[#C5CEBF] text-[#4B5650] hover:bg-[#EAF0E7]/60'
                    }`}
                  >
                    <span className="text-xs font-bold whitespace-nowrap">
                      {lang === 'ar' ? rw.labelAr : rw.labelEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Curriculum Scope Selector: سور | أجزاء | آيات */}
          <div className="p-3 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-[#161E19]">
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
                          ? 'bg-[#0E5C3E] text-[#FFFFFF]'
                          : 'text-[#4B5650] hover:text-[#161E19]'
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
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4B5650] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={singleSurah}
                    onChange={(e) => {
                      setSingleSurah(e.target.checked);
                      if (e.target.checked) setSurahEnd(surahStart);
                    }}
                    className="rounded border-[#96701E] text-[#96701E] focus:ring-[#96701E]"
                  />
                  <span>{dict.singleSurahToggle}</span>
                </label>

                <div className={`grid gap-2 ${singleSurah ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  <div>
                    <label className="block text-[11px] font-medium text-[#4B5650] mb-0.5">
                      {singleSurah ? dict.selectSurahForAyahs : dict.fromSurahLabel}
                    </label>
                    <select
                      value={surahStart}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSurahStart(val);
                        if (singleSurah || val > surahEnd) setSurahEnd(val);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#D5C7B2] text-xs text-[#161E19] focus:outline-none focus:border-[#96701E]"
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
                      <label className="block text-[11px] font-medium text-[#4B5650] mb-0.5">
                        {dict.toSurahLabel}
                      </label>
                      <select
                        value={surahEnd}
                        onChange={(e) => setSurahEnd(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#D5C7B2] text-xs text-[#161E19] focus:outline-none focus:border-[#96701E]"
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
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4B5650] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={singleJuz}
                    onChange={(e) => {
                      setSingleJuz(e.target.checked);
                      if (e.target.checked) setJuzEnd(juzStart);
                    }}
                    className="rounded border-[#96701E] text-[#96701E] focus:ring-[#96701E]"
                  />
                  <span>{dict.singleJuzToggle}</span>
                </label>

                <div className={`grid gap-2 ${singleJuz ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  <div>
                    <label className="block text-[11px] font-medium text-[#4B5650] mb-0.5">
                      {dict.fromJuzLabel}
                    </label>
                    <select
                      value={juzStart}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setJuzStart(val);
                        if (singleJuz || val > juzEnd) setJuzEnd(val);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#D5C7B2] text-xs text-[#161E19] focus:outline-none focus:border-[#96701E]"
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
                      <label className="block text-[11px] font-medium text-[#4B5650] mb-0.5">
                        {dict.toJuzLabel}
                      </label>
                      <select
                        value={juzEnd}
                        onChange={(e) => setJuzEnd(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#D5C7B2] text-xs text-[#161E19] focus:outline-none focus:border-[#96701E]"
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
                    <label className="text-[11px] font-medium text-[#4B5650]">
                      {dict.selectSurahForAyahs}
                    </label>
                    <span className="text-[11px] text-[#6A766E] font-mono-tabular">
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
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#D5C7B2] text-xs text-[#161E19] focus:outline-none focus:border-[#96701E]"
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
                    <label className="block text-[11px] font-medium text-[#4B5650] mb-0.5">
                      {dict.fromAyahLabel}
                    </label>
                    <select
                      value={ayahFrom}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setAyahFrom(val);
                        if (val > ayahTo) setAyahTo(val);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#D5C7B2] text-xs font-mono-tabular text-[#161E19] focus:outline-none focus:border-[#96701E] cursor-pointer"
                    >
                      {Array.from({ length: maxAyahs }, (_, i) => i + 1).map((num) => (
                        <option key={num} value={num}>
                          {lang === 'ar' ? `الآية ${num}` : `Ayah ${num}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#4B5650] mb-0.5">
                      {dict.toAyahLabel}
                    </label>
                    <select
                      value={ayahTo}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setAyahTo(val);
                        if (val < ayahFrom) setAyahFrom(val);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#D5C7B2] text-xs font-mono-tabular text-[#161E19] focus:outline-none focus:border-[#96701E] cursor-pointer"
                    >
                      {Array.from({ length: maxAyahs }, (_, i) => i + 1).map((num) => (
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
            <div className="pt-1.5 border-t border-[#C5CEBF] flex items-center justify-between text-xs text-[#4B5650]">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#96701E]" />
                <span>{dict.colMetrics}:</span>
              </span>
              <div className="font-mono-tabular font-semibold text-[#161E19]">
                <span>
                  {estimatedAyahs} {dict.ayahsUnit}
                </span>
                <span className="mx-1 text-[#6A766E]">·</span>
                <span>
                  ~{estimatedPages} {dict.pagesUnit}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Compact Row: Reminder Time, Mistakes, and Notes */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF]">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-[#161E19] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#96701E]" />
                  <span>{dict.reminderTimeLabel}</span>
                </label>
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  title={dict.enableReminderLabel}
                  className="rounded border-[#96701E] text-[#96701E] focus:ring-[#96701E] cursor-pointer"
                />
              </div>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full px-2 py-1 rounded-lg bg-[#FFFFFF] border border-[#D5C7B2] text-xs font-mono-tabular text-[#161E19] focus:outline-none focus:border-[#96701E]"
              />
              {planType === 'new_memorization' && (
                <span className="text-[10px] text-[#6A766E] block mt-1 leading-tight">
                  {lang === 'ar' ? 'تنبيه بصري هادئ (الصوت ملغى للحفظ)' : 'Silent alert (no chime)'}
                </span>
              )}
            </div>

            <div className="p-2.5 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF]">
              <label className="block text-[11px] font-bold text-[#161E19] mb-1">
                {dict.mistakesLabel}
              </label>
              <input
                type="number"
                min={0}
                max={99}
                value={mistakesCount}
                onChange={(e) => setMistakesCount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-2 py-1 rounded-lg bg-[#FFFFFF] border border-[#D5C7B2] text-xs font-mono-tabular text-[#161E19] focus:outline-none focus:border-[#96701E]"
              />
            </div>

            <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF]">
              <label className="block text-[11px] font-bold text-[#161E19] mb-1">
                {dict.notesLabel}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={dict.notesPlaceholder}
                className="w-full px-2 py-1 rounded-lg bg-[#FFFFFF] border border-[#D5C7B2] text-xs text-[#161E19] placeholder-[#6A766E] focus:outline-none focus:border-[#96701E]"
              />
            </div>
          </div>

          {/* Weekly Recurrence Option (تكرار الخطة أسبوعياً) */}
          <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF] hover:border-[#96701E]/60 transition-colors cursor-pointer select-none">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#96701E]/15 text-[#96701E]">
                <Repeat className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="block text-xs font-bold text-[#0E5C3E]">
                  {dict.repeatWeeklyLabel}
                </span>
                <span className="block text-[11px] text-[#6A766E]">
                  {dict.repeatWeeklyHint}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={repeatWeekly}
              onChange={(e) => setRepeatWeekly(e.target.checked)}
              className="w-4 h-4 rounded border-[#96701E] text-[#96701E] focus:ring-[#96701E] cursor-pointer"
            />
          </label>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#C5CEBF]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-[#D5C7B2] text-xs font-semibold text-[#4B5650] hover:bg-[#EAF0E7] transition-colors cursor-pointer"
            >
              {dict.cancelBtn}
            </button>
            <button
              type="submit"
              className="mustard-gradient-btn px-5 py-1.5 rounded-xl text-xs font-bold text-[#FFFFFF] shadow-2xs transition-all cursor-pointer"
            >
              {editingPlan ? dict.updatePlanBtn : dict.savePlanBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
