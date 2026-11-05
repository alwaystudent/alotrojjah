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
  LayoutGrid,
  Table as TableIcon,
  Mic,
  Repeat,
  HelpCircle,
  ExternalLink,
  BookOpen,
  BarChart3,
  Settings,
  X,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Maximize2,
  Minimize2,
  WifiOff,
} from 'lucide-react';
import {
  Language,
  PlanType,
  DayId,
  QuranPlanItem,
  PlanEvaluation,
  QuizLevel,
  CalendarMode,
  WEEK_DAYS,
  INITIAL_PLANS,
  getTodayDayId,
  getWeekDayDate,
  formatCalendarDate,
  formatCurriculumTitle,
  getPlanTypeLabel,
  getScopeLabel,
  getEvaluationLabel,
} from './data/quranData';
import { t } from './data/translations';
import { PlanModal } from './components/PlanModal';
import { AnalyticsSection } from './components/AnalyticsSection';
import { RemindersSection } from './components/RemindersSection';
import { SardMushafView } from './components/SardMushafView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { useOnlineStatus } from './hooks/useOnlineStatus';

const STORAGE_KEY_PLANS = 'mishkat_sard_user_plans_v2';
const STORAGE_KEY_LANG = 'mishkat_sard_lang_v1';
const STORAGE_KEY_CALENDAR_MODE = 'al_utrujjah_calendar_mode_v1';
const STORAGE_KEY_FOCUS_MODE = 'al_utrujjah_focus_mode_v1';

