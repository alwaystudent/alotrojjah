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
  Headphones,
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
  getOrCreateMyFriendInvite,
  regenerateMyFriendInvite,
  fetchFriendInviteDetails,
  sendConsentFriendRequest,
  approveIncomingFriendRequest,
  declineIncomingFriendRequest,
  syncAcceptedOutgoingRequest,
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

interface DuoRecitationSectionProps {
  lang: Language;
  defaultRiwayah?: QuranRiwayah;
  initialFriendInviteToken?: string;
  onClearFriendInvite?: () => void;
  pendingAcceptCallId?: string | null;
  onClearPendingCall?: () => void;
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
  offerType: string;
  offerSdp: string;
  answerType?: string | null;
  answerSdp?: string | null;
  status: 'ringing' | 'active' | 'declined' | 'ended';
}

function buildRtcConfiguration(highPrivacyRelay: boolean): RTCConfiguration {
  const iceServers: RTCIceServer[] = [];

  if (TURN_SERVER_URL.trim()) {
    iceServers.push({
      urls: TURN_SERVER_URL.trim(),
      ...(TURN_USERNAME.trim() ? { username: TURN_USERNAME.trim() } : {}),
      ...(TURN_CREDENTIAL.trim() ? { credential: TURN_CREDENTIAL.trim() } : {}),
    });
  }

  // Only include direct STUN servers when high-privacy IP masking (relay-only) is turned off
  if (!highPrivacyRelay) {
    iceServers.push(
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    );
  }

  return {
    iceServers,
    iceTransportPolicy: highPrivacyRelay ? 'relay' : 'all',
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

function waitForIceComplete(pc: RTCPeerConnection, timeoutMs = 1800): Promise<void> {
  if (pc.iceGatheringState === 'complete') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      pc.removeEventListener('icegatheringstatechange', onStateChange);
      clearTimeout(timer);
      resolve();
    };
    const onStateChange = () => {
      if (pc.iceGatheringState === 'complete') {
        done();
      }
    };
    pc.addEventListener('icegatheringstatechange', onStateChange);
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
          ? 'خدمة تسجيل الدخول بالبريد وكلمة المرور غير مفعّلة بعد في مشروع Firebase. يمكنك الدخول فوراً عبر زر "الدخول السريع عبر بريد Google".'
          : 'Email/Password sign-in is not yet enabled in Firebase Console. Sign in immediately with Google Email.',
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
          ? 'بيانات البريد الإلكتروني أو كلمة المرور غير صحيحة.'
          : 'Invalid email or password.',
    };
  }
  if (code === 'auth/email-already-in-use') {
    return {
      message:
        lang === 'ar'
          ? 'هذا البريد الإلكتروني مسجل مسبقاً. اختر "تسجيل الدخول" بدلاً من إنشاء حساب جديد.'
          : 'This email is already registered. Please switch to Sign In.',
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

  // Consent-Based Link-Only Friends & Invites State
  const [friends, setFriends] = useState<FriendContactItem[]>([]);
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

  // Simplified 3-Mode Curriculum & Riwayah Setup State
  const [selectedRiwayah, setSelectedRiwayah] = useState<QuranRiwayah>(defaultRiwayah);
  const [curriculumMode, setCurriculumMode] = useState<'surah' | 'ayah' | 'page'>('surah');
  const [surahPickStyle, setSurahPickStyle] = useState<'touch' | 'dropdown'>('touch');
  const [surahSearchQuery, setSurahSearchQuery] = useState<string>('');
  const [selectedSurah, setSelectedSurah] = useState<number>(1);
  const [selectedSurahEnd, setSelectedSurahEnd] = useState<number>(1);
  const [multiSurahRange, setMultiSurahRange] = useState<boolean>(false);
  const [ayahFrom, setAyahFrom] = useState<number>(1);
  const [ayahTo, setAyahTo] = useState<number>(7);
  const [pageFrom, setPageFrom] = useState<number>(1);
  const [pageTo, setPageTo] = useState<number>(2);
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
  const [optionsExpanded, setOptionsExpanded] = useState<boolean>(false);

  // Privacy & Encryption Settings (Default ON for High Privacy IP Masking via TURN relay)
  const [highPrivacyIpMask, setHighPrivacyIpMask] = useState<boolean>(true);
  const highPrivacyRef = useRef<boolean>(true);

  useEffect(() => {
    highPrivacyRef.current = highPrivacyIpMask;
  }, [highPrivacyIpMask]);

  // Active Direct Voice Call Session State (Direct Friend Call ONLY)
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [myRoleInCall, setMyRoleInCall] = useState<'host' | 'guest'>('host');
  const [sessionMeta, setSessionMeta] = useState<DuoSessionDoc | null>(null);
  const [outgoingCallTargetName, setOutgoingCallTargetName] = useState<string | null>(null);
  const [peerConnState, setPeerConnState] = useState<
    'idle' | 'ringing' | 'connecting' | 'connected' | 'declined' | 'disconnected' | 'ended'
  >('idle');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [copiedInvite, setCopiedInvite] = useState<boolean>(false);

  // Synchronized Quran Reading State
  const [verses, setVerses] = useState<TrustedVerseItem[]>([]);
  const [versesLoading, setVersesLoading] = useState<boolean>(false);
  const [activeAyah, setActiveAyah] = useState<number>(1);
  const [reciterSide, setReciterSide] = useState<'host' | 'guest'>('host');
  const [mistakesCount, setMistakesCount] = useState<number>(0);

  // Refs for WebRTC / Streams / Listeners (Strict Audio-Only — zero RTCDataChannel)
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const unsubSessionRef = useRef<(() => void) | null>(null);
  const remoteAnswerAppliedRef = useRef<boolean>(false);
  const sessionIdRef = useRef<string | null>(null);
  const myRoleRef = useRef<'host' | 'guest'>('host');
  const handledAutoCallRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    myRoleRef.current = myRoleInCall;
  }, [myRoleInCall]);

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

  useEffect(() => {
    setAyahFrom(1);
    setAyahTo(Math.min(currentSurahInfo.ayahCount, 15));
    if (!multiSurahRange || selectedSurahEnd < selectedSurah) {
      setSelectedSurahEnd(selectedSurah);
    }
  }, [currentSurahInfo, multiSurahRange, selectedSurah, selectedSurahEnd]);

  // Listen to Firebase Auth State + Sync Profile & Personal Invite Token
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser && nextUser.emailVerified) {
        await syncVerifiedUserProfileAndDirectory(nextUser);
        const inv = await getOrCreateMyFriendInvite(nextUser);
        setMyInvite(inv);
      } else {
        setMyInvite(null);
      }
    });
    return () => unsub();
  }, []);

  // Auto-resolve URL ?friendInvite= token when verified user opens link
  useEffect(() => {
    if (!initialFriendInviteToken || !user || !user.emailVerified) return;
    setPasteInviteInput(initialFriendInviteToken);
    let cancelled = false;
    const inspect = async () => {
      setInviteLookupBusy(true);
      const found = await fetchFriendInviteDetails(initialFriendInviteToken);
      if (!cancelled) {
        setInviteLookupBusy(false);
        if (found && found.ownerUid !== user.uid) {
          setPreviewedInvite(found);
        } else if (found && found.ownerUid === user.uid) {
          setFriendFeedback({
            type: 'err',
            msg: isAr ? 'هذا رابط دعوتك الشخصي — شاركه مع صديقك ليطلب إضافتك.' : 'This is your own invite link — share it with a friend.',
          });
        } else {
          setFriendFeedback({
            type: 'err',
            msg: isAr ? 'رابط الدعوة غير صالح أو تم إلغاؤه.' : 'Invite link is invalid or revoked.',
          });
        }
      }
    };
    inspect();
    return () => {
      cancelled = true;
    };
  }, [initialFriendInviteToken, user, isAr]);

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
      async (snap) => {
        const allOut = snap.docs.map((d) => d.data() as FriendRequestDoc);
        setOutgoingPendingRequests(allOut.filter((r) => r.status === 'pending'));
        // Automatically add approved friends once recipient clicks Approve
        for (const req of allOut) {
          if (req.status === 'accepted' && !req.syncedBySender) {
            await syncAcceptedOutgoingRequest(user, req);
          }
        }
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

  // Invite Link Builders & Sharing
  const personalInviteUrl = useMemo(() => {
    if (!myInvite?.inviteToken || typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}?friendInvite=${encodeURIComponent(
      myInvite.inviteToken
    )}`;
  }, [myInvite?.inviteToken]);

  const handleSharePersonalInvite = async () => {
    if (!personalInviteUrl) return;
    const shareTitle = isAr ? 'دعوة صداقة للسرد الثنائي — منصة السرد' : 'Duo Sard Friend Invite';
    const shareText = isAr
      ? 'اضغط على رابط الصداقة الآمن لإرسال طلب إضافة في منصة السرد (لن تتم الإضافة إلا بعد الموافقة):'
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
          msg: isAr ? 'تم إصدار رابط دعوة جديد وإلغاء الرابط السابق بنجاح.' : 'New invite link generated and previous link revoked.',
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
          msg: isAr ? 'لم يتم العثور على رابط دعوة صالح أو تم إلغاؤه.' : 'Invite link not found or revoked.',
        });
        return;
      }
      if (found.ownerUid === user.uid) {
        setFriendFeedback({
          type: 'err',
          msg: isAr ? 'لا يمكنك إضافة نفسك بهذا الرابط.' : 'You cannot send a friend request to yourself.',
        });
        return;
      }
      if (friends.some((f) => f.friendUid === found.ownerUid)) {
        setFriendFeedback({
          type: 'ok',
          msg: isAr ? `«${found.ownerName}» موجود بالفعل في قائمة أصدقائك.` : `"${found.ownerName}" is already in your friends list.`,
        });
        return;
      }
      setPreviewedInvite(found);
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
            ? `تم إرسال طلب الصداقة إلى «${previewedInvite.ownerName}». ستتم الإضافة فور موافقته حمايةً لخصوصية الطرفين.`
            : `Friend request sent to "${previewedInvite.ownerName}". Friend will be added once they approve.`,
        });
      } else if (result === 'already_pending') {
        setFriendFeedback({
          type: 'ok',
          msg: isAr
            ? `طلب الصداقة المرسل إلى «${previewedInvite.ownerName}» ما زال بانتظار موافقته.`
            : `Friend request to "${previewedInvite.ownerName}" is already pending approval.`,
        });
      } else {
        setFriendFeedback({
          type: 'ok',
          msg: isAr
            ? `«${previewedInvite.ownerName}» وافق مسبقاً على طلبك.`
            : `"${previewedInvite.ownerName}" already approved your request.`,
        });
      }
      setPreviewedInvite(null);
      setPasteInviteInput('');
      onClearFriendInvite?.();
      try {
        const u = new URL(window.location.href);
        if (u.searchParams.has('friendInvite')) {
          u.searchParams.delete('friendInvite');
          window.history.replaceState(null, '', u.toString());
        }
      } catch {
        // ignore
      }
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
    } finally {
      setInviteBusy(false);
    }
  };

  const handleDeclineRequest = async (req: FriendRequestDoc) => {
    setInviteBusy(true);
    try {
      await declineIncomingFriendRequest(req);
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

  // Sync bounded recitation metadata via Firestore signaling (strictly NO RTCDataChannel)
  const syncCallControlState = async (
    patch: Partial<{
      activeAyah: number;
      reciterSide: 'host' | 'guest';
      mistakesCount: number;
      hideVersesForReciter: boolean;
      hideVersesForListener: boolean;
      riwayah: QuranRiwayah;
    }>
  ) => {
    const activeCallId = sessionIdRef.current;
    if (!activeCallId || !auth.currentUser?.emailVerified) return;
    if (sessionMeta?.status !== 'active') return;
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
    if (typeof data.hideVersesForReciter === 'boolean') {
      setHideVersesForReciter(data.hideVersesForReciter);
    }
    if (typeof data.hideVersesForListener === 'boolean') {
      setHideVersesForListener(data.hideVersesForListener);
    }
    if (data.riwayah === 'hafs' || data.riwayah === 'qalun' || data.riwayah === 'warsh') {
      setSelectedRiwayah(data.riwayah);
    }
  };

  const setupPeerConnection = (stream: MediaStream): RTCPeerConnection => {
    const pc = new RTCPeerConnection(buildRtcConfiguration(highPrivacyRef.current));
    pcRef.current = pc;

    stream.getAudioTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => {});
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

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        callRingtone.stop();
        setOutgoingCallTargetName(null);
        setPeerConnState('connected');
      } else if (state === 'connecting' || state === 'new') {
        setPeerConnState((prev) => (prev === 'ringing' ? prev : 'connecting'));
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        callRingtone.stop();
        setPeerConnState((prev) =>
          prev === 'ended' || prev === 'declined' ? prev : 'disconnected'
        );
        teardownWebRtcResources();
      }
    };

    return pc;
  };

  // Start Direct Encrypted Friend Audio Call ONLY (Voice rooms completely disabled)
  const startDirectFriendCall = async (targetFriend: FriendContactItem) => {
    if (!user || !user.emailVerified) return;
    callRingtone.unlockAudio();
    setLobbyError(null);
    setLobbyBusy(true);
    remoteAnswerAppliedRef.current = false;

    const newSessionId = generateEphemeralSessionId();
    const sessionPath = `duoSessions/${newSessionId}`;

    try {
      const stream = await acquireMicrophone();
      const pc = setupPeerConnection(stream);

      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      await waitForIceComplete(pc, 1800);

      const finalDesc = pc.localDescription;
      if (!finalDesc || !finalDesc.sdp) {
        throw new Error(
          isAr ? 'تعذر تجهيز عرض الاتصال الصوتي المباشر.' : 'Failed to prepare WebRTC offer.'
        );
      }

      const hostDisplayName = (
        user.displayName ||
        user.email?.split('@')[0] ||
        (isAr ? 'المتصل' : 'Caller')
      ).slice(0, 80);

      const boundedFrom =
        curriculumMode === 'surah'
          ? 1
          : Math.max(1, Math.min(ayahFrom, currentSurahInfo.ayahCount));
      const boundedTo =
        curriculumMode === 'surah'
          ? currentSurahInfo.ayahCount
          : Math.max(boundedFrom, Math.min(ayahTo, currentSurahInfo.ayahCount));

      const sEnd =
        curriculumMode === 'surah' && multiSurahRange
          ? Math.max(selectedSurah, Math.min(114, selectedSurahEnd, selectedSurah + 4))
          : selectedSurah;

      const p1 = Math.max(1, Math.min(604, pageFrom));
      const p2 = Math.max(p1, Math.min(604, pageTo, p1 + 9));

      const callPayload: Record<string, unknown> = {
        sessionId: newSessionId,
        hostUid: user.uid,
        hostName: hostDisplayName,
        calleeUid: targetFriend.friendUid,
        callMode: 'friend_call',
        riwayah: selectedRiwayah,
        curriculumMode,
        surahNumber: selectedSurah,
        surahEnd: sEnd,
        ayahFrom: boundedFrom,
        ayahTo: boundedTo,
        pageFrom: p1,
        pageTo: p2,
        offerType: finalDesc.type || 'offer',
        offerSdp: finalDesc.sdp,
        hideVersesForReciter,
        hideVersesForListener,
        activeAyah: boundedFrom,
        reciterSide: 'host',
        mistakesCount: 0,
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
      setActiveAyah(boundedFrom);
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
      await waitForIceComplete(pc, 1800);

      const finalAnswer = pc.localDescription;
      if (!finalAnswer || !finalAnswer.sdp) {
        throw new Error(
          isAr ? 'تعذر تجهيز رد الاتصال المباشر.' : 'Failed to create WebRTC answer.'
        );
      }

      const guestDisplayName = (
        user.displayName ||
        user.email?.split('@')[0] ||
        (isAr ? 'المُشارِك' : 'Partner')
      ).slice(0, 80);

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
      if (callData.riwayah) {
        setSelectedRiwayah(callData.riwayah);
      }
      if (typeof callData.hideVersesForReciter === 'boolean') {
        setHideVersesForReciter(callData.hideVersesForReciter);
      }
      if (typeof callData.hideVersesForListener === 'boolean') {
        setHideVersesForListener(callData.hideVersesForListener);
      }
      setReciterSide(callData.reciterSide || 'host');
      setMistakesCount(typeof callData.mistakesCount === 'number' ? callData.mistakesCount : 0);
      setActiveAyah(typeof callData.activeAyah === 'number' ? callData.activeAyah : callData.ayahFrom);
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
          err instanceof Error ? err.message : isAr ? 'تعذر الرد على المكالمة.' : 'Failed to answer call.'
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

  const handleEndCall = async (resetToLobby = true) => {
    const activeCallId = sessionIdRef.current;
    const currentMeta = sessionMeta;

    callRingtone.stop();
    teardownWebRtcResources();

    if (activeCallId && auth.currentUser?.emailVerified) {
      try {
        if (currentMeta?.status !== 'ended' && currentMeta?.status !== 'declined') {
          await updateDoc(doc(db, 'duoSessions', activeCallId), {
            status: 'ended',
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        if (auth.currentUser) {
          console.warn('Call cleanup notice:', err);
        }
      }
      dismissBackgroundCallNotification(activeCallId);
    }

    if (resetToLobby) {
      setSessionId(null);
      setSessionMeta(null);
      setPeerConnState('idle');
      setVerses([]);
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

  const handleSwitchSessionRiwayah = (nextRw: QuranRiwayah) => {
    setSelectedRiwayah(nextRw);
    syncCallControlState({ riwayah: nextRw });
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
        ? `${p1 === p2 ? `صفحة ${p1}` : `الصفحات ${p1} – ${p2}`} · برواية ${rwLabel}`
        : `${p1 === p2 ? `Page ${p1}` : `Pages ${p1}–${p2}`} · ${rwLabel}`;
    }
    if (curriculumMode === 'surah') {
      const s2Obj = SURAH_LIST.find((s) => s.number === selectedSurahEnd) || currentSurahInfo;
      if (multiSurahRange && selectedSurahEnd !== selectedSurah) {
        return isAr
          ? `من سورة ${currentSurahInfo.nameAr} إلى ${s2Obj.nameAr} · برواية ${rwLabel}`
          : `Surah ${currentSurahInfo.nameEn} – ${s2Obj.nameEn} · ${rwLabel}`;
      }
      return isAr
        ? `سورة ${currentSurahInfo.nameAr} كاملة (${currentSurahInfo.ayahCount} آية) · برواية ${rwLabel}`
        : `Surah ${currentSurahInfo.nameEn} (Full) · ${rwLabel}`;
    }
    return isAr
      ? `سورة ${currentSurahInfo.nameAr} (الآيات ${ayahFrom} – ${ayahTo}) · برواية ${rwLabel}`
      : `Surah ${currentSurahInfo.nameEn} (Ayahs ${ayahFrom}–${ayahTo}) · ${rwLabel}`;
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

  const activeSessionTitle = useMemo(() => {
    if (!sessionMeta) return lobbyCurriculumSummary;
    const rw = getRiwayahLabel(sessionMeta.riwayah || selectedRiwayah, lang);
    if (sessionMeta.curriculumMode === 'page') {
      const p1 = sessionMeta.pageFrom || 1;
      const p2 = sessionMeta.pageTo || p1;
      return isAr
        ? `${p1 === p2 ? `صفحة ${p1}` : `الصفحات ${p1} – ${p2}`} · برواية ${rw}`
        : `${p1 === p2 ? `Page ${p1}` : `Pages ${p1}–${p2}`} · ${rw}`;
    }
    return isAr
      ? `سورة ${sessionSurahInfo.nameAr} (${sessionMeta.ayahFrom} - ${sessionMeta.ayahTo}) · برواية ${rw}`
      : `Surah ${sessionSurahInfo.nameEn} (${sessionMeta.ayahFrom}-${sessionMeta.ayahTo}) · ${rw}`;
  }, [sessionMeta, sessionSurahInfo, selectedRiwayah, lang, isAr, lobbyCurriculumSummary]);

  const amICurrentReciter = myRoleInCall === reciterSide;
  const shouldHideVersesForMe =
    localHideVerses ||
    (amICurrentReciter ? hideVersesForReciter : hideVersesForListener);

  const activeSourceMeta =
    TRUSTED_QURAN_SOURCES.find((s) => s.id === activeUsedSource) || TRUSTED_QURAN_SOURCES[0];

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
    <section className="max-w-5xl mx-auto space-y-5">
      {/* Compact Header Banner */}
      <div className="gold-card-surface rounded-[24px] border border-[#E6D19E] border-t-[3px] border-t-[#C88A14] p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#F6E9C8] border border-[#E5C983] flex items-center justify-center text-[#9E650C] shrink-0">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-extrabold font-display-islamic text-[#261C14]">
                {isAr ? 'السرد الثنائي — اتصال مباشر بالأصدقاء' : 'Duo Recitation — Direct Friend Audio'}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#ECFDF3] border border-[#86EFAC] text-[#15803D] text-[11px] font-bold">
                <Lock className="w-3 h-3" />
                <span>{isAr ? 'صوت مشفّر ومؤمّن (E2EE)' : 'Encrypted Audio (E2EE)'}</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#5C4B3B] leading-relaxed">
              {isAr
                ? 'اختر المقرر (بالصفحة أو السورة أو الآيات) والرواية (حفص، قالون، ورش) واتصل بصديقك المعتمد صوتياً بضغطة زر.'
                : 'Select pages, surahs, or ayahs with Hafs, Qalun, or Warsh and place an encrypted direct voice call to an approved friend.'}
            </p>
          </div>
        </div>

        {user && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
              <button
                type="button"
                onClick={handleEnableBackgroundCallAlerts}
                className="px-3 py-2 rounded-xl bg-[#4A6144] hover:bg-[#3B4F36] text-[#FFFDF9] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>{isAr ? 'تفعيل رنين المكالمات' : 'Enable Ring Alerts'}</span>
              </button>
            )}
            <div className="flex items-center gap-2 bg-[#FFFDF9] border border-[#DDD2BE] rounded-xl px-3 py-1.5">
              <div className="min-w-0 text-start">
                <div className="text-xs font-bold text-[#261C14] truncate max-w-[140px]">
                  {user.displayName || user.email}
                </div>
                <div className="text-[10.5px] text-[#84715E] truncate max-w-[140px]">
                  {user.email}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                title={isAr ? 'تسجيل الخروج' : 'Sign Out'}
                className="p-1.5 rounded-lg bg-[#F7F3EB] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-[#9C4A32] cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* STEP 1: NOT SIGNED IN -> AUTH GATE */}
      {!user && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#F6E9C8] text-[#9E650C] flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-[#261C14]">
                  {isAr ? 'تسجيل الدخول بالبريد الإلكتروني' : 'Sign In with Email'}
                </h2>
                <p className="text-xs text-[#5C4B3B]">
                  {isAr
                    ? 'سجّل دخولك لمشاركة رابط الصداقة والاتصال الصوتي المباشر المحمي'
                    : 'Sign in to share your friend invite link and make protected direct audio calls'}
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
                    placeholder={isAr ? 'مثال: عبد الله' : 'e.g. Abdullah'}
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

          <div className="olive-card-surface rounded-2xl border border-[#C8D4C2] p-5 sm:p-6 shadow-xs flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#4A6144]/15 text-[#4A6144] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-[#261C14]">
                  {isAr ? 'حماية وخصوصية السرد الثنائي' : 'Protected Direct Duo Recitation'}
                </h3>
              </div>

              <ul className="space-y-3 text-xs sm:text-sm text-[#2D2218]">
                <li className="flex items-start gap-2.5">
                  <Link2 className="w-4 h-4 text-[#4A6144] shrink-0 mt-0.5" />
                  <span>
                    {isAr
                      ? 'إضافة الأصدقاء عبر مشاركة رابط دعوة خاص بك ولا تتم الإضافة إلا بعد موافقتك لحماية خصوصيتك.'
                      : 'Add friends exclusively via shareable invite links requiring explicit approval.'}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                  <span>
                    {isAr
                      ? 'اتصال صوتي مباشر مشفّر (WebRTC E2EE) مع إخفاء الـ IP ومنع تبادل أي ملفات.'
                      : 'Encrypted direct audio-only calling with TURN IP masking and blocked data channels.'}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <BookOpen className="w-4 h-4 text-[#C88A14] shrink-0 mt-0.5" />
                  <span>
                    {isAr
                      ? 'دعم كامل للروايات الثلاث (حفص، قالون، ورش) وتحديد المقرر بالصفحات أو السور أو الآيات.'
                      : 'Supports Hafs, Qalun, and Warsh narrations with Page, Surah, or Ayah curriculum selection.'}
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl bg-[#FFFDF9]/80 border border-[#DDD2BE] p-3 text-xs text-[#5C4B3B]">
              {isAr
                ? 'تم إلغاء الغرف العامة؛ الاتصال الصوتي يقتصر على أصدقائك المعتمدين فقط.'
                : 'Public rooms are disabled; calling is strictly between approved friends.'}
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
            {isAr ? 'يرجى تأكيد بريدك الإلكتروني' : 'Verify Your Email Address'}
          </h2>
          <p className="text-xs sm:text-sm text-[#5C4B3B] leading-relaxed">
            {isAr
              ? `تم إرسال رابط التفعيل إلى (${user.email}). افتح الرسالة واضغط على رابط التأكيد، ثم اضغط على "تحقق من التفعيل الآن" أدناه.`
              : `A verification link was sent to (${user.email}). Click the link in your inbox, then tap "Verify Status" below.`}
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

      {/* STEP 3: VERIFIED USER LOBBY — 3 CLEAN STEPS */}
      {user && user.emailVerified && !sessionId && (
        <div className="space-y-4">
          {lobbyError && (
            <div className="rounded-xl bg-[#FBF3DF] border border-[#C88A14] p-3.5 text-xs sm:text-sm text-[#261C14] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#C88A14] shrink-0 mt-0.5" />
              <p className="font-semibold">{lobbyError}</p>
            </div>
          )}

          {/* Incoming Friend Link Invite Preview Card (Consent Gate) */}
          {previewedInvite && (
            <div className="rounded-2xl bg-[#FBF3DF] border-2 border-[#C88A14] p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2D2218] text-[#EAB338] flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-sm sm:text-base font-extrabold text-[#261C14]">
                    {isAr
                      ? `دعوة صداقة من «${previewedInvite.ownerName}»`
                      : `Friend Invite from "${previewedInvite.ownerName}"`}
                  </h3>
                  <p className="text-xs text-[#5C4B3B]">
                    {isAr
                      ? 'سيُرسل طلب صداقة إليه؛ ولن تُضافا في قائمة الأصدقاء إلا بعد موافقته الصريحة.'
                      : 'This sends a friend request. You will be connected once they explicitly approve.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={inviteBusy}
                  onClick={handleConfirmSendFriendRequest}
                  className="px-4 py-2 rounded-xl bg-[#4A6144] hover:bg-[#3B4F36] text-[#FFFDF9] text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {isAr ? 'إرسال طلب الصداقة' : 'Send Friend Request'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewedInvite(null);
                    onClearFriendInvite?.();
                  }}
                  className="px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-xs font-bold text-[#5C4B3B] cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 1 CARD: Riwayah & Simple Curriculum Selection */}
          <div className="rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#EFE9DC]">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#2D2218] text-[#EAB338] text-xs font-extrabold flex items-center justify-center">
                  1
                </span>
                <h2 className="text-sm sm:text-base font-extrabold text-[#261C14]">
                  {isAr ? 'الرواية ومقرر السرد' : 'Narration & Curriculum'}
                </h2>
              </div>
              <span className="text-xs font-bold text-[#4A6144] bg-[#4A6144]/10 border border-[#4A6144]/25 px-3 py-1 rounded-lg">
                {lobbyCurriculumSummary}
              </span>
            </div>

            {/* Riwayah Selector: Hafs / Qalun / Warsh */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#5C4B3B]">
                {isAr ? 'اختيار الرواية القرآنية:' : 'Quran Narration (Riwayah):'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {RIWAYAH_OPTIONS.map((rw) => {
                  const active = selectedRiwayah === rw.id;
                  return (
                    <button
                      key={rw.id}
                      type="button"
                      onClick={() => setSelectedRiwayah(rw.id)}
                      className={`py-2.5 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                        active
                          ? 'bg-[#2D2218] border-[#C88A14] text-[#EAB338] shadow-xs'
                          : 'bg-[#F7F3EB] border-[#DDD2BE] text-[#261C14] hover:bg-[#EFE9DC]'
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

            {/* 3 Clear Curriculum Modes: Surah / Ayah Numbers / Pages */}
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F7F3EB] rounded-xl border border-[#DDD2BE]">
                {(
                  [
                    {
                      id: 'surah',
                      label: isAr ? 'بالسور' : 'By Surah',
                      icon: BookOpen,
                    },
                    {
                      id: 'ayah',
                      label: isAr ? 'بأرقام الآيات' : 'By Ayahs',
                      icon: Hash,
                    },
                    {
                      id: 'page',
                      label: isAr ? 'بالصفحات' : 'By Pages',
                      icon: FileText,
                    },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = curriculumMode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCurriculumMode(tab.id)}
                      className={`py-2 px-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#4A6144] text-[#FFFDF9] shadow-2xs'
                          : 'text-[#5C4B3B] hover:text-[#261C14]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* MODE A: BY SURAH (Touch Grid OR Dropdown) */}
              {curriculumMode === 'surah' && (
                <div className="rounded-xl bg-[#F7F3EB]/70 border border-[#DDD2BE] p-3 space-y-3">
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
                        <span>{isAr ? 'اختيار باللمس' : 'Touch Grid'}</span>
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
                        className="rounded border-[#C88A14] text-[#C88A14] focus:ring-[#C88A14]"
                      />
                      <span>{isAr ? 'تحديد عدة سور متتالية' : 'Select Surah Range'}</span>
                    </label>
                  </div>

                  {surahPickStyle === 'dropdown' ? (
                    <div className={`grid gap-2.5 ${multiSurahRange ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                      <div>
                        <label className="block text-[11px] font-bold text-[#5C4B3B] mb-1">
                          {multiSurahRange
                            ? isAr
                              ? 'من السورة'
                              : 'From Surah'
                            : isAr
                            ? 'السورة'
                            : 'Surah'}
                        </label>
                        <select
                          value={selectedSurah}
                          onChange={(e) => setSelectedSurah(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-sm font-bold text-[#261C14] focus:outline-none focus:border-[#4A6144]"
                        >
                          {SURAH_LIST.map((s) => (
                            <option key={s.number} value={s.number}>
                              {s.number}. {isAr ? `سورة ${s.nameAr}` : s.nameEn} ({s.ayahCount})
                            </option>
                          ))}
                        </select>
                      </div>

                      {multiSurahRange && (
                        <div>
                          <label className="block text-[11px] font-bold text-[#5C4B3B] mb-1">
                            {isAr ? 'إلى السورة (حد أقصى 5 سور)' : 'To Surah (max 5)'}
                          </label>
                          <select
                            value={selectedSurahEnd}
                            onChange={(e) => setSelectedSurahEnd(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-sm font-bold text-[#261C14] focus:outline-none focus:border-[#4A6144]"
                          >
                            {SURAH_LIST.filter(
                              (s) => s.number >= selectedSurah && s.number <= selectedSurah + 4
                            ).map((s) => (
                              <option key={s.number} value={s.number}>
                                {s.number}. {isAr ? `سورة ${s.nameAr}` : s.nameEn}
                              </option>
                            ))}
                          </select>
                        </div>
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
                          placeholder={isAr ? 'ابحث باسم السورة أو رقمها للمسها...' : 'Search Surah by name or number...'}
                          className="w-full ps-8 pe-3 py-1.5 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-xs text-[#261C14] focus:outline-none focus:border-[#4A6144]"
                        />
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 max-h-44 overflow-y-auto p-1">
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
                                } else if (s.number < selectedSurah || selectedSurahEnd !== selectedSurah) {
                                  setSelectedSurah(s.number);
                                  setSelectedSurahEnd(s.number);
                                } else {
                                  setSelectedSurahEnd(Math.min(s.number, selectedSurah + 4));
                                }
                              }}
                              className={`px-2 py-2 rounded-xl border text-center transition-all cursor-pointer ${
                                isStart
                                  ? 'bg-[#2D2218] border-[#C88A14] text-[#EAB338] shadow-2xs'
                                  : isInRange
                                  ? 'bg-[#4A6144]/15 border-[#4A6144] text-[#261C14]'
                                  : 'bg-[#FFFDF9] border-[#DDD2BE] text-[#261C14] hover:border-[#C88A14]'
                              }`}
                            >
                              <div className="text-[10px] opacity-75 font-mono-tabular">
                                {s.number}
                              </div>
                              <div className="text-xs font-extrabold truncate">
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

              {/* MODE B: BY AYAH NUMBERS */}
              {curriculumMode === 'ayah' && (
                <div className="rounded-xl bg-[#F7F3EB]/70 border border-[#DDD2BE] p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[#5C4B3B] mb-1">
                        {isAr ? 'السورة' : 'Surah'}
                      </label>
                      <select
                        value={selectedSurah}
                        onChange={(e) => setSelectedSurah(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-sm font-bold text-[#261C14] focus:outline-none focus:border-[#4A6144]"
                      >
                        {SURAH_LIST.map((s) => (
                          <option key={s.number} value={s.number}>
                            {s.number}. {isAr ? s.nameAr : s.nameEn} ({s.ayahCount})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#5C4B3B] mb-1">
                        {isAr ? 'من الآية' : 'From Ayah'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={currentSurahInfo.ayahCount}
                        value={ayahFrom}
                        onChange={(e) =>
                          setAyahFrom(
                            Math.max(1, Math.min(Number(e.target.value) || 1, currentSurahInfo.ayahCount))
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-sm font-mono-tabular font-bold text-[#261C14]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#5C4B3B] mb-1">
                        {isAr ? 'إلى الآية' : 'To Ayah'}
                      </label>
                      <input
                        type="number"
                        min={ayahFrom}
                        max={currentSurahInfo.ayahCount}
                        value={ayahTo}
                        onChange={(e) =>
                          setAyahTo(
                            Math.max(
                              ayahFrom,
                              Math.min(Number(e.target.value) || ayahFrom, currentSurahInfo.ayahCount)
                            )
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-sm font-mono-tabular font-bold text-[#261C14]"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-[#84715E] font-bold">
                      {isAr ? 'اختيار سريع باللمس:' : 'Quick Touch:'}
                    </span>
                    {[
                      { label: isAr ? '١–٥' : '1–5', from: 1, to: Math.min(5, currentSurahInfo.ayahCount) },
                      { label: isAr ? '١–١٠' : '1–10', from: 1, to: Math.min(10, currentSurahInfo.ayahCount) },
                      { label: isAr ? '١–٢٠' : '1–20', from: 1, to: Math.min(20, currentSurahInfo.ayahCount) },
                      { label: isAr ? 'كل السورة' : 'All', from: 1, to: currentSurahInfo.ayahCount },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setAyahFrom(preset.from);
                          setAyahTo(preset.to);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#FFFDF9] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-xs font-bold text-[#261C14] cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* MODE C: BY MUSHAF PAGES */}
              {curriculumMode === 'page' && (
                <div className="rounded-xl bg-[#F7F3EB]/70 border border-[#DDD2BE] p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#5C4B3B] mb-1">
                        {isAr ? 'من الصفحة (١ – ٦٠٤)' : 'From Page (1–604)'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={604}
                        value={pageFrom}
                        onChange={(e) => {
                          const v = Math.max(1, Math.min(604, Number(e.target.value) || 1));
                          setPageFrom(v);
                          if (pageTo < v) setPageTo(v);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-sm font-mono-tabular font-bold text-[#261C14]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#5C4B3B] mb-1">
                        {isAr ? 'إلى الصفحة (حد أقصى ١٠ صفحات)' : 'To Page (max 10)'}
                      </label>
                      <input
                        type="number"
                        min={pageFrom}
                        max={Math.min(604, pageFrom + 9)}
                        value={pageTo}
                        onChange={(e) =>
                          setPageTo(
                            Math.max(
                              pageFrom,
                              Math.min(604, pageFrom + 9, Number(e.target.value) || pageFrom)
                            )
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-sm font-mono-tabular font-bold text-[#261C14]"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-[#84715E] font-bold">
                      {isAr ? 'عدد الصفحات باللمس:' : 'Page Count:'}
                    </span>
                    {[
                      { label: isAr ? 'صفحة واحدة' : '1 Page', span: 0 },
                      { label: isAr ? 'صفحتان' : '2 Pages', span: 1 },
                      { label: isAr ? '٣ صفحات' : '3 Pages', span: 2 },
                      { label: isAr ? '٥ صفحات' : '5 Pages', span: 4 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setPageTo(Math.min(604, pageFrom + preset.span))}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                          pageTo - pageFrom === preset.span
                            ? 'bg-[#2D2218] text-[#EAB338] border-[#C88A14]'
                            : 'bg-[#FFFDF9] text-[#261C14] border-[#DDD2BE] hover:bg-[#EFE9DC]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* STEP 2 CARD: Collapsible Simple Options + Privacy */}
          <div className="rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-4 shadow-xs space-y-3">
            <button
              type="button"
              onClick={() => setOptionsExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between gap-2 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#2D2218] text-[#EAB338] text-xs font-extrabold flex items-center justify-center">
                  2
                </span>
                <SlidersHorizontal className="w-4 h-4 text-[#C88A14]" />
                <span className="text-sm font-extrabold text-[#261C14]">
                  {isAr ? 'خيارات الإخفاء والخصوصية العالية' : 'Hiding & High-Privacy Settings'}
                </span>
              </div>
              <span className="text-xs font-bold text-[#9E650C]">
                {optionsExpanded
                  ? isAr
                    ? 'إخفاء التفاصيل'
                    : 'Hide'
                  : isAr
                  ? 'تخصيص الخيارات'
                  : 'Customize'}
              </span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setHideVersesForReciter(!hideVersesForReciter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                  hideVersesForReciter
                    ? 'bg-[#2D2218] border-[#2D2218] text-[#EAB338]'
                    : 'bg-[#F7F3EB] border-[#DDD2BE] text-[#5C4B3B]'
                }`}
              >
                {hideVersesForReciter ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{isAr ? 'إخفاء الآيات عن القارئ' : 'Hide for Reciter'}</span>
              </button>

              <button
                type="button"
                onClick={() => setHideVersesForListener(!hideVersesForListener)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                  hideVersesForListener
                    ? 'bg-[#2D2218] border-[#2D2218] text-[#EAB338]'
                    : 'bg-[#F7F3EB] border-[#DDD2BE] text-[#5C4B3B]'
                }`}
              >
                {hideVersesForListener ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{isAr ? 'إخفاء الآيات عن المُسمِّع' : 'Hide for Listener'}</span>
              </button>

              <button
                type="button"
                onClick={() => setFadeFirstWordOnly(!fadeFirstWordOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                  fadeFirstWordOnly
                    ? 'bg-[#4A6144] border-[#4A6144] text-[#FFFDF9]'
                    : 'bg-[#F7F3EB] border-[#DDD2BE] text-[#5C4B3B]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAr ? 'التلاشي (أول كلمة)' : 'First Word Hint'}</span>
              </button>
            </div>

            {optionsExpanded && (
              <div className="pt-2 border-t border-[#EFE9DC] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#ECFDF3] border border-[#86EFAC] px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-[#15803D] shrink-0" />
                    <div>
                      <div className="text-xs font-extrabold text-[#261C14]">
                        {isAr ? 'وضع الخصوصية العالية (إخفاء الـ IP)' : 'High Privacy Mode (IP Masking)'}
                      </div>
                      <div className="text-[11px] text-[#15803D] font-medium">
                        {isAr
                          ? 'توجيه الصوت المشفّر عبر خادم TURN الوسيط وحظر أي تبادل للملفات'
                          : 'Routes encrypted audio via TURN relay & blocks data channels'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={highPrivacyIpMask}
                    onClick={() => setHighPrivacyIpMask((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      highPrivacyIpMask ? 'bg-[#15803D]' : 'bg-[#C4B7A0]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                        highPrivacyIpMask ? (isAr ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {highPrivacyIpMask && !TURN_SERVER_URL.trim() && (
                  <p className="text-[11px] text-[#9E650C] bg-[#FBF3DF] border border-[#E5C983] rounded-lg px-3 py-1.5 font-semibold">
                    {isAr
                      ? 'تنبيه: وضع الخصوصية العالية (relay) مفعّل افتراضياً. ضع بيانات خادم TURN في TURN_SERVER_URL أعلى الملف أو أطفئه مؤقتاً للاتصال عبر STUN.'
                      : 'Note: High Privacy relay mode is active by default. Add TURN_SERVER_URL or toggle off for direct STUN.'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* STEP 3 CARD: Consent-Gated Invite Link Friends + 1-Tap Direct Voice Calls */}
          <div className="olive-card-surface rounded-2xl border border-[#C8D4C2] p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#4A6144] text-[#FFFDF9] text-xs font-extrabold flex items-center justify-center">
                  3
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-[#261C14]">
                    {isAr ? 'الأصدقاء والاتصال الصوتي المباشر' : 'Friends & Direct Audio Calling'}
                  </h2>
                  <p className="text-xs text-[#4A6144] font-semibold">
                    {isAr
                      ? 'شارك رابط صداقتك ولا يُضاف أحد إلا بعد موافقتك'
                      : 'Share your invite link — friends require your explicit approval'}
                  </p>
                </div>
              </div>
            </div>

            {friendFeedback && (
              <div
                className={`rounded-xl p-3 text-xs font-semibold border ${
                  friendFeedback.type === 'ok'
                    ? 'bg-[#4A6144]/10 border-[#4A6144]/35 text-[#261C14]'
                    : 'bg-[#FBF3DF] border-[#C88A14] text-[#261C14]'
                }`}
              >
                {friendFeedback.msg}
              </div>
            )}

            {/* Personal Shareable Invite Link Box */}
            <div className="rounded-xl bg-[#FFFDF9] border border-[#C8D4C2] p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-extrabold text-[#261C14] flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-[#4A6144]" />
                  <span>{isAr ? 'رابط دعوتك الشخصي لإضافة الأصدقاء' : 'Your Personal Friend Invite Link'}</span>
                </div>
                <button
                  type="button"
                  disabled={inviteBusy}
                  onClick={handleRegenerateInvite}
                  className="text-[11px] font-bold text-[#9E650C] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3 h-3 ${inviteBusy ? 'animate-spin' : ''}`} />
                  <span>{isAr ? 'تجديد وإلغاء السابق' : 'Regenerate Link'}</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  readOnly
                  dir="ltr"
                  value={personalInviteUrl || (isAr ? 'جاري التوليد...' : 'Generating...')}
                  className="flex-1 px-3 py-2 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs font-mono-tabular text-[#5C4B3B] select-all"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleSharePersonalInvite}
                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-[#4A6144] hover:bg-[#3B4F36] text-[#FFFDF9] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{isAr ? 'مشاركة الرابط' : 'Share Link'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="px-3 py-2 rounded-xl bg-[#F6E9C8] hover:bg-[#EDD8A1] text-[#7D5306] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedInvite ? <Check className="w-3.5 h-3.5 text-[#4A6144]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedInvite ? (isAr ? 'نُسخ' : 'Copied') : isAr ? 'نسخ' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Paste Received Friend Invite Link */}
              <form
                onSubmit={handleLookupPastedInvite}
                className="pt-2 border-t border-[#EFE9DC] flex flex-col sm:flex-row gap-2"
              >
                <input
                  type="text"
                  value={pasteInviteInput}
                  onChange={(e) => setPasteInviteInput(e.target.value)}
                  dir="ltr"
                  placeholder={isAr ? 'أو الصق رابط دعوة صديقك هنا...' : 'Or paste a friend invite link here...'}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs text-[#261C14] focus:outline-none focus:border-[#4A6144]"
                />
                <button
                  type="submit"
                  disabled={inviteLookupBusy || !pasteInviteInput.trim()}
                  className="px-3.5 py-1.5 rounded-xl bg-[#2D2218] text-[#EAB338] text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {inviteLookupBusy ? (isAr ? 'جاري التحقق...' : 'Checking...') : isAr ? 'معاينة الرابط' : 'Check Link'}
                </button>
              </form>
            </div>

            {/* Incoming Pending Friend Approvals (Privacy Gate!) */}
            {incomingRequests.length > 0 && (
              <div className="rounded-xl bg-[#FBF3DF] border-2 border-[#C88A14] p-3.5 space-y-2.5">
                <div className="text-xs font-extrabold text-[#261C14] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#C88A14]" />
                  <span>
                    {isAr
                      ? `طلبات صداقة بانتظار موافقتك (${incomingRequests.length})`
                      : `Pending Friend Requests (${incomingRequests.length})`}
                  </span>
                </div>
                <div className="space-y-2">
                  {incomingRequests.map((req) => (
                    <div
                      key={req.requestId}
                      className="rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] p-3 flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-xs sm:text-sm font-bold text-[#261C14]">
                        {req.fromName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={inviteBusy}
                          onClick={() => handleApproveRequest(req)}
                          className="px-3 py-1.5 rounded-lg bg-[#4A6144] hover:bg-[#3B4F36] text-[#FFFDF9] text-xs font-bold flex items-center gap-1 cursor-pointer"
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

            {/* Outgoing Pending Status Notice */}
            {outgoingPendingRequests.length > 0 && (
              <div className="text-xs text-[#5C4B3B] bg-[#FFFDF9]/80 border border-[#DDD2BE] rounded-xl px-3 py-2">
                {isAr
                  ? `طلبات صادرة بانتظار موافقة أصحابها: ${outgoingPendingRequests
                      .map((r) => r.toName)
                      .join('، ')}`
                  : `Awaiting approval from: ${outgoingPendingRequests.map((r) => r.toName).join(', ')}`}
              </div>
            )}

            {/* Approved Friends List — Direct Voice Call Button ONLY */}
            {friends.length === 0 ? (
              <div className="rounded-xl bg-[#FFFDF9]/85 border border-dashed border-[#C8D4C2] p-5 text-center text-xs text-[#5C4B3B]">
                {isAr
                  ? 'قائمة أصدقائك فارغة حالياً — شارك رابط دعوتك أعلاه، وعندما توافق على طلب صديقك سيظهر هنا للاتصال الصوتي المباشر.'
                  : 'No approved friends yet — share your invite link above and approve requests to place direct voice calls.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {friends.map((fr) => (
                  <div
                    key={fr.friendUid}
                    className="rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] p-3.5 flex items-center justify-between gap-2.5 shadow-2xs"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-[#261C14] truncate">
                        {fr.friendName}
                      </div>
                      <div className="text-[11px] text-[#4A6144] font-semibold">
                        {isAr ? 'صديق معتمد · اتصال محمي' : 'Approved Friend'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={lobbyBusy}
                        onClick={() => startDirectFriendCall(fr)}
                        className="px-3 py-2 rounded-xl bg-[#4A6144] hover:bg-[#3B4F36] text-[#FFFDF9] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-60"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>{isAr ? 'اتصال صوتي' : 'Voice Call'}</span>
                      </button>

                      {confirmRemoveFriendUid === fr.friendUid ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveFriend(fr.friendUid)}
                          className="px-2 py-2 rounded-xl bg-[#A84A32] text-[#FFFDF9] text-[11px] font-bold cursor-pointer"
                        >
                          {isAr ? 'تأكيد' : 'Confirm'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveFriendUid(fr.friendUid)}
                          title={isAr ? 'حذف الصديق' : 'Remove friend'}
                          className="p-2 rounded-xl bg-[#F7F3EB] hover:bg-[#EFE9DC] text-[#A84A32] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: ACTIVE DIRECT ENCRYPTED VOICE CALL + SYNCED MUSHAF */}
      {user && user.emailVerified && sessionId && (
        <div className="space-y-4">
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

          {/* Outgoing Ringing Call Window */}
          {peerConnState === 'ringing' && outgoingCallTargetName && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-[28px] bg-[#2D2218] text-[#FFFDF9] border-2 border-[#EAB338] p-6 text-center space-y-5 shadow-2xl">
                <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-[#EAB338]/25 animate-ping" />
                  <div className="relative w-16 h-16 rounded-full bg-[#4A6144] border-2 border-[#EAB338] flex items-center justify-center text-[#FFFDF9]">
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
                  <p className="text-xs text-[#E6D7BE]">{activeSessionTitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleEndCall(true)}
                  className="w-full py-3 rounded-2xl bg-[#A84A32] hover:bg-[#8E3B26] text-[#FFFDF9] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>{isAr ? 'إلغاء المكالمة' : 'Cancel Call'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Top Session Controls + Visual E2EE Lock Indicator */}
          <div className="rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Green Visual E2EE Security Lock Indicator */}
              <div
                className="px-3 py-1.5 rounded-xl bg-[#ECFDF3] border border-[#86EFAC] text-[#15803D] text-xs font-extrabold flex items-center gap-1.5 shadow-2xs"
                title={isAr ? 'اتصال صوتي مشفر ومؤمّن (E2EE)' : 'Encrypted & Secured Audio (E2EE)'}
              >
                <Lock className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                <span>
                  {isAr ? 'اتصال صوتي مشفر ومؤمّن (E2EE)' : 'Encrypted & Secured Audio (E2EE)'}
                </span>
              </div>

              <div
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                  peerConnState === 'connected'
                    ? 'bg-[#4A6144]/15 border-[#4A6144]/35 text-[#4A6144]'
                    : peerConnState === 'ended' ||
                      peerConnState === 'declined' ||
                      peerConnState === 'disconnected'
                    ? 'bg-[#A84A32]/15 border-[#A84A32]/35 text-[#A84A32]'
                    : 'bg-[#F6E9C8] border-[#E5C983] text-[#9E650C]'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    peerConnState === 'connected'
                      ? 'bg-[#4A6144] animate-pulse'
                      : peerConnState === 'ended' ||
                        peerConnState === 'declined' ||
                        peerConnState === 'disconnected'
                      ? 'bg-[#A84A32]'
                      : 'bg-[#C88A14] animate-ping'
                  }`}
                />
                <span>
                  {peerConnState === 'ringing'
                    ? isAr
                      ? 'يرن الآن لدى الصديق...'
                      : 'Ringing friend...'
                    : peerConnState === 'connecting'
                    ? isAr
                      ? 'جاري إتمام الربط الصوتي الآمن...'
                      : 'Establishing secure audio...'
                    : peerConnState === 'connected'
                    ? highPrivacyIpMask
                      ? isAr
                        ? 'متصل صوتياً (تخفي IP مفعّل)'
                        : 'Audio Connected (IP Masked)'
                      : isAr
                      ? 'متصل صوتي مباشر'
                      : 'Direct Audio Connected'
                    : peerConnState === 'declined'
                    ? isAr
                      ? 'تم رفض المكالمة أو انشغال الصديق'
                      : 'Call Declined'
                    : peerConnState === 'ended'
                    ? isAr
                      ? 'انتهت المكالمة وأُغلقت المسارات'
                      : 'Call Ended & Tracks Cleared'
                    : isAr
                    ? 'انقطع الاتصال — تم تنظيف الذاكرة'
                    : 'Disconnected — Tracks Cleared'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE]">
                <button
                  type="button"
                  onClick={handleToggleMic}
                  className={`flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                    isMicMuted ? 'text-[#A84A32]' : 'text-[#4A6144]'
                  }`}
                >
                  {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{isMicMuted ? (isAr ? 'صامت' : 'Muted') : isAr ? 'الميكروفون' : 'Mic On'}</span>
                </button>
                <div className="w-14 h-2 rounded-full bg-[#DDD2BE] overflow-hidden">
                  <div
                    className="h-full bg-[#4A6144] transition-all duration-75"
                    style={{ width: `${isMicMuted ? 0 : micLevel}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSwapRoles}
                className="px-3 py-2 rounded-xl bg-[#2D2218] hover:bg-[#3D2F22] text-[#EAB338] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>{isAr ? 'تبادل الأدوار' : 'Swap Roles'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleEndCall(true)}
                className="px-3 py-2 rounded-xl bg-[#A84A32] hover:bg-[#8E3B26] text-[#FFFDF9] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>{isAr ? 'إنهاء المكالمة' : 'End Call'}</span>
              </button>
            </div>
          </div>

          {/* Participants, Roles & Mistakes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div
              className={`rounded-2xl p-3.5 border flex items-center justify-between gap-2 ${
                reciterSide === 'host'
                  ? 'bg-[#4A6144]/10 border-[#4A6144]'
                  : 'bg-[#FFFDF9] border-[#DDD2BE]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#2D2218] text-[#EAB338] flex items-center justify-center shrink-0">
                  {reciterSide === 'host' ? <Mic className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-[#261C14] truncate">
                    {sessionMeta?.hostName || (isAr ? 'المتصل' : 'Caller')}{' '}
                    {myRoleInCall === 'host' ? (isAr ? '(أنت)' : '(You)') : ''}
                  </div>
                  <div className="text-[11px] font-bold text-[#4A6144]">
                    {reciterSide === 'host'
                      ? isAr
                        ? 'الدور: القارئ (يُسمِّع حفظه)'
                        : 'Role: Reciter'
                      : isAr
                      ? 'الدور: المُسمِّع (يتابع المصحف)'
                      : 'Role: Listener'}
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl p-3.5 border flex items-center justify-between gap-2 ${
                reciterSide === 'guest'
                  ? 'bg-[#4A6144]/10 border-[#4A6144]'
                  : 'bg-[#FFFDF9] border-[#DDD2BE]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#F6E9C8] text-[#9E650C] flex items-center justify-center shrink-0">
                  {reciterSide === 'guest' ? <Mic className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-[#261C14] truncate">
                    {sessionMeta?.guestName
                      ? `${sessionMeta.guestName} ${
                          myRoleInCall === 'guest' ? (isAr ? '(أنت)' : '(You)') : ''
                        }`
                      : outgoingCallTargetName || (isAr ? 'في انتظار الرد...' : 'Calling friend...')}
                  </div>
                  <div className="text-[11px] font-bold text-[#9E650C]">
                    {reciterSide === 'guest'
                      ? isAr
                        ? 'الدور: القارئ (يُسمِّع حفظه)'
                        : 'Role: Reciter'
                      : isAr
                      ? 'الدور: المُسمِّع (يتابع المصحف)'
                      : 'Role: Listener'}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-3.5 bg-[#FFFDF9] border border-[#DDD2BE] flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold text-[#84715E]">
                  {isAr ? 'تنبيهات الأخطاء المتزامنة' : 'Synced Mistakes'}
                </div>
                <div className="text-lg font-extrabold font-mono-tabular text-[#261C14]">
                  {mistakesCount}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAdjustMistakes(-1)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#F7F3EB] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-xs font-bold text-[#5C4B3B] cursor-pointer"
                >
                  -1
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustMistakes(1)}
                  className="px-3 py-1.5 rounded-lg bg-[#FBF3DF] hover:bg-[#F5E4B8] border border-[#C88A14]/50 text-xs font-bold text-[#9E650C] cursor-pointer"
                >
                  {isAr ? '+ خطأ' : '+ Error'}
                </button>
              </div>
            </div>
          </div>

          {/* Live Options Toolbar: Hide Verses + Riwayah + Privacy + Font Size */}
          <div className="rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-3.5 shadow-2xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleSyncedHideReciter}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                    hideVersesForReciter
                      ? 'bg-[#2D2218] text-[#EAB338] border-[#2D2218]'
                      : 'bg-[#F7F3EB] text-[#5C4B3B] border-[#DDD2BE]'
                  }`}
                >
                  {hideVersesForReciter ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{isAr ? 'إخفاء عن القارئ' : 'Hide for Reciter'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleSyncedHideListener}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                    hideVersesForListener
                      ? 'bg-[#2D2218] text-[#EAB338] border-[#2D2218]'
                      : 'bg-[#F7F3EB] text-[#5C4B3B] border-[#DDD2BE]'
                  }`}
                >
                  {hideVersesForListener ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{isAr ? 'إخفاء عن المُسمِّع' : 'Hide for Listener'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLocalHideVerses(!localHideVerses)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                    localHideVerses
                      ? 'bg-[#A84A32] text-[#FFFDF9] border-[#A84A32]'
                      : 'bg-[#F7F3EB] text-[#5C4B3B] border-[#DDD2BE]'
                  }`}
                >
                  {localHideVerses ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{isAr ? 'إخفاء عندي' : 'Hide Local'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFadeFirstWordOnly(!fadeFirstWordOnly)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                    fadeFirstWordOnly
                      ? 'bg-[#4A6144] text-[#FFFDF9] border-[#4A6144]'
                      : 'bg-[#F7F3EB] text-[#5C4B3B] border-[#DDD2BE]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تلاشي' : 'Fade Hint'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Live Riwayah Switcher */}
                <div className="flex items-center gap-1 bg-[#F7F3EB] border border-[#DDD2BE] rounded-xl p-0.5 text-[11px] font-bold">
                  {RIWAYAH_OPTIONS.map((rw) => (
                    <button
                      key={rw.id}
                      type="button"
                      onClick={() => handleSwitchSessionRiwayah(rw.id)}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                        selectedRiwayah === rw.id
                          ? 'bg-[#4A6144] text-[#FFFDF9]'
                          : 'text-[#5C4B3B]'
                      }`}
                    >
                      {isAr ? rw.shortAr : rw.shortEn}
                    </button>
                  ))}
                </div>

                {/* High Privacy IP Masking Toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={highPrivacyIpMask}
                  onClick={() => setHighPrivacyIpMask((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                    highPrivacyIpMask
                      ? 'bg-[#ECFDF3] border-[#86EFAC] text-[#15803D]'
                      : 'bg-[#F7F3EB] border-[#DDD2BE] text-[#5C4B3B]'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>{isAr ? 'وضع الخصوصية العالية (إخفاء الـ IP)' : 'High Privacy (IP Mask)'}</span>
                </button>

                <div className="flex items-center gap-1 bg-[#F7F3EB] border border-[#DDD2BE] rounded-xl p-0.5 text-[11px] font-bold">
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
                      className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                        textScale === sz.id ? 'bg-[#2D2218] text-[#EAB338]' : 'text-[#5C4B3B]'
                      }`}
                    >
                      {sz.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {highPrivacyIpMask && !TURN_SERVER_URL.trim() && (
              <div className="rounded-lg bg-[#FBF3DF] border border-[#E5C983] px-3 py-1.5 text-[11px] font-semibold text-[#9E650C]">
                {isAr
                  ? 'وضع إخفاء الـ IP (relay) مفعّل: يرجى تعبئة بيانات خادم TURN (TURN_SERVER_URL) لإتمام التمرير الوسيط، أو إيقافه مؤقتاً عند الاختبار.'
                  : 'IP Masking relay mode is active: set TURN_SERVER_URL credentials or toggle off for local STUN testing.'}
              </div>
            )}
          </div>

          {/* Synchronized Trusted Mushaf Panel */}
          <div className="rounded-[24px] bg-[#FFFDF9] border border-[#DDD2BE] p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EFE9DC]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#4A6144]" />
                  <h3 className="text-base sm:text-lg font-extrabold font-display-islamic text-[#261C14]">
                    {activeSessionTitle}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5C4B3B]">
                  <span className="font-bold text-[#4A6144]">
                    {isAr ? `المصدر: ${activeSourceMeta.labelAr}` : `Source: ${activeSourceMeta.labelEn}`}
                  </span>
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

              {/* Ayah Stepping & Sync Status */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStepVerse(-1)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#F7F3EB] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-xs font-bold text-[#261C14] flex items-center gap-1 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>{isAr ? 'السابقة' : 'Prev'}</span>
                </button>
                <span className="text-xs font-mono-tabular font-extrabold text-[#9E650C] px-2">
                  {isAr ? `آية ${activeAyah}` : `Ayah ${activeAyah}`}
                </span>
                <button
                  type="button"
                  onClick={() => handleStepVerse(1)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#F7F3EB] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-xs font-bold text-[#261C14] flex items-center gap-1 cursor-pointer"
                >
                  <span>{isAr ? 'التالية' : 'Next'}</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {shouldHideVersesForMe && (
              <div className="rounded-xl bg-[#FBF3DF] border border-[#C88A14]/50 px-3.5 py-2.5 text-xs text-[#261C14] flex items-center justify-between gap-2">
                <span className="font-bold">
                  {isAr
                    ? 'الآيات مخفية حالياً للتسميع غيباً — اضغط «كشف الآية» على أي سطر لاختلاس نظرة مؤقتة.'
                    : 'Verses are hidden for memorization — tap Peek on any verse row if needed.'}
                </span>
              </div>
            )}

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
                  const displayMode =
                    shouldHideVersesForMe && !isPeeking
                      ? 'hidden'
                      : fadeFirstWordOnly && !isPeeking
                      ? 'fade'
                      : 'full';
                  const prevSurah = idx > 0 ? verses[idx - 1].surahNumber : null;
                  const surahObj = SURAH_LIST.find((s) => s.number === v.surahNumber);

                  return (
                    <React.Fragment key={`${v.verseKey}-${idx}`}>
                      {(idx === 0 || prevSurah !== v.surahNumber) && surahObj && (
                        <div className="px-3 py-1.5 rounded-xl bg-[#F6E9C8]/70 border border-[#C88A14]/35 text-xs font-extrabold text-[#2D2218] text-center">
                          {isAr ? `سورة ${surahObj.nameAr}` : `Surah ${surahObj.nameEn}`}
                        </div>
                      )}
                      <div
                        onClick={() => handleSelectAyahSync(v.ayahNumber)}
                        className={`w-full text-start p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isActive
                            ? 'bg-[#FBF3DF] border-[#C88A14] ring-1 ring-[#C88A14]/40 shadow-2xs'
                            : 'bg-[#F7F3EB]/60 hover:bg-[#EFE9DC]/70 border-[#E5DEC9]'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          {displayMode === 'hidden' ? (
                            <div className="flex items-center justify-between gap-3 py-1">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#2D2218] text-xs font-mono-tabular font-bold text-[#EAB338]">
                                  {v.ayahNumber}
                                </span>
                                <span className="text-xs sm:text-sm font-bold text-[#84715E] select-none">
                                  {isAr
                                    ? 'آية مخفية للتسميع غيباً ••••••••••••••'
                                    : 'Verse hidden for memorization ••••••••••'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPeekVerseKey(v.verseKey);
                                  handleSelectAyahSync(v.ayahNumber);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#FFFDF9] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-[11px] font-bold text-[#9E650C] flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>{isAr ? 'كشف الآية' : 'Peek'}</span>
                              </button>
                            </div>
                          ) : (
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
                              {displayMode === 'fade'
                                ? extractFirstWordMask(v.textCleanUthmani)
                                : v.text}{' '}
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#C88A14]/15 border border-[#C88A14]/40 text-xs font-mono-tabular font-bold text-[#9E650C] align-middle mx-1">
                                {v.ayahNumber}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
