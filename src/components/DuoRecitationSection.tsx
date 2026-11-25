import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Users,
  Mail,
  Lock,
  LogIn,
  LogOut,
  ShieldCheck,
  Mic,
  MicOff,
  PhoneOff,
  PhoneCall,
  UserPlus,
  Trash2,
  Copy,
  Check,
  ArrowLeftRight,
  AlertCircle,
  BookOpen,
  RefreshCw,
  Link2,
  UserCheck,
  Sparkles,
  Eye,
  EyeOff,
  BellRing,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Share2,
  Search,
  FileText,
  Hash,
  Touchpad,
  ListFilter,
  UserX,
  Award,
  Radio,
  Volume2,
  Volume1,
  X,
} from 'lucide-react';
import { auth, db, googleProvider, OperationType, handleFirestoreError } from '../firebase';
import {
  Language,
  QuranRiwayah,
  RIWAYAH_OPTIONS,
  SURAH_LIST,
  getRiwayahLabel,
} from '../data/quranData';
import { memoryManager } from '../utils/memoryCleanup';
import {
  FriendContactItem,
  FriendInviteDoc,
  FriendRequestDoc,
  syncVerifiedUserProfileAndDirectory,
  updateUserPresenceHeartbeat,
  subscribeFriendPresence,
  formatFriendShortCode,
  getOrCreateMyFriendInvite,
  regenerateMyFriendInvite,
  fetchFriendInviteDetails,
  sendConsentFriendRequest,
  approveIncomingFriendRequest,
  declineIncomingFriendRequest,
  getDisplayNameForUser,
} from '../utils/friendsDirectory';
import {
  callRingtone,
  dismissBackgroundCallNotification,
} from '../utils/ringtone';
import {
  TrustedQuranSourceId,
  TrustedVerseItem,
  TRUSTED_QURAN_SOURCES,
  fetchTrustedCurriculumVerses,
} from '../utils/trustedQuranApi';

// ============================================================================
// إعدادات خادم TURN لوضع الخصوصية العالية وإخفاء عنوان الـ IP الحقيقي (IP Masking)
// ضع بيانات خادم TURN المجاني الخاص بك هنا لاحقاً بسهولة:
// ============================================================================
export const TURN_SERVER_URL = '';
export const TURN_USERNAME = '';
export const TURN_CREDENTIAL = '';

export type SessionEvaluationRating =
  | 'excellent'
  | 'very_good'
  | 'good_practice'
  | 'needs_review';

const EVALUATION_CHOICES: {
  id: SessionEvaluationRating;
  labelAr: string;
  labelEn: string;
}[] = [
  { id: 'excellent', labelAr: 'ممتاز — متقن', labelEn: 'Excellent — Mastered' },
  { id: 'very_good', labelAr: 'جيد جداً', labelEn: 'Very Good' },
  { id: 'good_practice', labelAr: 'جيد — يحتاج تثبيتاً', labelEn: 'Good — Needs Reinforcement' },
  { id: 'needs_review', labelAr: 'يحتاج مراجعة مركزة', labelEn: 'Needs Focused Review' },
];

interface DuoRecitationSectionProps {
  lang: Language;
  defaultRiwayah?: QuranRiwayah;
  initialFriendInviteToken?: string;
  onClearFriendInvite?: () => void;
  pendingAcceptCallId?: string | null;
  onClearPendingCall?: () => void;
  onOpenPrivacyTerms?: () => void;
}

interface DuoSessionDoc {
  sessionId: string;
  hostUid: string;
  hostName: string;
  guestUid?: string | null;
  guestName?: string | null;
  calleeUid: string;
  callMode: 'friend_call';
  riwayah?: QuranRiwayah;
  curriculumMode?: 'surah' | 'ayah' | 'page';
  surahNumber: number;
  surahEnd?: number;
  ayahFrom: number;
  ayahTo: number;
  pageFrom?: number;
  pageTo?: number;
  hideVersesForReciter?: boolean;
  hideVersesForListener?: boolean;
  activeAyah?: number;
  reciterSide?: 'host' | 'guest';
  mistakesCount?: number;
  markedErrors?: string[];
  endedByUid?: string | null;
  sessionEvaluation?: SessionEvaluationRating | null;
  callDurationSeconds?: number | null;
  accuracyPct?: number | null;
  offerType: string;
  offerSdp: string;
  answerType?: string | null;
  answerSdp?: string | null;
  status: 'ringing' | 'active' | 'declined' | 'ended';
}

interface CallSummaryBanner {
  partnerName: string;
  evaluation: SessionEvaluationRating;
  durationSeconds: number;
  mistakesCount: number;
  accuracyPct: number;
}

function toArabicDigits(value: string | number): string {
  const map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(value).replace(/\d/g, (d) => map[Number(d)] ?? d);
}

function formatCallDuration(totalSeconds: number, isAr: boolean): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = String(Math.floor(safe / 60)).padStart(2, '0');
  const secs = String(safe % 60).padStart(2, '0');
  const formatted = `${mins}:${secs}`;
  return isAr ? toArabicDigits(formatted) : formatted;
}

function parseMarkedErrorToken(token: string): {
  verseKey: string;
  word: string;
  wordIndex: number;
} {
  const parts = token.split('|');
  const verseKey = parts[0] || '';
  const word = parts[1] || token;
  const wordIndex = Number(parts[2] ?? -1);
  return { verseKey, word, wordIndex };
}

function buildRtcConfiguration(highPrivacyRelay: boolean): RTCConfiguration {
  const iceServers: RTCIceServer[] = [];
  const turnUrl = TURN_SERVER_URL.trim();

  if (turnUrl) {
    iceServers.push({
      urls: turnUrl,
      ...(TURN_USERNAME.trim() ? { username: TURN_USERNAME.trim() } : {}),
      ...(TURN_CREDENTIAL.trim() ? { credential: TURN_CREDENTIAL.trim() } : {}),
    });
  }

  // Enforce strict TURN relay IP masking only when a TURN server is configured;
  // otherwise use encrypted DTLS-SRTP STUN routing so live voice connects immediately.
  const effectiveRelayOnly = highPrivacyRelay && Boolean(turnUrl);

  if (!effectiveRelayOnly) {
    iceServers.push(
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    );
  }

  return {
    iceServers,
    iceTransportPolicy: effectiveRelayOnly ? 'relay' : 'all',
    iceCandidatePoolSize: 2,
  };
}

// Cryptographically random non-sequential 8-character ephemeral session ID
function generateEphemeralSessionId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomBytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < randomBytes.length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += chars.charAt(randomBytes[i] % chars.length);
  }
  return `SARD-${suffix}`;
}

function waitForIceComplete(pc: RTCPeerConnection, timeoutMs = 3500): Promise<void> {
  if (pc.iceGatheringState === 'complete') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    let candidateSettleTimer: ReturnType<typeof setTimeout> | null = null;
    const done = () => {
      if (settled) return;
      settled = true;
      pc.removeEventListener('icegatheringstatechange', onStateChange);
      pc.removeEventListener('icecandidate', onCandidate);
      clearTimeout(timer);
      if (candidateSettleTimer !== null) {
        clearTimeout(candidateSettleTimer);
      }
      resolve();
    };
    const onStateChange = () => {
      if (pc.iceGatheringState === 'complete') {
        done();
      }
    };
    const onCandidate = (event: RTCPeerConnectionIceEvent) => {
      if (!event.candidate) {
        done();
        return;
      }
      const cand = event.candidate.candidate || '';
      if (
        (cand.includes('typ srflx') || cand.includes('typ relay')) &&
        candidateSettleTimer === null
      ) {
        candidateSettleTimer = setTimeout(done, 600);
      }
    };
    pc.addEventListener('icegatheringstatechange', onStateChange);
    pc.addEventListener('icecandidate', onCandidate);
    const timer = setTimeout(done, timeoutMs);
  });
}

function mapFirebaseAuthError(
  err: unknown,
  lang: Language
): { message: string; isProviderDisabled?: boolean } {
  const code = (err as { code?: string })?.code || '';
  if (code === 'auth/operation-not-allowed') {
    return {
      isProviderDisabled: true,
      message:
        lang === 'ar'
          ? 'الدخول بالبريد غير مفعّل بعد في Firebase. استخدم «الدخول السريع عبر Google».'
          : 'Email/Password sign-in is disabled. Use Google Sign-In.',
    };
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return {
      message:
        lang === 'ar'
          ? 'البريد أو كلمة المرور غير صحيحة.'
          : 'Invalid email or password.',
    };
  }
  if (code === 'auth/email-already-in-use') {
    return {
      message:
        lang === 'ar'
          ? 'هذا البريد مسجل مسبقاً. اختر «تسجيل الدخول».'
          : 'Email already registered. Switch to Sign In.',
    };
  }
  if (code === 'auth/weak-password') {
    return {
      message:
        lang === 'ar'
          ? 'كلمة المرور ضعيفة؛ يُرجى إدخال 6 أحرف على الأقل.'
          : 'Password is too weak (minimum 6 characters).',
    };
  }
  if (code === 'auth/invalid-email') {
    return {
      message:
        lang === 'ar' ? 'صيغة البريد الإلكتروني غير صحيحة.' : 'Invalid email address format.',
    };
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      message:
        lang === 'ar'
          ? 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.'
          : 'Sign-in popup was closed before completing.',
    };
  }
  if (code === 'auth/unauthorized-domain') {
    return {
      message:
        lang === 'ar'
          ? 'هذا النطاق غير مصرح به في Firebase Auth.'
          : 'This domain is not authorized in Firebase Authentication.',
    };
  }
  return {
    message:
      err instanceof Error
        ? err.message
        : lang === 'ar'
        ? 'تعذر إتمام تسجيل الدخول. يُرجى المحاولة مجدداً.'
        : 'Sign-in failed. Please try again.',
  };
}

function extractFirstWordMask(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= 1) return words[0] || '';
  return `${words[0]} · · · · ·`;
}

