import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Check,
  Edit3,
  Trash2,
  Clock,
  Calendar,
  Search,
  Globe,
  Bell,
  Copy,
  RotateCcw,
  Mic,
  Repeat,
  HelpCircle,
  ExternalLink,
  BookOpen,
  Home,
  BarChart3,
  Settings,
  X,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import {
  Language,
  PlanType,
  DayId,
  QuranPlanItem,
  QuizLevel,
  WEEK_DAYS,
  INITIAL_PLANS,
  getTodayDayId,
  formatCurriculumTitle,
  getPlanTypeLabel,
  getScopeLabel,
} from './data/quranData';
import { t } from './data/translations';
import { PlanModal } from './components/PlanModal';
import { AnalyticsSection } from './components/AnalyticsSection';
import { RemindersSection } from './components/RemindersSection';
import { SardMushafView } from './components/SardMushafView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { getDualDate, getCompactDualDate } from './utils/calendar';
import { memoryManager } from './utils/memoryCleanup';

const STORAGE_KEY_PLANS = 'mishkat_sard_user_plans_v2';
const STORAGE_KEY_LANG = 'mishkat_sard_lang_v1';
const STORAGE_KEY_FOCUS_MODE = 'alutrujjah_focus_mode';

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LANG);
    return saved === 'en' || saved === 'ar' ? saved : 'ar';
  });

  const [plans, setPlans] = useState<QuranPlanItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PLANS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback to empty INITIAL_PLANS
    }
    return INITIAL_PLANS;
  });

  const [activeSection, setActiveSection] = useState<
    'schedule' | 'today' | 'analytics' | 'reminders'
  >('schedule');
  const [expandedSardPlanId, setExpandedSardPlanId] = useState<string | null>(null);
  const [focusModeEnabled, setFocusModeEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_FOCUS_MODE) === 'true';
    } catch {
      return false;
    }
  });
  const [filterType, setFilterType] = useState<'all' | PlanType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalInitialDay, setModalInitialDay] = useState<DayId | undefined>(undefined);
  const [editingPlan, setEditingPlan] = useState<QuranPlanItem | null>(null);

  // Notifications & Global Settings state
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [activeToast, setActiveToast] = useState<{ title: string; body: string } | null>(null);
  const lastNotifiedMinuteRef = useRef<string>('');

  // Unified Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [defaultSyncSpeed, setDefaultSyncSpeed] = useState<number>(1.0);
  const [defaultTargetReps, setDefaultTargetReps] = useState<number>(5);
  const [defaultQuizLevel, setDefaultQuizLevel] = useState<QuizLevel>('intermediate');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState<boolean>(false);
  const [ramCleanupMessage, setRamCleanupMessage] = useState<string | null>(null);

  const dict = t(lang);
  const todayId = getTodayDayId();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem(STORAGE_KEY_LANG, lang);
  }, [lang]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(plans));
    } catch {
      // Ignore storage quota errors
    }
  }, [plans]);

  const chimeAudioCtxRef = useRef<AudioContext | null>(null);

  const stopChimeAudio = () => {
    if (chimeAudioCtxRef.current) {
      try {
        chimeAudioCtxRef.current.close();
      } catch {
        // Ignore
      }
      chimeAudioCtxRef.current = null;
    }
  };

  const playGentleChime = () => {
    // Never play reminder sound if muted OR during an active Sard / plan session
    if (!soundEnabled || expandedSardPlanId) return;
    try {
      stopChimeAudio();
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      chimeAudioCtxRef.current = ctx;
      const now = ctx.currentTime;

      const freqs = [528, 660, 792];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.14);
        gain.gain.setValueAtTime(0.001, now + idx * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.14 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 1.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.14);
        osc.stop(now + idx * 0.14 + 1.15);
      });
    } catch {
      // AudioContext blocked or unsupported
    }
  };

  const triggerReminderNotification = (customPlan?: QuranPlanItem) => {
    // Suppress reminder audio during active Sard / plan sessions
    if (!expandedSardPlanId) {
      playGentleChime();
    }
    const title = dict.notificationTestTitle;
    const body = customPlan
      ? `${getPlanTypeLabel(customPlan.planType, lang)}: ${formatCurriculumTitle(
          customPlan,
          lang
        )} (${customPlan.estimatedAyahs} ${dict.ayahsUnit})`
      : dict.notificationTestBody;

    if (!expandedSardPlanId) {
      setActiveToast({ title, body });
    }

    if (
      !expandedSardPlanId &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(title, { body });
      } catch {
        // Ignore browser notification error inside sandboxed iframe
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      // Do not trigger reminder sounds or alerts during an active Sard session
      if (expandedSardPlanId) return;

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const currentHM = `${hh}:${mm}`;

      if (lastNotifiedMinuteRef.current === currentHM) return;

      const currentDayId = getTodayDayId();
      const duePlan = plans.find(
        (p) =>
          p.day === currentDayId &&
          p.reminderEnabled &&
          p.status !== 'completed' &&
          p.reminderTime === currentHM
      );

      if (duePlan) {
        lastNotifiedMinuteRef.current = currentHM;
        triggerReminderNotification(duePlan);
      }
    }, 25000);

    return () => clearInterval(interval);
  }, [plans, lang, soundEnabled, expandedSardPlanId]);

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        triggerReminderNotification();
      }
    } catch {
      triggerReminderNotification();
    }
  };

  const handleOpenPlanScreen = (planId: string) => {
    stopChimeAudio();
    setActiveToast(null);
    setExpandedSardPlanId(planId);
    try {
      window.history.pushState({ planId }, '', `#plan-${planId}`);
    } catch {
      // Ignore history pushState restriction in sandboxed iframe
    }
  };

  const handleClosePlanScreen = () => {
    setExpandedSardPlanId(null);
    try {
      if (window.location.hash.startsWith('#plan-')) {
        window.history.pushState(null, '', window.location.pathname + window.location.search);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    const onPopState = () => {
      if (!window.location.hash.startsWith('#plan-')) {
        setExpandedSardPlanId(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Explicit completion handler triggered ONLY when user explicitly clicks Finish Plan & Records Date
  const handleCompletePlanSard = (
    planId: string,
    recordedMistakes: number,
    completedAtDate: string,
    quizLevel?: QuizLevel
  ) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              status: 'completed',
              completedAt: completedAtDate,
              quizLevel: quizLevel || p.quizLevel,
              mistakesCount: (p.mistakesCount || 0) + recordedMistakes,
            }
          : p
      )
    );
    handleClosePlanScreen();
  };

  const handleOpenAddModal = (day?: DayId) => {
    setEditingPlan(null);
    setModalInitialDay(day || todayId);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (plan: QuranPlanItem) => {
    setEditingPlan(plan);
    setModalInitialDay(plan.day);
    setIsModalOpen(true);
  };

  const handleSavePlans = (
    newPlansData: Omit<QuranPlanItem, 'id' | 'createdAt'>[],
    editingId?: string
  ) => {
    if (editingId && newPlansData.length > 0) {
      const updatedFields = newPlansData[0];
      setPlans((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                ...updatedFields,
              }
            : item
        )
      );
    } else {
      const createdItems: QuranPlanItem[] = newPlansData.map((data, index) => ({
        ...data,
        id: `plan-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      }));
      setPlans((prev) => [...prev, ...createdItems]);
    }
  };

  const handleDeletePlan = (id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    if (expandedSardPlanId === id) {
      setExpandedSardPlanId(null);
    }
  };

  const handleDuplicatePlan = (plan: QuranPlanItem) => {
    const copy: QuranPlanItem = {
      ...plan,
      id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'pending',
      completedAt: undefined,
      evaluation: undefined,
      createdAt: new Date().toISOString(),
    };
    setPlans((prev) => [...prev, copy]);
  };

  const handleToggleStatus = (id: string) => {
    const todayDual = getDualDate(new Date(), lang);
    const dateFormatted = `${todayDual.hijriDate} · ${todayDual.gregorianDate}`;
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const willBeCompleted = p.status !== 'completed';
          return {
            ...p,
            status: willBeCompleted ? 'completed' : 'pending',
            completedAt: willBeCompleted ? (p.completedAt || dateFormatted) : undefined,
          };
        }
        return p;
      })
    );
  };

  const handleTogglePlanReminder = (id: string) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, reminderEnabled: !p.reminderEnabled } : p))
    );
  };

  const handleUpdatePlanReminderTime = (id: string, newTime: string) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, reminderTime: newTime } : p))
    );
  };

  const handleResetCompletion = () => {
    setPlans((prev) => prev.map((p) => ({ ...p, status: 'pending', completedAt: undefined })));
  };

  const getPlanPracticeButtonMeta = (type: PlanType) => {
    if (type === 'sard') {
      return { label: dict.openSardBtn, Icon: Mic };
    }
    if (type === 'new_memorization') {
      return { label: dict.openRepeatBtn, Icon: Repeat };
    }
    return { label: dict.openTestBtn, Icon: HelpCircle };
  };

  const handleManualRamCleanup = () => {
    memoryManager.runFullCleanup();
    setRamCleanupMessage(dict.cleanRamSuccess);
    setTimeout(() => {
      setRamCleanupMessage(null);
    }, 4000);
  };

  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      if (activeSection === 'today' && plan.day !== todayId) return false;
      if (filterType !== 'all' && plan.planType !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleAr = formatCurriculumTitle(plan, 'ar').toLowerCase();
        const titleEn = formatCurriculumTitle(plan, 'en').toLowerCase();
        const noteText = (plan.notes || '').toLowerCase();
        if (!titleAr.includes(q) && !titleEn.includes(q) && !noteText.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [plans, activeSection, todayId, filterType, searchQuery]);

  const visibleDays = useMemo(() => {
    if (activeSection === 'today') {
      return WEEK_DAYS.filter((d) => d.id === todayId);
    }
    return WEEK_DAYS;
  }, [activeSection, todayId]);

  const todayInfo = WEEK_DAYS.find((d) => d.id === todayId) || WEEK_DAYS[0];
  const todayPlansCount = plans.filter((p) => p.day === todayId).length;
  const todayCompletedCount = plans.filter(
    (p) => p.day === todayId && p.status === 'completed'
  ).length;
  const todayDual = useMemo(() => getDualDate(new Date(), lang), [lang]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F3EB] text-[#261C14] islamic-pattern-subtle">
      {/* Fixed/Sticky Top Header */}
      <header
        dir="rtl"
        className="sticky top-0 z-30 bg-[#FFFDF9]/95 backdrop-blur-md border-b border-[#DDD2BE] shadow-xs"
      >
        {/* Row 1: Top Brand Row — "الأترجة" Logo, Pure Date, PWA Install, Settings — strictly on the same level across all devices */}
        <div className="w-full max-w-[1400px] mx-auto px-2.5 sm:px-6 lg:px-8 py-2 sm:py-2.5 flex items-center justify-between gap-1.5 sm:gap-3 flex-nowrap">
          {/* Right: Elegant "الأترجة" Emblem Logo & Title */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            <a
              href="#schedule"
              onClick={(e) => {
                e.preventDefault();
                setActiveSection('schedule');
              }}
              className="flex items-center gap-2 sm:gap-3 shrink-0 group cursor-pointer focus:outline-none"
              title={dict.brandTitle}
            >
              {/* Distinctive & Clear Utrujjah Medallion Emblem */}
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-[#1C1610] via-[#2D2218] to-[#4A3828] border-2 border-[#EAB338] shadow-md flex items-center justify-center relative overflow-hidden group-hover:scale-105 group-hover:border-[#F6D365] transition-all shrink-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#EAB338]/20 via-transparent to-transparent pointer-events-none" />
                <svg
                  className="w-5 h-5 sm:w-7 sm:h-7 text-[#EAB338]"
                  viewBox="0 0 36 36"
                  fill="none"
                  aria-hidden="true"
                >
                  {/* Islamic 8-point geometric star (Rub el Hizb) */}
                  <rect
                    x="7"
                    y="7"
                    width="22"
                    height="22"
                    rx="3"
                    stroke="#EAB338"
                    strokeWidth="1.6"
                    strokeOpacity="0.85"
                  />
                  <rect
                    x="7"
                    y="7"
                    width="22"
                    height="22"
                    rx="3"
                    transform="rotate(45 18 18)"
                    stroke="#EAB338"
                    strokeWidth="1.6"
                    strokeOpacity="0.85"
                  />
                  {/* Inner glowing citrus medallion */}
                  <path
                    d="M18 9 C22 12, 23.5 15.5, 23.5 18.8 C23.5 22.3 21 25.2 18 26.5 C15 25.2 12.5 22.3 12.5 18.8 C12.5 15.5 14 12, 18 9 Z"
                    fill="#EAB338"
                    fillOpacity="0.35"
                    stroke="#EAB338"
                    strokeWidth="1.6"
                  />
                  <circle cx="18" cy="18" r="2.2" fill="#EAB338" />
                </svg>
              </div>

              {/* Bold Brand Name & Subtitle */}
              <div className="flex flex-col min-w-0">
                <span className="text-xl sm:text-2xl md:text-3xl font-extrabold font-display-islamic leading-none text-[#2D2218] tracking-tight truncate">
                  {dict.brandTitle}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-[#8B6514] tracking-normal mt-0.5 hidden md:block">
                  {dict.brandSubtitle}
                </span>
              </div>
            </a>
          </div>

          {/* Left Action Strip: Pure Date Badge, Prominent PWA Install, Settings — All on the exact same row! */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 ms-auto flex-nowrap">
            {/* Pure Date Display (التاريخ الهجري والميلادي فقط بدون تقويم) */}
            <div
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-[#2D2218] shadow-2xs font-mono-tabular shrink-0 select-none"
              title={dict.todayDateLabel}
            >
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C88A14] shrink-0" />
              <div className="flex flex-col text-start leading-tight">
                <span className="font-bold text-[#2D2218] text-[10px] sm:text-xs whitespace-nowrap">
                  {todayDual.hijriDate}
                </span>
                <span className="text-[9px] sm:text-[10px] text-[#84715E] font-medium whitespace-nowrap">
                  {todayDual.gregorianDate}
                </span>
              </div>
            </div>

            {/* Prominent PWA Install Button (تثبيت التطبيق على مختلف المتصفحات) */}
            <PWAInstallButton lang={lang} variant="header" />

            {/* Today's count badge (hidden on smaller phones to keep line pristine) */}
            <span className="hidden lg:inline-block text-xs font-mono-tabular font-semibold text-[#84715E] bg-[#F7F3EB] px-2.5 py-1.5 rounded-xl border border-[#E5DEC9] shrink-0">
              {lang === 'ar' ? todayInfo.nameAr : todayInfo.shortEn} · {todayCompletedCount}/
              {todayPlansCount}
            </span>

            {/* Settings Button (رمز الإعدادات على نفس المستوى تماماً) */}
            <button
              type="button"
              onClick={() => {
                setConfirmDeleteAll(false);
                setIsSettingsOpen(true);
              }}
              title={lang === 'ar' ? 'الإعدادات' : 'Settings'}
              className="p-1.5 sm:p-2 rounded-xl bg-[#F7F3EB] hover:bg-[#EFE9DC] border border-[#DDD2BE] hover:border-[#C88A14] text-[#2D2218] transition-all cursor-pointer flex items-center justify-center shadow-2xs shrink-0"
            >
              <Settings className="w-4 h-4 text-[#C88A14]" />
            </button>
          </div>
        </div>

        {/* Row 2: Fixed Horizontal Navigation Menu Underneath the Logo — 4 Equal Columns, Zero Horizontal Scroll, Labels Underneath Icons */}
        <div className="bg-[#F7F3EB]/95 border-t border-[#E5DEC9]">
          <div className="max-w-[1360px] mx-auto px-2 sm:px-6 lg:px-8 py-1">
            <nav className="grid grid-cols-4 gap-1.5 sm:gap-3 w-full">
              {(
                [
                  { id: 'schedule', label: dict.navSchedule, Icon: Home },
                  { id: 'today', label: dict.navToday, Icon: BookOpen },
                  { id: 'analytics', label: dict.navAnalytics, Icon: BarChart3 },
                  { id: 'reminders', label: dict.navReminders, Icon: Bell },
                ] as const
              ).map((nav) => {
                const NavIcon = nav.Icon;
                const isActive = activeSection === nav.id;
                return (
                  <button
                    key={nav.id}
                    type="button"
                    onClick={() => setActiveSection(nav.id)}
                    className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#2D2218] text-[#EAB338] shadow-2xs'
                        : 'text-[#5C4B3B] hover:text-[#261C14] hover:bg-[#EFE9DC]/80'
                    }`}
                  >
                    <NavIcon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#EAB338]' : 'text-[#C88A14]'
                      }`}
                    />
                    <span className="leading-none truncate max-w-full">{nav.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* In-App Reminder Notification Banner when triggered */}
      {activeToast && (
        <div className="bg-[#2D2218] text-[#FFFDF9] border-b border-[#C88A14] px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <Bell className="w-4 h-4 text-[#EAB338] shrink-0" />
            <div>
              <span className="font-bold text-[#EAB338]">{activeToast.title}</span>
              <span className="mx-2 text-[#84715E]">·</span>
              <span>{activeToast.body}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveToast(null)}
            className="px-2.5 py-1 rounded-md bg-white/10 text-xs hover:bg-white/20 transition-colors cursor-pointer shrink-0"
          >
            {lang === 'ar' ? 'إغلاق' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-2.5 sm:px-5 lg:px-6 py-2.5 sm:py-4 space-y-3">
        {/* Compact Hero & Quick Action Strip */}
        {(activeSection === 'schedule' || activeSection === 'today') && (
          <section className="earthy-gradient-banner rounded-xl sm:rounded-2xl px-3.5 py-2.5 sm:px-5 sm:py-3 text-[#FFFDF9] relative overflow-hidden border border-[#8F681E]/40 shadow-2xs flex items-center justify-between gap-3">
            <div className="relative z-10 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <h1 className="text-base sm:text-lg font-bold font-display-islamic leading-snug text-[#FFFDF9]">
                {dict.heroTitle}
              </h1>
              <p className="text-[11px] sm:text-xs text-[#E6D7BE]">
                {dict.heroSubtitle}
              </p>
            </div>

            <div className="relative z-10 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenAddModal(todayId)}
                className="mustard-gradient-btn px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold text-[#FFFDF9] shadow-2xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{dict.addPlanBtn}</span>
              </button>
            </div>
          </section>
        )}

        {/* SCHEDULE & TODAY VIEW */}
        {(activeSection === 'schedule' || activeSection === 'today') && (
          <section className="space-y-3">
            {/* Schedule Controls & Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#FFFDF9] p-2 rounded-xl border border-[#DDD2BE]">
              <div className="grid grid-cols-4 gap-1 p-0.5 bg-[#F7F3EB] rounded-lg border border-[#E5DEC9]">
                {(
                  [
                    { id: 'all', label: dict.filterAll },
                    { id: 'sard', label: dict.typeSard },
                    { id: 'new_memorization', label: dict.typeNewMem },
                    { id: 'review', label: dict.typeReview },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterType(tab.id)}
                    className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer text-center whitespace-nowrap ${
                      filterType === tab.id
                        ? 'bg-[#2D2218] text-[#FFFDF9] shadow-2xs'
                        : 'text-[#5C4B3B] hover:text-[#261C14]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[150px] sm:w-56">
                  <Search className="w-3.5 h-3.5 text-[#84715E] absolute top-1/2 -translate-y-1/2 start-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={dict.searchPlaceholder}
                    className="w-full ps-8 pe-2.5 py-1 rounded-lg bg-[#F7F3EB] border border-[#DDD2BE] text-xs text-[#261C14] placeholder-[#84715E] focus:outline-none focus:border-[#C88A14]"
                  />
                </div>



                <button
                  type="button"
                  onClick={handleResetCompletion}
                  title={dict.clearCompletedBtn}
                  className="p-1.5 rounded-lg border border-[#DDD2BE] text-[#5C4B3B] hover:text-[#261C14] hover:bg-[#EFE9DC] transition-colors cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* UNIFIED SCHEDULE PATTERN (النمط الموحد لجدول السرد والخطط على مختلف الأجهزة) */}
              <div className="space-y-3.5 sm:space-y-4 w-full">
                {visibleDays.map((day) => {
                  const dayPlans = filteredPlans
                    .filter((p) => p.day === day.id)
                    .sort((a, b) => a.reminderTime.localeCompare(b.reminderTime));
                  const isToday = day.id === todayId;
                  const doneCount = dayPlans.filter((p) => p.status === 'completed').length;
                  const dayDual = getCompactDualDate(day.id, lang);

                  return (
                    <div
                      key={day.id}
                      className={`rounded-2xl bg-[#FFFDF9] border overflow-hidden shadow-2xs transition-all ${
                        isToday ? 'border-[#C88A14] ring-1 ring-[#C88A14]/30' : 'border-[#DDD2BE]'
                      }`}
                    >
                      {/* Day Header Bar */}
                      <div
                        className={`px-3.5 py-2.5 border-b flex items-center justify-between gap-2 ${
                          isToday
                            ? 'bg-[#2D2218] text-[#FFFDF9] border-[#2D2218]'
                            : 'bg-[#F7F3EB] text-[#261C14] border-[#DDD2BE]'
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <span className="font-bold font-display-islamic text-sm sm:text-base">
                            {lang === 'ar' ? day.nameAr : day.nameEn}
                          </span>
                          {isToday && (
                            <span className="text-[11px] font-semibold text-[#EAB338] bg-[#EAB338]/20 px-2 py-0.5 rounded-md border border-[#EAB338]/30">
                              {dict.todayBadge}
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-mono-tabular ${
                              isToday ? 'text-[#E6D7BE]' : 'text-[#84715E]'
                            }`}
                          >
                            {dayDual.hijri} · {dayDual.greg}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-mono-tabular font-semibold ${
                              isToday ? 'text-[#E6D7BE]' : 'text-[#84715E]'
                            }`}
                          >
                            {doneCount}/{dayPlans.length} {lang === 'ar' ? 'مكتمل' : 'done'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenAddModal(day.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                              isToday
                                ? 'bg-[#C88A14] hover:bg-[#B3780C] text-[#FFFDF9]'
                                : 'bg-[#EFE9DC] hover:bg-[#E5DEC9] text-[#9E6A0C]'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{dict.addAnotherForDay}</span>
                          </button>
                        </div>
                      </div>

                      {/* Vertical Stream of Plans */}
                      <div className="divide-y divide-[#EFE9DC]">
                        {dayPlans.length === 0 ? (
                          <div className="py-4 px-4 text-center text-xs text-[#84715E]">
                            {dict.noPlansForDay}
                          </div>
                        ) : (
                          dayPlans.map((plan) => {
                            const isCompleted = plan.status === 'completed';
                            const { label: practiceLabel, Icon: PracticeIcon } =
                              getPlanPracticeButtonMeta(plan.planType);

                            return (
                              <div
                                key={plan.id}
                                className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#F7F3EB]/40 transition-colors"
                              >
                                {/* Left/Start: Type badge, scope, timing, curriculum, volume, completion date */}
                                <div className="flex-1 space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                    <span
                                      className={`font-bold px-2 py-0.5 rounded-md ${
                                        plan.planType === 'new_memorization'
                                          ? 'bg-[#4A6144]/15 text-[#4A6144] border border-[#4A6144]/25'
                                          : plan.planType === 'sard'
                                          ? 'bg-[#C88A14]/15 text-[#9E650C] border border-[#C88A14]/25'
                                          : 'bg-[#9C4A32]/15 text-[#9C4A32] border border-[#9C4A32]/25'
                                      }`}
                                    >
                                      {getPlanTypeLabel(plan.planType, lang)}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded-md bg-[#EFE9DC] text-[#5C4B3B] text-[11px] font-medium">
                                      {getScopeLabel(plan.scope, lang)}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded-md bg-[#EFE9DC] text-[#5C4B3B] text-[11px] font-mono-tabular flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-[#84715E]" />
                                      <span>{plan.reminderTime}</span>
                                    </span>
                                    {plan.repeatWeekly && (
                                      <span className="inline-flex items-center gap-1 text-[11px] text-[#9E6A0C] font-semibold bg-[#C88A14]/10 px-2 py-0.5 rounded-md border border-[#C88A14]/20">
                                        <Repeat className="w-3 h-3 text-[#C88A14]" />
                                        <span>{dict.repeatWeeklyBadge}</span>
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4
                                      className={`text-base font-bold text-[#261C14] font-display-islamic ${
                                        isCompleted ? 'line-through opacity-60' : ''
                                      }`}
                                    >
                                      {formatCurriculumTitle(plan, lang)}
                                    </h4>
                                    <span className="text-xs text-[#84715E] font-mono-tabular">
                                      · {plan.estimatedAyahs} {dict.ayahsUnit} (~{plan.estimatedPages} {dict.pagesUnit})
                                    </span>
                                    {isCompleted && plan.completedAt && (
                                      <span className="text-[11px] font-mono-tabular text-[#4A6144] bg-[#4A6144]/10 px-2 py-0.5 rounded-md border border-[#4A6144]/20 inline-flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-[#4A6144]" />
                                        <span>{dict.completedAtLabel}: {plan.completedAt}</span>
                                      </span>
                                    )}
                                  </div>

                                  {plan.notes && (
                                    <p className="text-xs text-[#84715E] line-clamp-1">{plan.notes}</p>
                                  )}
                                </div>

                                {/* Right/End: Practice button, Status button, Actions */}
                                <div className="flex items-center justify-between md:justify-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#EFE9DC]">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenPlanScreen(plan.id)}
                                      className="mustard-gradient-btn text-white px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap flex items-center gap-1.5 shadow-2xs hover:brightness-105 transition-all"
                                    >
                                      <PracticeIcon className="w-3.5 h-3.5" />
                                      <span>{practiceLabel}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleToggleStatus(plan.id)}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                                        isCompleted
                                          ? 'bg-[#4A6144] text-white'
                                          : 'bg-[#EFE9DC] hover:bg-[#DDD2BE] text-[#5C4B3B]'
                                      }`}
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>{isCompleted ? dict.markCompleted : dict.statusPending}</span>
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditModal(plan)}
                                      className="p-1.5 rounded-lg text-[#5C4B3B] hover:text-[#261C14] hover:bg-[#EFE9DC] transition-colors cursor-pointer"
                                      title={dict.editPlan}
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDuplicatePlan(plan)}
                                      className="p-1.5 rounded-lg text-[#5C4B3B] hover:text-[#261C14] hover:bg-[#EFE9DC] transition-colors cursor-pointer"
                                      title={dict.duplicatePlan}
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePlan(plan.id)}
                                      className="p-1.5 rounded-lg text-[#A84A32] hover:bg-[#A84A32]/10 transition-colors cursor-pointer"
                                      title={dict.deletePlan}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
          </section>
        )}

        {/* ANALYTICS DEDICATED VIEW */}
        {activeSection === 'analytics' && <AnalyticsSection plans={plans} lang={lang} />}

        {/* REMINDERS DEDICATED VIEW */}
        {activeSection === 'reminders' && (
          <RemindersSection
            plans={plans}
            lang={lang}
            notificationPermission={notificationPermission}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            onRequestPermission={handleRequestPermission}
            onTriggerTestReminder={triggerReminderNotification}
            onTogglePlanReminder={handleTogglePlanReminder}
            onUpdatePlanReminderTime={handleUpdatePlanReminderTime}
          />
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="mt-4 border-t border-[#DDD2BE] bg-[#EFE9DC]/60 py-2.5 px-4 text-center text-[11px] text-[#84715E]">
        <span>{dict.brandTitle}</span>
        <span className="mx-1.5">·</span>
        <span>{dict.brandSubtitle}</span>
      </footer>

      {/* Add / Edit Plan Modal */}
      <PlanModal
        isOpen={isModalOpen}
        lang={lang}
        initialDay={modalInitialDay}
        editingPlan={editingPlan}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePlans}
      />

      {/* Unified All-Settings Modal (نافذة الإعدادات) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/55 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-[#FFFDF9] border-2 border-[#C88A14]/60 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 earthy-gradient-banner text-[#FFFDF9] flex items-center justify-between border-b border-[#C88A14]/40">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#EAB338]" />
                <h2 className="text-base font-bold font-display-islamic">
                  {lang === 'ar' ? 'الإعدادات' : 'Settings'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#FFFDF9] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3 text-xs sm:text-sm">
              {/* 1. Language & Schedule Layout */}
              <div className="p-3 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] space-y-2.5">
                <h3 className="font-bold text-[#2D2218] flex items-center gap-1.5 text-xs">
                  <Globe className="w-3.5 h-3.5 text-[#C88A14]" />
                  <span>{lang === 'ar' ? 'اللغة والعرض' : 'Language & View'}</span>
                </h3>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <div className="text-[11px] text-[#5C4B3B] mb-1 font-semibold">
                      {lang === 'ar' ? 'اللغة' : 'Language'}
                    </div>
                    <div className="flex gap-1 p-0.5 rounded-lg bg-[#EFE9DC] border border-[#DDD2BE]">
                      <button
                        type="button"
                        onClick={() => setLang('ar')}
                        className={`flex-1 py-1 rounded-md text-xs font-bold cursor-pointer ${
                          lang === 'ar'
                            ? 'bg-[#2D2218] text-[#EAB338]'
                            : 'text-[#5C4B3B] hover:text-[#261C14]'
                        }`}
                      >
                        العربية
                      </button>
                      <button
                        type="button"
                        onClick={() => setLang('en')}
                        className={`flex-1 py-1 rounded-md text-xs font-bold cursor-pointer ${
                          lang === 'en'
                            ? 'bg-[#2D2218] text-[#EAB338]'
                            : 'text-[#5C4B3B] hover:text-[#261C14]'
                        }`}
                      >
                        English
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Focus Mode & Device Integration */}
              <div className="p-3 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] space-y-3">
                {/* Prominent Focus Mode Setting */}
                <div className={`p-3 rounded-xl border transition-all ${
                  focusModeEnabled
                    ? 'bg-[#F0F6EE] border-[#88B87E]'
                    : 'bg-[#FFFDF9] border-[#DDD2BE]'
                }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-lg ${
                          focusModeEnabled ? 'bg-[#4A6144] text-white' : 'bg-[#EFE9DC] text-[#C88A14]'
                        }`}>
                          <Eye className="w-4 h-4" />
                        </span>
                        <div>
                          <span className="font-bold text-[#2D2218] text-xs sm:text-sm block">
                            {dict.focusModeSettingTitle}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full inline-block ${
                            focusModeEnabled
                              ? 'bg-[#4A6144] text-white'
                              : 'bg-[#EFE9DC] text-[#84715E]'
                          }`}>
                            {focusModeEnabled ? dict.focusModeActive : dict.focusModeDisabled}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#5C4B3B] leading-relaxed">
                        {dict.focusModeSettingDesc}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const next = !focusModeEnabled;
                        setFocusModeEnabled(next);
                        localStorage.setItem('alutrujjah_focus_mode', String(next));
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        focusModeEnabled ? 'bg-[#4A6144]' : 'bg-[#DDD2BE]'
                      }`}
                      role="switch"
                      aria-checked={focusModeEnabled}
                      title={dict.focusModeSettingTitle}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          focusModeEnabled ? (lang === 'ar' ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Pure Date Display (التاريخ فقط) */}
                <div className="pt-2.5 border-t border-[#DDD2BE] flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="font-bold text-[#2D2218] flex items-center gap-1.5 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-[#C88A14]" />
                      <span>{dict.todayDateLabel}</span>
                    </span>
                    <p className="text-[11px] font-mono-tabular text-[#5C4B3B]">{todayDual.hijriDate} · {todayDual.gregorianDate}</p>
                  </div>
                </div>
              </div>

              {/* 2. Recitation, Repetition & Review Quiz Defaults */}
              <div className="p-3 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] space-y-2.5">
                <h3 className="font-bold text-[#2D2218] flex items-center gap-1.5 text-xs">
                  <Mic className="w-3.5 h-3.5 text-[#C88A14]" />
                  <span>
                    {lang === 'ar' ? 'السرد والحفظ والاختبار' : 'Recitation & Quiz'}
                  </span>
                </h3>

                <div>
                  <div className="text-[11px] text-[#5C4B3B] mb-1 font-semibold">
                    {lang === 'ar' ? 'سرعة المحاذاة' : 'Sync Speed'}
                  </div>
                  <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[#EFE9DC] border border-[#DDD2BE]">
                    {(
                      [
                        { factor: 0.72, labelAr: 'ترتيل', labelEn: 'Slow' },
                        { factor: 1.0, labelAr: 'طبيعي', labelEn: 'Normal' },
                        { factor: 1.32, labelAr: 'حدر', labelEn: 'Fast' },
                      ] as const
                    ).map((s) => (
                      <button
                        key={s.factor}
                        type="button"
                        onClick={() => setDefaultSyncSpeed(s.factor)}
                        className={`py-1 rounded-md text-xs font-bold cursor-pointer ${
                          defaultSyncSpeed === s.factor
                            ? 'bg-[#2D2218] text-[#EAB338]'
                            : 'text-[#5C4B3B]'
                        }`}
                      >
                        {lang === 'ar' ? s.labelAr : s.labelEn}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <div className="text-[11px] text-[#5C4B3B] mb-1 font-semibold">
                      {lang === 'ar' ? 'تكرار الحفظ' : 'Repetitions'}
                    </div>
                    <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-[#EFE9DC] border border-[#DDD2BE]">
                      {[3, 5, 7, 10].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setDefaultTargetReps(r)}
                          className={`py-1 rounded-md text-xs font-mono-tabular font-bold cursor-pointer ${
                            defaultTargetReps === r
                              ? 'bg-[#C88A14] text-[#FFFDF9]'
                              : 'text-[#5C4B3B]'
                          }`}
                        >
                          {r}×
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-[#5C4B3B] mb-1 font-semibold">
                      {lang === 'ar' ? 'مستوى الاختبار' : 'Quiz Level'}
                    </div>
                    <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-[#EFE9DC] border border-[#DDD2BE]">
                      {(
                        [
                          { id: 'beginner', labelAr: 'مبتدئ', labelEn: 'Easy' },
                          { id: 'intermediate', labelAr: 'متوسط', labelEn: 'Med' },
                          { id: 'advanced', labelAr: 'متقدم', labelEn: 'Adv' },
                          { id: 'hafiz', labelAr: 'حافظ', labelEn: 'Hafiz' },
                        ] as const
                      ).map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => setDefaultQuizLevel(lvl.id)}
                          className={`py-1 px-1 rounded-md text-[11px] font-bold cursor-pointer truncate ${
                            defaultQuizLevel === lvl.id
                              ? 'bg-[#2D2218] text-[#EAB338]'
                              : 'text-[#5C4B3B]'
                          }`}
                        >
                          {lang === 'ar' ? lvl.labelAr : lvl.labelEn}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Automatic & User Device RAM Cleanup (تنظيف الذاكرة العشوائية للجهاز والمستخدم) */}
              <div className="p-3 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] space-y-2">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-[#2D2218] flex items-center gap-1.5 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-[#C88A14]" />
                    <span>
                      {lang === 'ar'
                        ? 'تنظيف الذاكرة العشوائية (RAM) وموارد الجهاز'
                        : 'Device RAM & Resource Cleanup'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#5C4B3B] leading-relaxed">
                    {dict.autoCleanRamNote}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#DDD2BE]/70 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleManualRamCleanup}
                    className="px-3 py-1.5 rounded-lg bg-[#EFE9DC] hover:bg-[#DDD2BE] text-[#2D2218] text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#C88A14]" />
                    <span>{dict.cleanRamBtn}</span>
                  </button>
                  {ramCleanupMessage && (
                    <span className="text-[11px] font-semibold text-[#4A6144] bg-[#4A6144]/15 px-2.5 py-1 rounded-md border border-[#4A6144]/30 flex items-center gap-1 animate-in fade-in">
                      <Check className="w-3 h-3 text-[#4A6144]" />
                      <span>{ramCleanupMessage}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* 4. Optional App Install (خيار تثبيت التطبيق بدل التثبيت التلقائي) */}
              <div className="p-3 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] space-y-2.5">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-[#2D2218] flex items-center gap-1.5 text-xs">
                    <Smartphone className="w-3.5 h-3.5 text-[#C88A14]" />
                    <span>{dict.installAppOptionalChoice}</span>
                  </h3>
                  <p className="text-[11px] text-[#5C4B3B] leading-relaxed">
                    {dict.installAppOptionalChoiceDesc}
                  </p>
                </div>
                <div className="pt-1">
                  <PWAInstallButton lang={lang} variant="settings" />
                </div>
              </div>

              {/* 5. Reminders & Data Management */}
              <div className="p-3 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-[#2D2218] flex items-center gap-1.5 text-xs">
                    <Bell className="w-3.5 h-3.5 text-[#C88A14]" />
                    <span>{dict.soundAlertToggle}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSoundEnabled((prev) => !prev)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1 ${
                        soundEnabled
                          ? 'bg-[#4A6144] text-white'
                          : 'bg-[#EFE9DC] text-[#5C4B3B]'
                      }`}
                    >
                      {soundEnabled ? (
                        <Volume2 className="w-3.5 h-3.5" />
                      ) : (
                        <VolumeX className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {soundEnabled
                          ? lang === 'ar'
                            ? 'مفعّل'
                            : 'On'
                          : lang === 'ar'
                          ? 'صامت'
                          : 'Off'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerReminderNotification()}
                      className="px-2.5 py-1 rounded-lg border border-[#C88A14] bg-[#FBF5E6] text-[#2D2218] text-xs font-bold cursor-pointer"
                    >
                      {dict.testNotificationBtn}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E5DEC9] flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleResetCompletion();
                      setIsSettingsOpen(false);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#EFE9DC] hover:bg-[#DDD2BE] text-[#2D2218] text-xs font-bold cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{dict.clearCompletedBtn}</span>
                  </button>

                  {!confirmDeleteAll ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteAll(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#A84A32]/15 hover:bg-[#A84A32]/25 text-[#A84A32] text-xs font-bold cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'حذف الكل' : 'Delete All'}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPlans([]);
                          setConfirmDeleteAll(false);
                          setIsSettingsOpen(false);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#A84A32] text-white text-xs font-bold cursor-pointer"
                      >
                        {lang === 'ar' ? 'تأكيد' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteAll(false)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#EFE9DC] text-[#5C4B3B] text-xs font-semibold cursor-pointer"
                      >
                        {dict.cancelBtn}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-4 py-2.5 bg-[#F7F3EB] border-t border-[#DDD2BE] flex justify-end">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="mustard-gradient-btn px-5 py-1.5 rounded-xl text-xs font-bold text-[#FFFDF9] cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Full-Screen Plan Execution Window (شاشة تطبيق الخطط المستقلة) */}
      {expandedSardPlanId &&
        (() => {
          const activeExecutionPlan = plans.find((p) => p.id === expandedSardPlanId);
          if (!activeExecutionPlan) return null;
          return (
            <SardMushafView
              lang={lang}
              plan={activeExecutionPlan}
              focusModeDefault={focusModeEnabled}
              defaultSyncSpeed={defaultSyncSpeed}
              defaultTargetReps={defaultTargetReps}
              defaultQuizLevel={defaultQuizLevel}
              onClose={handleClosePlanScreen}
              onCompletePlanSard={handleCompletePlanSard}
            />
          );
        })()}
    </div>
  );
}
