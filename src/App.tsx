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
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Play,
  Compass,
  ArrowLeft,
  ArrowRight,
  PlusCircle,
  Star,
  Award,
  Brain,
  AlertCircle,
  BookMarked,
  Users,
  PhoneCall,
  PhoneOff,
} from 'lucide-react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from './firebase';
import {
  Language,
  PlanType,
  DayId,
  QuranPlanItem,
  QuranRiwayah,
  RIWAYAH_OPTIONS,
  getRiwayahLabel,
  PlanEvaluation,
  MemorizationReport,
  QuranRandomQuizItem,
  EVALUATION_OPTIONS,
  getEvaluationLabel,
  QuizLevel,
  WEEK_DAYS,
  SURAH_LIST,
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
import { MutunAdhkarSection } from './components/MutunAdhkarSection';
import { DuoRecitationSection } from './components/DuoRecitationSection';
import { SardMushafView } from './components/SardMushafView';
import { SmartMemorizationSystem } from './components/SmartMemorizationSystem';
import { RandomQuizModal } from './components/RandomQuizModal';
import { MemorizationReportModal } from './components/MemorizationReportModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { getDualDate, getCompactDualDate } from './utils/calendar';
import { memoryManager } from './utils/memoryCleanup';
import {
  IncomingDuoCall,
  syncVerifiedUserProfileAndDirectory,
} from './utils/friendsDirectory';
import {
  callRingtone,
  dispatchBackgroundCallNotification,
  dismissBackgroundCallNotification,
} from './utils/ringtone';
import {
  loadStoredReports,
  saveStoredReports,
  loadStoredQuizzes,
  saveStoredQuizzes,
  formatDualDate,
} from './utils/memorizationReports';

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

  const [initialFriendInviteToken, setInitialFriendInviteToken] = useState<string>(() => {
    try {
      const inv = new URLSearchParams(window.location.search).get('friendInvite');
      return inv ? inv.trim() : '';
    } catch {
      return '';
    }
  });

  const [pendingAcceptCallId, setPendingAcceptCallId] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('duo');
      const action = params.get('callAction');
      return code && action === 'answer' ? code.trim().toUpperCase() : null;
    } catch {
      return null;
    }
  });
  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);
  const [incomingCall, setIncomingCall] = useState<IncomingDuoCall | null>(null);
  const lastRingingCallIdRef = useRef<string | null>(null);

  const [activeSection, setActiveSection] = useState<
    'home' | 'schedule' | 'today' | 'analytics' | 'reminders' | 'mutun' | 'duo'
  >(() => (initialFriendInviteToken || pendingAcceptCallId ? 'duo' : 'home'));
  const [expandedSardPlanId, setExpandedSardPlanId] = useState<string | null>(null);
  const [smartMemorizationPlan, setSmartMemorizationPlan] = useState<QuranPlanItem | null>(null);

  // Memorization Reports & Scheduled Random Quizzes State (تقارير الحفظ المعتمدة والاختبارات العشوائية)
  const [memorizationReports, setMemorizationReports] = useState<MemorizationReport[]>(() =>
    loadStoredReports()
  );
  const [randomQuizzes, setRandomQuizzes] = useState<QuranRandomQuizItem[]>(() =>
    loadStoredQuizzes()
  );
  const [activeViewingReport, setActiveViewingReport] = useState<MemorizationReport | null>(null);
  const [activeRandomQuiz, setActiveRandomQuiz] = useState<QuranRandomQuizItem | null>(null);

  const [focusModeEnabled, setFocusModeEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_FOCUS_MODE) === 'true';
    } catch {
      return false;
    }
  });
  const [filterType, setFilterType] = useState<'all' | PlanType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Collapsible Dropdown Schedule state (نمط القائمة المنسدلة للخطط - افتراضي)
  const [collapsedDayIds, setCollapsedDayIds] = useState<Record<string, boolean>>({});

  const toggleDayCollapse = (dayId: string) => {
    setCollapsedDayIds((prev) => ({
      ...prev,
      [dayId]: !prev[dayId],
    }));
  };

  const handleToggleExpandAllDays = () => {
    const isAnyCollapsed = Object.values(collapsedDayIds).some((val) => val === true);
    if (isAnyCollapsed) {
      setCollapsedDayIds({});
    } else {
      const allCollapsed: Record<string, boolean> = {};
      WEEK_DAYS.forEach((d) => {
        allCollapsed[d.id] = true;
      });
      setCollapsedDayIds(allCollapsed);
    }
  };

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
  const [prepAlertsEnabled, setPrepAlertsEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('alutrujjah_prep_alerts');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });
  const [activeToast, setActiveToast] = useState<{
    title: string;
    body: string;
    isPrep?: boolean;
  } | null>(null);
  const lastNotifiedMinuteRef = useRef<string>('');
  const lastPrepNotifiedMinuteRef = useRef<string>('');

  const handleTogglePrepAlerts = () => {
    setPrepAlertsEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('alutrujjah_prep_alerts', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Unified Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [defaultSyncSpeed, setDefaultSyncSpeed] = useState<number>(1.0);
  const [defaultTargetReps, setDefaultTargetReps] = useState<number>(5);
  const [defaultQuizLevel, setDefaultQuizLevel] = useState<QuizLevel>('intermediate');
  const [defaultRiwayah, setDefaultRiwayah] = useState<QuranRiwayah>(() => {
    try {
      const saved = localStorage.getItem('alutrujjah_riwayah');
      if (saved === 'hafs' || saved === 'qalun' || saved === 'warsh') return saved;
    } catch {
      // ignore
    }
    return 'hafs';
  });
  const [confirmDeleteAll, setConfirmDeleteAll] = useState<boolean>(false);
  const [ramCleanupMessage, setRamCleanupMessage] = useState<string | null>(null);
  const [noPlansAlertOpen, setNoPlansAlertOpen] = useState<boolean>(false);

  const dict = t(lang);
  const todayId = getTodayDayId();

  // Global Firebase Auth + Incoming Friend Call Ringing Listener (active on all screens)
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      setAuthUser(nextUser);
      if (nextUser && nextUser.emailVerified) {
        await syncVerifiedUserProfileAndDirectory(nextUser);
      }
    });
    return () => unsubAuth();
  }, []);

  const handleDeclineIncomingCall = async (targetSessionId: string) => {
    callRingtone.stop();
    dismissBackgroundCallNotification(targetSessionId);
    setIncomingCall(null);
    lastRingingCallIdRef.current = null;
    if (!auth.currentUser?.emailVerified) return;
    const callPath = `duoSessions/${targetSessionId}`;
    try {
      await updateDoc(doc(db, 'duoSessions', targetSessionId), {
        status: 'declined',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Decline call notice:', err, callPath);
    }
  };

  const handleAcceptIncomingCall = (targetSessionId: string) => {
    callRingtone.stop();
    callRingtone.unlockAudio();
    dismissBackgroundCallNotification(targetSessionId);
    setIncomingCall(null);
    lastRingingCallIdRef.current = null;
    setPendingAcceptCallId(targetSessionId);
    setActiveSection('duo');
  };

  useEffect(() => {
    if (!authUser || !authUser.emailVerified) {
      setIncomingCall(null);
      callRingtone.stop();
      return;
    }

    const incomingQuery = query(
      collection(db, 'duoSessions'),
      where('calleeUid', '==', authUser.uid),
      where('status', '==', 'ringing')
    );

    const unsubCalls = onSnapshot(
      incomingQuery,
      (snap) => {
        if (snap.empty) {
          if (lastRingingCallIdRef.current) {
            dismissBackgroundCallNotification(lastRingingCallIdRef.current);
            lastRingingCallIdRef.current = null;
          }
          callRingtone.stop();
          setIncomingCall(null);
          return;
        }

        const firstDoc = snap.docs[0];
        const callData = firstDoc.data() as IncomingDuoCall;
        setIncomingCall(callData);

        if (lastRingingCallIdRef.current !== callData.sessionId) {
          lastRingingCallIdRef.current = callData.sessionId;
          callRingtone.start('incoming');

          const surahObj = SURAH_LIST.find((s) => s.number === callData.surahNumber);
          const rwLabel = getRiwayahLabel(callData.riwayah || 'hafs', lang);
          const surahLabel =
            callData.curriculumMode === 'page'
              ? lang === 'ar'
                ? `الصفحات ${callData.pageFrom || 1}-${callData.pageTo || callData.pageFrom || 1} (${rwLabel})`
                : `Pages ${callData.pageFrom || 1}-${callData.pageTo || callData.pageFrom || 1} (${rwLabel})`
              : surahObj
              ? lang === 'ar'
                ? `سورة ${surahObj.nameAr} (${rwLabel})`
                : `Surah ${surahObj.nameEn} (${rwLabel})`
              : '';
          dispatchBackgroundCallNotification({
            sessionId: callData.sessionId,
            callerName: callData.hostName,
            surahLabel,
            ayahRange: `${callData.ayahFrom}-${callData.ayahTo}`,
            lang,
          });
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'duoSessions');
      }
    );

    return () => {
      unsubCalls();
    };
  }, [authUser, lang]);

  // Listen to Service Worker Notification Click actions (Answer / Decline from background notification)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onSwMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.type !== 'CALL_NOTIFICATION_ACTION' || !msg.sessionId) return;
      if (msg.action === 'decline') {
        handleDeclineIncomingCall(msg.sessionId);
      } else {
        handleAcceptIncomingCall(msg.sessionId);
      }
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
  }, []);

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
    // Never play reminder sound if muted, during active Sard / Smart Memorization session
    if (!soundEnabled || expandedSardPlanId || smartMemorizationPlan) return;
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

  function getMinutesBefore(timeStr: string, minutesBefore: number = 10): string {
    const [hStr, mStr] = (timeStr || '00:00').split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    let totalMin = h * 60 + m - minutesBefore;
    if (totalMin < 0) {
      totalMin += 24 * 60;
    }
    const newH = Math.floor(totalMin / 60) % 24;
    const newM = totalMin % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  }

  const triggerReminderNotification = (
    customPlan?: QuranPlanItem,
    isPrepAlert: boolean = false
  ) => {
    // Suppress reminder audio for memorization plans ('new_memorization') and during active sessions
    const isMemorizationPlan = customPlan?.planType === 'new_memorization';
    if (!expandedSardPlanId && !smartMemorizationPlan && !isMemorizationPlan) {
      playGentleChime();
    }
    const title = isPrepAlert
      ? lang === 'ar'
        ? 'تنبيه استعداد (قبل الموعد بـ 10 دقائق)'
        : 'Readiness Alert (10 mins before)'
      : dict.notificationTestTitle;
    const body = customPlan
      ? isPrepAlert
        ? lang === 'ar'
          ? `اقترب موعد ${getPlanTypeLabel(customPlan.planType, lang)}: ${formatCurriculumTitle(
              customPlan,
              lang
            )}. يُرجى تجهيز المصحف الشريف أو التطبيق وتهيئة المكان.`
          : `Upcoming ${getPlanTypeLabel(customPlan.planType, lang)}: ${formatCurriculumTitle(
              customPlan,
              lang
            )}. Please prepare your Mushaf or app.`
        : `${getPlanTypeLabel(customPlan.planType, lang)}: ${formatCurriculumTitle(
            customPlan,
            lang
          )} (${customPlan.estimatedAyahs} ${dict.ayahsUnit})`
      : isPrepAlert
      ? lang === 'ar'
        ? 'تنبيه استعداد تجريبي: اقترب موعد الخطة، يُرجى تجهيز المصحف أو التطبيق.'
        : 'Test Readiness Alert: plan time is approaching, please prepare your Mushaf or app.'
      : dict.notificationTestBody;

    if (!expandedSardPlanId) {
      setActiveToast({ title, body, isPrep: isPrepAlert });
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

  const triggerRandomQuizReminderNotification = (
    quiz: QuranRandomQuizItem,
    isPrepAlert: boolean = false
  ) => {
    if (!expandedSardPlanId && !smartMemorizationPlan) {
      playGentleChime();
    }
    const title = isPrepAlert
      ? lang === 'ar'
        ? 'تنبيه استعداد لاختبار تثبيت الحفظ (قبل 10 دقائق)'
        : 'Readiness Alert: Retention Quiz (10 mins before)'
      : lang === 'ar'
      ? `تذكير بموعد الاختبار العشوائي: سورة ${quiz.surahNameAr}`
      : `Retention Quiz Reminder: Surah ${quiz.surahNameEn}`;

    const body = isPrepAlert
      ? lang === 'ar'
        ? `اقترب موعد الاختبار العشوائي لسورة ${quiz.surahNameAr} (${quiz.frequencyLabelAr}). تهيأ للاختبار.`
        : `Approaching retention quiz for Surah ${quiz.surahNameEn}. Prepare for testing.`
      : lang === 'ar'
      ? `حان الآن موعد الاختبار العشوائي لتثبيت الحفظ: سورة ${quiz.surahNameAr} (الآيات ${quiz.ayahFrom} - ${quiz.ayahTo}) [${quiz.frequencyLabelAr}].`
      : `It is now time for the retention quiz: Surah ${quiz.surahNameEn} (${quiz.ayahFrom} - ${quiz.ayahTo}).`;

    if (!expandedSardPlanId) {
      setActiveToast({ title, body, isPrep: isPrepAlert });
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
      // Do not trigger reminder sounds or alerts during an active Sard or Smart Memorization session
      if (expandedSardPlanId || smartMemorizationPlan) return;

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const currentHM = `${hh}:${mm}`;

      const currentDayId = getTodayDayId();
      const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')}`;

      // 1. Regular Due Plan at exact scheduled time
      if (lastNotifiedMinuteRef.current !== currentHM) {
        const duePlan = plans.find(
          (p) =>
            p.day === currentDayId &&
            p.reminderEnabled &&
            p.status !== 'completed' &&
            p.reminderTime === currentHM
        );

        if (duePlan) {
          lastNotifiedMinuteRef.current = currentHM;
          triggerReminderNotification(duePlan, false);
        } else {
          // Check for due random quizzes
          const dueQuiz = randomQuizzes.find(
            (q) =>
              (q.scheduledDate === todayYMD || q.dueDateTimestamp <= now.getTime()) &&
              q.reminderEnabled &&
              q.reminderTime === currentHM
          );
          if (dueQuiz) {
            lastNotifiedMinuteRef.current = currentHM;
            triggerRandomQuizReminderNotification(dueQuiz, false);
          }
        }
      }

      // 2. Preparation Alert (10 minutes before plan time)
      if (prepAlertsEnabled && lastPrepNotifiedMinuteRef.current !== currentHM) {
        const prepPlan = plans.find(
          (p) =>
            p.day === currentDayId &&
            p.reminderEnabled &&
            p.status !== 'completed' &&
            getMinutesBefore(p.reminderTime, 10) === currentHM
        );

        if (prepPlan) {
          lastPrepNotifiedMinuteRef.current = currentHM;
          triggerReminderNotification(prepPlan, true);
        } else {
          // Check for prep alert on random quizzes
          const prepQuiz = randomQuizzes.find(
            (q) =>
              (q.scheduledDate === todayYMD || q.dueDateTimestamp <= now.getTime()) &&
              q.reminderEnabled &&
              getMinutesBefore(q.reminderTime, 10) === currentHM
          );
          if (prepQuiz) {
            lastPrepNotifiedMinuteRef.current = currentHM;
            triggerRandomQuizReminderNotification(prepQuiz, true);
          }
        }
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [plans, randomQuizzes, lang, soundEnabled, prepAlertsEnabled, expandedSardPlanId, smartMemorizationPlan]);

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
    const target = plans.find((p) => p.id === planId);
    if (target && target.planType === 'new_memorization') {
      setSmartMemorizationPlan(target);
      return;
    }
    setExpandedSardPlanId(planId);
    try {
      window.history.pushState({ planId }, '', `#plan-${planId}`);
    } catch {
      // Ignore history pushState restriction in sandboxed iframe
    }
  };

  const handleCompleteSmartMemorization = (
    planId: string,
    evaluation: PlanEvaluation,
    spacedReviews?: QuranPlanItem[],
    report?: MemorizationReport,
    randomQuiz?: QuranRandomQuizItem
  ) => {
    const todayDual = getDualDate(new Date(), lang);
    const dateFormatted = `${todayDual.hijriDate} · ${todayDual.gregorianDate}`;
    setPlans((prev) => {
      const updated = prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              status: 'completed' as const,
              evaluation,
              completedAt: dateFormatted,
            }
          : p
      );
      if (spacedReviews && spacedReviews.length > 0) {
        return [...updated, ...spacedReviews];
      }
      return updated;
    });

    if (report) {
      setMemorizationReports((prev) => {
        const next = [report, ...prev.filter((r) => r.id !== report.id)];
        saveStoredReports(next);
        return next;
      });
      // Show report modal for celebration & confirmation
      if (evaluation === 'muthabbat') {
        setActiveViewingReport(report);
      }
    }

    if (randomQuiz) {
      setRandomQuizzes((prev) => {
        const next = [randomQuiz, ...prev.filter((q) => q.id !== randomQuiz.id)];
        saveStoredQuizzes(next);
        return next;
      });
    }

    if (evaluation === 'muthabbat') {
      setSmartMemorizationPlan(null);
    }
  };

  const handleToggleQuizReminder = (quizId: string) => {
    setRandomQuizzes((prev) => {
      const next = prev.map((q) =>
        q.id === quizId ? { ...q, reminderEnabled: !q.reminderEnabled } : q
      );
      saveStoredQuizzes(next);
      return next;
    });
  };

  const handleUpdateQuizReminderTime = (quizId: string, newTime: string) => {
    setRandomQuizzes((prev) => {
      const next = prev.map((q) => (q.id === quizId ? { ...q, reminderTime: newTime } : q));
      saveStoredQuizzes(next);
      return next;
    });
  };

  const handleStartQuiz = (quiz: QuranRandomQuizItem) => {
    setActiveViewingReport(null);
    setActiveRandomQuiz(quiz);
  };

  const handleCompleteQuiz = (quizId: string, score: number) => {
    setRandomQuizzes((prev) => {
      const updated = prev.map((q) => {
        if (q.id === quizId) {
          const now = new Date();
          let intervalDays = 7;
          if (q.frequency === 'three_days') intervalDays = 3;
          if (q.frequency === 'next_day') intervalDays = 1;

          const nextDate = new Date(now);
          nextDate.setDate(nextDate.getDate() + intervalDays);
          const yyyy = nextDate.getFullYear();
          const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
          const dd = String(nextDate.getDate()).padStart(2, '0');

          return {
            ...q,
            status: 'completed' as const,
            score,
            lastTakenDate: now.toISOString(),
            scheduledDate: `${yyyy}-${mm}-${dd}`,
            dueDateTimestamp: nextDate.getTime(),
            scheduledDateFormatted: formatDualDate(nextDate),
          };
        }
        return q;
      });
      saveStoredQuizzes(updated);
      return updated;
    });
  };

  const handleClosePlanScreen = () => {
    setExpandedSardPlanId(null);
    setSmartMemorizationPlan(null);
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
    quizLevel?: QuizLevel,
    evaluation?: PlanEvaluation
  ) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              status: 'completed',
              completedAt: completedAtDate,
              evaluation: evaluation || p.evaluation,
              quizLevel: quizLevel || p.quizLevel,
              mistakesCount: (p.mistakesCount || 0) + recordedMistakes,
            }
          : p
      )
    );
    handleClosePlanScreen();
  };

  // Direct evaluation handler for Sard, Memorization, and Review
  const handleSetPlanEvaluation = (planId: string, evaluation: PlanEvaluation) => {
    const todayDual = getDualDate(new Date(), lang);
    const dateStr = `${todayDual.hijriDate} · ${todayDual.gregorianDate}`;
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              evaluation,
              status: 'completed',
              completedAt: p.completedAt || dateStr,
            }
          : p
      )
    );
  };

  const handleToggleLanguage = () => {
    setLang((prev) => {
      const next = prev === 'ar' ? 'en' : 'ar';
      try {
        localStorage.setItem(STORAGE_KEY_LANG, next);
      } catch {
        // ignore
      }
      return next;
    });
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
      const baseNow = Date.now();
      const createdItems: QuranPlanItem[] = newPlansData.map((data, index) => ({
        ...data,
        id: `plan-${baseNow}-${index}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date(baseNow + index * 10).toISOString(),
      }));
      // Put newly added plans at the top
      setPlans((prev) => [...createdItems, ...prev]);
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
    // Put duplicated plan at the top
    setPlans((prev) => [copy, ...prev]);
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
      return {
        label: lang === 'ar' ? 'الحفظ الذكي (3 مراحل)' : 'Smart Memorization',
        Icon: Brain,
      };
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
  const nextTodayPlan = useMemo(
    () => plans.find((p) => p.day === todayId && p.status !== 'completed') || null,
    [plans, todayId]
  );
  const todayDual = useMemo(() => getDualDate(new Date(), lang), [lang]);

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="w-full min-w-full min-h-screen flex flex-col bg-[#F7F3EB] text-[#261C14] islamic-pattern-subtle overflow-x-hidden pb-20 sm:pb-24"
    >
      {/* Clean Top Bar in Original Warm Parchment, Umber & Mustard Gold Theme */}
      <header className="w-full sticky top-0 z-30 bg-[#FFFDF9]/95 backdrop-blur-md border-b border-[#DDD2BE] shadow-xs">
        <div className="w-full px-3 sm:px-6 lg:px-10 py-2 sm:py-2.5 flex items-center justify-between gap-2 flex-nowrap">
          {/* Start: Original App Logo & Brand Name */}
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('home');
            }}
            className="flex items-center gap-2.5 shrink-0 group cursor-pointer focus:outline-none"
            title={dict.brandTitle}
          >
            <img
              src="/icon.svg"
              alt={dict.brandTitle}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-[#EAB338]/70 shadow-sm object-cover group-hover:scale-105 transition-transform shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-lg sm:text-2xl font-extrabold font-display-islamic leading-none text-[#2D2218] tracking-tight whitespace-nowrap">
                {dict.brandTitle}
              </span>
              <span className="text-[10px] font-bold text-[#8B6514] mt-0.5 hidden sm:block truncate">
                {dict.brandSubtitle}
              </span>
            </div>
          </a>

          {/* Center (Desktop): Harmonious Single-Line Date */}
          <div className="hidden md:flex items-center justify-center">
            <div
              className="inline-flex items-center justify-center gap-2 px-3.5 py-1 rounded-full bg-[#F7F3EB] border border-[#DDD2BE] text-[#2D2218] font-mono-tabular select-none whitespace-nowrap text-xs shadow-2xs"
              title={dict.todayDateLabel}
            >
              <Calendar className="w-3.5 h-3.5 text-[#C88A14] shrink-0" />
              <span className="font-bold text-[#C88A14] whitespace-nowrap">
                {lang === 'ar' ? todayInfo.nameAr : todayInfo.nameEn}
              </span>
              <span className="text-[#DDD2BE]">|</span>
              <span className="font-bold text-[#2D2218] whitespace-nowrap">
                {todayDual.hijriDate}
              </span>
              <span className="text-[#C88A14] font-bold">·</span>
              <span className="text-[#5C4B3B] font-medium whitespace-nowrap">
                {todayDual.gregorianDate}
              </span>
            </div>
          </div>

          {/* End: Analytics on the right of Reminders, Reminders on the right of Language Toggle, then Settings */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
            {/* Analytics Icon directly on the right of Reminders (first in RTL order) */}
            <button
              type="button"
              onClick={() => setActiveSection('analytics')}
              title={dict.navAnalytics}
              className={`p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center shadow-2xs shrink-0 ${
                activeSection === 'analytics'
                  ? 'bg-[#EFE9DC] border-[#C88A14] text-[#9E650C]'
                  : 'bg-[#F7F3EB] hover:bg-[#EFE9DC] border-[#DDD2BE] hover:border-[#C88A14] text-[#2D2218]'
              }`}
            >
              <BarChart3 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#C88A14]" />
            </button>

            {/* Reminders Icon directly on the right of Language Toggle (in RTL) */}
            <button
              type="button"
              onClick={() => setActiveSection('reminders')}
              title={dict.navReminders}
              className={`p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center shadow-2xs shrink-0 ${
                activeSection === 'reminders'
                  ? 'bg-[#EFE9DC] border-[#C88A14] text-[#9E650C]'
                  : 'bg-[#F7F3EB] hover:bg-[#EFE9DC] border-[#DDD2BE] hover:border-[#C88A14] text-[#2D2218]'
              }`}
            >
              <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#C88A14]" />
            </button>

            {/* Language Switcher Button */}
            <button
              type="button"
              onClick={handleToggleLanguage}
              title={lang === 'ar' ? 'Switch to English' : 'التحويل إلى اللغة العربية'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-[#F7F3EB] hover:bg-[#EFE9DC] border border-[#DDD2BE] hover:border-[#C88A14] text-[#2D2218] transition-all cursor-pointer shadow-2xs shrink-0 select-none group"
            >
              <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C88A14] transition-transform group-hover:rotate-45 shrink-0" />
              <span className="text-[11px] sm:text-xs font-bold text-[#2D2218]">
                {lang === 'ar' ? 'EN' : 'عربي'}
              </span>
            </button>

            {/* Settings Button */}
            <button
              type="button"
              onClick={() => {
                setConfirmDeleteAll(false);
                setIsSettingsOpen(true);
              }}
              title={lang === 'ar' ? 'الإعدادات' : 'Settings'}
              className="p-2 sm:p-2.5 rounded-xl bg-[#F7F3EB] hover:bg-[#EFE9DC] border border-[#DDD2BE] hover:border-[#C88A14] text-[#2D2218] transition-all cursor-pointer flex items-center justify-center shadow-2xs shrink-0"
            >
              <Settings className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#C88A14]" />
            </button>
          </div>
        </div>

        {/* Mobile Centered Single-Line Date Strip */}
        <div className="md:hidden w-full flex items-center justify-center py-1 px-2 border-t border-[#E5DEC9] bg-[#F7F3EB]/95">
          <div
            className="inline-flex items-center justify-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FFFDF9] border border-[#DDD2BE] text-[#2D2218] font-mono-tabular select-none max-w-full overflow-hidden text-[11px] shadow-2xs"
            title={dict.todayDateLabel}
          >
            <Calendar className="w-3 h-3 text-[#C88A14] shrink-0" />
            <span className="font-bold text-[#C88A14] whitespace-nowrap">
              {lang === 'ar' ? todayInfo.nameAr : todayInfo.shortEn}
            </span>
            <span className="text-[#DDD2BE]">|</span>
            <span className="font-bold text-[#2D2218] whitespace-nowrap truncate">
              {todayDual.hijriDate}
            </span>
            <span className="text-[#C88A14] font-bold">·</span>
            <span className="text-[#5C4B3B] font-medium whitespace-nowrap truncate">
              {todayDual.gregorianDate}
            </span>
          </div>
        </div>

        {/* Top Left Bar directly under Date: PWA Install Button */}
        <div
          dir="ltr"
          className="w-full px-3 sm:px-6 lg:px-10 py-1 border-t border-[#E5DEC9]/80 bg-[#F7F3EB]/90 flex items-center justify-start"
        >
          <div dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <PWAInstallButton lang={lang} variant="header" />
          </div>
        </div>
      </header>

      {/* In-App Reminder Notification Banner when triggered (Soft Comfortable Earthy Theme) */}
      {activeToast && (
        <div className="bg-[#FBF3DF] text-[#261C14] border-b border-[#C88A14] px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3 text-xs sm:text-sm">
            {activeToast.isPrep ? (
              <Clock className="w-4 h-4 text-[#C88A14] shrink-0" />
            ) : (
              <Bell className="w-4 h-4 text-[#C88A14] shrink-0" />
            )}
            <div>
              <span className="font-bold text-[#9E650C]">{activeToast.title}</span>
              <span className="mx-2 text-[#C88A14]">·</span>
              <span className="text-[#261C14]">{activeToast.body}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveToast(null)}
            className="px-2.5 py-1 rounded-md bg-[#EFE9DC] border border-[#DDD2BE] text-xs font-semibold text-[#2D2218] hover:bg-[#E5DEC9] transition-colors cursor-pointer shrink-0"
          >
            {lang === 'ar' ? 'إغلاق' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 w-full px-3 sm:px-6 lg:px-10 py-4 sm:py-6 space-y-5">
        {/* HOME VIEW — Original Warm Umber, Parchment, Mustard Gold & Olive Theme (NO Tables Shown on Home!) */}
        {activeSection === 'home' && (
          <section className="max-w-5xl mx-auto space-y-5">
            {/* Centered Title & Greeting (Logo above platform title removed as requested) */}
            <div className="flex flex-col items-center text-center pt-1 pb-1 space-y-2.5">
              <h1 className="text-3xl sm:text-4xl font-extrabold font-display-islamic text-[#2D2218] leading-tight">
                {dict.homePlatformTitle}
              </h1>

              {/* Thin Line with Centered Gold Diamond + Spaced Title */}
              <div className="flex flex-col items-center gap-1.5 w-44">
                <div className="w-full flex items-center gap-2">
                  <div className="flex-1 h-px bg-[#DDD2BE]" />
                  <span className="w-2 h-2 rotate-45 bg-[#C88A14] inline-block shrink-0" />
                  <div className="flex-1 h-px bg-[#DDD2BE]" />
                </div>
                <span className="text-[11px] font-bold tracking-[0.28em] text-[#9E6A0C] uppercase">
                  {dict.homePlatformLatin}
                </span>
              </div>

              <p className="text-sm sm:text-base font-bold text-[#5C4B3B] max-w-xl leading-relaxed">
                {dict.homeWelcomeLine}
              </p>
            </div>

            {/* Guiding Compass Callout Card */}
            <div className="rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] px-4 py-3.5 flex items-center gap-3 shadow-2xs">
              <div className="w-9 h-9 rounded-full bg-[#F6E9C8] text-[#9E6A0C] flex items-center justify-center shrink-0">
                <Compass className="w-5 h-5" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-[#2D2218] leading-relaxed">
                {dict.homeGuidePrompt}
              </p>
            </div>

            {/* Clean Feature Cards Grid in Original App Palette (NO tables or schedules on home!) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1 (TOP): Add Quran Plans (Above Self-Paced Sard on all screens) */}
              <div className="md:col-span-2 gold-card-surface rounded-[24px] border border-[#E6D19E] border-t-[3px] border-t-[#C88A14] p-5 relative overflow-hidden shadow-xs flex flex-col justify-between gap-4">
                <svg className="w-28 h-28 absolute -bottom-6 -end-6 text-[#C88A14]/10 pointer-events-none" viewBox="0 0 96 96" fill="none" aria-hidden="true">
                  <rect x="20" y="20" width="56" height="56" rx="4" stroke="currentColor" strokeWidth="2" />
                  <rect x="20" y="20" width="56" height="56" rx="4" transform="rotate(45 48 48)" stroke="currentColor" strokeWidth="2" />
                </svg>

                <div className="space-y-3 relative z-10">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#F6E9C8] border border-[#E5C983] flex items-center justify-center text-[#9E650C] shrink-0">
                      <PlusCircle className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg sm:text-xl font-extrabold text-[#261C14] leading-snug">
                        {dict.homeCardAddTitle}
                      </h2>
                      <p className="text-xs sm:text-sm font-bold text-[#9E650C] mt-0.5">
                        {dict.homeCardAddSub}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-[#5C4B3B] leading-relaxed">
                    {dict.homeCardAddDesc}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1 relative z-10">
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal(todayId)}
                    className="mustard-gradient-btn rounded-full text-[#FFFDF9] px-5 py-2.5 text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    <span>{dict.homeCardAddCta}</span>
                    {lang === 'ar' ? (
                      <ArrowLeft className="w-4 h-4 shrink-0" />
                    ) : (
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    )}
                  </button>
                  <span className="text-xs font-medium text-[#84715E]">
                    {lang === 'ar' ? 'تخصيص مرن' : 'Flexible Setup'}
                  </span>
                </div>
              </div>

              {/* Card 2: Self-Paced Sard & Smart Memorization (Original Olive Green) */}
              <div className="md:col-span-2 olive-card-surface rounded-[24px] border border-[#C8D4C2] border-t-[3px] border-t-[#4A6144] p-5 relative overflow-hidden shadow-xs flex flex-col justify-between gap-4">
                <svg className="w-28 h-28 absolute -bottom-6 -end-6 text-[#4A6144]/10 pointer-events-none" viewBox="0 0 96 96" fill="none" aria-hidden="true">
                  <rect x="20" y="20" width="56" height="56" rx="4" stroke="currentColor" strokeWidth="2" />
                  <rect x="20" y="20" width="56" height="56" rx="4" transform="rotate(45 48 48)" stroke="currentColor" strokeWidth="2" />
                </svg>

                <div className="space-y-3 relative z-10">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#4A6144]/15 border border-[#4A6144]/25 flex items-center justify-center text-[#4A6144] shrink-0">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg sm:text-xl font-extrabold text-[#261C14] leading-snug">
                        {dict.homeCardSelfTitle}
                      </h2>
                      <p className="text-xs sm:text-sm font-bold text-[#4A6144] mt-0.5">
                        {dict.homeCardSelfSub}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-[#5C4B3B] leading-relaxed">
                    {dict.homeCardSelfDesc}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1 relative z-10">
                  <button
                    type="button"
                    onClick={() => {
                      if (plans.length === 0) {
                        setNoPlansAlertOpen(true);
                      } else if (nextTodayPlan) {
                        handleOpenPlanScreen(nextTodayPlan.id);
                      } else if (todayPlansCount > 0) {
                        setActiveSection('today');
                      } else {
                        setActiveSection('schedule');
                      }
                    }}
                    className="rounded-full bg-[#4A6144] hover:bg-[#3B4F36] text-[#FFFDF9] px-5 py-2.5 text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>{dict.homeCardSelfCta}</span>
                    {lang === 'ar' ? (
                      <ArrowLeft className="w-4 h-4 shrink-0" />
                    ) : (
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    )}
                  </button>
                  <span className="text-xs font-medium text-[#84715E] font-mono-tabular">
                    {todayPlansCount > 0
                      ? `${todayCompletedCount}/${todayPlansCount} ${dict.todayBadge}`
                      : lang === 'ar'
                      ? 'جاهز للبدء'
                      : 'Ready'}
                  </span>
                </div>
              </div>

              {/* Card 2b: Browser P2P Duo Recitation (Zero Server Load) */}
              <div className="md:col-span-2 gold-card-surface rounded-[24px] border border-[#E6D19E] border-t-[3px] border-t-[#C88A14] p-5 relative overflow-hidden shadow-xs flex flex-col justify-between gap-4">
                <svg className="w-28 h-28 absolute -bottom-6 -end-6 text-[#C88A14]/10 pointer-events-none" viewBox="0 0 96 96" fill="none" aria-hidden="true">
                  <rect x="20" y="20" width="56" height="56" rx="4" stroke="currentColor" strokeWidth="2" />
                  <rect x="20" y="20" width="56" height="56" rx="4" transform="rotate(45 48 48)" stroke="currentColor" strokeWidth="2" />
                </svg>

                <div className="space-y-3 relative z-10">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#F6E9C8] border border-[#E5C983] flex items-center justify-center text-[#9E650C] shrink-0">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg sm:text-xl font-extrabold text-[#261C14] leading-snug">
                        {dict.homeCardDuoTitle}
                      </h2>
                      <p className="text-xs sm:text-sm font-bold text-[#9E650C] mt-0.5">
                        {dict.homeCardDuoSub}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-[#5C4B3B] leading-relaxed">
                    {dict.homeCardDuoDesc}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1 relative z-10">
                  <button
                    type="button"
                    onClick={() => setActiveSection('duo')}
                    className="mustard-gradient-btn rounded-full text-[#FFFDF9] px-5 py-2.5 text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    <span>{dict.homeCardDuoCta}</span>
                    {lang === 'ar' ? (
                      <ArrowLeft className="w-4 h-4 shrink-0" />
                    ) : (
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    )}
                  </button>
                  <span className="text-xs font-medium text-[#84715E]">
                    {lang === 'ar' ? 'بث P2P مشفّر' : 'Direct WebRTC P2P'}
                  </span>
                </div>
              </div>

              {/* Card 3: Weekly Schedule (Original Warm Umber & Gold) */}
              <div className="umber-card-surface rounded-[24px] border border-[#DDD2BE] border-t-[3px] border-t-[#2D2218] p-5 relative overflow-hidden shadow-xs flex flex-col justify-between gap-4">
                <svg className="w-28 h-28 absolute -bottom-6 -end-6 text-[#2D2218]/10 pointer-events-none" viewBox="0 0 96 96" fill="none" aria-hidden="true">
                  <rect x="20" y="20" width="56" height="56" rx="4" stroke="currentColor" strokeWidth="2" />
                  <rect x="20" y="20" width="56" height="56" rx="4" transform="rotate(45 48 48)" stroke="currentColor" strokeWidth="2" />
                </svg>

                <div className="space-y-3 relative z-10">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#2D2218] border border-[#8F681E]/50 flex items-center justify-center text-[#EAB338] shrink-0">
                      <CalendarDays className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg sm:text-xl font-extrabold text-[#261C14] leading-snug">
                        {dict.homeCardScheduleTitle}
                      </h2>
                      <p className="text-xs sm:text-sm font-bold text-[#8B6514] mt-0.5">
                        {dict.homeCardScheduleSub}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-[#5C4B3B] leading-relaxed">
                    {dict.homeCardScheduleDesc}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1 relative z-10">
                  <button
                    type="button"
                    onClick={() => setActiveSection('schedule')}
                    className="rounded-full bg-[#2D2218] hover:bg-[#3D2F22] text-[#EAB338] px-5 py-2.5 text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>{dict.homeCardScheduleCta}</span>
                    {lang === 'ar' ? (
                      <ArrowLeft className="w-4 h-4 shrink-0" />
                    ) : (
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    )}
                  </button>
                  <span className="text-xs font-medium text-[#84715E] font-mono-tabular">
                    {plans.length} {lang === 'ar' ? 'خطة' : 'Plans'}
                  </span>
                </div>
              </div>


              {/* Card 5: Mutun & Daily Adhkar (Olive & Warm Parchment) */}
              <div className="olive-card-surface rounded-[24px] border border-[#C8D4C2] border-t-[3px] border-t-[#4A6144] p-5 relative overflow-hidden shadow-xs flex flex-col justify-between gap-4">
                <svg className="w-28 h-28 absolute -bottom-6 -end-6 text-[#4A6144]/10 pointer-events-none" viewBox="0 0 96 96" fill="none" aria-hidden="true">
                  <rect x="20" y="20" width="56" height="56" rx="4" stroke="currentColor" strokeWidth="2" />
                  <rect x="20" y="20" width="56" height="56" rx="4" transform="rotate(45 48 48)" stroke="currentColor" strokeWidth="2" />
                </svg>

                <div className="space-y-3 relative z-10">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#4A6144]/15 border border-[#4A6144]/25 flex items-center justify-center text-[#4A6144] shrink-0">
                      <BookMarked className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg sm:text-xl font-extrabold text-[#261C14] leading-snug">
                        {dict.homeCardMutunTitle}
                      </h2>
                      <p className="text-xs sm:text-sm font-bold text-[#4A6144] mt-0.5">
                        {dict.homeCardMutunSub}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-[#5C4B3B] leading-relaxed">
                    {dict.homeCardMutunDesc}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1 relative z-10">
                  <button
                    type="button"
                    onClick={() => setActiveSection('mutun')}
                    className="rounded-full bg-[#4A6144] hover:bg-[#3B4F36] text-[#FFFDF9] px-5 py-2.5 text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>{dict.homeCardMutunCta}</span>
                    {lang === 'ar' ? (
                      <ArrowLeft className="w-4 h-4 shrink-0" />
                    ) : (
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    )}
                  </button>
                  <span className="text-xs font-medium text-[#84715E]">
                    {lang === 'ar' ? 'قراءة مريحة' : 'Easy Reading'}
                  </span>
                </div>
              </div>

            </div>
          </section>
        )}
        {/* Compact Hero & Contextual Action Strip */}
        {(activeSection === 'schedule' || activeSection === 'today') && (
          <section className="earthy-gradient-banner rounded-xl sm:rounded-2xl px-3.5 py-3 sm:px-5 sm:py-3.5 text-[#FFFDF9] relative overflow-hidden border border-[#8F681E]/40 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative z-10 flex flex-col gap-0.5">
              <h1 className="text-base sm:text-lg font-bold font-display-islamic leading-snug text-[#FFFDF9]">
                {dict.heroTitle}
              </h1>
              <p className="text-[11px] sm:text-xs text-[#E6D7BE]">
                {dict.heroSubtitle}
              </p>
            </div>

            <div className="relative z-10 shrink-0 flex flex-wrap items-center gap-2">
              {nextTodayPlan && (
                <button
                  type="button"
                  onClick={() => handleOpenPlanScreen(nextTodayPlan.id)}
                  className="px-3.5 py-2 rounded-xl bg-[#4A6144] hover:bg-[#3F543A] border border-[#82A879]/40 text-xs sm:text-sm font-bold text-[#FFFDF9] shadow-2xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{dict.startTodayBtn}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  setActiveSection(activeSection === 'today' ? 'schedule' : 'today')
                }
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-[#EAB338]/35 text-xs sm:text-sm font-bold text-[#FDE68A] transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              >
                {activeSection === 'today' ? (
                  <>
                    <CalendarDays className="w-4 h-4 shrink-0" />
                    <span>{dict.navSchedule}</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4 shrink-0" />
                    <span>{dict.navToday}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleOpenAddModal(todayId)}
                className="mustard-gradient-btn px-3.5 py-2 sm:px-4 rounded-xl text-xs sm:text-sm font-bold text-[#FFFDF9] shadow-2xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>{dict.addPlanBtn}</span>
              </button>
            </div>
          </section>
        )}

        {/* SCHEDULE & TODAY VIEW */}
        {(activeSection === 'schedule' || activeSection === 'today') && (
          <section className="space-y-3">
            {/* Welcoming Quick-Start Banner when no plans exist yet */}
            {plans.length === 0 && (
              <div className="rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="space-y-1">
                  <h2 className="text-sm sm:text-base font-bold font-display-islamic text-[#261C14]">
                    {dict.emptyScheduleTitle}
                  </h2>
                  <p className="text-xs text-[#5C4B3B] leading-relaxed">
                    {dict.emptyScheduleDesc}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal(todayId)}
                    className="mustard-gradient-btn px-4 py-2 rounded-xl text-xs font-bold text-[#FFFDF9] shadow-2xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{dict.addPlanBtn}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Schedule Controls & Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#FFFDF9] p-2.5 rounded-xl border border-[#DDD2BE]">
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
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer text-center whitespace-nowrap ${
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
                    className="w-full ps-8 pe-2.5 py-1.5 rounded-lg bg-[#F7F3EB] border border-[#DDD2BE] text-xs text-[#261C14] placeholder-[#84715E] focus:outline-none focus:border-[#C88A14]"
                  />
                </div>
                {/* Collapsible Dropdown Schedule Toggle Button */}
                <button
                  type="button"
                  onClick={handleToggleExpandAllDays}
                  className="px-2.5 py-1.5 rounded-lg border border-[#DDD2BE] bg-[#F7F3EB] text-[#5C4B3B] hover:text-[#261C14] hover:bg-[#EFE9DC] text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                  title={lang === 'ar' ? 'طي أو توسيع القوائم المنسدلة للخطط' : 'Toggle Dropdown Lists'}
                >
                  <ChevronDown className="w-3.5 h-3.5 text-[#C88A14]" />
                  <span>
                    {Object.values(collapsedDayIds).some((v) => v)
                      ? dict.expandAllBtn
                      : dict.collapseAllBtn}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleResetCompletion}
                  title={dict.clearCompletedBtn}
                  className="px-2.5 py-1.5 rounded-lg border border-[#DDD2BE] bg-[#F7F3EB] text-[#5C4B3B] hover:text-[#261C14] hover:bg-[#EFE9DC] transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#84715E]" />
                  <span className="hidden md:inline">{dict.clearCompletedBtn}</span>
                </button>
              </div>
            </div>

            {/* UNIFIED SCHEDULE PATTERN (النمط الموحد لجدول السرد والخطط على مختلف الأجهزة) */}
              <div className="space-y-3.5 sm:space-y-4 w-full">
                {visibleDays.map((day) => {
                  const dayPlans = filteredPlans
                    .filter((p) => p.day === day.id)
                    .sort((a, b) => {
                      const timeA = new Date(a.createdAt || 0).getTime();
                      const timeB = new Date(b.createdAt || 0).getTime();
                      if (timeB !== timeA) return timeB - timeA;
                      return b.id.localeCompare(a.id);
                    });
                    const isToday = day.id === todayId;
                  const doneCount = dayPlans.filter((p) => p.status === 'completed').length;
                  const dayDual = getCompactDualDate(day.id, lang);
                  const isCollapsed = !!collapsedDayIds[day.id];

                  return (
                    <div
                      key={day.id}
                      className={`rounded-2xl bg-[#FFFDF9] border overflow-hidden shadow-2xs transition-all ${
                        isToday
                          ? 'border-[#C88A14] ring-1 ring-[#C88A14]/30'
                          : 'border-[#DDD2BE]'
                      }`}
                    >
                      {/* Day Header Bar (Collapsible Dropdown Trigger) */}
                      <div
                        onClick={() => toggleDayCollapse(day.id)}
                        className={`px-3.5 py-2.5 border-b flex items-center justify-between gap-2 cursor-pointer select-none transition-colors ${
                          isToday
                            ? 'bg-[#2D2218] text-[#FFFDF9] border-[#2D2218] hover:bg-[#3D2F22]'
                            : 'bg-[#F7F3EB] text-[#261C14] border-[#DDD2BE] hover:bg-[#EFE9DC]'
                        }`}
                        title={lang === 'ar' ? 'اضغط لفتح أو طي القائمة المنسدلة للخطط' : 'Click to toggle dropdown schedule'}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          {isCollapsed ? (
                            <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isToday ? 'text-[#EAB338]' : 'text-[#C88A14]'}`} />
                          ) : (
                            <ChevronUp className={`w-4 h-4 shrink-0 transition-transform ${isToday ? 'text-[#EAB338]' : 'text-[#C88A14]'}`} />
                          )}
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

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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

                      {/* Vertical Stream of Dropdown Plans */}
                      {!isCollapsed ? (
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
                                  className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors hover:bg-[#F7F3EB]/40"
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
                                        className={`text-base font-bold font-display-islamic ${
                                          isCompleted ? 'line-through opacity-60 text-[#84715E]' : 'text-[#261C14]'
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
                                      {plan.evaluation && (
                                        <span
                                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${
                                            plan.evaluation === 'muthabbat'
                                              ? 'bg-[#4A6144]/15 text-[#4A6144] border-[#4A6144]/30'
                                              : plan.evaluation === 'mutaraddid'
                                              ? 'bg-[#C88A14]/15 text-[#9E650C] border-[#C88A14]/30'
                                              : 'bg-[#A84A32]/15 text-[#A84A32] border-[#A84A32]/30'
                                          }`}
                                        >
                                          <Award className="w-3 h-3" />
                                          <span>{getEvaluationLabel(plan.evaluation, lang)}</span>
                                        </span>
                                      )}
                                    </div>

                                    {plan.notes && (
                                      <p className="text-xs text-[#84715E] line-clamp-1">{plan.notes}</p>
                                    )}

                                    {/* Direct Evaluation Rating Buttons for Sard, Memorization, and Review */}
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                      <span className="text-[11px] font-semibold text-[#84715E]">
                                        {lang === 'ar' ? 'أزرار التقييم:' : 'Evaluation:'}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        {EVALUATION_OPTIONS.map((opt) => {
                                          const isSelected = plan.evaluation === opt.id;
                                          return (
                                            <button
                                              key={opt.id}
                                              type="button"
                                              onClick={() => handleSetPlanEvaluation(plan.id, opt.id)}
                                              title={lang === 'ar' ? `تقييم: ${opt.labelAr}` : `Rate: ${opt.labelEn}`}
                                              className={`px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                                isSelected
                                                  ? opt.id === 'muthabbat'
                                                    ? 'bg-[#4A6144] text-white border-[#4A6144] shadow-2xs'
                                                    : opt.id === 'mutaraddid'
                                                    ? 'bg-[#C88A14] text-white border-[#C88A14] shadow-2xs'
                                                    : 'bg-[#A84A32] text-white border-[#A84A32] shadow-2xs'
                                                  : 'bg-[#FFFDF9] text-[#5C4B3B] border-[#DDD2BE] hover:bg-[#EFE9DC] hover:border-[#C88A14]'
                                              }`}
                                            >
                                              <Star
                                                className={`w-3 h-3 ${
                                                  isSelected ? 'fill-current text-white' : 'text-[#84715E]'
                                                }`}
                                              />
                                              <span>{lang === 'ar' ? opt.labelAr : opt.labelEn}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
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
                      ) : (
                        <div
                          onClick={() => toggleDayCollapse(day.id)}
                          className="py-2.5 px-4 bg-[#FFFDF9] hover:bg-[#F7F3EB] cursor-pointer text-xs text-[#84715E] font-semibold text-center border-t border-[#EFE9DC] flex items-center justify-center gap-1.5"
                        >
                          <ChevronDown className="w-3.5 h-3.5 text-[#C88A14]" />
                          <span>
                            {lang === 'ar'
                              ? `القائمة المنسدلة مطوية (${dayPlans.length} خطط) - اضغط للعرض`
                              : `Dropdown list collapsed (${dayPlans.length} plans) - click to expand`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
          </section>
        )}

        {/* ANALYTICS DEDICATED VIEW */}
        {activeSection === 'analytics' && (
          <AnalyticsSection
            plans={plans}
            reports={memorizationReports}
            quizzes={randomQuizzes}
            lang={lang}
            onStartQuiz={handleStartQuiz}
            onViewReport={(rep) => setActiveViewingReport(rep)}
          />
        )}

        {/* REMINDERS DEDICATED VIEW */}
        {activeSection === 'reminders' && (
          <RemindersSection
            plans={plans}
            quizzes={randomQuizzes}
            lang={lang}
            notificationPermission={notificationPermission}
            soundEnabled={soundEnabled}
            prepAlertsEnabled={prepAlertsEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            onTogglePrepAlerts={handleTogglePrepAlerts}
            onRequestPermission={handleRequestPermission}
            onTriggerTestReminder={(plan, isPrep) => triggerReminderNotification(plan, isPrep)}
            onTogglePlanReminder={handleTogglePlanReminder}
            onUpdatePlanReminderTime={handleUpdatePlanReminderTime}
            onToggleQuizReminder={handleToggleQuizReminder}
            onUpdateQuizReminderTime={handleUpdateQuizReminderTime}
            onStartQuiz={handleStartQuiz}
            onTriggerTestQuizReminder={(q) => triggerRandomQuizReminderNotification(q, false)}
          />
        )}

        {/* MUTUN & ADHKAR DEDICATED VIEW */}
        {activeSection === 'mutun' && <MutunAdhkarSection lang={lang} />}

        {/* BROWSER P2P DUO RECITATION DEDICATED VIEW */}
        {activeSection === 'duo' && (
          <DuoRecitationSection
            lang={lang}
            defaultRiwayah={defaultRiwayah}
            initialFriendInviteToken={initialFriendInviteToken}
            onClearFriendInvite={() => setInitialFriendInviteToken('')}
            pendingAcceptCallId={pendingAcceptCallId}
            onClearPendingCall={() => setPendingAcceptCallId(null)}
          />
        )}
      </main>

      {/* Fixed Bottom Navigation Bar (5 Clean Tabs: الرئيسية، اليوم، الثنائي، الأسبوعي، المكتبة) */}
      <nav
        aria-label={lang === 'ar' ? 'التنقل الرئيسي' : 'Primary navigation'}
        className="fixed bottom-0 inset-x-0 z-40 bg-[#FFFDF9]/95 backdrop-blur-md border-t border-[#DDD2BE] shadow-[0_-4px_18px_rgba(45,34,24,0.08)]"
      >
        <div className="max-w-5xl mx-auto px-2 sm:px-4 py-1.5 grid grid-cols-5 gap-1 sm:gap-2 items-center">
          {/* 1. Home (الرئيسية) */}
          <button
            type="button"
            onClick={() => setActiveSection('home')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSection === 'home'
                ? 'bg-[#2D2218] text-[#EAB338] shadow-xs'
                : 'text-[#5C4B3B] hover:text-[#261C14] hover:bg-[#EFE9DC]'
            }`}
          >
            <Home className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 ${activeSection === 'home' ? 'text-[#EAB338]' : 'text-[#C88A14]'}`} />
            <span className="leading-none truncate max-w-full">{dict.navHome}</span>
          </button>

          {/* 2. Today / Self (اليوم) */}
          <button
            type="button"
            onClick={() => setActiveSection('today')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSection === 'today'
                ? 'bg-[#2D2218] text-[#EAB338] shadow-xs'
                : 'text-[#5C4B3B] hover:text-[#261C14] hover:bg-[#EFE9DC]'
            }`}
          >
            <BookOpen className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 ${activeSection === 'today' ? 'text-[#EAB338]' : 'text-[#C88A14]'}`} />
            <span className="leading-none truncate max-w-full">{dict.navToday}</span>
          </button>

          {/* 3. Browser P2P Duo Sard (الثنائي) */}
          <button
            type="button"
            onClick={() => setActiveSection('duo')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSection === 'duo'
                ? 'bg-[#2D2218] text-[#EAB338] shadow-xs'
                : 'text-[#5C4B3B] hover:text-[#261C14] hover:bg-[#EFE9DC]'
            }`}
          >
            <Users className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 ${activeSection === 'duo' ? 'text-[#EAB338]' : 'text-[#C88A14]'}`} />
            <span className="leading-none truncate max-w-full">{dict.navDuo}</span>
          </button>

          {/* 4. Weekly Schedule (الأسبوعي) */}
          <button
            type="button"
            onClick={() => setActiveSection('schedule')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSection === 'schedule'
                ? 'bg-[#2D2218] text-[#EAB338] shadow-xs'
                : 'text-[#5C4B3B] hover:text-[#261C14] hover:bg-[#EFE9DC]'
            }`}
          >
            <CalendarDays className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 ${activeSection === 'schedule' ? 'text-[#EAB338]' : 'text-[#C88A14]'}`} />
            <span className="leading-none truncate max-w-full">{dict.navSchedule}</span>
          </button>

          {/* 5. Library (المكتبة) */}
          <button
            type="button"
            onClick={() => setActiveSection('mutun')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSection === 'mutun'
                ? 'bg-[#2D2218] text-[#EAB338] shadow-xs'
                : 'text-[#5C4B3B] hover:text-[#261C14] hover:bg-[#EFE9DC]'
            }`}
          >
            <BookMarked className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 ${activeSection === 'mutun' ? 'text-[#EAB338]' : 'text-[#4A6144]'}`} />
            <span className="leading-none truncate max-w-full">{dict.navMutun}</span>
          </button>
        </div>
      </nav>

      {/* Global Incoming Friend Call Ringing Window (Both Sides Call Modal Experience) */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] bg-[#2D2218] text-[#FFFDF9] border-2 border-[#EAB338] p-6 text-center space-y-5 shadow-2xl">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-[#EAB338]/30 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-[#4A6144] border-2 border-[#EAB338] flex items-center justify-center text-[#FFFDF9]">
                <PhoneCall className="w-7 h-7 animate-bounce" />
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-bold text-[#EAB338]">
                {lang === 'ar' ? 'مكالمة سرد ثنائي واردة 🔔' : 'Incoming Duo Sard Call'}
              </p>
              <h3 className="text-xl font-extrabold font-display-islamic">
                {incomingCall.hostName}
              </h3>
              <p className="text-xs text-[#E6D7BE]">
                {(() => {
                  const rw = getRiwayahLabel(incomingCall.riwayah || 'hafs', lang);
                  if (incomingCall.curriculumMode === 'page') {
                    const p1 = incomingCall.pageFrom || 1;
                    const p2 = incomingCall.pageTo || p1;
                    return lang === 'ar'
                      ? `${p1 === p2 ? `صفحة ${p1}` : `الصفحات ${p1} - ${p2}`} · برواية ${rw}`
                      : `${p1 === p2 ? `Page ${p1}` : `Pages ${p1}-${p2}`} · ${rw}`;
                  }
                  const s = SURAH_LIST.find((item) => item.number === incomingCall.surahNumber);
                  return s
                    ? lang === 'ar'
                      ? `سورة ${s.nameAr} (الآيات ${incomingCall.ayahFrom} - ${incomingCall.ayahTo}) · برواية ${rw}`
                      : `Surah ${s.nameEn} (${incomingCall.ayahFrom} - ${incomingCall.ayahTo}) · ${rw}`
                    : '';
                })()}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleDeclineIncomingCall(incomingCall.sessionId)}
                className="py-3 px-4 rounded-2xl bg-[#A84A32] hover:bg-[#8E3B26] text-[#FFFDF9] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <PhoneOff className="w-4 h-4" />
                <span>{lang === 'ar' ? 'رفض' : 'Decline'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleAcceptIncomingCall(incomingCall.sessionId)}
                className="py-3 px-4 rounded-2xl bg-[#4A6144] hover:bg-[#3B4F36] border border-[#82A879]/50 text-[#FFFDF9] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <PhoneCall className="w-4 h-4" />
                <span>{lang === 'ar' ? 'ردّ الآن' : 'Answer'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Plans Alert Modal when user clicks "Start Self-Paced Sard" on empty schedule */}
      {noPlansAlertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-[#FFFDF9] border-2 border-[#C88A14]/70 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-4 py-3 bg-[#EFE9DC] border-b border-[#DDD2BE] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#C88A14] shrink-0" />
                <h3 className="text-sm sm:text-base font-bold font-display-islamic text-[#2D2218]">
                  {dict.noPlansAlertTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNoPlansAlertOpen(false)}
                className="p-1 rounded-lg hover:bg-[#DDD2BE]/60 text-[#5C4B3B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-xs sm:text-sm text-[#5C4B3B] leading-relaxed">
                {dict.noPlansAlertDesc}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNoPlansAlertOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-[#EFE9DC] hover:bg-[#DDD2BE] text-[#5C4B3B] text-xs font-bold cursor-pointer transition-colors"
                >
                  {dict.noPlansAlertCloseBtn}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNoPlansAlertOpen(false);
                    handleOpenAddModal(todayId);
                  }}
                  className="mustard-gradient-btn px-4 py-2 rounded-xl text-[#FFFDF9] text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{dict.noPlansAlertAddBtn}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Plan Modal */}
      <PlanModal
        isOpen={isModalOpen}
        lang={lang}
        initialDay={modalInitialDay}
        defaultRiwayah={defaultRiwayah}
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

                  <div>
                    <div className="text-[11px] text-[#5C4B3B] mb-1 font-semibold">
                      {lang === 'ar' ? 'الرواية الافتراضية' : 'Default Riwayah'}
                    </div>
                    <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[#EFE9DC] border border-[#DDD2BE]">
                      {RIWAYAH_OPTIONS.map((rw) => (
                        <button
                          key={rw.id}
                          type="button"
                          onClick={() => {
                            setDefaultRiwayah(rw.id);
                            try {
                              localStorage.setItem('alutrujjah_riwayah', rw.id);
                            } catch {
                              // ignore
                            }
                          }}
                          className={`py-1 rounded-md text-xs font-bold cursor-pointer ${
                            defaultRiwayah === rw.id
                              ? 'bg-[#2D2218] text-[#EAB338]'
                              : 'text-[#5C4B3B] hover:text-[#261C14]'
                          }`}
                        >
                          {lang === 'ar' ? rw.shortAr : rw.shortEn}
                        </button>
                      ))}
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

              {/* 5. Reminders & Alerts Settings */}
              <div className="p-3 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] space-y-3">
                {/* 5.1 Preparation Alerts (قبل موعد الخطة بـ 10 دقائق لتجهيز المصحف أو التطبيق) */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-[#2D2218] flex items-center gap-1.5 text-xs">
                      <Clock className="w-3.5 h-3.5 text-[#C88A14]" />
                      <span>{dict.prepAlertsTitle}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleTogglePrepAlerts}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1 transition-all ${
                          prepAlertsEnabled
                            ? 'bg-[#4A6144] text-white shadow-2xs'
                            : 'bg-[#EFE9DC] text-[#5C4B3B]'
                        }`}
                      >
                        <Check className={`w-3.5 h-3.5 ${prepAlertsEnabled ? 'opacity-100' : 'opacity-0'}`} />
                        <span>
                          {prepAlertsEnabled
                            ? lang === 'ar'
                              ? 'مفعّل'
                              : 'On'
                            : lang === 'ar'
                            ? 'معطّل'
                            : 'Off'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => triggerReminderNotification(undefined, true)}
                        className="px-2.5 py-1 rounded-lg border border-[#C88A14] bg-[#FBF5E6] text-[#2D2218] text-xs font-bold cursor-pointer"
                      >
                        {dict.prepAlertsTestBtn}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#5C4B3B] leading-relaxed">
                    {dict.prepAlertsDesc}
                  </p>
                </div>

                {/* 5.2 Sound Alerts Toggle */}
                <div className="pt-2 border-t border-[#DDD2BE]/70 flex flex-wrap items-center justify-between gap-2">
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
              defaultRiwayah={defaultRiwayah}
              onClose={handleClosePlanScreen}
              onCompletePlanSard={handleCompletePlanSard}
              onOpenSmartMemorization={() => {
                setExpandedSardPlanId(null);
                setSmartMemorizationPlan(activeExecutionPlan);
              }}
            />
          );
        })()}

      {/* Dedicated Smart Quran Memorization System (نظام إدارة خطة الحفظ الذكي - 3 مراحل متتالية وصارمة) */}
      {smartMemorizationPlan && (
        <SmartMemorizationSystem
          lang={lang}
          plan={smartMemorizationPlan}
          onClose={() => setSmartMemorizationPlan(null)}
          onCompleteMemorization={handleCompleteSmartMemorization}
        />
      )}

      {/* Random Retention Quiz Modal (الاختبار العشوائي لتثبيت الحفظ) */}
      {activeRandomQuiz && (
        <RandomQuizModal
          quiz={activeRandomQuiz}
          lang={lang}
          onClose={() => setActiveRandomQuiz(null)}
          onCompleteQuiz={handleCompleteQuiz}
        />
      )}

      {/* Certified Memorization Report Modal (تقرير إتمام الحفظ المعتمد) */}
      {activeViewingReport && (
        <MemorizationReportModal
          report={activeViewingReport}
          lang={lang}
          onClose={() => setActiveViewingReport(null)}
          onStartQuizNow={() => {
            const matchingQuiz = randomQuizzes.find((q) => q.reportId === activeViewingReport.id);
            if (matchingQuiz) {
              handleStartQuiz(matchingQuiz);
            } else {
              const targetQuiz: QuranRandomQuizItem = {
                id: `dynamic-${Date.now()}`,
                reportId: activeViewingReport.id,
                planId: activeViewingReport.planId,
                surahNumber: activeViewingReport.surahNumber,
                surahNameAr: activeViewingReport.surahNameAr,
                surahNameEn: activeViewingReport.surahNameEn,
                ayahFrom: activeViewingReport.ayahFrom,
                ayahTo: activeViewingReport.ayahTo,
                evaluation: activeViewingReport.evaluation,
                frequency: activeViewingReport.randomQuizSchedule.frequency,
                frequencyLabelAr: activeViewingReport.randomQuizSchedule.frequencyLabelAr,
                scheduledDate: activeViewingReport.randomQuizSchedule.scheduledDate,
                scheduledDateFormatted: activeViewingReport.randomQuizSchedule.scheduledDateFormatted,
                dueDateTimestamp: Date.now(),
                reminderTime: activeViewingReport.randomQuizSchedule.reminderTime,
                reminderEnabled: true,
                status: 'pending',
                createdAt: new Date().toISOString(),
              };
              handleStartQuiz(targetQuiz);
            }
          }}
          onViewInAnalytics={() => {
            setActiveViewingReport(null);
            setActiveSection('analytics');
          }}
        />
      )}
    </div>
  );
}