export const DuoRecitationSection: React.FC<DuoRecitationSectionProps> = ({
  lang,
  defaultRiwayah = 'hafs',
  initialFriendInviteToken = '',
  onClearFriendInvite,
  pendingAcceptCallId = null,
  onClearPendingCall,
  onOpenPrivacyTerms,
}) => {
  const isAr = lang === 'ar';

  // Auth State
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [providerHelpOpen, setProviderHelpOpen] = useState(false);
  const [verificationMsg, setVerificationMsg] = useState<string | null>(null);

  // Notification permission for background call ringing
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  // Consent-Based Link-Only Friends, Live Presence & Invites State
  const [friends, setFriends] = useState<FriendContactItem[]>([]);
  const [friendPresenceMap, setFriendPresenceMap] = useState<
    Record<string, { online: boolean; lastSeen?: number }>
  >({});
  const [myInvite, setMyInvite] = useState<FriendInviteDoc | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestDoc[]>([]);
  const [outgoingPendingRequests, setOutgoingPendingRequests] = useState<FriendRequestDoc[]>([]);
  const [pasteInviteInput, setPasteInviteInput] = useState(initialFriendInviteToken);
  const [previewedInvite, setPreviewedInvite] = useState<FriendInviteDoc | null>(null);
  const [inviteLookupBusy, setInviteLookupBusy] = useState(false);
  const [friendFeedback, setFriendFeedback] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);
  const [confirmRemoveFriendUid, setConfirmRemoveFriendUid] = useState<string | null>(null);

  // Curriculum & Riwayah Setup State (Editable in Lobby Modal AND Live Inside Call)
  const [selectedRiwayah, setSelectedRiwayah] = useState<QuranRiwayah>(defaultRiwayah);
  const [curriculumMode, setCurriculumMode] = useState<'surah' | 'ayah' | 'page'>('ayah');
  const [surahPickStyle, setSurahPickStyle] = useState<'touch' | 'dropdown'>('touch');
  const [surahSearchQuery, setSurahSearchQuery] = useState<string>('');
  const [selectedSurah, setSelectedSurah] = useState<number>(78);
  const [selectedSurahEnd, setSelectedSurahEnd] = useState<number>(78);
  const [multiSurahRange, setMultiSurahRange] = useState<boolean>(false);
  const [ayahFrom, setAyahFrom] = useState<number>(1);
  const [ayahTo, setAyahTo] = useState<number>(10);
  const [pageFrom, setPageFrom] = useState<number>(1);
  const [pageTo, setPageTo] = useState<number>(2);
  const [showCurriculumModal, setShowCurriculumModal] = useState<boolean>(false);
  const [lobbyBusy, setLobbyBusy] = useState<boolean>(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);

  // Recitation & Privacy Options
  const [hideVersesForReciter, setHideVersesForReciter] = useState<boolean>(true);
  const [hideVersesForListener, setHideVersesForListener] = useState<boolean>(false);
  const [localHideVerses, setLocalHideVerses] = useState<boolean>(false);
  const [fadeFirstWordOnly, setFadeFirstWordOnly] = useState<boolean>(false);
  const [peekVerseKey, setPeekVerseKey] = useState<string | null>(null);
  const [textScale, setTextScale] = useState<'normal' | 'large' | 'xlarge'>('large');
  const [trustedSourceId] = useState<TrustedQuranSourceId>('kfgqpc_hafs');
  const [activeUsedSource, setActiveUsedSource] = useState<TrustedQuranSourceId>('kfgqpc_hafs');

  // Privacy & Encryption Settings (Default ON for High Privacy IP Masking via TURN relay, persisted locally)
  const [highPrivacyIpMask, setHighPrivacyIpMask] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('alutrujjah_high_privacy_ip');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const highPrivacyRef = useRef<boolean>(highPrivacyIpMask);

  useEffect(() => {
    highPrivacyRef.current = highPrivacyIpMask;
    try {
      localStorage.setItem('alutrujjah_high_privacy_ip', String(highPrivacyIpMask));
    } catch {
      // ignore
    }
  }, [highPrivacyIpMask]);

  // Keep Riwayah synced when changed from Settings while not inside an active call
  useEffect(() => {
    if (!sessionIdRef.current) {
      setSelectedRiwayah(defaultRiwayah);
    }
  }, [defaultRiwayah]);

  // Active Direct Voice Call Session State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [myRoleInCall, setMyRoleInCall] = useState<'host' | 'guest'>('host');
  const [sessionMeta, setSessionMeta] = useState<DuoSessionDoc | null>(null);
  const [outgoingCallTargetName, setOutgoingCallTargetName] = useState<string | null>(null);
  const [peerConnState, setPeerConnState] = useState<
    'idle' | 'ringing' | 'connecting' | 'connected' | 'declined' | 'disconnected' | 'ended'
  >('idle');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [speakerMode, setSpeakerMode] = useState<'speaker' | 'earpiece'>('speaker');
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState<boolean>(false);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [copiedInvite, setCopiedInvite] = useState<boolean>(false);
  const [callElapsedSeconds, setCallElapsedSeconds] = useState<number>(0);

  // End-Call Evaluation Modal State
  const [showEvalModal, setShowEvalModal] = useState<boolean>(false);
  const [selectedEvaluation, setSelectedEvaluation] =
    useState<SessionEvaluationRating>('excellent');
  const [lastCallSummary, setLastCallSummary] = useState<CallSummaryBanner | null>(null);

  // Synchronized Quran Reading & Marked Errors State
  const [verses, setVerses] = useState<TrustedVerseItem[]>([]);
  const [versesLoading, setVersesLoading] = useState<boolean>(false);
  const [activeAyah, setActiveAyah] = useState<number>(1);
  const [reciterSide, setReciterSide] = useState<'host' | 'guest'>('host');
  const [mistakesCount, setMistakesCount] = useState<number>(0);
  const [markedErrors, setMarkedErrors] = useState<string[]>([]);

  // Refs for WebRTC / Streams / Listeners (Strict Audio-Only — zero RTCDataChannel)
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakerModeRef = useRef<'speaker' | 'earpiece'>('speaker');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const unsubSessionRef = useRef<(() => void) | null>(null);
  const remoteAnswerAppliedRef = useRef<boolean>(false);
  const sessionIdRef = useRef<string | null>(null);
  const myRoleRef = useRef<'host' | 'guest'>('host');
  const handledAutoCallRef = useRef<string | null>(null);
  const sessionStatusRef = useRef<DuoSessionDoc['status'] | undefined>(undefined);

  useEffect(() => {
    sessionIdRef.current = sessionId;
    if (typeof window !== 'undefined') {
      const win = window as unknown as { __alutrujjahActiveVoiceCall?: boolean };
      win.__alutrujjahActiveVoiceCall = Boolean(sessionId);
      if (!sessionId) {
        window.dispatchEvent(new Event('alutrujjah:call-ended'));
      }
    }
  }, [sessionId]);

  useEffect(() => {
    myRoleRef.current = myRoleInCall;
  }, [myRoleInCall]);

  useEffect(() => {
    sessionStatusRef.current = sessionMeta?.status;
  }, [sessionMeta?.status]);

  // Call duration timer while session is open
  useEffect(() => {
    if (!sessionId) {
      setCallElapsedSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setCallElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionId]);

  const currentSurahInfo = useMemo(
    () => SURAH_LIST.find((s) => s.number === selectedSurah) || SURAH_LIST[0],
    [selectedSurah]
  );

  const filteredSurahs = useMemo(() => {
    const q = surahSearchQuery.trim().toLowerCase();
    if (!q) return SURAH_LIST;
    return SURAH_LIST.filter(
      (s) =>
        s.nameAr.includes(q) ||
        s.nameEn.toLowerCase().includes(q) ||
        String(s.number) === q
    );
  }, [surahSearchQuery]);

  // Adjust ayah bounds if selectedSurah changes (keep 1..10 default on Surah 78)
  const prevSurahRef = useRef<number>(selectedSurah);
  useEffect(() => {
    if (prevSurahRef.current !== selectedSurah) {
      prevSurahRef.current = selectedSurah;
      setAyahFrom(1);
      setAyahTo(Math.min(currentSurahInfo.ayahCount, 10));
      if (!multiSurahRange || selectedSurahEnd < selectedSurah) {
        setSelectedSurahEnd(selectedSurah);
      }
    }
  }, [currentSurahInfo, multiSurahRange, selectedSurah, selectedSurahEnd]);

  // Listen to Firebase Auth State + Sync Profile & Personal Invite Token
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser && nextUser.emailVerified) {
        try {
          await syncVerifiedUserProfileAndDirectory(nextUser);
          const inv = await getOrCreateMyFriendInvite(nextUser);
          setMyInvite(inv);
        } catch (err) {
          console.warn('Duo auth profile sync notice:', err);
        }
      } else {
        setMyInvite(null);
      }
    });
    return () => unsub();
  }, []);

  // Live online presence heartbeat (every 45s while tab visible)
  useEffect(() => {
    if (!user || !user.emailVerified) return;
    const beat = () => {
      if (document.visibilityState === 'visible') {
        updateUserPresenceHeartbeat(user).catch(() => {});
      }
    };
    const intervalId = window.setInterval(beat, 45_000);
    document.addEventListener('visibilitychange', beat);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [user]);

  // Subscribe to approved friends' online presence
  useEffect(() => {
    if (!user || !user.emailVerified || friends.length === 0) {
      setFriendPresenceMap({});
      return;
    }

    const unsubs = friends.map((fr) =>
      subscribeFriendPresence(fr.friendUid, (uid, online, lastSeen) => {
        setFriendPresenceMap((prev) => ({
          ...prev,
          [uid]: { online, lastSeen },
        }));
      })
    );

    // Re-evaluate staleness every 30s locally without extra Firestore reads
    const staleTicker = window.setInterval(() => {
      setFriendPresenceMap((prev) => {
        const next: Record<string, { online: boolean; lastSeen?: number }> = {};
        let changed = false;
        const now = Date.now();
        for (const [uid, info] of Object.entries(prev) as [
          string,
          { online: boolean; lastSeen?: number },
        ][]) {
          const stillOnline = Boolean(info.lastSeen && now - info.lastSeen < 120_000);
          if (stillOnline !== info.online) changed = true;
          next[uid] = { ...info, online: stillOnline };
        }
        return changed ? next : prev;
      });
    }, 30_000);

    return () => {
      unsubs.forEach((u) => u());
      window.clearInterval(staleTicker);
    };
  }, [user, friends]);

  // Sync invite input if parent passes a token while already mounted in Duo
  useEffect(() => {
    if (initialFriendInviteToken) {
      setPasteInviteInput(initialFriendInviteToken);
    }
  }, [initialFriendInviteToken]);

  // Real-time Approved Friends List + Consent-Gated Friend Requests Listeners
  useEffect(() => {
    if (!user || !user.emailVerified) {
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingPendingRequests([]);
      return;
    }

    const friendsPath = `users/${user.uid}/friends`;
    const unsubFriends = onSnapshot(
      collection(db, 'users', user.uid, 'friends'),
      (snap) => {
        const list: FriendContactItem[] = snap.docs.map((d) => {
          const data = d.data() as FriendContactItem;
          return {
            friendUid: data.friendUid || d.id,
            friendName: data.friendName || d.id,
            note: data.note,
          };
        });
        setFriends(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, friendsPath);
      }
    );

    const incomingReqQ = query(
      collection(db, 'friendRequests'),
      where('toUid', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsubIncomingReq = onSnapshot(
      incomingReqQ,
      (snap) => {
        setIncomingRequests(snap.docs.map((d) => d.data() as FriendRequestDoc));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'friendRequests');
      }
    );

    const outgoingReqQ = query(
      collection(db, 'friendRequests'),
      where('fromUid', '==', user.uid)
    );
    const unsubOutgoingReq = onSnapshot(
      outgoingReqQ,
      (snap) => {
        const allOut = snap.docs.map((d) => d.data() as FriendRequestDoc);
        setOutgoingPendingRequests(allOut.filter((r) => r.status === 'pending'));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'friendRequests');
      }
    );

    return () => {
      unsubFriends();
      unsubIncomingReq();
      unsubOutgoingReq();
    };
  }, [user]);

  const teardownWebRtcResources = () => {
    callRingtone.stop();
    if (unsubSessionRef.current) {
      try {
        unsubSessionRef.current();
      } catch {
        // ignore
      }
      unsubSessionRef.current = null;
    }
    if (meterRafRef.current !== null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        // ignore
      }
      audioCtxRef.current = null;
    }
    if (pcRef.current) {
      const pc = pcRef.current;
      pc.ontrack = null;
      pc.ondatachannel = null;
      pc.onconnectionstatechange = null;
      try {
        pc.getSenders().forEach((sender) => {
          if (sender.track) {
            sender.track.enabled = false;
            sender.track.stop();
          }
        });
        pc.getReceivers().forEach((receiver) => {
          if (receiver.track) {
            receiver.track.enabled = false;
            receiver.track.stop();
          }
        });
        pc.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      const stream = localStreamRef.current;
      stream.getTracks().forEach((track) => {
        try {
          track.enabled = false;
          track.stop();
          stream.removeTrack(track);
        } catch {
          // ignore
        }
      });
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => {
        try {
          track.enabled = false;
          track.stop();
        } catch {
          // ignore
        }
      });
      remoteStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      const remoteObj = remoteAudioRef.current.srcObject as MediaStream | null;
      if (remoteObj && typeof remoteObj.getTracks === 'function') {
        remoteObj.getTracks().forEach((track) => {
          try {
            track.enabled = false;
            track.stop();
          } catch {
            // ignore
          }
        });
      }
      remoteAudioRef.current.srcObject = null;
    }
    remoteAnswerAppliedRef.current = false;
    speakerModeRef.current = 'speaker';
    setSpeakerMode('speaker');
    setNeedsAudioUnlock(false);
    setMicLevel(0);
    setIsMicMuted(false);
    setOutgoingCallTargetName(null);
  };

  useEffect(() => {
    const unregister = memoryManager.register(() => {
      teardownWebRtcResources();
    });
    return () => {
      unregister();
      teardownWebRtcResources();
    };
  }, []);

  // Fetch Trusted Verses according to curriculum mode (surah / ayah / page) & Riwayah (hafs / qalun / warsh)
  useEffect(() => {
    if (!sessionMeta) {
      setVerses([]);
      return;
    }
    let cancelled = false;
    const loadVerses = async () => {
      setVersesLoading(true);
      try {
        const result = await fetchTrustedCurriculumVerses({
          curriculumMode: sessionMeta.curriculumMode || 'ayah',
          surahNumber: sessionMeta.surahNumber,
          surahEnd: sessionMeta.surahEnd,
          ayahFrom: sessionMeta.ayahFrom,
          ayahTo: sessionMeta.ayahTo,
          pageFrom: sessionMeta.pageFrom,
          pageTo: sessionMeta.pageTo,
          riwayah: sessionMeta.riwayah || selectedRiwayah,
          preferredSource: trustedSourceId,
        });
        if (!cancelled) {
          setVerses(result.verses);
          setActiveUsedSource(result.usedSource);
          setActiveAyah(result.verses[0]?.ayahNumber || sessionMeta.ayahFrom || 1);
        }
      } catch {
        if (!cancelled) {
          setVerses([]);
        }
      } finally {
        if (!cancelled) {
          setVersesLoading(false);
        }
      }
    };
    loadVerses();
    return () => {
      cancelled = true;
    };
  }, [
    sessionMeta?.sessionId,
    sessionMeta?.curriculumMode,
    sessionMeta?.surahNumber,
    sessionMeta?.surahEnd,
    sessionMeta?.ayahFrom,
    sessionMeta?.ayahTo,
    sessionMeta?.pageFrom,
    sessionMeta?.pageTo,
    sessionMeta?.riwayah,
    trustedSourceId,
    selectedRiwayah,
  ]);

  // Auth Actions
  const handleGoogleSignIn = async () => {
    callRingtone.unlockAudio();
    setAuthError(null);
    setProviderHelpOpen(false);
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const mapped = mapFirebaseAuthError(err, lang);
      setAuthError(mapped.message);
      if (mapped.isProviderDisabled) setProviderHelpOpen(true);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    callRingtone.unlockAudio();
    setAuthError(null);
    setProviderHelpOpen(false);
    setVerificationMsg(null);
    const trimmedEmail = emailInput.trim();
    if (!trimmedEmail || !passwordInput) {
      setAuthError(
        isAr
          ? 'يُرجى إدخال البريد الإلكتروني وكلمة المرور.'
          : 'Please enter email and password.'
      );
      return;
    }
    setAuthLoading(true);
    try {
      if (authMode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, passwordInput);
        if (nameInput.trim()) {
          await updateProfile(cred.user, { displayName: nameInput.trim().slice(0, 80) });
        }
        await sendEmailVerification(cred.user);
        setVerificationMsg(
          isAr
            ? 'تم إنشاء الحساب وإرسال رابط التفعيل إلى بريدك الإلكتروني.'
            : 'Account created and verification email sent.'
        );
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, passwordInput);
      }
    } catch (err) {
      const mapped = mapFirebaseAuthError(err, lang);
      setAuthError(mapped.message);
      if (mapped.isProviderDisabled) setProviderHelpOpen(true);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    setAuthLoading(true);
    setVerificationMsg(null);
    try {
      await sendEmailVerification(auth.currentUser);
      setVerificationMsg(
        isAr
          ? 'تم إعادة إرسال رابط التفعيل إلى بريدك الإلكتروني بنجاح.'
          : 'Verification link resent to your email.'
      );
    } catch (err) {
      const mapped = mapFirebaseAuthError(err, lang);
      setVerificationMsg(mapped.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRefreshVerificationStatus = async () => {
    if (!auth.currentUser) return;
    setAuthLoading(true);
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      const refreshed = auth.currentUser;
      setUser(refreshed ? ({ ...refreshed } as User) : null);
      if (refreshed && refreshed.emailVerified) {
        await syncVerifiedUserProfileAndDirectory(refreshed);
        const inv = await getOrCreateMyFriendInvite(refreshed);
        setMyInvite(inv);
      } else {
        setVerificationMsg(
          isAr
            ? 'لم يتم تأكيد البريد الإلكتروني بعد. افتح رسالة التفعيل في بريدك ثم أعد الضغط هنا.'
            : 'Email is not verified yet. Please click the verification link in your inbox.'
        );
      }
    } catch (err) {
      const mapped = mapFirebaseAuthError(err, lang);
      setVerificationMsg(mapped.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await handleEndCall(false);
    await signOut(auth);
  };

  const handleEnableBackgroundCallAlerts = async () => {
    callRingtone.unlockAudio();
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
    } catch {
      // ignore
    }
  };

  // Invite Link Builders & Sharing (Clean ?invite=... format + accepts both ?invite= & ?friendInvite=)
  const personalInviteUrl = useMemo(() => {
    if (!myInvite?.inviteToken || typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(
      myInvite.inviteToken
    )}`;
  }, [myInvite?.inviteToken]);

  const handleSharePersonalInvite = async () => {
    if (!personalInviteUrl) return;
    const shareTitle = isAr ? 'دعوة صداقة للسرد الثنائي — منصة السرد' : 'Duo Sard Friend Invite';
    const shareText = isAr
      ? 'اضغط على رابط الصداقة لإرسال طلب إضافة في منصة السرد (تتم الإضافة بعد الموافقة):'
      : 'Open this invite link to send a friend request in Assard (requires approval):';

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: personalInviteUrl });
        return;
      } catch {
        // Fallback to copy
      }
    }
    try {
      await navigator.clipboard.writeText(personalInviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2200);
    } catch {
      // ignore
    }
  };

  const handleCopyInviteLink = async () => {
    if (!personalInviteUrl) return;
    try {
      await navigator.clipboard.writeText(personalInviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2200);
    } catch {
      // ignore
    }
  };

  const handleRegenerateInvite = async () => {
    if (!user || !user.emailVerified) return;
    setInviteBusy(true);
    try {
      const fresh = await regenerateMyFriendInvite(user);
      if (fresh) {
        setMyInvite(fresh);
        setFriendFeedback({
          type: 'ok',
          msg: isAr
            ? 'تم إصدار رابط جديد وإلغاء السابق.'
            : 'New invite link generated; previous revoked.',
        });
      }
    } finally {
      setInviteBusy(false);
    }
  };

  const handleLookupPastedInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.emailVerified || !pasteInviteInput.trim()) return;
    setInviteLookupBusy(true);
    setFriendFeedback(null);
    setPreviewedInvite(null);
    try {
      const found = await fetchFriendInviteDetails(pasteInviteInput);
      if (!found) {
        setFriendFeedback({
          type: 'err',
          msg: isAr
            ? 'رابط الدعوة غير صالح أو مُلغى.'
            : 'Invite link invalid or revoked.',
        });
        return;
      }
      if (found.ownerUid === user.uid) {
        setFriendFeedback({
          type: 'err',
          msg: isAr ? 'لا يمكنك إضافة نفسك.' : 'Cannot invite yourself.',
        });
        return;
      }
      if (friends.some((f) => f.friendUid === found.ownerUid)) {
        setFriendFeedback({
          type: 'ok',
          msg: isAr
            ? `«${found.ownerName}» مضاف مسبقاً في أصدقائك.`
            : `"${found.ownerName}" is already a friend.`,
        });
        return;
      }
      setPreviewedInvite(found);
    } catch {
      setFriendFeedback({
        type: 'err',
        msg: isAr
          ? 'تعذر التحقق من الرابط، حاول مجدداً.'
          : 'Could not verify invite link. Please try again.',
      });
    } finally {
      setInviteLookupBusy(false);
    }
  };

  const handleConfirmSendFriendRequest = async () => {
    if (!user || !user.emailVerified || !previewedInvite) return;
    setInviteBusy(true);
    setFriendFeedback(null);
    try {
      const result = await sendConsentFriendRequest(user, previewedInvite);
      if (result === 'sent') {
        setFriendFeedback({
          type: 'ok',
          msg: isAr
            ? `أُرسل طلب الصداقة إلى «${previewedInvite.ownerName}»؛ سيُضاف عند موافقته.`
            : `Friend request sent to "${previewedInvite.ownerName}". Added upon approval.`,
        });
      } else if (result === 'already_pending') {
        setFriendFeedback({
          type: 'ok',
          msg: isAr
            ? `طلبك إلى «${previewedInvite.ownerName}» بانتظار الموافقة.`
            : `Request to "${previewedInvite.ownerName}" is pending approval.`,
        });
      } else {
        setFriendFeedback({
          type: 'ok',
          msg: isAr
            ? `تمت إضافة «${previewedInvite.ownerName}» في قائمة أصدقائك.`
            : `"${previewedInvite.ownerName}" is added to your friends list.`,
        });
      }
      setPreviewedInvite(null);
      setPasteInviteInput('');
      onClearFriendInvite?.();
    } catch {
      setFriendFeedback({
        type: 'err',
        msg: isAr
          ? 'تعذر إرسال طلب الصداقة. تحقق من الاتصال وحاول مجدداً.'
          : 'Could not send friend request. Please try again.',
      });
    } finally {
      setInviteBusy(false);
    }
  };

  const handleApproveRequest = async (req: FriendRequestDoc) => {
    if (!user || !user.emailVerified) return;
    setInviteBusy(true);
    try {
      await approveIncomingFriendRequest(user, req);
      setFriendFeedback({
        type: 'ok',
        msg: isAr
          ? `تمت الموافقة وإضافة «${req.fromName}» إلى قائمة أصدقائك بنجاح.`
          : `Approved and added "${req.fromName}" to your friends list.`,
      });
    } catch {
      setFriendFeedback({
        type: 'err',
        msg: isAr ? 'تعذر إتمام الإضافة، حاول مجدداً.' : 'Could not add friend. Try again.',
      });
    } finally {
      setInviteBusy(false);
    }
  };

  const handleDeclineRequest = async (req: FriendRequestDoc) => {
    setInviteBusy(true);
    try {
      await declineIncomingFriendRequest(req);
    } catch {
      setFriendFeedback({
        type: 'err',
        msg: isAr ? 'تعذر رفض الطلب، حاول مجدداً.' : 'Could not decline request.',
      });
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRemoveFriend = async (friendUid: string) => {
    if (!user || !user.emailVerified) return;
    const friendPath = `users/${user.uid}/friends/${friendUid}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'friends', friendUid));
      setConfirmRemoveFriendUid(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, friendPath);
    }
  };

  // Setup Strict Audio-Only Mic + Audio Level Meter
  const acquireMicrophone = async (): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    localStreamRef.current = stream;
    memoryManager.registerStream(stream);

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      memoryManager.registerAudioContext(ctx);
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!localStreamRef.current) return;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = Math.min(100, Math.round((sum / data.length) * 1.4));
        setMicLevel(avg);
        meterRafRef.current = requestAnimationFrame(tick);
      };
      meterRafRef.current = requestAnimationFrame(tick);
    } catch {
      // Audio meter optional
    }

    return stream;
  };

  // Sync bounded recitation metadata & live curriculum via Firestore signaling (strictly NO RTCDataChannel)
  const syncCallControlState = async (
    patch: Partial<{
      activeAyah: number;
      reciterSide: 'host' | 'guest';
      mistakesCount: number;
      markedErrors: string[];
      hideVersesForReciter: boolean;
      hideVersesForListener: boolean;
      riwayah: QuranRiwayah;
      curriculumMode: 'surah' | 'ayah' | 'page';
      surahNumber: number;
      surahEnd: number;
      ayahFrom: number;
      ayahTo: number;
      pageFrom: number;
      pageTo: number;
    }>
  ) => {
    const activeCallId = sessionIdRef.current;
    if (!activeCallId || !auth.currentUser?.emailVerified) return;
    if (sessionStatusRef.current !== 'active') return;
    const sessionPath = `duoSessions/${activeCallId}`;
    try {
      await updateDoc(doc(db, 'duoSessions', activeCallId), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, sessionPath);
    }
  };

  const applySyncedSessionSnapshot = (data: DuoSessionDoc) => {
    if (typeof data.activeAyah === 'number') setActiveAyah(data.activeAyah);
    if (data.reciterSide === 'host' || data.reciterSide === 'guest') {
      setReciterSide(data.reciterSide);
    }
    if (typeof data.mistakesCount === 'number') setMistakesCount(data.mistakesCount);
    if (Array.isArray(data.markedErrors)) {
      setMarkedErrors(data.markedErrors.slice(0, 80));
    }
    if (typeof data.hideVersesForReciter === 'boolean') {
      setHideVersesForReciter(data.hideVersesForReciter);
    }
    if (typeof data.hideVersesForListener === 'boolean') {
      setHideVersesForListener(data.hideVersesForListener);
    }
    if (data.riwayah === 'hafs' || data.riwayah === 'qalun' || data.riwayah === 'warsh') {
      setSelectedRiwayah(data.riwayah);
    }
    if (
      data.curriculumMode === 'surah' ||
      data.curriculumMode === 'ayah' ||
      data.curriculumMode === 'page'
    ) {
      setCurriculumMode(data.curriculumMode);
    }
    if (typeof data.surahNumber === 'number') setSelectedSurah(data.surahNumber);
    if (typeof data.surahEnd === 'number') setSelectedSurahEnd(data.surahEnd);
    if (typeof data.ayahFrom === 'number') setAyahFrom(data.ayahFrom);
    if (typeof data.ayahTo === 'number') setAyahTo(data.ayahTo);
    if (typeof data.pageFrom === 'number') setPageFrom(data.pageFrom);
    if (typeof data.pageTo === 'number') setPageTo(data.pageTo);
  };

  const applyAudioOutputMode = async (
    mode: 'speaker' | 'earpiece',
    targetEl?: HTMLAudioElement | null
  ) => {
    const audioEl = targetEl ?? remoteAudioRef.current;
    if (!audioEl) return;

    audioEl.muted = false;
    audioEl.volume = mode === 'earpiece' ? 0.42 : 1.0;

    const sinkCapableEl = audioEl as HTMLAudioElement & {
      setSinkId?: (sinkId: string) => Promise<void>;
    };
    if (
      typeof sinkCapableEl.setSinkId === 'function' &&
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices?.enumerateDevices
    ) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter((d) => d.kind === 'audiooutput');
        if (outputs.length > 0) {
          const preferred =
            mode === 'speaker'
              ? outputs.find((d) =>
                  /speaker|external|default|مكبر/i.test(d.label || d.deviceId)
                ) || outputs.find((d) => d.deviceId === 'default')
              : outputs.find((d) =>
                  /earpiece|handset|receiver|communications|سماعة/i.test(d.label || d.deviceId)
                );
          if (preferred?.deviceId) {
            await sinkCapableEl.setSinkId(preferred.deviceId);
          }
        }
      } catch {
        // Browsers without setSinkId permission fall back to volume scaling cleanly
      }
    }

    if (audioEl.srcObject) {
      audioEl
        .play()
        .then(() => {
          setNeedsAudioUnlock(false);
        })
        .catch(() => {
          setNeedsAudioUnlock(true);
        });
    }
  };

  const syncRemoteAudioTracksToMediaElement = (
    event?: RTCTrackEvent,
    pcInstance?: RTCPeerConnection | null
  ) => {
    const activePc = pcInstance ?? pcRef.current;
    const stream = remoteStreamRef.current || new MediaStream();
    const collectedAudioTracks: MediaStreamTrack[] = [];

    if (event?.streams?.[0]) {
      collectedAudioTracks.push(...event.streams[0].getAudioTracks());
    }
    if (event?.track && event.track.kind === 'audio') {
      collectedAudioTracks.push(event.track);
    }
    if (activePc) {
      activePc.getReceivers().forEach((receiver) => {
        if (receiver.track && receiver.track.kind === 'audio') {
          collectedAudioTracks.push(receiver.track);
        }
      });
    }

    let trackAdded = false;
    collectedAudioTracks.forEach((audioTrack) => {
      if (audioTrack.readyState === 'ended') return;
      audioTrack.enabled = true;
      const alreadyAttached = stream
        .getAudioTracks()
        .some((existing) => existing.id === audioTrack.id);
      if (!alreadyAttached) {
        stream.addTrack(audioTrack);
        trackAdded = true;
      }
    });

    if (stream.getAudioTracks().length === 0) return;

    remoteStreamRef.current = stream;
    const audioEl = remoteAudioRef.current;
    if (audioEl) {
      if (audioEl.srcObject !== stream || trackAdded) {
        audioEl.srcObject = stream;
      }
      audioEl.muted = false;
      applyAudioOutputMode(speakerModeRef.current, audioEl);
    }
  };

  useEffect(() => {
    if (!sessionId || !remoteAudioRef.current || !remoteStreamRef.current) return;
    const el = remoteAudioRef.current;
    if (el.srcObject !== remoteStreamRef.current) {
      el.srcObject = remoteStreamRef.current;
    }
    applyAudioOutputMode(speakerModeRef.current, el);
  }, [sessionId, peerConnState]);

  const setupPeerConnection = (stream: MediaStream): RTCPeerConnection => {
    const pc = new RTCPeerConnection(buildRtcConfiguration(highPrivacyRef.current));
    pcRef.current = pc;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = true;
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      syncRemoteAudioTracksToMediaElement(event, pc);
      if (event.track && event.track.kind === 'audio') {
        event.track.onunmute = () => {
          syncRemoteAudioTracksToMediaElement(event, pc);
        };
      }
    };

    // Strict Audio-Only: block creating or receiving any RTCDataChannel (no file/data exchange)
    pc.ondatachannel = (event) => {
      try {
        event.channel.close();
      } catch {
        // ignore
      }
    };

    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      if (iceState === 'connected' || iceState === 'completed') {
        syncRemoteAudioTracksToMediaElement(undefined, pc);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        callRingtone.stop();
        setOutgoingCallTargetName(null);
        setPeerConnState('connected');
        syncRemoteAudioTracksToMediaElement(undefined, pc);
      } else if (state === 'connecting' || state === 'new') {
        setPeerConnState((prev) => (prev === 'ringing' ? prev : 'connecting'));
      } else if (state === 'disconnected') {
        // Transient network hiccup — allow ICE to recover without tearing down immediately
        setPeerConnState((prev) =>
          prev === 'ended' || prev === 'declined' ? prev : 'connecting'
        );
      } else if (state === 'failed' || state === 'closed') {
        callRingtone.stop();
        setPeerConnState((prev) =>
          prev === 'ended' || prev === 'declined' ? prev : 'disconnected'
        );
        teardownWebRtcResources();
      }
    };

    return pc;
  };

  // Helper to get current curriculum bounds
  const buildCurriculumPayloadFields = () => {
    const surahInfo = SURAH_LIST.find((s) => s.number === selectedSurah) || SURAH_LIST[0];
    const boundedFrom =
      curriculumMode === 'surah'
        ? 1
        : Math.max(1, Math.min(ayahFrom, surahInfo.ayahCount));
    const boundedTo =
      curriculumMode === 'surah'
        ? surahInfo.ayahCount
        : Math.max(boundedFrom, Math.min(ayahTo, surahInfo.ayahCount));
    const sEnd =
      curriculumMode === 'surah' && multiSurahRange
        ? Math.max(selectedSurah, Math.min(114, selectedSurahEnd, selectedSurah + 4))
        : selectedSurah;
    const p1 = Math.max(1, Math.min(604, pageFrom));
    const p2 = Math.max(p1, Math.min(604, pageTo, p1 + 9));
    return {
      riwayah: selectedRiwayah,
      curriculumMode,
      surahNumber: selectedSurah,
      surahEnd: sEnd,
      ayahFrom: boundedFrom,
      ayahTo: boundedTo,
      pageFrom: p1,
      pageTo: p2,
    };
  };

  // Start Direct Encrypted Friend Audio Call ONLY (Voice rooms completely disabled)
  const startDirectFriendCall = async (targetFriend: FriendContactItem) => {
    if (!user || !user.emailVerified) return;
    callRingtone.unlockAudio();
    setLobbyError(null);
    setLastCallSummary(null);
    setLobbyBusy(true);
    remoteAnswerAppliedRef.current = false;

    const newSessionId = generateEphemeralSessionId();
    const sessionPath = `duoSessions/${newSessionId}`;

    try {
      const stream = await acquireMicrophone();
      const pc = setupPeerConnection(stream);

      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      await waitForIceComplete(pc, 3500);

      const finalDesc = pc.localDescription;
      if (!finalDesc || !finalDesc.sdp) {
        throw new Error(
          isAr ? 'تعذر تجهيز عرض الاتصال الصوتي المباشر.' : 'Failed to prepare WebRTC offer.'
        );
      }

      const hostDisplayName = getDisplayNameForUser(user);
      const currFields = buildCurriculumPayloadFields();

      const callPayload: Record<string, unknown> = {
        sessionId: newSessionId,
        hostUid: user.uid,
        hostName: hostDisplayName,
        calleeUid: targetFriend.friendUid,
        callMode: 'friend_call',
        ...currFields,
        offerType: finalDesc.type || 'offer',
        offerSdp: finalDesc.sdp,
        hideVersesForReciter,
        hideVersesForListener,
        activeAyah: currFields.ayahFrom,
        reciterSide: 'host',
        mistakesCount: 0,
        markedErrors: [],
        status: 'ringing',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'duoSessions', newSessionId), callPayload);

      setMyRoleInCall('host');
      setSessionId(newSessionId);
      setSessionMeta(callPayload as unknown as DuoSessionDoc);
      setReciterSide('host');
      setMistakesCount(0);
      setMarkedErrors([]);
      setActiveAyah(currFields.ayahFrom);
      setOutgoingCallTargetName(targetFriend.friendName);
      setPeerConnState('ringing');
      callRingtone.start('outgoing');

      unsubSessionRef.current = onSnapshot(
        doc(db, 'duoSessions', newSessionId),
        async (snap) => {
          if (!snap.exists()) {
            setPeerConnState('ended');
            teardownWebRtcResources();
            return;
          }
          const data = snap.data() as DuoSessionDoc;
          setSessionMeta(data);

          if (data.status === 'declined') {
            callRingtone.stop();
            setOutgoingCallTargetName(null);
            setPeerConnState('declined');
            teardownWebRtcResources();
            return;
          }

          if (data.status === 'ended') {
            callRingtone.stop();
            setOutgoingCallTargetName(null);
            setPeerConnState('ended');
            teardownWebRtcResources();
            if (data.sessionEvaluation) {
              setLastCallSummary({
                partnerName: data.guestName || targetFriend.friendName,
                evaluation: data.sessionEvaluation,
                durationSeconds: data.callDurationSeconds ?? 0,
                mistakesCount: data.mistakesCount ?? 0,
                accuracyPct: data.accuracyPct ?? 100,
              });
              setShowEvalModal(false);
              setSessionId(null);
              setSessionMeta(null);
              setPeerConnState('idle');
            }
            return;
          }

          if (data.status === 'active') {
            applySyncedSessionSnapshot(data);
          }

          if (
            data.status === 'active' &&
            data.answerSdp &&
            data.answerType &&
            !remoteAnswerAppliedRef.current &&
            pcRef.current
          ) {
            remoteAnswerAppliedRef.current = true;
            callRingtone.stop();
            setOutgoingCallTargetName(null);
            setPeerConnState('connecting');
            try {
              await pcRef.current.setRemoteDescription(
                new RTCSessionDescription({
                  type: data.answerType as RTCSdpType,
                  sdp: data.answerSdp,
                })
              );
            } catch {
              remoteAnswerAppliedRef.current = false;
            }
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, sessionPath);
        }
      );
    } catch (err) {
      teardownWebRtcResources();
      if (err instanceof Error && err.message.startsWith('{"error":')) {
        throw err;
      }
      if ((err as { name?: string })?.name === 'NotAllowedError') {
        setLobbyError(
          isAr
            ? 'يرجى السماح للمتصفح بالوصول إلى الميكروفون لبدء الاتصال الصوتي المباشر.'
            : 'Please allow microphone access to start live P2P audio.'
        );
      } else {
        setLobbyError(
          err instanceof Error
            ? err.message
            : isAr
            ? 'تعذر بدء الاتصال الصوتي المباشر.'
            : 'Failed to start direct voice call.'
        );
      }
    } finally {
      setLobbyBusy(false);
    }
  };

  // Answer Incoming Direct Friend Call
  const answerIncomingFriendCall = async (targetSessionId: string) => {
    if (!user || !user.emailVerified) return;
    callRingtone.unlockAudio();

    const cleanId = targetSessionId.trim().toUpperCase();
    setLobbyError(null);
    setLastCallSummary(null);
    setLobbyBusy(true);
    const sessionPath = `duoSessions/${cleanId}`;

    try {
      const snap = await getDoc(doc(db, 'duoSessions', cleanId)).catch((err) => {
        handleFirestoreError(err, OperationType.GET, sessionPath);
      });

      if (!snap || !snap.exists()) {
        setLobbyError(
          isAr
            ? 'انتهت المكالمة الواردة أو ألغاها المتصل.'
            : 'Incoming call has ended or been cancelled.'
        );
        return;
      }

      const callData = snap.data() as DuoSessionDoc;
      if (callData.status !== 'ringing' || callData.calleeUid !== user.uid) {
        setLobbyError(
          isAr
            ? 'هذه المكالمة غير متاحة أو تم الرد عليها مسبقاً.'
            : 'This call is no longer available.'
        );
        return;
      }

      const stream = await acquireMicrophone();
      const pc = setupPeerConnection(stream);

      await pc.setRemoteDescription(
        new RTCSessionDescription({
          type: callData.offerType as RTCSdpType,
          sdp: callData.offerSdp,
        })
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceComplete(pc, 3500);

      const finalAnswer = pc.localDescription;
      if (!finalAnswer || !finalAnswer.sdp) {
        throw new Error(
          isAr ? 'تعذر تجهيز رد الاتصال المباشر.' : 'Failed to create WebRTC answer.'
        );
      }

      const guestDisplayName = getDisplayNameForUser(user);

      await updateDoc(doc(db, 'duoSessions', cleanId), {
        guestUid: user.uid,
        guestName: guestDisplayName,
        answerType: finalAnswer.type || 'answer',
        answerSdp: finalAnswer.sdp,
        status: 'active',
        updatedAt: serverTimestamp(),
      }).catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, sessionPath);
      });

      dismissBackgroundCallNotification(cleanId);
      setMyRoleInCall('guest');
      setSessionId(cleanId);
      setSessionMeta({
        ...callData,
        guestUid: user.uid,
        guestName: guestDisplayName,
        status: 'active',
      });
      applySyncedSessionSnapshot(callData);
      setPeerConnState('connecting');

      unsubSessionRef.current = onSnapshot(
        doc(db, 'duoSessions', cleanId),
        (nextSnap) => {
          if (!nextSnap.exists()) {
            setPeerConnState('ended');
            teardownWebRtcResources();
            return;
          }
          const updated = nextSnap.data() as DuoSessionDoc;
          setSessionMeta(updated);
          if (updated.status === 'ended' || updated.status === 'declined') {
            setPeerConnState(updated.status);
            teardownWebRtcResources();
            if (updated.status === 'ended' && updated.sessionEvaluation) {
              setLastCallSummary({
                partnerName: updated.hostName,
                evaluation: updated.sessionEvaluation,
                durationSeconds: updated.callDurationSeconds ?? 0,
                mistakesCount: updated.mistakesCount ?? 0,
                accuracyPct: updated.accuracyPct ?? 100,
              });
              setShowEvalModal(false);
              setSessionId(null);
              setSessionMeta(null);
              setPeerConnState('idle');
            }
            return;
          }
          if (updated.status === 'active') {
            applySyncedSessionSnapshot(updated);
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, sessionPath);
        }
      );
    } catch (err) {
      teardownWebRtcResources();
      if (err instanceof Error && err.message.startsWith('{"error":')) {
        throw err;
      }
      if ((err as { name?: string })?.name === 'NotAllowedError') {
        setLobbyError(
          isAr
            ? 'يرجى السماح بالوصول إلى الميكروفون للرد على المكالمة الصوتية.'
            : 'Please allow microphone access to answer the voice call.'
        );
      } else {
        setLobbyError(
          err instanceof Error
            ? err.message
            : isAr
            ? 'تعذر الرد على المكالمة.'
            : 'Failed to answer call.'
        );
      }
    } finally {
      setLobbyBusy(false);
    }
  };

  // Auto-answer when user clicks Answer on the global Incoming Call Modal
  useEffect(() => {
    if (
      pendingAcceptCallId &&
      user &&
      user.emailVerified &&
      handledAutoCallRef.current !== pendingAcceptCallId
    ) {
      handledAutoCallRef.current = pendingAcceptCallId;
      answerIncomingFriendCall(pendingAcceptCallId).finally(() => {
        onClearPendingCall?.();
      });
    }
  }, [pendingAcceptCallId, user]);

  // Compute accuracy percentage based on errors vs verse words in current curriculum
  const totalWordsInVerses = useMemo(() => {
    if (verses.length === 0) return 50;
    return Math.max(
      10,
      verses.reduce((sum, v) => sum + v.text.trim().split(/\s+/).filter(Boolean).length, 0)
    );
  }, [verses]);

  const computedAccuracyPct = useMemo(() => {
    if (mistakesCount <= 0) return 100;
    return Math.max(
      0,
      Math.min(100, Math.round(((totalWordsInVerses - mistakesCount) / totalWordsInVerses) * 100))
    );
  }, [mistakesCount, totalWordsInVerses]);

  const handleEndCall = async (
    resetToLobby = true,
    evalPayload?: {
      evaluation: SessionEvaluationRating;
      durationSeconds: number;
      accuracyPct: number;
    }
  ) => {
    const activeCallId = sessionIdRef.current;
    const currentMeta = sessionMeta;

    callRingtone.stop();
    teardownWebRtcResources();
    setShowEvalModal(false);
    setShowCurriculumModal(false);

    if (activeCallId && auth.currentUser?.emailVerified) {
      try {
        if (currentMeta?.status !== 'ended' && currentMeta?.status !== 'declined') {
          const endDocPatch: Record<string, unknown> = {
            status: 'ended',
            updatedAt: serverTimestamp(),
          };
          if (evalPayload) {
            endDocPatch.endedByUid = auth.currentUser.uid;
            endDocPatch.sessionEvaluation = evalPayload.evaluation;
            endDocPatch.callDurationSeconds = Math.max(0, Math.min(86400, evalPayload.durationSeconds));
            endDocPatch.accuracyPct = Math.max(0, Math.min(100, evalPayload.accuracyPct));
          }
          await updateDoc(doc(db, 'duoSessions', activeCallId), endDocPatch);
        }
      } catch (err) {
        if (auth.currentUser) {
          console.warn('Call cleanup notice:', err);
        }
      }
      dismissBackgroundCallNotification(activeCallId);
    }

    if (evalPayload && currentMeta) {
      const pName =
        myRoleRef.current === 'host'
          ? currentMeta.guestName || outgoingCallTargetName || (isAr ? 'صديقك' : 'Partner')
          : currentMeta.hostName;
      setLastCallSummary({
        partnerName: pName,
        evaluation: evalPayload.evaluation,
        durationSeconds: evalPayload.durationSeconds,
        mistakesCount,
        accuracyPct: evalPayload.accuracyPct,
      });
    }

    if (resetToLobby) {
      setSessionId(null);
      setSessionMeta(null);
      setPeerConnState('idle');
      setVerses([]);
      setMarkedErrors([]);
      setMistakesCount(0);
      handledAutoCallRef.current = null;
    }
  };

  const handleToggleMic = () => {
    if (!localStreamRef.current) return;
    const nextMuted = !isMicMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMicMuted(nextMuted);
    if (remoteAudioRef.current?.srcObject) {
      remoteAudioRef.current.play().catch(() => {});
    }
  };

  const handleToggleSpeakerMode = () => {
    const nextMode: 'speaker' | 'earpiece' =
      speakerMode === 'speaker' ? 'earpiece' : 'speaker';
    speakerModeRef.current = nextMode;
    setSpeakerMode(nextMode);
    applyAudioOutputMode(nextMode);
  };

  const handleSelectAyahSync = (ayahNum: number) => {
    const bounded = Math.max(1, Math.min(286, ayahNum));
    setActiveAyah(bounded);
    syncCallControlState({ activeAyah: bounded });
  };

  const handleSwapRoles = () => {
    const nextSide = reciterSide === 'host' ? 'guest' : 'host';
    setReciterSide(nextSide);
    setPeekVerseKey(null);
    syncCallControlState({ reciterSide: nextSide });
  };

  const handleAdjustMistakes = (delta: number) => {
    const next = Math.max(0, Math.min(999, mistakesCount + delta));
    setMistakesCount(next);
    syncCallControlState({ mistakesCount: next });
  };

  // Interactive tap on individual word for Listener -> syncs highlighted error token to Reciter!
  const handleToggleWordError = (verseKey: string, word: string, wordIdx: number) => {
    const cleanWord = word.trim().slice(0, 28);
    if (!cleanWord) return;
    const token = `${verseKey}|${cleanWord}|${wordIdx}`.slice(0, 80);

    let nextList: string[];
    let nextCount: number;

    if (markedErrors.includes(token)) {
      nextList = markedErrors.filter((t) => t !== token);
      nextCount = Math.max(0, mistakesCount - 1);
    } else {
      nextList = [token, ...markedErrors].slice(0, 80);
      nextCount = Math.min(999, Math.max(mistakesCount + 1, nextList.length));
    }

    setMarkedErrors(nextList);
    setMistakesCount(nextCount);
    syncCallControlState({ markedErrors: nextList, mistakesCount: nextCount });
  };

  const handleToggleSyncedHideReciter = () => {
    const next = !hideVersesForReciter;
    setHideVersesForReciter(next);
    setPeekVerseKey(null);
    syncCallControlState({ hideVersesForReciter: next });
  };

  const handleToggleSyncedHideListener = () => {
    const next = !hideVersesForListener;
    setHideVersesForListener(next);
    setPeekVerseKey(null);
    syncCallControlState({ hideVersesForListener: next });
  };

  const handleApplyCurriculumSettings = () => {
    if (sessionId && sessionStatusRef.current === 'active') {
      const payload = buildCurriculumPayloadFields();
      syncCallControlState({
        ...payload,
        hideVersesForReciter,
        hideVersesForListener,
      });
    }
    setShowCurriculumModal(false);
  };

  const handleStepVerse = (delta: number) => {
    if (verses.length === 0) return;
    const currIdx = verses.findIndex((v) => v.ayahNumber === activeAyah);
    const nextIdx =
      currIdx === -1
        ? 0
        : Math.max(0, Math.min(verses.length - 1, currIdx + delta));
    handleSelectAyahSync(verses[nextIdx].ayahNumber);
  };

  // Curriculum Human Summary
  const lobbyCurriculumSummary = useMemo(() => {
    const rwLabel = getRiwayahLabel(selectedRiwayah, lang);
    if (curriculumMode === 'page') {
      const p1 = Math.min(pageFrom, pageTo);
      const p2 = Math.max(pageFrom, pageTo);
      return isAr
        ? `${p1 === p2 ? `صفحة ${toArabicDigits(p1)}` : `الصفحات ${toArabicDigits(p1)} – ${toArabicDigits(p2)}`} · رواية ${rwLabel}`
        : `${p1 === p2 ? `Page ${p1}` : `Pages ${p1}–${p2}`} · ${rwLabel}`;
    }
    if (curriculumMode === 'surah') {
      const s2Obj = SURAH_LIST.find((s) => s.number === selectedSurahEnd) || currentSurahInfo;
      if (multiSurahRange && selectedSurahEnd !== selectedSurah) {
        return isAr
          ? `من سورة ${currentSurahInfo.nameAr} إلى ${s2Obj.nameAr} · رواية ${rwLabel}`
          : `Surah ${currentSurahInfo.nameEn} – ${s2Obj.nameEn} · ${rwLabel}`;
      }
      return isAr
        ? `سورة ${currentSurahInfo.nameAr} كاملة · رواية ${rwLabel}`
        : `Surah ${currentSurahInfo.nameEn} (Full) · ${rwLabel}`;
    }
    return isAr
      ? `سورة ${currentSurahInfo.nameAr} (${toArabicDigits(ayahFrom)} - ${toArabicDigits(ayahTo)}) · رواية ${rwLabel}`
      : `Surah ${currentSurahInfo.nameEn} (${ayahFrom}–${ayahTo}) · ${rwLabel}`;
  }, [
    curriculumMode,
    pageFrom,
    pageTo,
    selectedSurah,
    selectedSurahEnd,
    multiSurahRange,
    currentSurahInfo,
    ayahFrom,
    ayahTo,
    selectedRiwayah,
    isAr,
    lang,
  ]);

  const sessionSurahInfo = useMemo(() => {
    if (!sessionMeta) return currentSurahInfo;
    return SURAH_LIST.find((s) => s.number === sessionMeta.surahNumber) || currentSurahInfo;
  }, [sessionMeta, currentSurahInfo]);

  const activeCurriculumTextOnly = useMemo(() => {
    if (!sessionMeta) return '';
    if (sessionMeta.curriculumMode === 'page') {
      const p1 = sessionMeta.pageFrom || 1;
      const p2 = sessionMeta.pageTo || p1;
      return isAr
        ? p1 === p2
          ? `صفحة ${toArabicDigits(p1)}`
          : `الصفحات ${toArabicDigits(p1)} - ${toArabicDigits(p2)}`
        : p1 === p2
        ? `Page ${p1}`
        : `Pages ${p1}-${p2}`;
    }
    return isAr
      ? `سُورَةُ ${sessionSurahInfo.nameAr} (${toArabicDigits(sessionMeta.ayahFrom)} - ${toArabicDigits(
          sessionMeta.ayahTo
        )})`
      : `Surah ${sessionSurahInfo.nameEn} (${sessionMeta.ayahFrom} - ${sessionMeta.ayahTo})`;
  }, [sessionMeta, sessionSurahInfo, isAr]);

  const activeRiwayahLabel = getRiwayahLabel(sessionMeta?.riwayah || selectedRiwayah, lang);

  const partnerName = useMemo(() => {
    if (!sessionMeta) return outgoingCallTargetName || (isAr ? 'صديقك' : 'Partner');
    if (myRoleInCall === 'host') {
      return sessionMeta.guestName || outgoingCallTargetName || (isAr ? 'صديقك' : 'Partner');
    }
    return sessionMeta.hostName || (isAr ? 'صديقك' : 'Partner');
  }, [sessionMeta, myRoleInCall, outgoingCallTargetName, isAr]);

  const amICurrentReciter = myRoleInCall === reciterSide;
  const shouldHideVersesForMe =
    localHideVerses ||
    (amICurrentReciter ? hideVersesForReciter : hideVersesForListener);

  const activeSourceMeta =
    TRUSTED_QURAN_SOURCES.find((s) => s.id === activeUsedSource) || TRUSTED_QURAN_SOURCES[0];

  const onlineFriendsCount = useMemo(
    () => friends.filter((f) => friendPresenceMap[f.friendUid]?.online).length,
    [friends, friendPresenceMap]
  );

  if (!authReady) {
    return (
      <section className="max-w-4xl mx-auto py-12 flex flex-col items-center justify-center gap-3 text-[#5C4B3B]">
        <RefreshCw className="w-6 h-6 animate-spin text-[#C88A14]" />
        <p className="text-sm font-bold">
          {isAr ? 'جاري التحقق من حالة الجلسة...' : 'Checking authentication status...'}
        </p>
      </section>
    );
  }

  return (
    <section className="max-w-5xl mx-auto space-y-4">
      <audio ref={remoteAudioRef} autoPlay playsInline className="sr-only" />
      {/* STEP 1: NOT SIGNED IN -> AUTH GATE */}
      {!user && (
        <div className="space-y-3">
          <div className="gold-card-surface frame-card-gold rounded-[20px] p-3.5 sm:p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#F6E9C8] border border-[#E5C983] flex items-center justify-center text-[#9E650C] shrink-0">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-extrabold font-display-islamic text-[#261C14]">
                  {isAr ? 'السرد الثنائي المباشر' : 'Duo Recitation'}
                </h1>
                <p className="text-xs text-[#5C4B3B]">
                  {isAr
                    ? 'سجّل دخولك لمشاركة رابط الصداقة والاتصال المشفّر'
                    : 'Sign in to share your friend link and place encrypted calls'}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#ECFDF3] border border-[#86EFAC] text-[#15803D] text-[11px] font-bold shrink-0">
              <Lock className="w-3 h-3" />
              <span>E2EE</span>
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-[#FFFDF9] frame-card-ivory p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#F6E9C8] text-[#9E650C] flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#261C14]">
                    {isAr ? 'تسجيل الدخول' : 'Sign In'}
                  </h2>
                  <p className="text-xs text-[#5C4B3B]">
                    {isAr
                      ? 'اتصال مباشر محمي بين الأصدقاء'
                      : 'Protected direct friend calling'}
                  </p>
                </div>
              </div>

              {authError && (
                <div className="rounded-xl bg-[#FBF3DF] border border-[#C88A14] p-3 text-xs text-[#261C14] flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-[#C88A14] shrink-0 mt-0.5" />
                  <div className="space-y-1 leading-relaxed">
                    <p className="font-semibold">{authError}</p>
                    {providerHelpOpen && (
                      <p className="text-[11px] text-[#5C4B3B]">
                        {isAr
                          ? 'لتفعيل البريد وكلمة المرور: افتح Firebase Console ← Authentication ← Sign-in method ← Email/Password ← Enable.'
                          : 'Enable Email/Password in Firebase Console → Authentication → Sign-in method.'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {verificationMsg && (
                <div className="rounded-xl bg-[#4A6144]/10 border border-[#4A6144]/30 p-3 text-xs text-[#261C14] font-semibold">
                  {verificationMsg}
                </div>
              )}

              <button
                type="button"
                disabled={authLoading}
                onClick={handleGoogleSignIn}
                className="w-full mustard-gradient-btn text-[#FFFDF9] py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 shadow-xs cursor-pointer disabled:opacity-60"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {isAr
                    ? 'الدخول السريع عبر بريد Google (موثّق فوراً)'
                    : 'Sign In Instantly with Google Email'}
                </span>
              </button>

              <div className="flex items-center gap-3 text-xs text-[#84715E]">
                <div className="flex-1 h-px bg-[#E5DEC9]" />
                <span>{isAr ? 'أو بالبريد وكلمة المرور' : 'Or with Email & Password'}</span>
                <div className="flex-1 h-px bg-[#E5DEC9]" />
              </div>

              <div className="grid grid-cols-2 gap-1 p-1 bg-[#F7F3EB] rounded-xl border border-[#DDD2BE]">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-[#2D2218] text-[#EAB338]'
                      : 'text-[#5C4B3B] hover:text-[#261C14]'
                  }`}
                >
                  {isAr ? 'تسجيل الدخول' : 'Sign In'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setAuthError(null);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    authMode === 'register'
                      ? 'bg-[#2D2218] text-[#EAB338]'
                      : 'text-[#5C4B3B] hover:text-[#261C14]'
                  }`}
                >
                  {isAr ? 'حساب بريد جديد' : 'Create Account'}
                </button>
              </div>

              <form onSubmit={handleEmailAuthSubmit} className="space-y-3">
                {authMode === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-[#5C4B3B] mb-1">
                      {isAr ? 'الاسم الظاهر للأصدقاء' : 'Display Name'}
                    </label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder={isAr ? 'مثال: نور' : 'e.g. Noor'}
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-sm text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[#5C4B3B] mb-1">
                    {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#84715E] absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="name@example.com"
                      dir="ltr"
                      className="w-full ps-9 pe-3 py-2 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-sm text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5C4B3B] mb-1">
                    {isAr ? 'كلمة المرور' : 'Password'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#84715E] absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="••••••"
                      dir="ltr"
                      className="w-full ps-9 pe-3 py-2 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-sm text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#2D2218] hover:bg-[#3D2F22] text-[#EAB338] text-sm font-bold cursor-pointer transition-colors disabled:opacity-60"
                >
                  {authLoading
                    ? isAr
                      ? 'جاري المعالجة...'
                      : 'Please wait...'
                    : authMode === 'register'
                    ? isAr
                      ? 'إنشاء الحساب وإرسال رابط التفعيل'
                      : 'Create Account & Send Verification'
                    : isAr
                    ? 'دخول بالبريد الإلكتروني'
                    : 'Sign In with Email'}
                </button>
              </form>
            </div>

            <div className="olive-card-surface frame-card-olive rounded-2xl p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#4A6144]/15 text-[#4A6144] flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-extrabold text-[#261C14]">
                    {isAr ? 'حماية وخصوصية السرد الثنائي' : 'Protected Direct Duo Recitation'}
                  </h3>
                </div>

                <ul className="space-y-2.5 text-xs sm:text-sm text-[#2D2218]">
                  <li className="flex items-start gap-2.5">
                    <Link2 className="w-4 h-4 text-[#4A6144] shrink-0 mt-0.5" />
                    <span>
                      {isAr
                        ? 'إضافة الأصدقاء عبر رابط دعوة خاص وبموافقة الطرفين.'
                        : 'Friend invites via personal links with mutual approval.'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Lock className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                    <span>
                      {isAr
                        ? 'صوت مشفّر (E2EE) مع إخفاء IP ومنع تبادل الملفات.'
                        : 'Encrypted audio (E2EE) with IP masking and no file transfer.'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <BookOpen className="w-4 h-4 text-[#C88A14] shrink-0 mt-0.5" />
                    <span>
                      {isAr
                        ? 'روايات حفص وقالون وورش مع تنبيه لحظي للأخطاء.'
                        : 'Hafs, Qalun & Warsh narrations with live error alerts.'}
                    </span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <div className="rounded-xl bg-[#FFFDF9]/85 border border-[#DDD2BE] p-3 text-xs text-[#5C4B3B]">
                  {isAr
                    ? 'الاتصال مقتصر على الأصدقاء المعتمدين فقط (دون غرف عامة).'
                    : 'Private calling strictly between approved friends.'}
                </div>
                {onOpenPrivacyTerms && (
                  <button
                    type="button"
                    onClick={onOpenPrivacyTerms}
                    className="text-xs font-bold text-[#15803D] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{isAr ? 'الخصوصية وشروط الاستخدام' : 'Privacy & Terms'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: VERIFICATION GATE */}
      {user && !user.emailVerified && (
        <div className="rounded-2xl bg-[#FFFDF9] border-2 border-[#C88A14]/60 p-6 max-w-xl mx-auto text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#F6E9C8] text-[#9E650C] flex items-center justify-center">
            <Mail className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-extrabold text-[#261C14]">
            {isAr ? 'تأكيد البريد الإلكتروني' : 'Verify Your Email'}
          </h2>
          <p className="text-xs sm:text-sm text-[#5C4B3B] leading-relaxed">
            {isAr
              ? `أُرسل رابط التفعيل إلى (${user.email}). افتحه ثم اضغط «تحقق الآن».`
              : `Verification link sent to (${user.email}). Click it, then tap "Verify Now".`}
          </p>
          {verificationMsg && (
            <div className="rounded-xl bg-[#FBF3DF] border border-[#C88A14] p-2.5 text-xs font-semibold text-[#261C14]">
              {verificationMsg}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              disabled={authLoading}
              onClick={handleRefreshVerificationStatus}
              className="mustard-gradient-btn text-[#FFFDF9] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${authLoading ? 'animate-spin' : ''}`} />
              <span>{isAr ? 'تحقق من التفعيل الآن' : 'Verify Status'}</span>
            </button>
            <button
              type="button"
              disabled={authLoading}
              onClick={handleResendVerification}
              className="px-4 py-2.5 rounded-xl bg-[#F7F3EB] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-xs font-bold text-[#2D2218] cursor-pointer"
            >
              {isAr ? 'إعادة إرسال الرابط' : 'Resend Link'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: VERIFIED USER LOBBY */}
      {user && user.emailVerified && !sessionId && (
        <div className="space-y-4">
          {/* Top Soft Green Guidance Banner */}
          <div className="rounded-xl bg-[#ECFDF3] border border-[#BBF7D0] px-3.5 py-2 text-xs sm:text-sm font-bold text-[#15803D] leading-snug">
            {isAr
              ? 'شارك رابط دعوتك مع صديقك، وعند موافقته يمكنك بدء مكالمة السرد الثنائي.'
              : 'Share your invite link with a friend; once approved, start your Duo voice call.'}
          </div>

          {lobbyError && (
            <div className="rounded-xl bg-[#FBF3DF] border border-[#C88A14] p-3 text-xs sm:text-sm text-[#261C14] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#C88A14] shrink-0 mt-0.5" />
              <p className="font-semibold">{lobbyError}</p>
            </div>
          )}

          {/* Post-Call Evaluation Summary Toast Card */}
          {lastCallSummary && (
            <div className="rounded-2xl bg-[#FFFDF9] border-2 border-[#15803D]/40 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#ECFDF3] text-[#15803D] flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm font-extrabold text-[#261C14]">
                    {isAr
                      ? `نتيجة جلسة السرد مع ${lastCallSummary.partnerName}`
                      : `Session Summary with ${lastCallSummary.partnerName}`}
                  </div>
                  <div className="text-xs text-[#5C4B3B] flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[#15803D]">
                      {
                        EVALUATION_CHOICES.find((c) => c.id === lastCallSummary.evaluation)?.[
                          isAr ? 'labelAr' : 'labelEn'
                        ]
                      }
                    </span>
                    <span>·</span>
                    <span>
                      {isAr ? 'المدة' : 'Duration'}:{' '}
                      {formatCallDuration(lastCallSummary.durationSeconds, isAr)}
                    </span>
                    <span>·</span>
                    <span>
                      {isAr ? 'الإتقان' : 'Accuracy'}:{' '}
                      {isAr
                        ? `${toArabicDigits(lastCallSummary.accuracyPct)}٪`
                        : `${lastCallSummary.accuracyPct}%`}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLastCallSummary(null)}
                className="p-1.5 rounded-lg bg-[#F7F3EB] text-[#5C4B3B] hover:bg-[#EFE9DC] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Instant On-Screen Pasted-Invite Confirmation Alert Modal */}
          {previewedInvite && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div className="w-full max-w-sm rounded-[24px] bg-[#FFFDF9] border-2 border-[#166534] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-3 bg-[#ECFDF3] border-b border-[#BBF7D0] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-[#15803D]" />
                    <h3 className="text-sm sm:text-base font-extrabold text-[#14532D]">
                      {isAr
                        ? `دعوة صداقة من «${previewedInvite.ownerName}»`
                        : `Friend Invite from "${previewedInvite.ownerName}"`}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewedInvite(null);
                      onClearFriendInvite?.();
                    }}
                    className="p-1 rounded-lg hover:bg-[#DCFCE7] text-[#14532D] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-xs sm:text-sm text-[#261C14] leading-relaxed">
                    {isAr
                      ? `هل توافق على إرسال طلب إضافة «${previewedInvite.ownerName}» إلى أصدقائك في السرد الثنائي؟`
                      : `Approve sending a friend request to "${previewedInvite.ownerName}"?`}
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewedInvite(null);
                        onClearFriendInvite?.();
                      }}
                      className="py-2.5 px-3 rounded-xl bg-[#EFE9DC] text-xs font-bold text-[#5C4B3B] cursor-pointer"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      disabled={inviteBusy}
                      onClick={handleConfirmSendFriendRequest}
                      className="py-2.5 px-3 rounded-xl bg-[#166534] hover:bg-[#14532D] text-[#FFFDF9] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isAr ? 'موافقة وإرسال' : 'Approve & Send'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Balanced Lobby Grid: Invite Link + Add Friend side-by-side on large screens, Friends below */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            {/* LOBBY CARD 1: Welcome + Personal Invite Link + Copy / Share / Sign Out */}
            <div className="rounded-[20px] bg-[#FFFDF9] frame-card-ivory p-3.5 sm:p-4 flex flex-col justify-between gap-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2.5">
                <div className="space-y-0.5 min-w-0">
                  <h2 className="text-lg sm:text-xl font-extrabold text-[#261C14] truncate">
                    {isAr
                      ? `مرحباً، ${getDisplayNameForUser(user)}`
                      : `Welcome, ${getDisplayNameForUser(user)}`}
                  </h2>
                  <p className="text-xs font-semibold text-[#5C4B3B]">
                    {isAr ? 'رابط دعوتك الخاص للأصدقاء:' : 'Your personal friend invite link:'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
                    <button
                      type="button"
                      onClick={handleEnableBackgroundCallAlerts}
                      className="px-2.5 py-1.5 rounded-xl bg-[#4A6144] hover:bg-[#3B4F36] text-[#FFFDF9] text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <BellRing className="w-3.5 h-3.5" />
                      <span>{isAr ? 'تفعيل الرنين' : 'Ring Alerts'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="px-3 py-1.5 rounded-xl bg-[#FFFDF9] hover:bg-[#F7F3EB] border border-[#DDD2BE] text-xs font-bold text-[#261C14] flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5 text-[#5C4B3B]" />
                    <span>{isAr ? 'تسجيل الخروج' : 'Sign Out'}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  readOnly
                  dir="ltr"
                  value={personalInviteUrl || (isAr ? 'جاري التوليد...' : 'Generating...')}
                  className="flex-1 min-w-[170px] px-3 py-2 rounded-xl bg-[#FAF7F0] border border-[#DDD2BE] text-xs font-mono-tabular text-[#5C4B3B] select-all truncate"
                />
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="px-3 py-2 rounded-xl bg-[#FFFDF9] hover:bg-[#F7F3EB] border border-[#DDD2BE] text-xs font-bold text-[#261C14] flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedInvite ? (
                    <Check className="w-3.5 h-3.5 text-[#15803D]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#5C4B3B]" />
                  )}
                  <span>{copiedInvite ? (isAr ? 'نُسخ الرابط' : 'Copied') : isAr ? 'نسخ الرابط' : 'Copy Link'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSharePersonalInvite}
                  className="px-3 py-2 rounded-xl bg-[#ECFDF3] hover:bg-[#DCFCE7] border border-[#BBF7D0] text-xs font-extrabold text-[#15803D] flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isAr ? 'مشاركة' : 'Share'}</span>
                </button>
                <button
                  type="button"
                  disabled={inviteBusy}
                  onClick={handleRegenerateInvite}
                  title={isAr ? 'إصدار رابط جديد وإلغاء السابق' : 'Regenerate & revoke previous link'}
                  className="p-2 rounded-xl bg-[#F7F3EB] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-[#9E650C] cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${inviteBusy ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* LOBBY CARD 2: Invite a Friend by Link */}
            <div className="rounded-[20px] bg-[#FFFDF9] frame-card-ivory p-3.5 sm:p-4 flex flex-col justify-between gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#15803D]" />
                  <h3 className="text-base font-extrabold text-[#261C14]">
                    {isAr ? 'دعوة صديق عبر الرابط' : 'Invite a Friend via Link'}
                  </h3>
                </div>
                <p className="text-xs text-[#5C4B3B]">
                  {isAr
                    ? 'أرسل رابطك أو الصق رابط صديقك لإرسال طلب الصداقة:'
                    : 'Share your link or paste your friend’s link below:'}
                </p>
              </div>

              <form onSubmit={handleLookupPastedInvite} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Link2 className="w-4 h-4 text-[#84715E] absolute top-1/2 -translate-y-1/2 end-3 pointer-events-none" />
                  <input
                    type="text"
                    value={pasteInviteInput}
                    onChange={(e) => setPasteInviteInput(e.target.value)}
                    dir="ltr"
                    placeholder="https://.../?invite=..."
                    className="w-full ps-3 pe-9 py-2 rounded-xl bg-[#FAF7F0] border border-[#DDD2BE] text-xs sm:text-sm text-[#261C14] focus:outline-none focus:border-[#15803D]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={inviteLookupBusy || !pasteInviteInput.trim()}
                  className="px-4 py-2 rounded-xl bg-[#166534] hover:bg-[#14532D] text-[#FFFDF9] text-xs sm:text-sm font-extrabold cursor-pointer disabled:opacity-50 shrink-0 transition-colors"
                >
                  {inviteLookupBusy
                    ? isAr
                      ? 'جاري...'
                      : '...'
                    : isAr
                    ? 'إرسال'
                    : 'Send'}
                </button>
              </form>

              {friendFeedback && (
                <div
                  className={`rounded-xl p-2.5 text-xs font-semibold border ${
                    friendFeedback.type === 'ok'
                      ? 'bg-[#ECFDF3] border-[#86EFAC] text-[#15803D]'
                      : 'bg-[#FBF3DF] border-[#C88A14] text-[#261C14]'
                  }`}
                >
                  {friendFeedback.msg}
                </div>
              )}

              {/* Pending Incoming Approval Requests (Privacy Consent Gate) */}
              {incomingRequests.length > 0 && (
                <div className="rounded-xl bg-[#FBF3DF] border-2 border-[#C88A14] p-3 space-y-2">
                  <div className="text-xs font-extrabold text-[#261C14] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#C88A14]" />
                    <span>
                      {isAr
                        ? `طلبات صداقة بانتظار موافقتك (${incomingRequests.length})`
                        : `Pending Friend Requests (${incomingRequests.length})`}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {incomingRequests.map((req) => (
                      <div
                        key={req.requestId}
                        className="rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] p-2.5 flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="text-xs sm:text-sm font-bold text-[#261C14]">
                          {req.fromName}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={inviteBusy}
                            onClick={() => handleApproveRequest(req)}
                            className="px-3 py-1.5 rounded-lg bg-[#166534] hover:bg-[#14532D] text-[#FFFDF9] text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isAr ? 'موافقة وإضافة' : 'Approve'}</span>
                          </button>
                          <button
                            type="button"
                            disabled={inviteBusy}
                            onClick={() => handleDeclineRequest(req)}
                            className="px-3 py-1.5 rounded-lg bg-[#F7F3EB] hover:bg-[#EFE9DC] text-[#A84A32] text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>{isAr ? 'رفض' : 'Decline'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {outgoingPendingRequests.length > 0 && (
                <div className="text-xs text-[#5C4B3B] bg-[#FAF7F0] border border-[#E5DEC9] rounded-xl px-3 py-2">
                  {isAr
                    ? `طلبات صادرة بانتظار موافقة أصحابها: ${outgoingPendingRequests
                        .map((r) => r.toName)
                        .join('، ')}`
                    : `Awaiting approval from: ${outgoingPendingRequests.map((r) => r.toName).join(', ')}`}
                </div>
              )}
            </div>

            {/* LOBBY CARD 3: Connected Friends + One-Tap Curriculum Picker + Voice Call */}
            <div className="lg:col-span-2 rounded-[20px] bg-[#FFFDF9] frame-card-ivory p-3.5 sm:p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#15803D]" />
                  <h3 className="text-base font-extrabold text-[#261C14]">
                    {isAr ? 'الأصدقاء المتصلون' : 'Connected Friends'}
                  </h3>
                </div>
                <span className="text-xs font-bold text-[#5C4B3B]">
                  {isAr
                    ? `${toArabicDigits(onlineFriendsCount)} متصل الآن من ${toArabicDigits(
                        friends.length
                      )}`
                    : `${onlineFriendsCount} online of ${friends.length}`}
                </span>
              </div>

              {/* Compact Current Riwayah, Curriculum & Privacy Bar */}
              <div className="rounded-xl bg-[#FAF7F0] border border-[#E5DEC9] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs min-w-0">
                  <BookOpen className="w-4 h-4 text-[#C88A14] shrink-0" />
                  <span className="font-bold text-[#261C14] truncate">{lobbyCurriculumSummary}</span>
                  {highPrivacyIpMask && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#ECFDF3] border border-[#86EFAC] text-[#15803D] text-[10px] font-bold shrink-0">
                      <Lock className="w-2.5 h-2.5" />
                      <span>{isAr ? 'إخفاء IP' : 'IP Masked'}</span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCurriculumModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#FFFDF9] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-xs font-bold text-[#261C14] flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#C88A14]" />
                  <span>{isAr ? 'الرواية والمقرر' : 'Narration & Curriculum'}</span>
                </button>
              </div>

              {friends.length === 0 ? (
                <div className="rounded-xl bg-[#FAF7F0] border border-dashed border-[#DDD2BE] p-3.5 text-center text-xs sm:text-sm text-[#5C4B3B]">
                  {isAr
                    ? 'لا يوجد أصدقاء بعد — شارك رابط دعوتك أعلاه لإضافتهم.'
                    : 'No friends yet — share your invite link above.'}
                </div>
              ) : (
                <div
                  className={
                    friends.length > 1
                      ? 'grid grid-cols-1 md:grid-cols-2 gap-2.5'
                      : 'space-y-2'
                  }
                >
                {friends.map((fr) => {
                  const isOnline = Boolean(friendPresenceMap[fr.friendUid]?.online);
                  return (
                    <div
                      key={fr.friendUid}
                      className="rounded-2xl bg-[#FAF7F0] border-[1.5px] border-[#D3C3A8] shadow-2xs p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:border-[#B5A07D]"
                    >
                      <div className="flex items-center justify-between sm:justify-start gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-[#E8F2EC] border border-[#BBF7D0] text-[#15803D] flex items-center justify-center shrink-0">
                          <UserCheck className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="text-sm sm:text-base font-extrabold text-[#261C14] truncate">
                            {fr.friendName}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span
                              className={`font-bold flex items-center gap-1 ${
                                isOnline ? 'text-[#15803D]' : 'text-[#84715E]'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isOnline ? 'bg-[#16A34A]' : 'bg-[#B5A897]'
                                }`}
                              />
                              <span>
                                {isOnline
                                  ? isAr
                                    ? 'متصل الآن'
                                    : 'Online now'
                                  : isAr
                                  ? 'صديق معتمد'
                                  : 'Approved friend'}
                              </span>
                            </span>
                            <span className="text-[#B5A897]">·</span>
                            <span dir="ltr" className="font-mono-tabular text-[11px] text-[#5C4B3B]">
                              {formatFriendShortCode(fr.friendUid)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={lobbyBusy}
                          onClick={() => startDirectFriendCall(fr)}
                          className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl bg-[#166534] hover:bg-[#14532D] text-[#FFFDF9] text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-2xs disabled:opacity-60 transition-colors"
                        >
                          <PhoneCall className="w-4 h-4" />
                          <span>{isAr ? 'دعوة للسرد الثنائي' : 'Call for Duo Sard'}</span>
                        </button>

                        {confirmRemoveFriendUid === fr.friendUid ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveFriend(fr.friendUid)}
                            className="px-2.5 py-2.5 rounded-xl bg-[#B93829] text-[#FFFDF9] text-xs font-bold cursor-pointer"
                          >
                            {isAr ? 'تأكيد' : 'Confirm'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveFriendUid(fr.friendUid)}
                            title={isAr ? 'إزالة الصديق' : 'Remove friend'}
                            className="p-2.5 rounded-xl bg-[#FFFDF9] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-[#A84A32] cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

              {/* Footer Compliance Link */}
              <div className="pt-2 border-t border-[#EFE9DC] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#84715E]">
                <span className="flex items-center gap-1 text-[#15803D] font-bold">
                  <Lock className="w-3 h-3" />
                  <span>{isAr ? 'اتصال صوتي مشفّر ومؤمّن (E2EE)' : 'Encrypted Audio-Only (E2EE)'}</span>
                </span>
                {onOpenPrivacyTerms && (
                  <button
                    type="button"
                    onClick={onOpenPrivacyTerms}
                    className="font-bold text-[#5C4B3B] hover:text-[#15803D] hover:underline cursor-pointer"
                  >
                    {isAr ? 'سياسة الخصوصية وشروط الاستخدام' : 'Privacy Policy & Terms'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: ACTIVE CALL VIEW */}
      {user && user.emailVerified && sessionId && (
        <div className="space-y-3">
          {/* Outgoing Ringing Overlay Modal */}
          {peerConnState === 'ringing' && outgoingCallTargetName && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-[28px] bg-[#2D2218] text-[#FFFDF9] border-2 border-[#EAB338] p-6 text-center space-y-5 shadow-2xl">
                <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-[#EAB338]/25 animate-ping" />
                  <div className="relative w-16 h-16 rounded-full bg-[#166534] border-2 border-[#EAB338] flex items-center justify-center text-[#FFFDF9]">
                    <PhoneCall className="w-7 h-7 animate-bounce" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-[#EAB338]">
                    {isAr ? 'اتصال صوتي مباشر — يرن الآن...' : 'Direct Voice Call — Ringing...'}
                  </p>
                  <h3 className="text-xl font-extrabold font-display-islamic">
                    {outgoingCallTargetName}
                  </h3>
                  <p className="text-xs text-[#E6D7BE]">
                    {activeCurriculumTextOnly} · {activeRiwayahLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleEndCall(true)}
                  className="w-full py-3 rounded-2xl bg-[#B93829] hover:bg-[#992D20] text-[#FFFDF9] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>{isAr ? 'إلغاء المكالمة' : 'Cancel Call'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Compact Top Status & Action Bar */}
          <div className="rounded-[20px] bg-[#FFFDF9] frame-card-ivory p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold">
                <Radio
                  className={`w-4 h-4 shrink-0 ${
                    peerConnState === 'connected'
                      ? 'text-[#15803D]'
                      : 'text-[#15803D] animate-pulse'
                  }`}
                />
                <span className="text-[#15803D]">
                  {peerConnState === 'connected'
                    ? isAr
                      ? `متصل صوتياً مع ${partnerName}`
                      : `Connected with ${partnerName}`
                    : peerConnState === 'ended'
                    ? isAr
                      ? `انتهت الجلسة مع ${partnerName}`
                      : `Session ended with ${partnerName}`
                    : isAr
                    ? `جاري ربط الصوت مع ${partnerName}...`
                    : `Connecting audio with ${partnerName}...`}
                </span>
                <span className="text-[#B5A897]">·</span>
                <span className="font-mono-tabular text-[#5C4B3B]">
                  {formatCallDuration(callElapsedSeconds, isAr)}
                </span>
              </div>

              {/* Green E2EE Security Lock Badge */}
              <div
                className="px-2.5 py-1 rounded-lg bg-[#ECFDF3] border border-[#86EFAC] text-[#15803D] text-[11px] font-bold flex items-center gap-1"
                title={isAr ? 'اتصال صوتي مشفر ومؤمّن (E2EE)' : 'Encrypted & Secured Audio (E2EE)'}
              >
                <Lock className="w-3 h-3 shrink-0" />
                <span>{isAr ? 'صوت مشفر ومؤمّن (E2EE)' : 'E2EE Secured'}</span>
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-sm sm:text-base font-extrabold text-[#261C14]">
                {activeCurriculumTextOnly}{' '}
                <span className="text-[#84715E]">·</span>{' '}
                <span className="text-[#C88A14]">
                  {isAr ? `رواية ${activeRiwayahLabel}` : activeRiwayahLabel}
                </span>
              </div>
              <div className="text-xs sm:text-sm text-[#5C4B3B]">
                {isAr ? 'دورك:' : 'Your role:'}{' '}
                <strong className="text-[#261C14]">
                  {amICurrentReciter
                    ? shouldHideVersesForMe
                      ? isAr
                        ? 'القارئ (الشاشة مخفية)'
                        : 'Reciter (Screen Hidden)'
                      : isAr
                      ? 'القارئ (النص ظاهر)'
                      : 'Reciter (Text Visible)'
                    : isAr
                    ? 'المُسمِّع (متابعة المصحف وتنبيه الأخطاء)'
                    : 'Listener (Follow Mushaf & Mark Errors)'}
                </strong>
              </div>
            </div>

            {/* Clean Controls Bar (Mute, Speaker/Earpiece, Curriculum, Swap Roles, Rate & End) */}
            {needsAudioUnlock && (
              <button
                type="button"
                onClick={() => syncRemoteAudioTracksToMediaElement()}
                className="w-full py-2 px-3 rounded-xl bg-[#ECFDF3] hover:bg-[#DCFCE7] border border-[#86EFAC] text-[#15803D] text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-4 h-4 shrink-0" />
                <span>
                  {isAr
                    ? 'اضغط هنا لتشغيل الصوت الوارد من الطرف الآخر'
                    : 'Tap to enable incoming call audio'}
                </span>
              </button>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleToggleMic}
                className={`px-3.5 py-2 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isMicMuted
                    ? 'bg-[#FEE2E2] border-[#FECACA] text-[#B93829]'
                    : 'bg-[#FAF7F0] hover:bg-[#EFE9DC] border-[#DDD2BE] text-[#261C14]'
                }`}
              >
                {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isMicMuted ? (isAr ? 'صامت' : 'Muted') : isAr ? 'كتم' : 'Mute'}</span>
                {!isMicMuted && (
                  <span className="w-6 h-1.5 rounded-full bg-[#DDD2BE] overflow-hidden inline-block ms-0.5">
                    <span
                      className="block h-full bg-[#15803D] transition-all duration-75"
                      style={{ width: `${micLevel}%` }}
                    />
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleToggleSpeakerMode}
                title={
                  isAr
                    ? speakerMode === 'speaker'
                      ? 'التبديل إلى السماعة'
                      : 'التبديل إلى مكبر الصوت'
                    : speakerMode === 'speaker'
                    ? 'Switch to Earpiece'
                    : 'Switch to Speaker'
                }
                className={`px-3.5 py-2 rounded-2xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  speakerMode === 'speaker'
                    ? 'bg-[#ECFDF3] hover:bg-[#DCFCE7] border-[#86EFAC] text-[#15803D]'
                    : 'bg-[#FAF7F0] hover:bg-[#EFE9DC] border-[#DDD2BE] text-[#261C14]'
                }`}
              >
                {speakerMode === 'speaker' ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <Volume1 className="w-4 h-4" />
                )}
                <span>
                  {speakerMode === 'speaker'
                    ? isAr
                      ? 'مكبر الصوت'
                      : 'Speaker'
                    : isAr
                    ? 'السماعة'
                    : 'Earpiece'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowCurriculumModal(true)}
                className="px-3.5 py-2 rounded-2xl bg-[#FAF7F0] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-xs sm:text-sm font-bold text-[#261C14] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#5C4B3B]" />
                <span>{isAr ? 'الرواية والمقرر' : 'Narration & Plan'}</span>
              </button>

              <button
                type="button"
                onClick={handleSwapRoles}
                className="px-3.5 py-2 rounded-2xl bg-[#FAF7F0] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-xs sm:text-sm font-bold text-[#261C14] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeftRight className="w-4 h-4 text-[#5C4B3B]" />
                <span>{isAr ? 'تبادل الأدوار' : 'Swap Roles'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowEvalModal(true)}
                className="px-4 py-2 rounded-2xl bg-[#B93829] hover:bg-[#992D20] text-[#FFFDF9] text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              >
                <PhoneOff className="w-4 h-4" />
                <span>{isAr ? 'تقييم وإنهاء' : 'Rate & End'}</span>
              </button>
            </div>
          </div>

          {/* Main Reading Area: Hidden Reciter Screen OR Listener Interactive Word-Tap Mushaf */}
          {shouldHideVersesForMe ? (
            <div className="rounded-[20px] bg-[#FFFDF9] frame-card-ivory p-4 sm:p-5 flex flex-col justify-between gap-3.5">
              <div className="flex flex-col items-center justify-center text-center py-3 space-y-2 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-xl bg-[#FAF7F0] border border-[#E5DEC9] flex items-center justify-center text-[#15803D]">
                  <EyeOff className="w-6 h-6" />
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#261C14]">
                  {amICurrentReciter
                    ? isAr
                      ? 'شاشة القارئ — النص مخفي'
                      : 'Reciter Screen — Text Hidden'
                    : isAr
                    ? 'شاشة المُسمِّع — النص مخفي'
                    : 'Listener Screen — Text Hidden'}
                </h2>
                <p className="text-xs sm:text-sm text-[#5C4B3B] leading-relaxed">
                  {amICurrentReciter
                    ? isAr
                      ? `اتلُ غيباً؛ سيظهر هنا أي خطأ يعلّم عليه (${partnerName}).`
                      : `Recite from memory; marked errors by (${partnerName}) appear here.`
                    : isAr
                    ? 'النص مخفي لديك — اضغط أدناه لعرض المصحف.'
                    : 'Text hidden — tap below to show verses.'}
                </p>

                {markedErrors.length > 0 && (
                  <div className="mt-2 px-3.5 py-2 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-xs font-extrabold animate-in fade-in">
                    {isAr
                      ? `تنبيه لحظي: تم التعليم على كلمة «${
                          parseMarkedErrorToken(markedErrors[0]).word
                        }» (${parseMarkedErrorToken(markedErrors[0]).verseKey})`
                      : `Marked word alert: "${parseMarkedErrorToken(markedErrors[0]).word}"`}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setLocalHideVerses(false)}
                  className="text-[11px] font-bold text-[#84715E] hover:text-[#261C14] flex items-center gap-1 pt-2 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إظهار النص مؤقتاً لي' : 'Show Text Locally'}</span>
                </button>
              </div>

              {/* Bottom Card: Marked Session Errors (Matching Screenshot 2) */}
              <div className="rounded-2xl bg-[#FAF7F0] border border-[#E5DEC9] p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-[#261C14]">
                    {isAr ? 'الأخطاء المعلّم عليها في الجلسة' : 'Marked Errors in Session'}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#B93829]">
                    <span className="w-2 h-2 rounded-full bg-[#B93829]" />
                    <span>{isAr ? toArabicDigits(mistakesCount) : mistakesCount}</span>
                  </div>
                </div>

                {markedErrors.length === 0 && mistakesCount === 0 ? (
                  <p className="text-xs sm:text-sm text-[#5C4B3B]">
                    {isAr
                      ? 'لم تُسجّل أي أخطاء حتى الآن — واصل التلاوة بثبات.'
                      : 'No errors marked yet — keep reciting steadily.'}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {markedErrors.map((tok, i) => {
                      const parsed = parseMarkedErrorToken(tok);
                      return (
                        <span
                          key={`${tok}-${i}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-xs font-extrabold"
                        >
                          <span className="font-uthmani text-sm">{parsed.word}</span>
                          {parsed.verseKey && (
                            <span className="text-[10px] opacity-80 font-mono-tabular">
                              ({parsed.verseKey})
                            </span>
                          )}
                        </span>
                      );
                    })}
                    {markedErrors.length === 0 && mistakesCount > 0 && (
                      <span className="text-xs text-[#991B1B] font-bold">
                        {isAr
                          ? `تم تسجيل ${toArabicDigits(mistakesCount)} تنبيه خطأ من المُسمِّع.`
                          : `${mistakesCount} error alert(s) marked by listener.`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Listener Interactive Word-Tap Mushaf Screen */
            <div className="rounded-[20px] bg-[#FFFDF9] frame-card-ivory p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#EFE9DC]">
                <div className="space-y-0.5">
                  <div className="text-xs sm:text-sm font-extrabold text-[#15803D]">
                    {isAr
                      ? 'المصحف — المس أي كلمة للتنبيه على خطأ'
                      : 'Mushaf — Tap any word to mark an error'}
                  </div>
                  <div className="text-[11px] text-[#5C4B3B]">
                    {isAr ? `عدد الأخطاء المسجلة:` : `Marked Errors:`}{' '}
                    <strong className="text-[#B93829] font-mono-tabular">
                      {isAr ? toArabicDigits(mistakesCount) : mistakesCount}
                    </strong>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAdjustMistakes(-1)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#FAF7F0] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-xs font-bold text-[#5C4B3B] cursor-pointer"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustMistakes(1)}
                    className="px-3 py-1.5 rounded-lg bg-[#FEE2E2] hover:bg-[#FECACA] border border-[#FCA5A5] text-xs font-bold text-[#991B1B] cursor-pointer"
                  >
                    {isAr ? '+ خطأ' : '+ Error'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepVerse(-1)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#FAF7F0] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-xs font-bold text-[#261C14] flex items-center gap-0.5 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span>{isAr ? 'السابقة' : 'Prev'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepVerse(1)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#FAF7F0] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-xs font-bold text-[#261C14] flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>{isAr ? 'التالية' : 'Next'}</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {versesLoading ? (
                <div className="py-10 flex items-center justify-center gap-2 text-sm text-[#5C4B3B]">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#C88A14]" />
                  <span>
                    {isAr
                      ? `جاري تحميل الآيات برواية ${getRiwayahLabel(selectedRiwayah, 'ar')}...`
                      : `Loading verses in ${getRiwayahLabel(selectedRiwayah, 'en')}...`}
                  </span>
                </div>
              ) : verses.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#84715E]">
                  {isAr
                    ? 'تعذر جلب النص حالياً — الاتصال الصوتي المباشر ما زال يعمل بشكل طبيعي.'
                    : 'Unable to load Quran text right now — direct P2P audio remains active.'}
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[54vh] overflow-y-auto pe-1">
                  {verses.map((v, idx) => {
                    const isActive = activeAyah === v.ayahNumber;
                    const isPeeking = peekVerseKey === v.verseKey;
                    const prevSurah = idx > 0 ? verses[idx - 1].surahNumber : null;
                    const surahObj = SURAH_LIST.find((s) => s.number === v.surahNumber);
                    const words = v.text.trim().split(/\s+/).filter(Boolean);

                    return (
                      <React.Fragment key={`${v.verseKey}-${idx}`}>
                        {(idx === 0 || prevSurah !== v.surahNumber) && surahObj && (
                          <div className="px-3 py-1.5 rounded-xl bg-[#F6E9C8]/70 border border-[#C88A14]/35 text-xs font-extrabold text-[#2D2218] text-center">
                            {isAr ? `سورة ${surahObj.nameAr}` : `Surah ${surahObj.nameEn}`}
                          </div>
                        )}
                        <div
                          onClick={() => handleSelectAyahSync(v.ayahNumber)}
                          className={`w-full text-start p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
                            isActive
                              ? 'bg-[#FBF3DF] border-[#C88A14] ring-1 ring-[#C88A14]/40 shadow-2xs'
                              : 'bg-[#FAF7F0] hover:bg-[#EFE9DC]/70 border-[#E5DEC9]'
                          }`}
                        >
                          {fadeFirstWordOnly && !isPeeking ? (
                            <div className="flex items-center justify-between gap-2">
                              <p
                                dir="rtl"
                                className={`font-uthmani text-[#261C14] leading-[2.2] ${
                                  textScale === 'xlarge'
                                    ? 'text-2xl sm:text-3xl'
                                    : textScale === 'large'
                                    ? 'text-xl sm:text-2xl'
                                    : 'text-lg sm:text-xl'
                                }`}
                              >
                                {extractFirstWordMask(v.textCleanUthmani)}{' '}
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#C88A14]/15 border border-[#C88A14]/40 text-xs font-mono-tabular font-bold text-[#9E650C] align-middle mx-1">
                                  {v.ayahNumber}
                                </span>
                              </p>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPeekVerseKey(v.verseKey);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#FFFDF9] border border-[#DDD2BE] text-[11px] font-bold text-[#9E650C] shrink-0 cursor-pointer"
                              >
                                {isAr ? 'كشف' : 'Reveal'}
                              </button>
                            </div>
                          ) : (
                            <p
                              dir="rtl"
                              className={`font-uthmani text-[#261C14] leading-[2.3] flex flex-wrap items-baseline gap-x-1.5 gap-y-1 ${
                                textScale === 'xlarge'
                                  ? 'text-2xl sm:text-3xl'
                                  : textScale === 'large'
                                  ? 'text-xl sm:text-2xl'
                                  : 'text-lg sm:text-xl'
                              }`}
                            >
                              {words.map((word, wIdx) => {
                                const token = `${v.verseKey}|${word.slice(0, 28)}|${wIdx}`.slice(0, 80);
                                const isMarked = markedErrors.includes(token);
                                return (
                                  <button
                                    key={`${v.verseKey}-w-${wIdx}`}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectAyahSync(v.ayahNumber);
                                      handleToggleWordError(v.verseKey, word, wIdx);
                                    }}
                                    className={`inline-block rounded-md px-0.5 transition-colors cursor-pointer ${
                                      isMarked
                                        ? 'bg-[#FEE2E2] text-[#991B1B] border-b-2 border-[#DC2626]'
                                        : 'hover:bg-[#E5DEC9]/70'
                                    }`}
                                  >
                                    {word}
                                  </button>
                                );
                              })}
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#C88A14]/15 border border-[#C88A14]/40 text-xs font-mono-tabular font-bold text-[#9E650C] align-middle mx-1">
                                {v.ayahNumber}
                              </span>
                            </p>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}

              {/* Trusted Source Links */}
              <div className="pt-2 border-t border-[#EFE9DC] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5C4B3B]">
                <span className="font-bold text-[#4A6144]">
                  {isAr ? `المصدر: ${activeSourceMeta.labelAr}` : `Source: ${activeSourceMeta.labelEn}`}
                </span>
                <div className="flex items-center gap-3">
                  <a
                    href={activeSourceMeta.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-[#9E650C] hover:underline"
                  >
                    <span>{isAr ? 'مجمع الملك فهد' : 'KFGQPC'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={activeSourceMeta.partnerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-[#9E650C] hover:underline"
                  >
                    <span>{activeSourceMeta.partnerLabelAr}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* IN-CALL & LOBBY MODAL: RIWAYAH, CURRICULUM, HIDING & IP PRIVACY */}
      {showCurriculumModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-4"
          onClick={() => setShowCurriculumModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[88vh] flex flex-col rounded-[26px] bg-[#FFFDF9] border border-[#DDD2BE] shadow-2xl overflow-hidden text-[#261C14]"
          >
            <div className="px-4 sm:px-5 py-3.5 bg-[#2D2218] text-[#FFFDF9] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#EAB338]" />
                <h3 className="text-sm sm:text-base font-extrabold">
                  {isAr ? 'الرواية والمقرر وخيارات السرد' : 'Narration, Curriculum & Options'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCurriculumModal(false)}
                className="p-1.5 rounded-lg bg-[#FFFDF9]/10 hover:bg-[#FFFDF9]/20 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {/* Riwayah Switcher */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#5C4B3B]">
                  {isAr ? 'الرواية القرآنية:' : 'Quran Narration:'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {RIWAYAH_OPTIONS.map((rw) => {
                    const active = selectedRiwayah === rw.id;
                    return (
                      <button
                        key={rw.id}
                        type="button"
                        onClick={() => setSelectedRiwayah(rw.id)}
                        className={`py-2.5 px-2 rounded-xl border text-center cursor-pointer transition-colors ${
                          active
                            ? 'bg-[#2D2218] border-[#C88A14] text-[#EAB338]'
                            : 'bg-[#FAF7F0] border-[#DDD2BE] text-[#261C14]'
                        }`}
                      >
                        <div className="text-xs sm:text-sm font-extrabold">
                          {isAr ? rw.labelAr : rw.labelEn}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3 Curriculum Modes */}
              <div className="space-y-2.5">
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F7F3EB] rounded-xl border border-[#DDD2BE]">
                  {(
                    [
                      { id: 'surah', label: isAr ? 'بالسور' : 'By Surah', icon: BookOpen },
                      { id: 'ayah', label: isAr ? 'بأرقام الآيات' : 'By Ayahs', icon: Hash },
                      { id: 'page', label: isAr ? 'بالصفحات' : 'By Pages', icon: FileText },
                    ] as const
                  ).map((tab) => {
                    const Icon = tab.icon;
                    const active = curriculumMode === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCurriculumMode(tab.id)}
                        className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                          active
                            ? 'bg-[#166534] text-[#FFFDF9]'
                            : 'text-[#5C4B3B] hover:text-[#261C14]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* By Surah */}
                {curriculumMode === 'surah' && (
                  <div className="rounded-xl bg-[#FAF7F0] border border-[#DDD2BE] p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1 p-0.5 bg-[#EFE9DC] rounded-lg border border-[#DDD2BE]">
                        <button
                          type="button"
                          onClick={() => setSurahPickStyle('touch')}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer ${
                            surahPickStyle === 'touch'
                              ? 'bg-[#2D2218] text-[#EAB338]'
                              : 'text-[#5C4B3B]'
                          }`}
                        >
                          <Touchpad className="w-3.5 h-3.5" />
                          <span>{isAr ? 'باللمس' : 'Touch'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSurahPickStyle('dropdown')}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer ${
                            surahPickStyle === 'dropdown'
                              ? 'bg-[#2D2218] text-[#EAB338]'
                              : 'text-[#5C4B3B]'
                          }`}
                        >
                          <ListFilter className="w-3.5 h-3.5" />
                          <span>{isAr ? 'قائمة منسدلة' : 'Dropdown'}</span>
                        </button>
                      </div>

                      <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5C4B3B] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={multiSurahRange}
                          onChange={(e) => {
                            setMultiSurahRange(e.target.checked);
                            if (!e.target.checked) setSelectedSurahEnd(selectedSurah);
                          }}
                          className="rounded border-[#C88A14] text-[#C88A14]"
                        />
                        <span>{isAr ? 'عدة سور متتالية' : 'Multi-Surah'}</span>
                      </label>
                    </div>

                    {surahPickStyle === 'dropdown' ? (
                      <div className={`grid gap-2 ${multiSurahRange ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        <select
                          value={selectedSurah}
                          onChange={(e) => setSelectedSurah(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-xs sm:text-sm font-bold"
                        >
                          {SURAH_LIST.map((s) => (
                            <option key={s.number} value={s.number}>
                              {s.number}. {isAr ? `سورة ${s.nameAr}` : s.nameEn}
                            </option>
                          ))}
                        </select>
                        {multiSurahRange && (
                          <select
                            value={selectedSurahEnd}
                            onChange={(e) => setSelectedSurahEnd(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-xs sm:text-sm font-bold"
                          >
                            {SURAH_LIST.filter(
                              (s) => s.number >= selectedSurah && s.number <= selectedSurah + 4
                            ).map((s) => (
                              <option key={s.number} value={s.number}>
                                {s.number}. {isAr ? `سورة ${s.nameAr}` : s.nameEn}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-[#84715E] absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
                          <input
                            type="text"
                            value={surahSearchQuery}
                            onChange={(e) => setSurahSearchQuery(e.target.value)}
                            placeholder={isAr ? 'ابحث باسم السورة أو رقمها...' : 'Search Surah...'}
                            className="w-full ps-8 pe-3 py-1.5 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                          {filteredSurahs.map((s) => {
                            const isStart = s.number === selectedSurah;
                            const isInRange =
                              multiSurahRange &&
                              s.number >= selectedSurah &&
                              s.number <= selectedSurahEnd;
                            return (
                              <button
                                key={s.number}
                                type="button"
                                onClick={() => {
                                  if (!multiSurahRange) {
                                    setSelectedSurah(s.number);
                                    setSelectedSurahEnd(s.number);
                                  } else if (
                                    s.number < selectedSurah ||
                                    selectedSurahEnd !== selectedSurah
                                  ) {
                                    setSelectedSurah(s.number);
                                    setSelectedSurahEnd(s.number);
                                  } else {
                                    setSelectedSurahEnd(Math.min(s.number, selectedSurah + 4));
                                  }
                                }}
                                className={`px-2 py-1.5 rounded-xl border text-center cursor-pointer ${
                                  isStart
                                    ? 'bg-[#2D2218] border-[#C88A14] text-[#EAB338]'
                                    : isInRange
                                    ? 'bg-[#4A6144]/15 border-[#4A6144] text-[#261C14]'
                                    : 'bg-[#FFFDF9] border-[#DDD2BE] text-[#261C14]'
                                }`}
                              >
                                <div className="text-[10px] opacity-70">{s.number}</div>
                                <div className="text-xs font-bold truncate">
                                  {isAr ? s.nameAr : s.nameEn}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* By Ayah Range */}
                {curriculumMode === 'ayah' && (
                  <div className="rounded-xl bg-[#FAF7F0] border border-[#DDD2BE] p-3 space-y-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-[#5C4B3B] mb-1">
                          {isAr ? 'السورة' : 'Surah'}
                        </label>
                        <select
                          value={selectedSurah}
                          onChange={(e) => setSelectedSurah(Number(e.target.value))}
                          className="w-full px-2.5 py-2 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-xs font-bold"
                        >
                          {SURAH_LIST.map((s) => (
                            <option key={s.number} value={s.number}>
                              {s.number}. {isAr ? s.nameAr : s.nameEn}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#5C4B3B] mb-1">
                          {isAr ? 'من الآية' : 'From'}
                        </label>
                        <select
                          value={ayahFrom}
                          onChange={(e) => {
                            const v = Math.max(
                              1,
                              Math.min(Number(e.target.value) || 1, currentSurahInfo.ayahCount)
                            );
                            setAyahFrom(v);
                            if (ayahTo < v) setAyahTo(v);
                          }}
                          className="w-full px-2.5 py-2 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-xs font-mono-tabular font-bold"
                        >
                          {Array.from(
                            { length: currentSurahInfo.ayahCount },
                            (_, idx) => idx + 1
                          ).map((num) => (
                            <option key={num} value={num}>
                              {isAr ? toArabicDigits(num) : num}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#5C4B3B] mb-1">
                          {isAr ? 'إلى الآية' : 'To'}
                        </label>
                        <select
                          value={ayahTo}
                          onChange={(e) =>
                            setAyahTo(
                              Math.max(
                                ayahFrom,
                                Math.min(Number(e.target.value) || ayahFrom, currentSurahInfo.ayahCount)
                              )
                            )
                          }
                          className="w-full px-2.5 py-2 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-xs font-mono-tabular font-bold"
                        >
                          {Array.from(
                            { length: Math.max(1, currentSurahInfo.ayahCount - ayahFrom + 1) },
                            (_, idx) => ayahFrom + idx
                          ).map((num) => (
                            <option key={num} value={num}>
                              {isAr ? toArabicDigits(num) : num}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* By Page Range */}
                {curriculumMode === 'page' && (
                  <div className="rounded-xl bg-[#FAF7F0] border border-[#DDD2BE] p-3 grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[#5C4B3B] mb-1">
                        {isAr ? 'من الصفحة (١–٦٠٤)' : 'From Page (1–604)'}
                      </label>
                      <select
                        value={pageFrom}
                        onChange={(e) => {
                          const v = Math.max(1, Math.min(604, Number(e.target.value) || 1));
                          setPageFrom(v);
                          if (pageTo < v) {
                            setPageTo(v);
                          } else if (pageTo > Math.min(604, v + 9)) {
                            setPageTo(Math.min(604, v + 9));
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-xs font-mono-tabular font-bold"
                      >
                        {Array.from({ length: 604 }, (_, idx) => idx + 1).map((p) => (
                          <option key={p} value={p}>
                            {isAr ? `صفحة ${toArabicDigits(p)}` : `Page ${p}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#5C4B3B] mb-1">
                        {isAr ? 'إلى الصفحة (حد ١٠)' : 'To Page (max 10)'}
                      </label>
                      <select
                        value={pageTo}
                        onChange={(e) =>
                          setPageTo(
                            Math.max(
                              pageFrom,
                              Math.min(604, pageFrom + 9, Number(e.target.value) || pageFrom)
                            )
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-xs font-mono-tabular font-bold"
                      >
                        {Array.from(
                          { length: Math.max(1, Math.min(604, pageFrom + 9) - pageFrom + 1) },
                          (_, idx) => pageFrom + idx
                        ).map((p) => (
                          <option key={p} value={p}>
                            {isAr ? `صفحة ${toArabicDigits(p)}` : `Page ${p}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Hiding, Font Size & IP Privacy Controls */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleSyncedHideReciter}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${
                      hideVersesForReciter
                        ? 'bg-[#2D2218] text-[#EAB338] border-[#2D2218]'
                        : 'bg-[#FAF7F0] text-[#5C4B3B] border-[#DDD2BE]'
                    }`}
                  >
                    {hideVersesForReciter ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{isAr ? 'إخفاء عن القارئ' : 'Hide for Reciter'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleSyncedHideListener}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${
                      hideVersesForListener
                        ? 'bg-[#2D2218] text-[#EAB338] border-[#2D2218]'
                        : 'bg-[#FAF7F0] text-[#5C4B3B] border-[#DDD2BE]'
                    }`}
                  >
                    {hideVersesForListener ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{isAr ? 'إخفاء عن المُسمِّع' : 'Hide for Listener'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFadeFirstWordOnly(!fadeFirstWordOnly)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${
                      fadeFirstWordOnly
                        ? 'bg-[#166534] text-[#FFFDF9] border-[#166534]'
                        : 'bg-[#FAF7F0] text-[#5C4B3B] border-[#DDD2BE]'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تلاشي' : 'Fade'}</span>
                  </button>
                </div>

                {/* Text Scale */}
                <div className="flex items-center justify-between gap-2 rounded-xl bg-[#FAF7F0] border border-[#DDD2BE] px-3 py-2">
                  <span className="text-xs font-bold text-[#5C4B3B]">
                    {isAr ? 'حجم خط الآيات:' : 'Verse Font Size:'}
                  </span>
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { id: 'normal', label: isAr ? 'عادي' : 'S' },
                        { id: 'large', label: isAr ? 'كبير' : 'M' },
                        { id: 'xlarge', label: isAr ? 'مكبر' : 'L' },
                      ] as const
                    ).map((sz) => (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => setTextScale(sz.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                          textScale === sz.id
                            ? 'bg-[#2D2218] text-[#EAB338]'
                            : 'bg-[#FFFDF9] text-[#5C4B3B]'
                        }`}
                      >
                        {sz.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* High Privacy IP Masking Toggle */}
                <div className="flex items-center justify-between gap-3 rounded-xl bg-[#ECFDF3] border border-[#86EFAC] px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#15803D] shrink-0" />
                    <div>
                      <div className="text-xs font-extrabold text-[#261C14]">
                        {isAr ? 'وضع الخصوصية العالية (إخفاء الـ IP)' : 'High Privacy Mode (IP Masking)'}
                      </div>
                      <div className="text-[11px] text-[#15803D]">
                        {isAr
                          ? 'تمرير عبر TURN الوسيط وحظر أي تبادل للملفات'
                          : 'TURN relay + strict audio-only'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={highPrivacyIpMask}
                    onClick={() => setHighPrivacyIpMask((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      highPrivacyIpMask ? 'bg-[#15803D]' : 'bg-[#C4B7A0]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition ${
                        highPrivacyIpMask
                          ? isAr
                            ? '-translate-x-5'
                            : 'translate-x-5'
                          : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {highPrivacyIpMask && !TURN_SERVER_URL.trim() && (
                  <p className="text-[11px] text-[#9E650C] bg-[#FBF3DF] border border-[#E5C983] rounded-lg px-3 py-1.5 font-semibold">
                    {isAr
                      ? 'توجيه مشفّر تلقائي لضمان عمل الصوت فوراً؛ أضف TURN_SERVER_URL لإجبار التمرير عبر خادم وسيط.'
                      : 'Encrypted STUN fallback is active so audio works immediately; set TURN_SERVER_URL to enforce strict relay.'}
                  </p>
                )}
              </div>
            </div>

            <div className="px-4 sm:px-5 py-3 bg-[#F7F3EB] border-t border-[#DDD2BE] flex justify-end gap-2">
              <button
                type="button"
                onClick={handleApplyCurriculumSettings}
                className="px-5 py-2 rounded-xl bg-[#166534] hover:bg-[#14532D] text-[#FFFDF9] text-xs sm:text-sm font-extrabold cursor-pointer"
              >
                {sessionId
                  ? isAr
                    ? 'حفظ ومزامنة في الجلسة'
                    : 'Save & Sync Live'
                  : isAr
                  ? 'حفظ وإغلاق'
                  : 'Save & Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* END-CALL EVALUATION MODAL (MATCHING SCREENSHOT 1) */}
      {showEvalModal && sessionId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-[28px] bg-[#FFFDF9] border border-[#DDD2BE] p-5 sm:p-6 shadow-2xl space-y-5 text-[#261C14]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#C88A14]" />
                <h3 className="text-base sm:text-lg font-extrabold">
                  {isAr ? 'التقييم وإنهاء الاتصال' : 'Evaluate & End Call'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEvalModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#F7F3EB] text-[#5C4B3B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 3 Metrics Card */}
            <div className="rounded-2xl bg-[#FAF7F0] border border-[#E5DEC9] grid grid-cols-3 py-3.5 px-2 text-center divide-x rtl:divide-x-reverse divide-[#E5DEC9]">
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-[#5C4B3B]">
                  {isAr ? 'المدة' : 'Duration'}
                </div>
                <div className="text-base font-extrabold font-mono-tabular text-[#261C14]">
                  {formatCallDuration(callElapsedSeconds, isAr)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-[#5C4B3B]">
                  {isAr ? 'الأخطاء' : 'Errors'}
                </div>
                <div className="text-base font-extrabold font-mono-tabular text-[#B93829]">
                  {isAr ? toArabicDigits(mistakesCount) : mistakesCount}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-[#5C4B3B]">
                  {isAr ? 'نسبة الإتقان' : 'Accuracy'}
                </div>
                <div className="text-base font-extrabold font-mono-tabular text-[#15803D]">
                  {isAr ? `٪${toArabicDigits(computedAccuracyPct)}` : `${computedAccuracyPct}%`}
                </div>
              </div>
            </div>

            {/* Final Rating Choices */}
            <div className="space-y-2.5">
              <p className="text-xs sm:text-sm font-bold text-[#261C14]">
                {isAr
                  ? 'التقدير النهائي للجلسة (سيظهر لك ولصديقك)'
                  : 'Final Session Rating (visible to you & your friend)'}
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                {EVALUATION_CHOICES.map((opt) => {
                  const selected = selectedEvaluation === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedEvaluation(opt.id)}
                      className={`py-2.5 px-3 rounded-2xl border text-xs sm:text-sm font-bold text-center cursor-pointer transition-all ${
                        selected
                          ? 'bg-[#E6F4EE] border-[#15803D] text-[#155E42] shadow-2xs'
                          : 'bg-[#FFFDF9] border-[#DDD2BE] text-[#261C14] hover:bg-[#FAF7F0]'
                      }`}
                    >
                      {isAr ? opt.labelAr : opt.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() =>
                  handleEndCall(true, {
                    evaluation: selectedEvaluation,
                    durationSeconds: callElapsedSeconds,
                    accuracyPct: computedAccuracyPct,
                  })
                }
                className="py-3 px-3 rounded-2xl bg-[#B93829] hover:bg-[#992D20] text-[#FFFDF9] text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <PhoneOff className="w-4 h-4" />
                <span>{isAr ? 'حفظ وإنهاء الاتصال' : 'Save & End Call'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowEvalModal(false)}
                className="py-3 px-3 rounded-2xl bg-[#FFFDF9] hover:bg-[#FAF7F0] border border-[#DDD2BE] text-[#261C14] text-xs sm:text-sm font-bold cursor-pointer"
              >
                {isAr ? 'متابعة الجلسة' : 'Continue Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