export default function App() {
  const isOnline = useOnlineStatus();
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LANG);
    return saved === 'en' || saved === 'ar' ? saved : 'ar';
  });

  const [calendarMode, setCalendarMode] = useState<CalendarMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CALENDAR_MODE);
    return saved === 'both' || saved === 'hijri' || saved === 'gregorian' ? saved : 'both';
  });

  const [focusModeEnabled, setFocusModeEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FOCUS_MODE);
      return saved ? JSON.parse(saved) === true : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FOCUS_MODE, JSON.stringify(focusModeEnabled));
    } catch {
      // Ignore
    }
  }, [focusModeEnabled]);

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
  const [scheduleViewMode, setScheduleViewMode] = useState<'dropdown' | 'table' | 'grid'>('dropdown');
  const [selectedDropdownPlanId, setSelectedDropdownPlanId] = useState<string | null>(null);
  const [dropdownDayFilter, setDropdownDayFilter] = useState<'all' | DayId>('all');
  const [daySelectedPlanMap, setDaySelectedPlanMap] = useState<Record<string, string>>({});
  const [dayExpandedAllMap, setDayExpandedAllMap] = useState<Record<string, boolean>>({});
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

  const dict = t(lang);
  const todayId = getTodayDayId();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem(STORAGE_KEY_LANG, lang);
  }, [lang]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CALENDAR_MODE, calendarMode);
    } catch {
      // Ignore quota
    }
  }, [calendarMode]);

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
      // Do not trigger reminder sounds or alerts during an active Sard session or when tab is hidden
      if (expandedSardPlanId || document.hidden) return;

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
    }, 30000);

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

  // Explicit completion handler triggered ONLY when user explicitly chooses to mark the plan as completed
  const handleCompletePlanSard = (
    planId: string,
    recordedMistakes: number,
    evaluation?: PlanEvaluation,
    quizLevel?: QuizLevel,
    markAsCompleted: boolean = true
  ) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              status: markAsCompleted ? 'completed' : p.status,
              evaluation: evaluation || p.evaluation,
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
    let nextPlans: QuranPlanItem[] = [];
    if (editingId && newPlansData.length > 0) {
      const updatedFields = newPlansData[0];
      setPlans((prev) => {
        nextPlans = prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                ...updatedFields,
              }
            : item
        );
        try {
          localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(nextPlans));
        } catch {
          // Ignore
        }
        return nextPlans;
      });
    } else {
      const createdItems: QuranPlanItem[] = newPlansData.map((data, index) => ({
        ...data,
        id: `plan-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      }));
      setPlans((prev) => {
        nextPlans = [...prev, ...createdItems];
        try {
          localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(nextPlans));
        } catch {
          // Ignore
        }
        return nextPlans;
      });
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
      evaluation: undefined,
      createdAt: new Date().toISOString(),
    };
    setPlans((prev) => [...prev, copy]);
  };

  const handleToggleStatus = (id: string) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: p.status === 'completed' ? 'pending' : 'completed',
            }
          : p
      )
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
    setPlans((prev) => prev.map((p) => ({ ...p, status: 'pending', evaluation: undefined })));
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

  const getEvalColorClass = (evalType?: PlanEvaluation) => {
    if (evalType === 'muthabbat') return 'text-[#4A6144] font-bold';
    if (evalType === 'mutaraddid') return 'text-[#B87D10] font-bold';
    if (evalType === 'mutafallit') return 'text-[#A84A32] font-bold';
    return '';
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

  // Pre-group and sort filteredPlans by day once in O(N log N) instead of repeating inside every day row/card
  const plansByDayMap = useMemo(() => {
    const map: Record<DayId, QuranPlanItem[]> = {
      saturday: [],
      sunday: [],
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
    };
    filteredPlans.forEach((p) => {
      if (map[p.day]) {
        map[p.day].push(p);
      }
    });
    (Object.keys(map) as DayId[]).forEach((dKey) => {
      map[dKey].sort((a, b) => a.reminderTime.localeCompare(b.reminderTime));
    });
    return map;
  }, [filteredPlans]);

  const dropdownFilteredPlans = useMemo(() => {
    return filteredPlans.filter((p) => {
      if (dropdownDayFilter !== 'all' && p.day !== dropdownDayFilter) return false;
      return true;
    });
  }, [filteredPlans, dropdownDayFilter]);

  const activeDropdownPlan = useMemo(() => {
    if (selectedDropdownPlanId) {
      const found = dropdownFilteredPlans.find((p) => p.id === selectedDropdownPlanId);
      if (found) return found;
    }
    const todayPlan = dropdownFilteredPlans.find((p) => p.day === todayId);
    return todayPlan || dropdownFilteredPlans[0] || null;
  }, [dropdownFilteredPlans, selectedDropdownPlanId, todayId]);

  const activeDropdownPlanIndex = activeDropdownPlan
    ? dropdownFilteredPlans.findIndex((p) => p.id === activeDropdownPlan.id)
    : -1;

  const handleStepDropdownPlan = (direction: -1 | 1) => {
    if (dropdownFilteredPlans.length === 0 || activeDropdownPlanIndex === -1) return;
    const nextIdx =
      (activeDropdownPlanIndex + direction + dropdownFilteredPlans.length) %
      dropdownFilteredPlans.length;
    setSelectedDropdownPlanId(dropdownFilteredPlans[nextIdx].id);
  };

  const { todayPlansCount, todayCompletedCount } = useMemo(() => {
    let total = 0;
    let done = 0;
    for (let i = 0; i < plans.length; i++) {
      if (plans[i].day === todayId) {
        total++;
        if (plans[i].status === 'completed') done++;
      }
    }
    return { todayPlansCount: total, todayCompletedCount: done };
  }, [plans, todayId]);

  const todayInfo = WEEK_DAYS.find((d) => d.id === todayId) || WEEK_DAYS[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F3EB] text-[#261C14] islamic-pattern-subtle">
      {/* Fixed/Sticky Top Header: Row 1 = "الأترجة" Emblem on the Right + Settings Icon on the Left | Row 2 = Full-Width 4-Column Icon-Top Menu Underneath the Logo */}
      <header
        dir="rtl"
        className="sticky top-0 z-30 bg-[#FFFDF9]/95 backdrop-blur-md border-b border-[#DDD2BE] shadow-xs"
      >
        {/* Row 1: Top Brand Row — Elegant "الأترجة" Logo on the Right & Compact Settings Icon on the Left */}
        <div className="max-w-[1360px] mx-auto px-3 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-2">
          {/* Right (على اليمين): Elegant "الأترجة" Emblem Logo */}
          <a
            href="#schedule"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('schedule');
            }}
            className="flex items-center gap-2.5 shrink-0 group cursor-pointer"
            title="الأترجة"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#2D2218] via-[#3D2E20] to-[#59412A] border border-[#C88A14] shadow-2xs flex items-center justify-center relative overflow-hidden group-hover:border-[#EAB338] transition-colors">
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6 text-[#EAB338]"
                viewBox="0 0 36 36"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="7"
                  y="7"
                  width="22"
                  height="22"
                  rx="2.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeOpacity="0.55"
                />
                <rect
                  x="7"
                  y="7"
                  width="22"
                  height="22"
                  rx="2.5"
                  transform="rotate(45 18 18)"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M18 10.5C21.2 13 22.8 15.8 22.8 18.7C22.8 21.8 20.6 24.3 18 25.5C15.4 24.3 13.2 21.8 13.2 18.7C13.2 15.8 14.8 13 18 10.5Z"
                  fill="currentColor"
                  fillOpacity="0.22"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <circle cx="18" cy="18" r="1.8" fill="currentColor" />
              </svg>
            </div>
            <span className="text-xl sm:text-2xl font-bold font-display-islamic leading-none text-[#2D2218] tracking-tight">
              الأترجة
            </span>
          </a>

          {/* Left: Compact Date, Counter & Settings Control Button */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex flex-col items-end text-end">
              <span className="text-[11px] sm:text-xs font-bold text-[#2D2218] flex items-center gap-1 font-mono-tabular leading-tight">
                <Calendar className="w-3 h-3 text-[#C88A14] shrink-0" />
                <span>{formatCalendarDate(new Date(), lang, calendarMode, { compact: true })}</span>
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono-tabular text-[#84715E] leading-tight">
                {lang === 'ar' ? todayInfo.nameAr : todayInfo.shortEn} · {todayCompletedCount}/
                {todayPlansCount}
              </span>
            </div>

            {/* Offline Network Status Indicator */}
            {!isOnline && (
              <span
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#A84A32]/15 border border-[#A84A32]/30 text-[#A84A32] text-[10px] font-bold shrink-0 animate-pulse"
                title={lang === 'ar' ? 'أنت تعمل دون اتصال — كل البيانات والآيات تعمل محلياً 100%' : 'Working offline — 100% locally available'}
              >
                <WifiOff className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">{lang === 'ar' ? 'دون إنترنت' : 'Offline'}</span>
              </span>
            )}

            {/* In-App PWA Install Button for Android / Desktop */}
            <PWAInstallButton lang={lang} variant="header" />

            <button
              type="button"
              onClick={() => {
                setConfirmDeleteAll(false);
                setIsSettingsOpen(true);
              }}
              title={lang === 'ar' ? 'الإعدادات' : 'Settings'}
              className="p-2 rounded-xl bg-[#F7F3EB] hover:bg-[#EFE9DC] border border-[#DDD2BE] hover:border-[#C88A14] text-[#2D2218] transition-all cursor-pointer flex items-center justify-center shadow-2xs"
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
                  { id: 'schedule', label: dict.navSchedule, Icon: Calendar },
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

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 p-0.5 bg-[#F7F3EB] rounded-lg border border-[#DDD2BE]">
                  <button
                    type="button"
                    onClick={() => setScheduleViewMode('dropdown')}
                    className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      scheduleViewMode === 'dropdown'
                        ? 'bg-[#2D2218] text-[#EAB338] shadow-2xs'
                        : 'text-[#5C4B3B] hover:text-[#261C14]'
                    }`}
                    title={dict.viewModeDropdown}
                  >
                    <ListFilter className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{dict.viewModeDropdown}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleViewMode('table')}
                    className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      scheduleViewMode === 'table'
                        ? 'bg-[#C88A14] text-[#FFFDF9] shadow-2xs'
                        : 'text-[#5C4B3B] hover:text-[#261C14]'
                    }`}
                    title={dict.viewModeTable}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{dict.viewModeTable}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleViewMode('grid')}
                    className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      scheduleViewMode === 'grid'
                        ? 'bg-[#C88A14] text-[#FFFDF9] shadow-2xs'
                        : 'text-[#5C4B3B] hover:text-[#261C14]'
                    }`}
                    title={dict.viewModeGrid}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{dict.viewModeGrid}</span>
                  </button>
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

            {/* VERTICAL WEEKLY SCHEDULE WITH DROPDOWNS (الجدول الأسبوعي العمودي بالقوائم المنسدلة) */}
            {scheduleViewMode === 'dropdown' && (
              <div className="space-y-3.5">
                {/* Top Control Bar: Vertical Day Filter Selector + Overall Stats & Quick Add */}
                <div className="bg-[#FFFDF9] p-3 rounded-2xl border border-[#DDD2BE] shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <span className="text-xs font-bold text-[#5C4B3B] flex items-center gap-1.5 shrink-0">
                      <Calendar className="w-4 h-4 text-[#C88A14]" />
                      <span>{lang === 'ar' ? 'عرض أيام الجدول:' : 'Schedule Days:'}</span>
                    </span>

                    {/* Vertical Filter Dropdown */}
                    <div className="relative flex-1 max-w-xs">
                      <select
                        value={dropdownDayFilter}
                        onChange={(e) => setDropdownDayFilter(e.target.value as 'all' | DayId)}
                        className="w-full appearance-none ps-3 pe-8 py-1.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] hover:border-[#C88A14] text-xs font-bold text-[#2D2218] focus:outline-none focus:ring-1 focus:ring-[#C88A14] cursor-pointer"
                      >
                        <option value="all">
                          {lang === 'ar' ? '📅 جميع أيام الأسبوع (السبت - الجمعة) عمودياً' : '📅 All Week Days (Sat - Fri)'}
                        </option>
                        {WEEK_DAYS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {lang === 'ar' ? d.nameAr : d.nameEn} {d.id === todayId ? (lang === 'ar' ? '· (اليوم)' : '· (Today)') : ''} ({(plansByDayMap[d.id] || []).length} {dict.dropdownPlanCount})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-[#C88A14] absolute end-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ms-auto shrink-0">
                    <span className="text-xs font-mono-tabular font-bold text-[#84715E] bg-[#F7F3EB] px-2.5 py-1 rounded-lg border border-[#DDD2BE]">
                      {filteredPlans.filter(p => p.status === 'completed').length}/{filteredPlans.length} {dict.dropdownPlanCount} {dict.statusCompleted}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        handleOpenAddModal(dropdownDayFilter !== 'all' ? dropdownDayFilter : todayId)
                      }
                      className="mustard-gradient-btn px-3 py-1.5 rounded-xl text-xs font-bold text-[#FFFDF9] shadow-2xs hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{dict.addPlanBtn}</span>
                    </button>
                  </div>
                </div>

                {/* Vertical Stack of Days (عمودية) */}
                <div className="space-y-3">
                  {(dropdownDayFilter === 'all'
                    ? visibleDays
                    : visibleDays.filter((d) => d.id === dropdownDayFilter)
                  ).map((day) => {
                    const dayPlans = plansByDayMap[day.id] || [];
                    const isToday = day.id === todayId;
                    const dateStr = formatCalendarDate(getWeekDayDate(day.id), lang, calendarMode, { compact: true });
                    const doneCount = dayPlans.filter((p) => p.status === 'completed').length;
                    const isAllExpanded = !!dayExpandedAllMap[day.id];

                    // Active selected plan for this day
                    const activePlanForDay =
                      dayPlans.find((p) => p.id === daySelectedPlanMap[day.id]) ||
                      dayPlans[0] ||
                      null;

                    return (
                      <div
                        key={day.id}
                        className={`rounded-2xl border transition-all ${
                          isToday
                            ? 'bg-gradient-to-b from-[#FFFDF9] to-[#FBF7EE] border-[#C88A14]/70 shadow-sm'
                            : 'bg-[#FFFDF9] border-[#DDD2BE] shadow-2xs'
                        } p-3.5 sm:p-4 space-y-3`}
                      >
                        {/* Day Header Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDD2BE]/60 pb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold font-display-islamic text-base sm:text-lg text-[#2D2218]">
                                {lang === 'ar' ? day.nameAr : day.nameEn}
                              </span>
                              {isToday && (
                                <span className="px-2 py-0.5 rounded-full bg-[#C88A14]/20 border border-[#C88A14]/40 text-[#9E6A0C] text-[11px] font-bold animate-pulse">
                                  {dict.todayBadge}
                                </span>
                              )}
                            </div>
                            <span className="text-[#84715E] text-xs font-mono-tabular">
                              · {dateStr}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {dayPlans.length > 0 && (
                              <span className="text-[11px] font-mono-tabular font-bold text-[#5C4B3B] bg-[#F7F3EB] px-2 py-0.5 rounded-lg border border-[#DDD2BE]">
                                {doneCount}/{dayPlans.length} {dict.statusCompleted}
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenAddModal(day.id)}
                              title={dict.addAnotherForDay}
                              className="px-2 py-1 rounded-lg bg-[#F7F3EB] hover:bg-[#EFE9DC] border border-[#DDD2BE] hover:border-[#C88A14] text-xs font-semibold text-[#8A5E09] flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span className="hidden sm:inline">{lang === 'ar' ? 'إضافة خطة' : 'Add'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Day Content */}
                        {dayPlans.length === 0 ? (
                          <div className="py-4 px-3 text-center rounded-xl border border-dashed border-[#DDD2BE] bg-[#F7F3EB]/40 flex items-center justify-between gap-2">
                            <span className="text-xs text-[#84715E]">
                              {lang === 'ar'
                                ? `لا توجد خطط مجدولة ليوم ${day.nameAr}`
                                : `No plans scheduled for ${day.nameEn}`}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenAddModal(day.id)}
                              className="text-xs font-bold text-[#C88A14] hover:underline cursor-pointer"
                            >
                              + {dict.addFirstPlanForDay}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* If day has 2+ plans: provide the elegant Dropdown Selector */}
                            {dayPlans.length > 1 && (
                              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F7F3EB]/70 p-2 rounded-xl border border-[#DDD2BE]">
                                <div className="relative flex-1 min-w-[200px]">
                                  <div className="relative flex items-center">
                                    <select
                                      value={activePlanForDay?.id || ''}
                                      onChange={(e) =>
                                        setDaySelectedPlanMap((prev) => ({
                                          ...prev,
                                          [day.id]: e.target.value,
                                        }))
                                      }
                                      className="w-full appearance-none ps-3 pe-9 py-2 rounded-xl bg-[#FFFDF9] border border-[#C88A14]/60 hover:border-[#C88A14] text-xs font-bold text-[#2D2218] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#C88A14]/30 cursor-pointer transition-all"
                                    >
                                      {dayPlans.map((p, pIdx) => {
                                        const typeLabel = getPlanTypeLabel(p.planType, lang);
                                        const currTitle = formatCurriculumTitle(p, lang);
                                        const statusLabel =
                                          p.status === 'completed'
                                            ? lang === 'ar'
                                              ? '✓ مكتمل'
                                              : '✓ Done'
                                            : lang === 'ar'
                                            ? '○ متبقٍ'
                                            : '○ Pending';
                                        return (
                                          <option key={p.id} value={p.id}>
                                            {pIdx + 1}. {typeLabel}: {currTitle} ({p.reminderTime}) - {statusLabel}
                                          </option>
                                        );
                                      })}
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-[#C88A14] absolute end-2.5 pointer-events-none" />
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setDayExpandedAllMap((prev) => ({
                                      ...prev,
                                      [day.id]: !isAllExpanded,
                                    }))
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-[#FFFDF9] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-[11px] font-bold text-[#5C4B3B] transition-colors cursor-pointer shrink-0"
                                >
                                  {isAllExpanded
                                    ? lang === 'ar'
                                      ? 'طي إلى القائمة المنسدلة'
                                      : 'Collapse to Dropdown'
                                    : lang === 'ar'
                                    ? `عرض كل الخطط (${dayPlans.length})`
                                    : `View all (${dayPlans.length})`}
                                </button>
                              </div>
                            )}

                            {/* Render either All Expanded Plans or the Single Selected Dropdown Plan */}
                            <div className="space-y-2.5">
                              {(isAllExpanded || dayPlans.length === 1
                                ? dayPlans
                                : activePlanForDay
                                ? [activePlanForDay]
                                : []
                              ).map((plan) => {
                                const isCompleted = plan.status === 'completed';
                                const { label: practiceLabel, Icon: PracticeIcon } =
                                  getPlanPracticeButtonMeta(plan.planType);

                                return (
                                  <div
                                    key={plan.id}
                                    className={`rounded-xl border p-3 sm:p-3.5 transition-all ${
                                      isCompleted
                                        ? 'bg-[#F7F3EB]/60 border-[#DDD2BE]'
                                        : 'bg-gradient-to-b from-[#FFFDF9] to-[#FBF9F3] border-[#C88A14]/35 shadow-2xs'
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span
                                          className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                            plan.planType === 'new_memorization'
                                              ? 'bg-[#4A6144]/15 text-[#354930] border border-[#4A6144]/30'
                                              : plan.planType === 'sard'
                                              ? 'bg-[#C88A14]/15 text-[#8A5E09] border border-[#C88A14]/30'
                                              : 'bg-[#9C4A32]/15 text-[#733320] border border-[#9C4A32]/30'
                                          }`}
                                        >
                                          {getPlanTypeLabel(plan.planType, lang)}
                                        </span>

                                        <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-[#EFE9DC] text-[#5C4B3B] border border-[#DDD2BE]">
                                          {getScopeLabel(plan.scope, lang)}
                                        </span>

                                        {plan.repeatWeekly && (
                                          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-[#C88A14]/15 text-[#8A5E09] border border-[#C88A14]/30 flex items-center gap-1">
                                            <Repeat className="w-3 h-3 text-[#C88A14]" />
                                            <span>{dict.repeatWeeklyBadge}</span>
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleTogglePlanReminder(plan.id)}
                                          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono-tabular border transition-colors cursor-pointer ${
                                            plan.reminderEnabled
                                              ? 'bg-[#2D2218] text-[#EAB338] border-[#2D2218]'
                                              : 'bg-[#EFE9DC] text-[#84715E] border-[#DDD2BE]'
                                          }`}
                                          title={dict.colReminder}
                                        >
                                          <Bell className="w-3 h-3" />
                                          <span>{plan.reminderTime}</span>
                                        </button>

                                        <span
                                          className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                            isCompleted
                                              ? 'bg-[#4A6144]/15 text-[#4A6144]'
                                              : 'bg-[#84715E]/15 text-[#5C4B3B]'
                                          }`}
                                        >
                                          {isCompleted ? dict.statusCompleted : dict.statusPending}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Headline & Notes */}
                                    <div className="space-y-1 mb-2.5">
                                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                                        <h4 className="text-sm sm:text-base font-bold font-display-islamic text-[#2D2218]">
                                          {formatCurriculumTitle(plan, lang)}
                                        </h4>
                                        {plan.evaluation && (
                                          <span
                                            className={`text-xs font-semibold px-2 py-0.5 rounded-md ${getEvalColorClass(
                                              plan.evaluation
                                            )} bg-[#F7F3EB]`}
                                          >
                                            {getEvaluationLabel(plan.evaluation, lang)}
                                          </span>
                                        )}
                                      </div>
                                      {plan.notes && (
                                        <p className="text-[11px] text-[#5C4B3B] bg-[#FFFDF9] p-1.5 rounded-lg border border-[#E5DEC9] italic">
                                          {plan.notes}
                                        </p>
                                      )}
                                    </div>

                                    {/* Bottom Action Bar */}
                                    <div className="pt-2 border-t border-[#DDD2BE]/60 flex flex-wrap items-center justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenPlanScreen(plan.id)}
                                        className="mustard-gradient-btn px-4 py-1.5 rounded-xl text-xs font-bold text-[#FFFDF9] shadow-2xs hover:shadow transition-all cursor-pointer flex items-center gap-1.5"
                                      >
                                        <PracticeIcon className="w-3.5 h-3.5" />
                                        <span>{practiceLabel}</span>
                                      </button>

                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-mono-tabular text-[#84715E] me-1">
                                          {plan.estimatedAyahs} {dict.ayahsUnit} · ~{plan.estimatedPages} {dict.pagesUnit}
                                        </span>

                                        <button
                                          type="button"
                                          onClick={() => handleToggleStatus(plan.id)}
                                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                            isCompleted
                                              ? 'bg-[#4A6144] text-white border-[#4A6144]'
                                              : 'bg-[#F7F3EB] text-[#5C4B3B] hover:text-[#261C14] border-[#DDD2BE]'
                                          }`}
                                          title={isCompleted ? dict.statusCompleted : 'تعليم كمكتمل'}
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditModal(plan)}
                                          title={dict.editPlan}
                                          className="p-1.5 rounded-lg border border-[#DDD2BE] bg-[#F7F3EB] hover:bg-[#EFE9DC] text-[#5C4B3B] hover:text-[#261C14] transition-colors cursor-pointer"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleDeletePlan(plan.id)}
                                          title={dict.deletePlan}
                                          className="p-1.5 rounded-lg border border-[#DDD2BE] bg-[#F7F3EB] hover:bg-[#A84A32]/10 text-[#5C4B3B] hover:text-[#A84A32] transition-colors cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DESKTOP TABLE VIEW (`hidden lg:block` when table mode is selected) */}
            {scheduleViewMode === 'table' && (
              <div className="hidden lg:block rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-start border-collapse">
                    <thead>
                      <tr className="bg-[#EFE9DC]/75 border-b border-[#DDD2BE] text-[11px] font-bold text-[#5C4B3B]">
                        <th className="py-2 px-3 text-start">{dict.colDay}</th>
                        <th className="py-2 px-3 text-start">{dict.colType}</th>
                        <th className="py-2 px-3 text-start">{dict.colCurriculum}</th>
                        <th className="py-2 px-3 text-end">{dict.colMetrics}</th>
                        <th className="py-2 px-3 text-center">{dict.colReminder}</th>
                        <th className="py-2 px-3 text-center">{dict.colStatus}</th>
                        <th className="py-2 px-3 text-end">{dict.colActions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE9DC] text-xs sm:text-sm">
                      {visibleDays.map((day) => {
                        const dayPlans = plansByDayMap[day.id] || [];
                        const isToday = day.id === todayId;

                        if (dayPlans.length === 0) {
                          return (
                            <tr
                              key={day.id}
                              className={isToday ? 'bg-[#FBF5E6]/50' : 'hover:bg-[#F7F3EB]/40'}
                            >
                              <td className="py-2 px-3 font-bold text-[#261C14] whitespace-nowrap">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span>{lang === 'ar' ? day.nameAr : day.nameEn}</span>
                                    {isToday && (
                                      <span className="text-[11px] font-semibold text-[#C88A14]">
                                        · {dict.todayBadge}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono-tabular text-[#84715E] font-normal">
                                    {formatCalendarDate(getWeekDayDate(day.id), lang, calendarMode, { compact: true })}
                                  </span>
                                </div>
                              </td>
                              <td colSpan={5} className="py-2 px-3 text-xs text-[#84715E]">
                                {dict.noPlansForDay}
                              </td>
                              <td className="py-2 px-3 text-end whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddModal(day.id)}
                                  className="px-2.5 py-1 rounded-lg border border-[#C88A14]/60 text-xs font-semibold text-[#9E6A0C] hover:bg-[#FBF5E6] transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  + {dict.addFirstPlanForDay}
                                </button>
                              </td>
                            </tr>
                          );
                        }

                        return dayPlans.map((plan, idx) => {
                          const isCompleted = plan.status === 'completed';
                          const isSardOpen = expandedSardPlanId === plan.id;
                          const { label: practiceLabel, Icon: PracticeIcon } =
                            getPlanPracticeButtonMeta(plan.planType);

                          return (
                            <React.Fragment key={plan.id}>
                              <tr
                                className={`transition-colors ${
                                  isSardOpen
                                    ? 'bg-[#FBF5E6]'
                                    : isToday
                                    ? 'bg-[#FBF5E6]/45'
                                    : 'hover:bg-[#F7F3EB]/60'
                                }`}
                              >
                                <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                                  {idx === 0 ? (
                                    <div className="flex items-center gap-2">
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-1 font-bold text-[#261C14]">
                                          <span>{lang === 'ar' ? day.nameAr : day.nameEn}</span>
                                          {isToday && (
                                            <span className="text-[11px] font-semibold text-[#C88A14]">
                                              · {dict.todayBadge}
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[10px] font-mono-tabular text-[#84715E] font-normal">
                                          {formatCalendarDate(getWeekDayDate(day.id), lang, calendarMode, { compact: true })}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenAddModal(day.id)}
                                        title={dict.addAnotherForDay}
                                        className="p-0.5 rounded-md text-[#B87D10] hover:bg-[#EFE9DC] hover:text-[#261C14] transition-colors cursor-pointer"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-[#84715E] font-mono-tabular ps-2">
                                      ↳ #{idx + 1}
                                    </span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                                  <span
                                    className={`text-xs font-bold ${
                                      plan.planType === 'new_memorization'
                                        ? 'text-[#4A6144]'
                                        : plan.planType === 'sard'
                                        ? 'text-[#B87D10]'
                                        : 'text-[#9C4A32]'
                                    }`}
                                  >
                                    {getPlanTypeLabel(plan.planType, lang)}
                                  </span>
                                  <span className="text-[11px] text-[#84715E] ms-1.5">
                                    · {getScopeLabel(plan.scope, lang)}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 align-middle">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={`font-bold text-[#261C14] ${
                                        isCompleted ? 'line-through opacity-65' : ''
                                      }`}
                                    >
                                      {formatCurriculumTitle(plan, lang)}
                                    </span>
                                    {plan.repeatWeekly && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#C88A14]/15 text-[#9E6A0C] border border-[#C88A14]/30 font-semibold inline-flex items-center gap-0.5">
                                        <Repeat className="w-2.5 h-2.5" />
                                        <span>{dict.repeatWeeklyBadge}</span>
                                      </span>
                                    )}
                                    {plan.evaluation && (
                                      <span className={`text-xs ${getEvalColorClass(plan.evaluation)}`}>
                                        · {getEvaluationLabel(plan.evaluation, lang)}
                                      </span>
                                    )}
                                    {plan.notes && (
                                      <span className="text-xs text-[#84715E]">· {plan.notes}</span>
                                    )}
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 align-middle text-end whitespace-nowrap font-mono-tabular text-xs text-[#261C14]">
                                  <span>
                                    {plan.estimatedAyahs} {dict.ayahsUnit}
                                  </span>
                                  <span className="text-[#84715E] ms-1">
                                    (~{plan.estimatedPages} {dict.pagesUnit})
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 align-middle text-center whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePlanReminder(plan.id)}
                                    className={`inline-flex items-center gap-1 text-xs font-mono-tabular cursor-pointer ${
                                      plan.reminderEnabled
                                        ? 'text-[#261C14] font-semibold'
                                        : 'text-[#84715E] line-through'
                                    }`}
                                    title={dict.enableReminderLabel}
                                  >
                                    <Clock className="w-3 h-3 text-[#C88A14]" />
                                    <span>{plan.reminderTime}</span>
                                  </button>
                                </td>

                                <td className="py-2.5 px-3 align-middle text-center whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatus(plan.id)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                                      isCompleted
                                        ? 'bg-[#4A6144] text-white'
                                        : 'bg-[#EFE9DC] text-[#5C4B3B] hover:bg-[#C88A14] hover:text-white'
                                    }`}
                                  >
                                    {isCompleted ? (
                                      <span className="flex items-center gap-1">
                                        <Check className="w-3 h-3" />
                                        <span>{dict.markCompleted}</span>
                                      </span>
                                    ) : (
                                      dict.statusPending
                                    )}
                                  </button>
                                </td>

                                <td className="py-2.5 px-3 align-middle text-end whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenPlanScreen(plan.id)}
                                      className="mustard-gradient-btn text-[#FFFDF9] px-3 py-1 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
                                    >
                                      <PracticeIcon className="w-3.5 h-3.5" />
                                      <span>{practiceLabel}</span>
                                      <ExternalLink className="w-3 h-3 opacity-85" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditModal(plan)}
                                      title={dict.editPlan}
                                      className="p-1 rounded-lg text-[#5C4B3B] hover:text-[#261C14] hover:bg-[#EFE9DC] transition-colors cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDuplicatePlan(plan)}
                                      title={dict.duplicatePlan}
                                      className="p-1 rounded-lg text-[#5C4B3B] hover:text-[#261C14] hover:bg-[#EFE9DC] transition-colors cursor-pointer"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePlan(plan.id)}
                                      title={dict.deletePlan}
                                      className="p-1 rounded-lg text-[#A84A32] hover:bg-[#A84A32]/10 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RESPONSIVE CARDS VIEW (Active when Grid View is selected, or on Mobile/Tablet `< lg` when Table View is selected) */}
            {scheduleViewMode !== 'dropdown' && (
              <div
                className={`${
                  scheduleViewMode === 'table' ? 'block lg:hidden' : 'block'
                } grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3`}
              >
                {visibleDays.map((day) => {
                  const dayPlans = plansByDayMap[day.id] || [];
                  const isToday = day.id === todayId;
                  const doneCount = dayPlans.filter((p) => p.status === 'completed').length;

                  return (
                    <div
                      key={day.id}
                      className={`rounded-xl bg-[#FFFDF9] border flex flex-col justify-between overflow-hidden ${
                        isToday ? 'border-[#C88A14] shadow-2xs' : 'border-[#DDD2BE]'
                      }`}
                    >
                      <div>
                        <div
                          className={`px-3 py-2 border-b flex items-center justify-between ${
                            isToday
                              ? 'bg-[#2D2218] text-[#FFFDF9] border-[#2D2218]'
                              : 'bg-[#F7F3EB] text-[#261C14] border-[#DDD2BE]'
                          }`}
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-bold font-display-islamic">
                                {lang === 'ar' ? day.nameAr : day.nameEn}
                              </h3>
                              {isToday && (
                                <span className="text-[11px] font-semibold text-[#EAB338]">
                                  · {dict.todayBadge}
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-mono-tabular ${
                                isToday ? 'text-[#E6D7BE]' : 'text-[#84715E]'
                              }`}
                            >
                              {formatCalendarDate(getWeekDayDate(day.id), lang, calendarMode, { compact: true })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-mono-tabular ${
                                isToday ? 'text-[#E6D7BE]' : 'text-[#84715E]'
                              }`}
                            >
                              {doneCount}/{dayPlans.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenAddModal(day.id)}
                              title={dict.addAnotherForDay}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-0.5 cursor-pointer transition-colors ${
                                isToday
                                  ? 'bg-[#C88A14] text-[#FFFDF9]'
                                  : 'bg-[#EFE9DC] text-[#9E6A0C] hover:bg-[#E5DEC9]'
                              }`}
                            >
                              <Plus className="w-3 h-3" />
                              <span>{dict.addAnotherForDay}</span>
                            </button>
                          </div>
                        </div>

                        <div className="divide-y divide-[#EFE9DC]">
                          {dayPlans.length === 0 ? (
                            <div className="py-3 px-3 text-center">
                              <p className="text-xs text-[#84715E]">{dict.noPlansForDay}</p>
                            </div>
                          ) : (
                            dayPlans.map((plan) => {
                              const isCompleted = plan.status === 'completed';
                              const { label: practiceLabel, Icon: PracticeIcon } =
                                getPlanPracticeButtonMeta(plan.planType);

                              return (
                                <div
                                  key={plan.id}
                                  className="p-2.5 sm:p-3 space-y-1.5 hover:bg-[#F7F3EB]/50 transition-colors"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-[#84715E]">
                                    <div className="flex items-center gap-1">
                                      <span
                                        className={`font-bold ${
                                          plan.planType === 'new_memorization'
                                            ? 'text-[#4A6144]'
                                            : plan.planType === 'sard'
                                            ? 'text-[#B87D10]'
                                            : 'text-[#9C4A32]'
                                        }`}
                                      >
                                        {getPlanTypeLabel(plan.planType, lang)}
                                      </span>
                                      <span aria-hidden="true">·</span>
                                      <span>{getScopeLabel(plan.scope, lang)}</span>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-mono-tabular">{plan.reminderTime}</span>
                                      {plan.evaluation && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span className={getEvalColorClass(plan.evaluation)}>
                                            {getEvaluationLabel(plan.evaluation, lang)}
                                          </span>
                                        </>
                                      )}
                                    </div>

                                    <span className="font-mono-tabular">
                                      {plan.estimatedAyahs} {dict.ayahsUnit} (~{plan.estimatedPages}{' '}
                                      {dict.pagesUnit})
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={`text-sm font-bold text-[#261C14] ${
                                        isCompleted ? 'line-through opacity-60' : ''
                                      }`}
                                    >
                                      {formatCurriculumTitle(plan, lang)}
                                    </span>
                                    {plan.repeatWeekly && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#C88A14]/15 text-[#8A5E09] border border-[#C88A14]/30 font-semibold inline-flex items-center gap-0.5">
                                        <Repeat className="w-2.5 h-2.5" />
                                        <span>{dict.repeatWeeklyBadge}</span>
                                      </span>
                                    )}
                                  </div>

                                  {plan.notes && (
                                    <p className="text-[11px] text-[#5C4B3B] line-clamp-1">
                                      {plan.notes}
                                    </p>
                                  )}

                                  <div className="pt-1 flex flex-wrap items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenPlanScreen(plan.id)}
                                        className="mustard-gradient-btn text-[#FFFDF9] flex-1 sm:flex-initial justify-center px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap flex items-center gap-1 shadow-2xs"
                                      >
                                        <PracticeIcon className="w-3 h-3" />
                                        <span>{practiceLabel}</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleToggleStatus(plan.id)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                                          isCompleted
                                            ? 'bg-[#4A6144] text-white'
                                            : 'bg-[#EFE9DC] text-[#5C4B3B]'
                                        }`}
                                      >
                                        {isCompleted ? dict.markCompleted : dict.statusPending}
                                      </button>
                                    </div>

                                    <div className="flex items-center gap-0.5">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditModal(plan)}
                                        className="p-1 rounded-md text-[#5C4B3B] hover:text-[#261C14] hover:bg-[#EFE9DC] cursor-pointer"
                                        title={dict.editPlan}
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDuplicatePlan(plan)}
                                        className="p-1 rounded-md text-[#5C4B3B] hover:text-[#261C14] hover:bg-[#EFE9DC] cursor-pointer"
                                        title={dict.duplicatePlan}
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePlan(plan.id)}
                                        className="p-1 rounded-md text-[#A84A32] hover:bg-[#A84A32]/10 cursor-pointer"
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
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ANALYTICS DEDICATED VIEW */}
        {activeSection === 'analytics' && <AnalyticsSection plans={plans} lang={lang} />}

        {/* REMINDERS DEDICATED VIEW */}
        {activeSection === 'reminders' && (
          <RemindersSection
            plans={plans}
            lang={lang}
            calendarMode={calendarMode}
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
        <span>{dict.heroSubtitle}</span>
      </footer>

      {/* Add / Edit Plan Modal */}
      <PlanModal
        isOpen={isModalOpen}
        lang={lang}
        calendarMode={calendarMode}
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
              {/* PWA App Installation for Android & Desktop */}
              <PWAInstallButton lang={lang} variant="settings" />

              {/* 1. Language, Layout & Calendar System */}
              <div className="p-3 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] space-y-3">
                <h3 className="font-bold text-[#2D2218] flex items-center gap-1.5 text-xs">
                  <Globe className="w-3.5 h-3.5 text-[#C88A14]" />
                  <span>{lang === 'ar' ? 'اللغة والتقويم ونمط العرض' : 'Language, Calendar & View'}</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

                  <div>
                    <div className="text-[11px] text-[#5C4B3B] mb-1 font-semibold">
                      {lang === 'ar' ? 'نمط الجدول' : 'Layout'}
                    </div>
                    <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[#EFE9DC] border border-[#DDD2BE]">
                      <button
                        type="button"
                        onClick={() => setScheduleViewMode('dropdown')}
                        className={`py-1 rounded-md text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1 truncate ${
                          scheduleViewMode === 'dropdown'
                            ? 'bg-[#2D2218] text-[#EAB338] shadow-2xs'
                            : 'text-[#5C4B3B]'
                        }`}
                        title={dict.viewModeDropdown}
                      >
                        <ListFilter className="w-3 h-3 shrink-0" />
                        <span className="truncate">{dict.viewModeDropdown}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleViewMode('table')}
                        className={`py-1 rounded-md text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1 truncate ${
                          scheduleViewMode === 'table'
                            ? 'bg-[#C88A14] text-[#FFFDF9] shadow-2xs'
                            : 'text-[#5C4B3B]'
                        }`}
                        title={dict.viewModeTable}
                      >
                        <TableIcon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{dict.viewModeTable}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleViewMode('grid')}
                        className={`py-1 rounded-md text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1 truncate ${
                          scheduleViewMode === 'grid'
                            ? 'bg-[#C88A14] text-[#FFFDF9] shadow-2xs'
                            : 'text-[#5C4B3B]'
                        }`}
                        title={dict.viewModeGrid}
                      >
                        <LayoutGrid className="w-3 h-3 shrink-0" />
                        <span className="truncate">{dict.viewModeGrid}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Calendar System Switcher (الهجري / الميلادي / كلاهما) */}
                <div className="pt-2 border-t border-[#E5DEC9]">
                  <div className="text-[11px] text-[#5C4B3B] mb-1 font-semibold flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#C88A14]" />
                    <span>{dict.calendarModeLabel}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[#EFE9DC] border border-[#DDD2BE]">
                    {(
                      [
                        { id: 'both', label: dict.calendarBoth },
                        { id: 'hijri', label: dict.calendarHijri },
                        { id: 'gregorian', label: dict.calendarGregorian },
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCalendarMode(c.id)}
                        className={`py-1.5 px-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors truncate ${
                          calendarMode === c.id
                            ? 'bg-[#2D2218] text-[#EAB338] shadow-2xs'
                            : 'text-[#5C4B3B] hover:text-[#261C14]'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
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

                {/* Focus Mode during Recitation Toggle (وضع التركيز أثناء جلسات السرد) */}
                <div className="pt-2 border-t border-[#DDD2BE] flex items-center justify-between gap-3">
                  <div className="flex flex-col pe-2">
                    <span className="font-bold text-[#2D2218] flex items-center gap-1.5 text-xs">
                      <Maximize2 className="w-3.5 h-3.5 text-[#C88A14]" />
                      <span>{dict.focusModeLabel}</span>
                    </span>
                    <span className="text-[11px] text-[#84715E] leading-relaxed">
                      {dict.focusModeHint}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFocusModeEnabled((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      focusModeEnabled ? 'bg-[#4A6144]' : 'bg-[#DDD2BE]'
                    }`}
                    role="switch"
                    aria-checked={focusModeEnabled}
                    title={dict.focusModeLabel}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        focusModeEnabled
                          ? lang === 'ar'
                            ? '-translate-x-5'
                            : 'translate-x-5'
                          : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* 3. Reminders & Data */}
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
              defaultSyncSpeed={defaultSyncSpeed}
              defaultTargetReps={defaultTargetReps}
              defaultQuizLevel={defaultQuizLevel}
              focusModeEnabled={focusModeEnabled}
              onToggleFocusMode={() => setFocusModeEnabled((prev) => !prev)}
              onClose={handleClosePlanScreen}
              onCompletePlanSard={handleCompletePlanSard}
            />
          );
        })()}
    </div>
  );
}
