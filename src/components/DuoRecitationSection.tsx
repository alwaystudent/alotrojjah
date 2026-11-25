import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Link2,
  LogIn,
  LogOut,
  Mail,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  RefreshCw,
  RotateCcw,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, googleProvider, OperationType, handleFirestoreError } from '../firebase';
import {
  Language,
  QuranRiwayah,
  RIWAYAH_OPTIONS,
  SURAH_LIST,
  getRiwayahLabel,
} from '../data/quranData';
import { TrustedVerseItem, fetchTrustedCurriculumVerses } from '../utils/trustedQuranApi';
import { memoryManager } from '../utils/memoryCleanup';
import { callRingtone, dismissBackgroundCallNotification } from '../utils/ringtone';
import {
  FriendContactDoc,
  FriendInviteDoc,
  FriendRequestDoc,
  IceCandidateDoc,
  IncomingDuoCall,
  approveIncomingFriendRequest,
  declineIncomingFriendRequest,
  extractInviteTokenFromInput,
  fetchFriendInviteDetails,
  formatFriendShortCode,
  getDisplayNameForUser,
  getOrCreateMyFriendInvite,
  regenerateMyFriendInvite,
  removeFriendWithCleanup,
  sendConsentFriendRequest,
  subscribeFriendPresence,
  syncAcceptedOutgoingRequest,
  syncVerifiedUserProfileAndDirectory,
  updateUserPresenceHeartbeat,
} from '../utils/friendsDirectory';

export interface DuoActiveCallSummary {
  isInCall: boolean;
  status: 'ringing' | 'active' | null;
  peerName: string;
  surahLabel: string;
}

interface DuoRecitationSectionProps {
  lang: Language;
  defaultRiwayah?: QuranRiwayah;
  initialFriendInviteToken?: string;
  onClearFriendInvite?: () => void;
  pendingAcceptCallId?: string | null;
  onClearPendingCall?: () => void;
  onOpenPrivacyTerms?: () => void;
  onActiveCallStateChange?: (summary: DuoActiveCallSummary) => void;
}

type SessionEvalKey = 'excellent' | 'very_good' | 'good_practice' | 'needs_review';

interface PostCallSummary {
  peerName: string;
  surahLabel: string;
  durationSeconds: number;
  mistakesCount: number;
  accuracyPct: number;
  evaluation: SessionEvalKey | null;
}

const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
];

const EVALUATION_CHOICES: {
  id: SessionEvalKey;
  labelAr: string;
  labelEn: string;
  colorClass: string;
}[] = [
  {
    id: 'excellent',
    labelAr: 'إتقان ممتاز',
    labelEn: 'Excellent Mastery',
    colorClass: 'bg-[#ECFDF3] border-[#15803D] text-[#14532D]',
  },
  {
    id: 'very_good',
    labelAr: 'جيد جداً',
    labelEn: 'Very Good',
    colorClass: 'bg-[#F0F9FF] border-[#0369A1] text-[#0C4A6E]',
  },
  {
    id: 'good_practice',
    labelAr: 'تدريب جيد',
    labelEn: 'Good Practice',
    colorClass: 'bg-[#FEFCE8] border-[#CA8A04] text-[#713F12]',
  },
  {
    id: 'needs_review',
    labelAr: 'يحتاج مراجعة',
    labelEn: 'Needs Review',
    colorClass: 'bg-[#FEF2F2] border-[#DC2626] text-[#7F1D1D]',
  },
];

function generateId(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return `${prefix}_${out}`;
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function buildIceConfiguration(highPrivacy: boolean): RTCConfiguration {
  const turnUrl = import.meta.env.VITE_TURN_SERVER_URL as string | undefined;
  const turnUser = import.meta.env.VITE_TURN_USERNAME as string | undefined;
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

  const iceServers: RTCIceServer[] = [...DEFAULT_STUN_SERVERS];
  const hasTurn = Boolean(turnUrl && turnUrl.trim().length > 0);
  if (hasTurn && turnUrl) {
    iceServers.push({
      urls: turnUrl.split(',').map((u) => u.trim()).filter(Boolean),
      username: turnUser || undefined,
      credential: turnCred || undefined,
    });
  }

  return {
    iceServers,
    iceTransportPolicy: highPrivacy && hasTurn ? 'relay' : 'all',
    iceCandidatePoolSize: 4,
  };
}

function buildCurriculumSummary(meta: IncomingDuoCall | null, lang: Language): string {
  if (!meta) return '';
  const rw = getRiwayahLabel(meta.riwayah || 'hafs', lang);
  if (meta.curriculumMode === 'page') {
    const p1 = meta.pageFrom || 1;
    const p2 = meta.pageTo || p1;
    return lang === 'ar'
      ? `${p1 === p2 ? `صفحة ${p1}` : `الصفحات ${p1} - ${p2}`} · ${rw}`
      : `${p1 === p2 ? `Page ${p1}` : `Pages ${p1}-${p2}`} · ${rw}`;
  }
  const sStart = SURAH_LIST.find((s) => s.number === meta.surahNumber);
  const sEnd = meta.surahEnd ? SURAH_LIST.find((s) => s.number === meta.surahEnd) : null;
  if (meta.curriculumMode === 'surah' && sStart) {
    if (sEnd && sEnd.number !== sStart.number) {
      return lang === 'ar'
        ? `من ${sStart.nameAr} إلى ${sEnd.nameAr} · ${rw}`
        : `${sStart.nameEn} to ${sEnd.nameEn} · ${rw}`;
    }
    return lang === 'ar' ? `سورة ${sStart.nameAr} · ${rw}` : `Surah ${sStart.nameEn} · ${rw}`;
  }
  return sStart
    ? lang === 'ar'
      ? `سورة ${sStart.nameAr} (${meta.ayahFrom}-${meta.ayahTo}) · ${rw}`
      : `Surah ${sStart.nameEn} (${meta.ayahFrom}-${meta.ayahTo}) · ${rw}`
    : rw;
}

export const DuoRecitationSection: React.FC<DuoRecitationSectionProps> = ({
  lang,
  defaultRiwayah = 'hafs',
  initialFriendInviteToken = '',
  onClearFriendInvite,
  pendingAcceptCallId = null,
  onClearPendingCall,
  onOpenPrivacyTerms,
  onActiveCallStateChange,
}) => {
  const isAr = lang === 'ar';

  // Auth & Profile State (never spread Firebase User!)
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [profileVersion, setProfileVersion] = useState<number>(0);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [nameInput, setNameInput] = useState<string>('');
  const [authBusy, setAuthBusy] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState<boolean>(false);
  const [displayNameDraft, setDisplayNameDraft] = useState<string>('');

  // Friends, Invite & Presence State
  const [myInvite, setMyInvite] = useState<FriendInviteDoc | null>(null);
  const [inviteCopied, setInviteCopied] = useState<boolean>(false);
  const [inviteBusy, setInviteBusy] = useState<boolean>(false);
  const [pasteInviteInput, setPasteInviteInput] = useState<string>('');
  const [lookupInviteResult, setLookupInviteResult] = useState<FriendInviteDoc | null>(null);
  const [lookupBusy, setLookupBusy] = useState<boolean>(false);
  const [friends, setFriends] = useState<FriendContactDoc[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestDoc[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestDoc[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, number>>({});
  const [confirmRemoveFriendUid, setConfirmRemoveFriendUid] = useState<string | null>(null);
  const [lobbyNotice, setLobbyNotice] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);

  // Curriculum & Call Options
  const [riwayah, setRiwayah] = useState<QuranRiwayah>(defaultRiwayah);
  const [curriculumMode, setCurriculumMode] = useState<'surah' | 'ayah' | 'page'>('ayah');
  const [surahNumber, setSurahNumber] = useState<number>(1);
  const [surahEnd, setSurahEnd] = useState<number>(1);
  const [ayahFrom, setAyahFrom] = useState<number>(1);
  const [ayahTo, setAyahTo] = useState<number>(7);
  const [pageFrom, setPageFrom] = useState<number>(1);
  const [pageTo, setPageTo] = useState<number>(1);
  const [highPrivacyMasking, setHighPrivacyMasking] = useState<boolean>(false);

  // Active Session & WebRTC State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionMeta, setSessionMeta] = useState<IncomingDuoCall | null>(null);
  const [peerConnState, setPeerConnState] = useState<
    'idle' | 'ringing' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
  >('idle');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [audioUnlockNeeded, setAudioUnlockNeeded] = useState<boolean>(false);
  const [speakerOutputMode, setSpeakerOutputMode] = useState<'speaker' | 'earpiece'>('speaker');
  const [callSeconds, setCallSeconds] = useState<number>(0);
  const [postCallSummary, setPostCallSummary] = useState<PostCallSummary | null>(null);

  // Verses & Interactive Recitation Workspace State
  const [verses, setVerses] = useState<TrustedVerseItem[]>([]);
  const [versesLoading, setVersesLoading] = useState<boolean>(false);
  const [versesError, setVersesError] = useState<string | null>(null);
  const [localRevealCurrentAyah, setLocalRevealCurrentAyah] = useState<boolean>(false);
  const [localFadeFirstWordOnly, setLocalFadeFirstWordOnly] = useState<boolean>(false);
  const [verseTextScale, setVerseTextScale] = useState<number>(1);
  const [showEndEvalModal, setShowEndEvalModal] = useState<boolean>(false);
  const [endingBusy, setEndingBusy] = useState<boolean>(false);

  // WebRTC & Resource Refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const unregisterStreamRef = useRef<(() => void) | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const micAnalyserCtxRef = useRef<AudioContext | null>(null);
  const unregisterAnalyserCtxRef = useRef<(() => void) | null>(null);
  const micMeterRafRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionMetaRef = useRef<IncomingDuoCall | null>(null);
  const sessionCreatedRef = useRef<boolean>(false);
  const remoteDescSetRef = useRef<boolean>(false);
  const pendingLocalCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingRemoteCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const processedCandidateIdsRef = useRef<Set<string>>(new Set());
  const ringingTimeoutRef = useRef<number | null>(null);
  const iceRestartAttemptedRef = useRef<boolean>(false);
  const answeringCallIdRef = useRef<string | null>(null);
  const callStartTimestampRef = useRef<number | null>(null);
  const ayahRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    sessionMetaRef.current = sessionMeta;
  }, [sessionMeta]);

  useEffect(() => {
    setRiwayah(defaultRiwayah);
  }, [defaultRiwayah]);

  // Adjust ayah bounds when surah changes
  const selectedSurahInfo = useMemo(
    () => SURAH_LIST.find((s) => s.number === surahNumber) || SURAH_LIST[0],
    [surahNumber]
  );

  useEffect(() => {
    if (ayahFrom > selectedSurahInfo.ayahCount) {
      setAyahFrom(1);
      setAyahTo(selectedSurahInfo.ayahCount);
    } else if (ayahTo > selectedSurahInfo.ayahCount) {
      setAyahTo(selectedSurahInfo.ayahCount);
    }
    if (surahEnd < surahNumber) {
      setSurahEnd(surahNumber);
    }
  }, [surahNumber, surahEnd, ayahFrom, ayahTo, selectedSurahInfo.ayahCount]);

  // Notify parent & window of active call status
  useEffect(() => {
    const win = window as unknown as { __alutrujjahActiveVoiceCall?: boolean };
    const isInCall = Boolean(sessionId);
    win.__alutrujjahActiveVoiceCall = isInCall;
    if (!isInCall) {
      window.dispatchEvent(new Event('alutrujjah:call-ended'));
    }

    if (onActiveCallStateChange) {
      const peerName = sessionMeta
        ? sessionMeta.hostUid === user?.uid
          ? friends.find((f) => f.friendUid === sessionMeta.calleeUid)?.friendName ||
            sessionMeta.guestName ||
            (isAr ? 'صديق' : 'Friend')
          : sessionMeta.hostName
        : '';
      onActiveCallStateChange({
        isInCall,
        status:
          sessionMeta?.status === 'ringing' || sessionMeta?.status === 'active'
            ? sessionMeta.status
            : isInCall
            ? 'ringing'
            : null,
        peerName,
        surahLabel: buildCurriculumSummary(sessionMeta, lang),
      });
    }
  }, [sessionId, sessionMeta, user?.uid, friends, lang, isAr, onActiveCallStateChange]);

  // Clean WebRTC & Media Teardown
  const teardownWebRtcResources = useCallback(() => {
    callRingtone.stop();
    if (ringingTimeoutRef.current !== null) {
      window.clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }

    if (micMeterRafRef.current !== null) {
      window.cancelAnimationFrame(micMeterRafRef.current);
      micMeterRafRef.current = null;
    }
    setMicLevel(0);

    if (micAnalyserCtxRef.current) {
      try {
        if (micAnalyserCtxRef.current.state !== 'closed') {
          void micAnalyserCtxRef.current.close();
        }
      } catch {
        // ignore
      }
      micAnalyserCtxRef.current = null;
    }
    if (unregisterAnalyserCtxRef.current) {
      unregisterAnalyserCtxRef.current();
      unregisterAnalyserCtxRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {
          // ignore
        }
      });
      localStreamRef.current = null;
    }
    if (unregisterStreamRef.current) {
      unregisterStreamRef.current();
      unregisterStreamRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      remoteStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      } catch {
        // ignore
      }
    }

    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.ondatachannel = null;
        pcRef.current.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
    }

    sessionCreatedRef.current = false;
    remoteDescSetRef.current = false;
    pendingLocalCandidatesRef.current = [];
    pendingRemoteCandidatesRef.current = [];
    processedCandidateIdsRef.current.clear();
    iceRestartAttemptedRef.current = false;
    callStartTimestampRef.current = null;
    setIsMicMuted(false);
    setAudioUnlockNeeded(false);
    setCallSeconds(0);
    setPeerConnState('idle');
    setShowEndEvalModal(false);
    setLocalRevealCurrentAyah(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      teardownWebRtcResources();
    };
  }, [teardownWebRtcResources]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
      if (nextUser && nextUser.emailVerified) {
        try {
          await syncVerifiedUserProfileAndDirectory(nextUser);
        } catch {
          // Non-fatal
        }
      } else if (!nextUser) {
        teardownWebRtcResources();
        setSessionId(null);
        setSessionMeta(null);
        setFriends([]);
        setMyInvite(null);
      }
    });
    return () => unsub();
  }, [teardownWebRtcResources]);

  // Clean up any orphaned ringing sessions hosted by current user on login
  useEffect(() => {
    if (!user || !user.emailVerified) return;
    let cancelled = false;
    const cleanupStaleHostCalls = async () => {
      try {
        const staleQ = query(
          collection(db, 'duoSessions'),
          where('hostUid', '==', user.uid),
          where('status', '==', 'ringing')
        );
        const snap = await getDocs(staleQ);
        if (cancelled) return;
        const now = Date.now();
        for (const d of snap.docs) {
          if (d.id === sessionIdRef.current) continue;
          const data = d.data() as IncomingDuoCall & { createdAt?: { toMillis?: () => number } };
          const createdMs =
            data.createdAt && typeof data.createdAt === 'object' && typeof data.createdAt.toMillis === 'function'
              ? data.createdAt.toMillis()
              : 0;
          if (!createdMs || now - createdMs > 90_000) {
            await updateDoc(d.ref, {
              status: 'ended',
              endedByUid: user.uid,
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
        }
      } catch {
        // Ignore non-critical startup cleanup failure
      }
    };
    void cleanupStaleHostCalls();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Load personal invite link + heartbeat presence + friends + friendRequests listeners
  useEffect(() => {
    if (!user || !user.emailVerified) {
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setMyInvite(null);
      return;
    }

    let cancelled = false;
    getOrCreateMyFriendInvite(user)
      .then((inv) => {
        if (!cancelled) setMyInvite(inv);
      })
      .catch(() => {});

    const heartbeatId = window.setInterval(() => {
      void updateUserPresenceHeartbeat(user);
    }, 25_000);

    const unsubFriends = onSnapshot(
      collection(db, 'users', user.uid, 'friends'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as FriendContactDoc);
        list.sort((a, b) => (a.friendName || '').localeCompare(b.friendName || ''));
        setFriends(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/friends`);
      }
    );

    const unsubInReqs = onSnapshot(
      query(
        collection(db, 'friendRequests'),
        where('toUid', '==', user.uid),
        where('status', '==', 'pending')
      ),
      (snap) => {
        setIncomingRequests(snap.docs.map((d) => d.data() as FriendRequestDoc));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'friendRequests');
      }
    );

    const unsubOutReqs = onSnapshot(
      query(collection(db, 'friendRequests'), where('fromUid', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as FriendRequestDoc);
        setOutgoingRequests(list.filter((r) => r.status === 'pending'));
        // Auto-sync any accepted outgoing request
        list
          .filter((r) => r.status === 'accepted' && !r.syncedBySender)
          .forEach((r) => {
            void syncAcceptedOutgoingRequest(user, r);
          });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'friendRequests');
      }
    );

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatId);
      unsubFriends();
      unsubInReqs();
      unsubOutReqs();
    };
  }, [user, profileVersion]);

  // Subscribe to friend live presence
  useEffect(() => {
    if (!user || !user.emailVerified || friends.length === 0) {
      setPresenceMap({});
      return;
    }
    return subscribeFriendPresence(
      friends.map((f) => f.friendUid),
      setPresenceMap
    );
  }, [user, friends]);

  // Handle initialFriendInviteToken passed into Duo section
  useEffect(() => {
    if (!user || !user.emailVerified || !initialFriendInviteToken) return;
    let cancelled = false;
    fetchFriendInviteDetails(initialFriendInviteToken)
      .then((found) => {
        if (cancelled) return;
        if (found && found.ownerUid !== user.uid) {
          setLookupInviteResult(found);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, initialFriendInviteToken]);

  // Play remote stream helper (with gesture-unlock fallback)
  const playRemoteStreamSafely = useCallback(async (stream: MediaStream) => {
    remoteStreamRef.current = stream;
    const el = remoteAudioRef.current;
    if (!el) return;
    el.srcObject = stream;
    el.volume = 1;
    try {
      await el.play();
      setAudioUnlockNeeded(false);
    } catch {
      setAudioUnlockNeeded(true);
    }
  }, []);

  // Acquire microphone + set up visual mic level meter
  const acquireMicrophone = useCallback(async (): Promise<MediaStream> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(isAr ? 'المتصفح لا يدعم الوصول للميكروفون.' : 'Microphone API not supported.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    localStreamRef.current = stream;
    if (unregisterStreamRef.current) unregisterStreamRef.current();
    unregisterStreamRef.current = memoryManager.registerStream(stream);

    // Lightweight AudioContext analyser for visual voice indicator
    try {
      const AudioCtxCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxCtor) {
        const ctx = new AudioCtxCtor();
        micAnalyserCtxRef.current = ctx;
        if (unregisterAnalyserCtxRef.current) unregisterAnalyserCtxRef.current();
        unregisterAnalyserCtxRef.current = memoryManager.registerAudioContext(ctx);
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        src.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const tickMeter = () => {
          if (!localStreamRef.current || !micAnalyserCtxRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          setMicLevel(Math.min(100, Math.round((avg / 90) * 100)));
          micMeterRafRef.current = window.requestAnimationFrame(tickMeter);
        };
        micMeterRafRef.current = window.requestAnimationFrame(tickMeter);
      }
    } catch {
      // Visual meter is non-critical
    }

    return stream;
  }, [isAr]);

  // Write Trickle ICE candidate to Firestore subcollection
  const publishLocalIceCandidate = useCallback(
    async (targetSessionId: string, senderUid: string, recipientUid: string, cand: RTCIceCandidateInit) => {
      if (!cand.candidate || cand.candidate.trim().length === 0) return;
      const candidateId = generateId('ice');
      try {
        await setDoc(doc(db, 'duoSessions', targetSessionId, 'candidates', candidateId), {
          candidateId,
          sessionId: targetSessionId,
          senderUid,
          recipientUid,
          candidate: cand.candidate.slice(0, 2048),
          sdpMid: cand.sdpMid ? String(cand.sdpMid).slice(0, 64) : null,
          sdpMLineIndex:
            typeof cand.sdpMLineIndex === 'number' && cand.sdpMLineIndex >= 0 && cand.sdpMLineIndex <= 20
              ? cand.sdpMLineIndex
              : null,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        // Non-fatal if session just ended
        console.warn('Trickle ICE publish notice:', err);
      }
    },
    []
  );

  // Create RTCPeerConnection with strict audio-only enforcement & Trickle ICE
  const createAudioPeerConnection = useCallback(
    (targetSessionId: string, localUid: string, remoteUid: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(buildIceConfiguration(highPrivacyMasking));
      pcRef.current = pc;

      // Strict Audio-Only Enforcement: immediately close any unexpected DataChannel
      pc.ondatachannel = (event) => {
        try {
          event.channel.close();
        } catch {
          // ignore
        }
      };

      pc.ontrack = (event) => {
        const stream = event.streams?.[0] || new MediaStream([event.track]);
        void playRemoteStreamSafely(stream);
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate || !event.candidate.candidate) return;
        const candInit: RTCIceCandidateInit = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        };
        if (sessionCreatedRef.current) {
          void publishLocalIceCandidate(targetSessionId, localUid, remoteUid, candInit);
        } else {
          pendingLocalCandidatesRef.current.push(candInit);
        }
      };

      const updateConnectionStatus = () => {
        const iceState = pc.iceConnectionState;
        const connState = pc.connectionState;
        if (connState === 'connected' || iceState === 'connected' || iceState === 'completed') {
          setPeerConnState('connected');
          iceRestartAttemptedRef.current = false;
        } else if (iceState === 'disconnected') {
          setPeerConnState('reconnecting');
        } else if (connState === 'failed' || iceState === 'failed') {
          if (!iceRestartAttemptedRef.current && typeof pc.restartIce === 'function') {
            iceRestartAttemptedRef.current = true;
            setPeerConnState('reconnecting');
            try {
              pc.restartIce();
            } catch {
              setPeerConnState('failed');
            }
          } else {
            setPeerConnState('failed');
          }
        }
      };

      pc.oniceconnectionstatechange = updateConnectionStatus;
      pc.onconnectionstatechange = updateConnectionStatus;
      return pc;
    },
    [highPrivacyMasking, playRemoteStreamSafely, publishLocalIceCandidate]
  );

  // Flush queued remote ICE candidates once remoteDescription is set
  const flushPendingRemoteCandidates = useCallback(async (pc: RTCPeerConnection) => {
    if (!pc.remoteDescription) return;
    const queue = [...pendingRemoteCandidatesRef.current];
    pendingRemoteCandidatesRef.current = [];
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        // Ignore stale candidate
      }
    }
  }, []);

  // Gather brief initial ICE candidates (max 1.2s) while Trickle ICE sends all remaining ones
  const gatherInitialOfferSdp = async (pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> => {
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await pc.setLocalDescription(offer);

    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const timer = window.setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', onState);
        resolve();
      }, 1200);
      const onState = () => {
        if (pc.iceGatheringState === 'complete') {
          window.clearTimeout(timer);
          pc.removeEventListener('icegatheringstatechange', onState);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', onState);
    });

    return pc.localDescription || offer;
  };

  // Start Outgoing Call to Approved Friend
  const startFriendAudioCall = async (friend: FriendContactDoc) => {
    if (!user || !user.emailVerified) return;
    if (sessionId) return;

    setLobbyNotice(null);
    setPostCallSummary(null);
    callRingtone.unlockAudio();

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setLobbyNotice({
        type: 'error',
        text: isAr ? 'لا يوجد اتصال بالإنترنت حالياً.' : 'You appear to be offline.',
      });
      return;
    }

    const newSessionId = generateId('call');
    setSessionId(newSessionId);
    setPeerConnState('ringing');

    try {
      const micStream = await acquireMicrophone();
      const pc = createAudioPeerConnection(newSessionId, user.uid, friend.friendUid);
      micStream.getTracks().forEach((track) => pc.addTrack(track, micStream));

      const localOffer = await gatherInitialOfferSdp(pc);
      if (!localOffer.sdp) {
        throw new Error('Failed to create SDP offer');
      }

      // Build valid curriculum payload matching firestore.rules
      let finalSurahEnd = surahNumber;
      let finalAyahFrom = ayahFrom;
      let finalAyahTo = ayahTo;
      if (curriculumMode === 'surah') {
        finalSurahEnd = Math.max(surahNumber, Math.min(114, surahEnd));
        const endInfo = SURAH_LIST.find((s) => s.number === finalSurahEnd) || selectedSurahInfo;
        finalAyahFrom = 1;
        finalAyahTo = endInfo.ayahCount;
      } else if (curriculumMode === 'page') {
        finalAyahFrom = 1;
        finalAyahTo = 7;
      } else {
        finalAyahFrom = Math.max(1, Math.min(ayahFrom, selectedSurahInfo.ayahCount));
        finalAyahTo = Math.max(finalAyahFrom, Math.min(ayahTo, selectedSurahInfo.ayahCount));
      }

      const safePageFrom = Math.max(1, Math.min(604, pageFrom));
      const safePageTo = Math.max(safePageFrom, Math.min(604, pageTo));

      const initialDoc: IncomingDuoCall = {
        sessionId: newSessionId,
        hostUid: user.uid,
        hostName: getDisplayNameForUser(user),
        calleeUid: friend.friendUid,
        callMode: 'friend_call',
        riwayah,
        curriculumMode,
        hideVersesForReciter: false,
        hideVersesForListener: false,
        activeAyah: finalAyahFrom,
        reciterSide: 'host',
        mistakesCount: 0,
        markedErrors: [],
        surahNumber,
        surahEnd: finalSurahEnd,
        ayahFrom: finalAyahFrom,
        ayahTo: finalAyahTo,
        pageFrom: safePageFrom,
        pageTo: safePageTo,
        offerType: localOffer.type || 'offer',
        offerSdp: localOffer.sdp.slice(0, 65536),
        status: 'ringing',
      };

      await setDoc(doc(db, 'duoSessions', newSessionId), {
        ...initialDoc,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      sessionCreatedRef.current = true;
      setSessionMeta(initialDoc);

      // Flush any ICE candidates collected during offer creation
      const queuedLocals = [...pendingLocalCandidatesRef.current];
      pendingLocalCandidatesRef.current = [];
      queuedLocals.forEach((cand) => {
        void publishLocalIceCandidate(newSessionId, user.uid, friend.friendUid, cand);
      });

      callRingtone.start('outgoing');

      // Auto-timeout ringing call after 55 seconds if unanswered
      ringingTimeoutRef.current = window.setTimeout(async () => {
        const currentMeta = sessionMetaRef.current;
        if (sessionIdRef.current === newSessionId && currentMeta?.status === 'ringing') {
          try {
            await updateDoc(doc(db, 'duoSessions', newSessionId), {
              status: 'ended',
              endedByUid: user.uid,
              updatedAt: serverTimestamp(),
            });
          } catch {
            // ignore
          }
          teardownWebRtcResources();
          setSessionId(null);
          setSessionMeta(null);
          setLobbyNotice({
            type: 'info',
            text: isAr
              ? `لم يتم الرد من «${friend.friendName}» خلال المهلة.`
              : `No answer from "${friend.friendName}".`,
          });
        }
      }, 55_000);
    } catch (err) {
      teardownWebRtcResources();
      setSessionId(null);
      setSessionMeta(null);
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
        setLobbyNotice({
          type: 'error',
          text: isAr
            ? 'يرجى السماح بصلاحية الميكروفون من إعدادات المتصفح لبدء المكالمة.'
            : 'Please allow microphone access in your browser settings.',
        });
      } else {
        setLobbyNotice({
          type: 'error',
          text: isAr ? 'تعذر بدء المكالمة الصوتية، حاول مجدداً.' : 'Could not start audio call.',
        });
      }
    }
  };

  // Answer Incoming Friend Call (triggered from App.tsx Answer button or notification)
  const answerIncomingFriendCall = useCallback(
    async (targetSessionId: string) => {
      if (!user || !user.emailVerified) return;
      if (answeringCallIdRef.current === targetSessionId || sessionIdRef.current === targetSessionId) return;
      answeringCallIdRef.current = targetSessionId;

      callRingtone.stop();
      callRingtone.unlockAudio();
      void dismissBackgroundCallNotification(targetSessionId);
      setLobbyNotice(null);
      setPostCallSummary(null);

      try {
        const sessionRef = doc(db, 'duoSessions', targetSessionId);
        const snap = await getDoc(sessionRef);
        if (!snap.exists()) {
          setLobbyNotice({
            type: 'info',
            text: isAr ? 'انتهت المكالمة قبل الرد.' : 'Call ended before answering.',
          });
          return;
        }
        const initialData = snap.data() as IncomingDuoCall;
        if (initialData.status !== 'ringing') {
          setLobbyNotice({
            type: 'info',
            text: isAr ? 'ألغى المتصل المكالمة أو انتهت.' : 'Caller cancelled or call ended.',
          });
          return;
        }

        setSessionId(targetSessionId);
        setSessionMeta(initialData);
        setPeerConnState('connecting');

        const micStream = await acquireMicrophone();

        // Re-check status after mic prompt in case caller hung up while callee clicked Allow
        const freshSnap = await getDoc(sessionRef);
        const freshData = freshSnap.exists() ? (freshSnap.data() as IncomingDuoCall) : null;
        if (!freshData || freshData.status !== 'ringing') {
          teardownWebRtcResources();
          setSessionId(null);
          setSessionMeta(null);
          setLobbyNotice({
            type: 'info',
            text: isAr ? 'انتهت المكالمة قبل إتمام الرد.' : 'Call ended before connecting.',
          });
          return;
        }

        const pc = createAudioPeerConnection(targetSessionId, user.uid, freshData.hostUid);
        sessionCreatedRef.current = true;
        micStream.getTracks().forEach((track) => pc.addTrack(track, micStream));

        await pc.setRemoteDescription(
          new RTCSessionDescription({
            type: (freshData.offerType as RTCSdpType) || 'offer',
            sdp: freshData.offerSdp,
          })
        );
        remoteDescSetRef.current = true;
        await flushPendingRemoteCandidates(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Brief wait (max 800ms) for initial local candidate
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === 'complete') {
            resolve();
            return;
          }
          const tmr = window.setTimeout(resolve, 800);
          pc.addEventListener(
            'icegatheringstatechange',
            () => {
              if (pc.iceGatheringState === 'complete') {
                window.clearTimeout(tmr);
                resolve();
              }
            },
            { once: true }
          );
        });

        const finalAnswer = pc.localDescription || answer;
        await updateDoc(sessionRef, {
          guestUid: user.uid,
          guestName: getDisplayNameForUser(user),
          answerType: finalAnswer.type || 'answer',
          answerSdp: (finalAnswer.sdp || '').slice(0, 65536),
          status: 'active',
          updatedAt: serverTimestamp(),
        });

        callStartTimestampRef.current = Date.now();
      } catch (err) {
        teardownWebRtcResources();
        setSessionId(null);
        setSessionMeta(null);
        const msg = err instanceof Error ? err.message : '';
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
          setLobbyNotice({
            type: 'error',
            text: isAr
              ? 'يرجى السماح بالميكروفون للرد على المكالمة.'
              : 'Microphone permission is required to answer the call.',
          });
        } else {
          setLobbyNotice({
            type: 'info',
            text: isAr ? 'تعذر الرد — ربما أغلق المتصل المكالمة.' : 'Could not answer call.',
          });
        }
      } finally {
        answeringCallIdRef.current = null;
        if (onClearPendingCall) onClearPendingCall();
      }
    },
    [
      user,
      isAr,
      acquireMicrophone,
      createAudioPeerConnection,
      flushPendingRemoteCandidates,
      teardownWebRtcResources,
      onClearPendingCall,
    ]
  );

  // Trigger answer when App passes pendingAcceptCallId
  useEffect(() => {
    if (!pendingAcceptCallId || !user || !user.emailVerified) return;
    void answerIncomingFriendCall(pendingAcceptCallId);
  }, [pendingAcceptCallId, user, answerIncomingFriendCall]);

  // Listen to Active Session Document & Trickle ICE Subcollection
  useEffect(() => {
    if (!sessionId || !user || !user.emailVerified) return;

    const sessionRef = doc(db, 'duoSessions', sessionId);
    const unsubSession = onSnapshot(
      sessionRef,
      async (snap) => {
        if (!snap.exists()) {
          teardownWebRtcResources();
          setSessionId(null);
          setSessionMeta(null);
          return;
        }

        const data = snap.data() as IncomingDuoCall;
        setSessionMeta(data);

        if (data.status === 'active') {
          callRingtone.stop();
          if (ringingTimeoutRef.current !== null) {
            window.clearTimeout(ringingTimeoutRef.current);
            ringingTimeoutRef.current = null;
          }
          if (!callStartTimestampRef.current) {
            callStartTimestampRef.current = Date.now();
          }

          // Caller sets remote answer SDP once
          const pc = pcRef.current;
          if (
            pc &&
            data.hostUid === user.uid &&
            data.answerSdp &&
            !remoteDescSetRef.current
          ) {
            remoteDescSetRef.current = true;
            setPeerConnState('connecting');
            try {
              await pc.setRemoteDescription(
                new RTCSessionDescription({
                  type: (data.answerType as RTCSdpType) || 'answer',
                  sdp: data.answerSdp,
                })
              );
              await flushPendingRemoteCandidates(pc);
            } catch (err) {
              console.warn('Error applying answer SDP:', err);
            }
          }
        } else if (data.status === 'declined') {
          teardownWebRtcResources();
          setSessionId(null);
          setSessionMeta(null);
          const peerName =
            data.hostUid === user.uid
              ? friends.find((f) => f.friendUid === data.calleeUid)?.friendName || (isAr ? 'الصديق' : 'Friend')
              : data.hostName;
          setLobbyNotice({
            type: 'info',
            text: isAr ? `رفض «${peerName}» المكالمة.` : `"${peerName}" declined the call.`,
          });
        } else if (data.status === 'ended') {
          const duration =
            typeof data.callDurationSeconds === 'number'
              ? data.callDurationSeconds
              : callStartTimestampRef.current
              ? Math.round((Date.now() - callStartTimestampRef.current) / 1000)
              : 0;
          const mistakes = data.mistakesCount || 0;
          const accuracy =
            typeof data.accuracyPct === 'number'
              ? data.accuracyPct
              : Math.max(0, Math.min(100, 100 - mistakes * 2));
          const peerName =
            data.hostUid === user.uid
              ? friends.find((f) => f.friendUid === data.calleeUid)?.friendName ||
                data.guestName ||
                (isAr ? 'صديق' : 'Friend')
              : data.hostName;
          const summaryLabel = buildCurriculumSummary(data, lang);

          teardownWebRtcResources();
          setSessionId(null);
          setSessionMeta(null);

          if (data.sessionEvaluation || duration > 0) {
            setPostCallSummary({
              peerName,
              surahLabel: summaryLabel,
              durationSeconds: duration,
              mistakesCount: mistakes,
              accuracyPct: accuracy,
              evaluation: data.sessionEvaluation || null,
            });
          } else {
            setLobbyNotice({
              type: 'info',
              text: isAr ? 'تم إنهاء المكالمة.' : 'Call ended.',
            });
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `duoSessions/${sessionId}`);
      }
    );

    // Subscribe to incoming Trickle ICE candidates targeted to current user
    const candQuery = query(
      collection(db, 'duoSessions', sessionId, 'candidates'),
      where('recipientUid', '==', user.uid)
    );
    const unsubCandidates = onSnapshot(
      candQuery,
      async (snap) => {
        const pc = pcRef.current;
        for (const change of snap.docChanges()) {
          if (change.type !== 'added') continue;
          if (processedCandidateIdsRef.current.has(change.doc.id)) continue;
          processedCandidateIdsRef.current.add(change.doc.id);

          const c = change.doc.data() as IceCandidateDoc;
          const candInit: RTCIceCandidateInit = {
            candidate: c.candidate,
            sdpMid: c.sdpMid ?? undefined,
            sdpMLineIndex: typeof c.sdpMLineIndex === 'number' ? c.sdpMLineIndex : undefined,
          };

          if (pc && pc.remoteDescription && remoteDescSetRef.current) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candInit));
            } catch {
              // ignore stale candidate
            }
          } else {
            pendingRemoteCandidatesRef.current.push(candInit);
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `duoSessions/${sessionId}/candidates`);
      }
    );

    return () => {
      unsubSession();
      unsubCandidates();
    };
  }, [sessionId, user, isAr, lang, friends, flushPendingRemoteCandidates, teardownWebRtcResources]);

  // Call Duration Ticker
  useEffect(() => {
    if (!sessionMeta || sessionMeta.status !== 'active') return;
    if (!callStartTimestampRef.current) {
      callStartTimestampRef.current = Date.now();
    }
    const timer = window.setInterval(() => {
      if (callStartTimestampRef.current) {
        setCallSeconds(Math.floor((Date.now() - callStartTimestampRef.current) / 1000));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionMeta?.status]);

  // Load Quran Verses for active session curriculum
  useEffect(() => {
    if (!sessionMeta) {
      setVerses([]);
      return;
    }
    let cancelled = false;
    setVersesLoading(true);
    setVersesError(null);

    fetchTrustedCurriculumVerses({
      curriculumMode: sessionMeta.curriculumMode || 'ayah',
      surahNumber: sessionMeta.surahNumber,
      surahEnd: sessionMeta.surahEnd,
      ayahFrom: sessionMeta.ayahFrom,
      ayahTo: sessionMeta.ayahTo,
      pageFrom: sessionMeta.pageFrom,
      pageTo: sessionMeta.pageTo,
      riwayah: sessionMeta.riwayah || 'hafs',
    })
      .then((res) => {
        if (!cancelled) {
          setVerses(res.verses);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVersesError(
            isAr
              ? 'تعذر تحميل الآيات، تحقق من اتصال الإنترنت.'
              : 'Could not load verses. Check internet connection.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setVersesLoading(false);
      });

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
    isAr,
  ]);

  // Auto-scroll active ayah into view
  useEffect(() => {
    if (!sessionMeta?.activeAyah) return;
    const match = verses.find((v) => v.ayahNumber === sessionMeta.activeAyah);
    const key = match ? match.verseKey : null;
    if (key && ayahRowRefs.current[key]) {
      ayahRowRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [sessionMeta?.activeAyah, verses]);

  // Sync active session metadata helper (Action 4 in firestore.rules)
  const updateActiveSessionFields = async (patch: Partial<IncomingDuoCall>) => {
    if (!sessionId || !sessionMeta || sessionMeta.status !== 'active') return;
    try {
      await updateDoc(doc(db, 'duoSessions', sessionId), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `duoSessions/${sessionId}`);
    }
  };

  // End or Cancel Call
  const finalizeEndCall = async (evaluation: SessionEvalKey | null) => {
    if (!sessionId || !user) return;
    const targetId = sessionId;
    const currentMeta = sessionMeta;
    setEndingBusy(true);

    const duration = callStartTimestampRef.current
      ? Math.max(0, Math.round((Date.now() - callStartTimestampRef.current) / 1000))
      : callSeconds;
    const mistakes = currentMeta?.mistakesCount || 0;
    const totalWords = Math.max(
      1,
      verses.reduce((acc, v) => acc + v.text.split(/\s+/).filter(Boolean).length, 0)
    );
    const accuracyPct =
      currentMeta?.status === 'active'
        ? Math.max(0, Math.min(100, Math.round(((totalWords - mistakes) / totalWords) * 100)))
        : null;

    try {
      await updateDoc(doc(db, 'duoSessions', targetId), {
        status: 'ended',
        endedByUid: user.uid,
        sessionEvaluation: evaluation,
        callDurationSeconds: currentMeta?.status === 'active' ? duration : 0,
        accuracyPct,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // If peer already ended call, proceed smoothly to teardown
    } finally {
      setEndingBusy(false);
      teardownWebRtcResources();
      setSessionId(null);
      setSessionMeta(null);
    }
  };

  // Toggle Mic Mute
  const handleToggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !isMicMuted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMicMuted(nextMuted);
  };

  // Toggle Speaker / Earpiece Audio Output
  const handleToggleAudioOutput = async () => {
    const el = remoteAudioRef.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    const nextMode = speakerOutputMode === 'speaker' ? 'earpiece' : 'speaker';
    setSpeakerOutputMode(nextMode);
    if (!el || typeof el.setSinkId !== 'function') return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((d) => d.kind === 'audiooutput');
      const target =
        nextMode === 'speaker'
          ? outputs.find((d) => /speaker|مكبر/i.test(d.label)) || outputs[0]
          : outputs.find((d) => /earpiece|headphone|bluetooth|سماعة/i.test(d.label)) || outputs[0];
      if (target) {
        await el.setSinkId(target.deviceId);
      }
    } catch {
      // Ignore unsupported sink routing
    }
  };

  // Auth Actions
  const handleGoogleLogin = async () => {
    setAuthBusy(true);
    setAuthError(null);
    setAuthSuccessMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(isAr ? 'تعذر تسجيل الدخول عبر Google.' : 'Google sign-in failed.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    setAuthSuccessMsg(null);
    try {
      if (authMode === 'register') {
        if (!nameInput.trim()) {
          setAuthError(isAr ? 'أدخل الاسم الظاهر أولاً.' : 'Please enter your display name.');
          setAuthBusy(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
        await updateProfile(cred.user, { displayName: nameInput.trim().slice(0, 80) });
        await sendEmailVerification(cred.user);
        setProfileVersion((v) => v + 1);
        setAuthSuccessMsg(
          isAr
            ? 'تم إنشاء الحساب وإرسال رابط التفعيل لبريدك الإلكتروني.'
            : 'Account created! Verification email sent.'
        );
      } else {
        await signInWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('email-already-in-use')) {
        setAuthError(isAr ? 'هذا البريد مسجل بالفعل، جرّب تسجيل الدخول.' : 'Email already registered.');
      } else if (msg.includes('weak-password')) {
        setAuthError(isAr ? 'كلمة المرور ضعيفة (6 أحرف على الأقل).' : 'Password should be at least 6 characters.');
      } else if (msg.includes('invalid-credential') || msg.includes('wrong-password')) {
        setAuthError(isAr ? 'البريد أو كلمة المرور غير صحيحة.' : 'Invalid email or password.');
      } else {
        setAuthError(isAr ? 'تعذر إتمام العملية، تحقق من البيانات.' : 'Authentication failed.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!user || !displayNameDraft.trim()) return;
    try {
      await updateProfile(user, { displayName: displayNameDraft.trim().slice(0, 80) });
      await syncVerifiedUserProfileAndDirectory(user);
      setProfileVersion((v) => v + 1);
      setEditingDisplayName(false);
      setLobbyNotice({
        type: 'success',
        text: isAr ? 'تم تحديث الاسم الظاهر.' : 'Display name updated.',
      });
    } catch {
      setLobbyNotice({
        type: 'error',
        text: isAr ? 'تعذر تحديث الاسم.' : 'Could not update display name.',
      });
    }
  };

  // Invite Link Actions
  const myInviteUrl = useMemo(() => {
    if (!myInvite || typeof window === 'undefined') return '';
    return `${window.location.origin}/?friendInvite=${encodeURIComponent(myInvite.inviteToken)}`;
  }, [myInvite]);

  const handleCopyInviteLink = async () => {
    if (!myInviteUrl) return;
    try {
      await navigator.clipboard.writeText(myInviteUrl);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2200);
    } catch {
      // ignore
    }
  };

  const handleShareInviteLink = async () => {
    if (!myInviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: isAr ? 'دعوة السرد الثنائي — الأترجة' : 'Al-Utrujjah Duo Sard Invite',
          text: isAr
            ? 'أضفني في السرد الثنائي لتسميع القرآن الكريم بصوت مباشر مشفّر:'
            : 'Add me on Al-Utrujjah for live encrypted Duo Quran recitation:',
          url: myInviteUrl,
        });
        return;
      } catch {
        // fallback to copy
      }
    }
    await handleCopyInviteLink();
  };

  const handleRegenerateInvite = async () => {
    if (!user) return;
    setInviteBusy(true);
    try {
      const next = await regenerateMyFriendInvite(user);
      setMyInvite(next);
      setLobbyNotice({
        type: 'success',
        text: isAr ? 'تم إنشاء رابط دعوة جديد وإلغاء الرابط السابق.' : 'New invite link generated.',
      });
    } catch {
      setLobbyNotice({
        type: 'error',
        text: isAr ? 'تعذر تجديد الرابط.' : 'Could not regenerate link.',
      });
    } finally {
      setInviteBusy(false);
    }
  };

  const handleLookupFriendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pasteInviteInput.trim()) return;
    setLookupBusy(true);
    setLobbyNotice(null);
    setLookupInviteResult(null);
    try {
      const token = extractInviteTokenFromInput(pasteInviteInput);
      const found = await fetchFriendInviteDetails(token);
      if (!found) {
        setLobbyNotice({
          type: 'error',
          text: isAr ? 'رابط أو رمز الدعوة غير صالح أو ملغى.' : 'Invite link or code is invalid or revoked.',
        });
      } else if (found.ownerUid === user.uid) {
        setLobbyNotice({
          type: 'info',
          text: isAr ? 'هذا رابط دعوتك الشخصي، شاركه مع صديقك.' : 'This is your own invite link.',
        });
      } else {
        setLookupInviteResult(found);
      }
    } catch {
      setLobbyNotice({
        type: 'error',
        text: isAr ? 'تعذر البحث عن الدعوة.' : 'Could not look up invite.',
      });
    } finally {
      setLookupBusy(false);
    }
  };

  const handleSendLookupRequest = async () => {
    if (!user || !lookupInviteResult) return;
    setLookupBusy(true);
    try {
      const outcome = await sendConsentFriendRequest(user, lookupInviteResult);
      const targetName = lookupInviteResult.ownerName;
      setLookupInviteResult(null);
      setPasteInviteInput('');
      if (onClearFriendInvite) onClearFriendInvite();

      if (outcome === 'already_accepted') {
        setLobbyNotice({
          type: 'success',
          text: isAr
            ? `«${targetName}» مضاف في قائمة أصدقائك؛ يمكنك الاتصال به الآن.`
            : `"${targetName}" is in your friends list and ready to call.`,
        });
      } else if (outcome === 'already_pending') {
        setLobbyNotice({
          type: 'info',
          text: isAr ? `طلبك إلى «${targetName}» بانتظار الموافقة.` : `Request to "${targetName}" is still pending.`,
        });
      } else {
        setLobbyNotice({
          type: 'success',
          text: isAr ? `تم إرسال طلب الصداقة إلى «${targetName}».` : `Friend request sent to "${targetName}".`,
        });
      }
    } catch {
      setLobbyNotice({
        type: 'error',
        text: isAr ? 'تعذر إرسال طلب الصداقة.' : 'Could not send friend request.',
      });
    } finally {
      setLookupBusy(false);
    }
  };

  // Word-tap mistake toggling inside active call
  const handleToggleWordError = async (wordKey: string) => {
    if (!sessionMeta || sessionMeta.status !== 'active') return;
    const currentErrors = Array.isArray(sessionMeta.markedErrors) ? sessionMeta.markedErrors : [];
    const exists = currentErrors.includes(wordKey);
    const nextErrors = exists
      ? currentErrors.filter((k) => k !== wordKey)
      : [...currentErrors, wordKey].slice(0, 80);

    await updateActiveSessionFields({
      markedErrors: nextErrors,
      mistakesCount: nextErrors.length,
    });
  };

  // Helper: Am I the Reciter or the Listener?
  const isHost = Boolean(user && sessionMeta && sessionMeta.hostUid === user.uid);
  const amIReciter = Boolean(
    sessionMeta &&
      ((isHost && (sessionMeta.reciterSide || 'host') === 'host') ||
        (!isHost && sessionMeta.reciterSide === 'guest'))
  );
  const versesHiddenForMe = Boolean(
    sessionMeta &&
      ((amIReciter && sessionMeta.hideVersesForReciter) ||
        (!amIReciter && sessionMeta.hideVersesForListener))
  );

  // Hidden reading overlay for auth gate
  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center text-sm text-[#4B5650]">
        {isAr ? 'جاري تهيئة السرد الثنائي...' : 'Initializing Duo Recitation...'}
      </div>
    );
  }

  // 1. SIGN-IN GATE
  if (!user) {
    return (
      <section className="max-w-xl mx-auto space-y-5">
        <div className="rounded-[24px] bg-[#FFFFFF] border border-[#C5CEBF] p-5 sm:p-6 shadow-sm space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#ECFDF3] border border-[#BBF7D0] flex items-center justify-center text-[#0E6340]">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold font-display-islamic text-[#0E5C3E]">
              {isAr ? 'السرد الثنائي المباشر' : 'Direct Duo Recitation'}
            </h2>
            <p className="text-xs sm:text-sm text-[#4B5650] leading-relaxed">
              {isAr
                ? 'سجّل دخولك لتبادل دعوات الصداقة والتسميع الصوتي المباشر المشفّر بين المتصفحين.'
                : 'Sign in to add friends via private invite links and start encrypted P2P Quran recitation calls.'}
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}
          {authSuccessMsg && (
            <div className="p-3 rounded-xl bg-[#ECFDF3] border border-[#BBF7D0] text-[#14532D] text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{authSuccessMsg}</span>
            </div>
          )}

          <button
            type="button"
            disabled={authBusy}
            onClick={handleGoogleLogin}
            className="w-full py-3 px-4 rounded-xl bg-[#0E6340] hover:bg-[#0A4D31] text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            <span>{isAr ? 'الدخول السريع بحساب Google' : 'Sign in with Google'}</span>
          </button>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-[#D3DCD1]" />
            <span className="px-3 text-[11px] font-bold text-[#6E7A73]">
              {isAr ? 'أو بالبريد الإلكتروني' : 'or with email'}
            </span>
            <div className="flex-grow border-t border-[#D3DCD1]" />
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F4F5EE]">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setAuthError(null);
              }}
              className={`py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                authMode === 'login' ? 'bg-white text-[#0E5C3E] shadow-xs' : 'text-[#4B5650]'
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
              className={`py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                authMode === 'register' ? 'bg-white text-[#0E5C3E] shadow-xs' : 'text-[#4B5650]'
              }`}
            >
              {isAr ? 'حساب جديد' : 'Create Account'}
            </button>
          </div>

          <form onSubmit={handleEmailAuthSubmit} className="space-y-3">
            {authMode === 'register' && (
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={isAr ? 'الاسم الظاهر للأصدقاء' : 'Display name'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF] text-sm text-[#161E19] focus:outline-none focus:border-[#0E6340]"
              />
            )}
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder={isAr ? 'البريد الإلكتروني' : 'Email address'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF] text-sm text-[#161E19] focus:outline-none focus:border-[#0E6340]"
            />
            <input
              type="password"
              required
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder={isAr ? 'كلمة المرور' : 'Password'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF] text-sm text-[#161E19] focus:outline-none focus:border-[#0E6340]"
            />
            <button
              type="submit"
              disabled={authBusy}
              className="w-full py-2.5 px-4 rounded-xl bg-[#96701E] hover:bg-[#7A5A16] text-white text-sm font-bold cursor-pointer transition-colors disabled:opacity-60"
            >
              {authMode === 'register'
                ? isAr
                  ? 'إنشاء الحساب'
                  : 'Register'
                : isAr
                ? 'دخول'
                : 'Sign In'}
            </button>
          </form>

          {onOpenPrivacyTerms && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onOpenPrivacyTerms}
                className="text-[11px] font-bold text-[#0E5C3E] underline cursor-pointer"
              >
                {isAr ? 'سياسة الخصوصية والأمان الصوتي (WebRTC)' : 'Audio Privacy & Security Policy'}
              </button>
            </div>
          )}
        </div>
      </section>
    );
  }

  // 2. EMAIL VERIFICATION GATE
  if (!user.emailVerified) {
    return (
      <section className="max-w-lg mx-auto">
        <div className="rounded-[24px] bg-[#FFFFFF] border border-[#DEC994] p-6 shadow-sm space-y-4 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FEFCE8] border border-[#FDE047] flex items-center justify-center text-[#96701E]">
            <Mail className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-extrabold font-display-islamic text-[#0E5C3E]">
            {isAr ? 'تفعيل البريد الإلكتروني مطلوب' : 'Email Verification Required'}
          </h3>
          <p className="text-xs sm:text-sm text-[#4B5650] leading-relaxed">
            {isAr
              ? `أرسلنا رابط التفعيل إلى (${user.email}). افتح الرسالة وأكّد بريدك ثم اضغط زر التحقق أدناه.`
              : `Please verify (${user.email}) via the link sent to your inbox, then tap Refresh below.`}
          </p>
          {authError && <p className="text-xs text-[#991B1B] font-semibold">{authError}</p>}
          {authSuccessMsg && <p className="text-xs text-[#15803D] font-semibold">{authSuccessMsg}</p>}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={async () => {
                setAuthBusy(true);
                setAuthError(null);
                try {
                  await user.reload();
                  setProfileVersion((v) => v + 1);
                  if (auth.currentUser?.emailVerified) {
                    setUser(auth.currentUser);
                    await syncVerifiedUserProfileAndDirectory(auth.currentUser);
                  } else {
                    setAuthError(isAr ? 'لم يتم التفعيل بعد، تحقق من بريدك.' : 'Not verified yet.');
                  }
                } catch {
                  setAuthError(isAr ? 'تعذر التحقق الآن.' : 'Verification check failed.');
                } finally {
                  setAuthBusy(false);
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-[#0E6340] text-white text-xs font-bold cursor-pointer"
            >
              {isAr ? 'تم التفعيل، متابعة' : 'I Verified — Continue'}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await sendEmailVerification(user);
                  setAuthSuccessMsg(isAr ? 'أُعيد إرسال رابط التفعيل.' : 'Verification email resent.');
                } catch {
                  setAuthError(isAr ? 'انتظر قليلاً قبل إعادة الإرسال.' : 'Please wait before resending.');
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-[#EAF0E7] text-[#0E5C3E] text-xs font-bold cursor-pointer"
            >
              {isAr ? 'إعادة إرسال الرابط' : 'Resend Email'}
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="px-3 py-2.5 rounded-xl text-[#A84A32] text-xs font-bold cursor-pointer"
            >
              {isAr ? 'خروج' : 'Sign Out'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Derived Display Name for verified user
  const myDisplayName = getDisplayNameForUser(user);
  void profileVersion; // Referenced so profile updates trigger clean re-read from User instance

  const peerDisplayName = sessionMeta
    ? sessionMeta.hostUid === user.uid
      ? friends.find((f) => f.friendUid === sessionMeta.calleeUid)?.friendName ||
        sessionMeta.guestName ||
        (isAr ? 'صديق' : 'Friend')
      : sessionMeta.hostName
    : '';

  return (
    <section className="max-w-4xl mx-auto space-y-5">
      {/* Persistent Remote WebRTC Audio Element */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* 3. ACTIVE CALL OR RINGING VIEW */}
      {sessionId && sessionMeta ? (
        <div className="space-y-4">
          {/* Call Status Bar */}
          <div className="rounded-[24px] bg-[#0E5C3E] text-white border-2 border-[#E6C25A]/70 p-4 sm:p-5 shadow-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#0E6340] border border-[#E6C25A]/60 flex items-center justify-center">
                  <PhoneCall
                    className={`w-5 h-5 text-[#E6C25A] ${
                      sessionMeta.status === 'ringing' ? 'animate-bounce' : ''
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-extrabold font-display-islamic">
                      {peerDisplayName}
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-white/15 text-[11px] font-bold">
                      {sessionMeta.status === 'ringing'
                        ? isAr
                          ? 'جاري الرنين...'
                          : 'Ringing...'
                        : peerConnState === 'connected'
                        ? isAr
                          ? 'صوت مباشر مشفّر'
                          : 'Live Encrypted'
                        : peerConnState === 'reconnecting'
                        ? isAr
                          ? 'إعادة الربط...'
                          : 'Reconnecting...'
                        : peerConnState === 'failed'
                        ? isAr
                          ? 'تعذر الربط الصوتي'
                          : 'Audio Failed'
                        : isAr
                        ? 'جاري الاتصال...'
                        : 'Connecting...'}
                    </span>
                  </div>
                  <p className="text-xs text-[#E6D7BE] mt-0.5">
                    {buildCurriculumSummary(sessionMeta, lang)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {sessionMeta.status === 'active' && (
                  <span className="px-3 py-1.5 rounded-xl bg-black/25 font-mono text-sm font-bold text-[#E6C25A]">
                    {formatDuration(callSeconds)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (sessionMeta.status === 'active') {
                      setShowEndEvalModal(true);
                    } else {
                      void finalizeEndCall(null);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-[#A84A32] hover:bg-[#8E3B26] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>
                    {sessionMeta.status === 'ringing'
                      ? isAr
                        ? 'إلغاء'
                        : 'Cancel'
                      : isAr
                      ? 'إنهاء'
                      : 'End'}
                  </span>
                </button>
              </div>
            </div>

            {/* Audio Controls + Unlock Prompt */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/15">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    isMicMuted
                      ? 'bg-[#A84A32] text-white'
                      : 'bg-white/15 hover:bg-white/25 text-white'
                  }`}
                >
                  {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>
                    {isMicMuted ? (isAr ? 'مكتوم' : 'Muted') : isAr ? 'الميكروفون' : 'Mic On'}
                  </span>
                </button>

                {/* Live Mic Level Bar */}
                {!isMicMuted && (
                  <div
                    className="w-16 h-2 rounded-full bg-black/30 overflow-hidden"
                    title={isAr ? 'مستوى الميكروفون' : 'Microphone level'}
                  >
                    <div
                      className="h-full bg-[#E6C25A] transition-all duration-75"
                      style={{ width: `${micLevel}%` }}
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleToggleAudioOutput}
                  className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {speakerOutputMode === 'speaker' ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                  <span>
                    {speakerOutputMode === 'speaker'
                      ? isAr
                        ? 'مكبر الصوت'
                        : 'Speaker'
                      : isAr
                      ? 'سماعة الأذن'
                      : 'Earpiece'}
                  </span>
                </button>

                {audioUnlockNeeded && (
                  <button
                    type="button"
                    onClick={() => {
                      callRingtone.unlockAudio();
                      if (remoteStreamRef.current) {
                        void playRemoteStreamSafely(remoteStreamRef.current);
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-[#E6C25A] text-[#0E5C3E] text-xs font-extrabold animate-pulse cursor-pointer"
                  >
                    {isAr ? 'اضغط لتفعيل صوت الصديق' : 'Tap to Enable Audio'}
                  </button>
                )}
              </div>

              {sessionMeta.status === 'active' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-[#E6C25A]/20 border border-[#E6C25A]/50 text-[#E6C25A] text-xs font-bold">
                    {amIReciter
                      ? isAr
                        ? 'دورك: القارئ'
                        : 'Role: Reciter'
                      : isAr
                      ? 'دورك: المستمع'
                      : 'Role: Listener'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void updateActiveSessionFields({
                        reciterSide: (sessionMeta.reciterSide || 'host') === 'host' ? 'guest' : 'host',
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تبديل الأدوار' : 'Swap Roles'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Active Recitation Workspace Controls & Script */}
          {sessionMeta.status === 'active' && (
            <div className="rounded-[24px] bg-[#FFFFFF] border border-[#C5CEBF] p-4 sm:p-5 shadow-sm space-y-4">
              {/* Visibility, Errors & Ayah Navigation Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EAF0E7]">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void updateActiveSessionFields({
                        hideVersesForReciter: !sessionMeta.hideVersesForReciter,
                      })
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${
                      sessionMeta.hideVersesForReciter
                        ? 'bg-[#0E6340] text-white border-[#0E6340]'
                        : 'bg-[#F4F5EE] text-[#161E19] border-[#C5CEBF]'
                    }`}
                  >
                    {sessionMeta.hideVersesForReciter ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                    <span>{isAr ? 'إخفاء عن القارئ' : 'Hide for Reciter'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void updateActiveSessionFields({
                        hideVersesForListener: !sessionMeta.hideVersesForListener,
                      })
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${
                      sessionMeta.hideVersesForListener
                        ? 'bg-[#0E6340] text-white border-[#0E6340]'
                        : 'bg-[#F4F5EE] text-[#161E19] border-[#C5CEBF]'
                    }`}
                  >
                    {sessionMeta.hideVersesForListener ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                    <span>{isAr ? 'إخفاء عن المستمع' : 'Hide for Listener'}</span>
                  </button>

                  {versesHiddenForMe && (
                    <>
                      <button
                        type="button"
                        onClick={() => setLocalRevealCurrentAyah((v) => !v)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FEFCE8] border border-[#CA8A04] text-[#713F12] cursor-pointer"
                      >
                        {localRevealCurrentAyah
                          ? isAr
                            ? 'إعادة الإخفاء'
                            : 'Re-hide'
                          : isAr
                          ? 'كشف الآية الحالية'
                          : 'Peek Current Ayah'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLocalFadeFirstWordOnly((v) => !v)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#EAF0E7] text-[#0E5C3E] cursor-pointer"
                      >
                        {localFadeFirstWordOnly
                          ? isAr
                            ? 'إخفاء كامل'
                            : 'Hide All'
                          : isAr
                          ? 'أول كلمة فقط'
                          : 'First Word Cue'}
                      </button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs font-bold">
                    {isAr
                      ? `التنبيهات: ${sessionMeta.mistakesCount || 0}`
                      : `Alerts: ${sessionMeta.mistakesCount || 0}`}
                  </span>
                  {(sessionMeta.mistakesCount || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        void updateActiveSessionFields({ markedErrors: [], mistakesCount: 0 })
                      }
                      className="p-1.5 rounded-lg bg-[#F4F5EE] hover:bg-[#EAF0E7] text-[#4B5650] cursor-pointer"
                      title={isAr ? 'تصفير التنبيهات' : 'Reset alerts'}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="flex items-center gap-1 bg-[#F4F5EE] rounded-lg px-1.5 py-1">
                    <button
                      type="button"
                      onClick={() => setVerseTextScale((s) => Math.max(0.85, Number((s - 0.1).toFixed(2))))}
                      className="px-1.5 text-xs font-bold text-[#0E5C3E] cursor-pointer"
                    >
                      A-
                    </button>
                    <button
                      type="button"
                      onClick={() => setVerseTextScale((s) => Math.min(1.45, Number((s + 0.1).toFixed(2))))}
                      className="px-1.5 text-xs font-bold text-[#0E5C3E] cursor-pointer"
                    >
                      A+
                    </button>
                  </div>
                </div>
              </div>

              {/* Verses Container */}
              {versesLoading ? (
                <p className="text-center py-8 text-sm text-[#4B5650]">
                  {isAr ? 'جاري تحميل الآيات بالرسم العثماني...' : 'Loading Uthmani verses...'}
                </p>
              ) : versesError ? (
                <div className="p-4 rounded-xl bg-[#FEF2F2] text-[#991B1B] text-xs font-semibold text-center">
                  {versesError}
                </div>
              ) : (
                <div className="space-y-3 max-h-[54vh] overflow-y-auto px-1">
                  {verses.map((v) => {
                    const isCurrent = sessionMeta.activeAyah === v.ayahNumber;
                    const hideThisAyah = versesHiddenForMe && !(isCurrent && localRevealCurrentAyah);
                    const words = v.text.split(/\s+/).filter(Boolean);
                    const marked = Array.isArray(sessionMeta.markedErrors) ? sessionMeta.markedErrors : [];

                    return (
                      <div
                        key={v.verseKey}
                        ref={(el) => {
                          ayahRowRefs.current[v.verseKey] = el;
                        }}
                        onClick={() =>
                          void updateActiveSessionFields({ activeAyah: v.ayahNumber })
                        }
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-[#ECFDF3]/80 border-[#0E6340] shadow-xs'
                            : 'bg-[#FAFBF8] border-[#E2E8DF] hover:border-[#0E6340]/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[11px] font-bold text-[#96701E]">
                            {isAr ? `الآية ${v.ayahNumber}` : `Ayah ${v.ayahNumber}`}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#0E6340] text-white">
                              {isAr ? 'الآية الحالية' : 'Active'}
                            </span>
                          )}
                        </div>

                        {hideThisAyah ? (
                          <div dir="rtl" className="py-2 text-right font-quran text-lg text-[#4B5650]">
                            {localFadeFirstWordOnly && words.length > 0 ? (
                              <>
                                <span className="text-[#0E5C3E] font-bold">{words[0]} </span>
                                <span className="blur-[5px] select-none opacity-40">
                                  {words.slice(1).join(' ')}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs font-sans text-[#6E7A73]">
                                {isAr
                                  ? 'مخفية للتسميع الغيبي — اقرأ من حفظك'
                                  : 'Hidden for memorization — recite from memory'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p
                            dir="rtl"
                            style={{ fontSize: `${Math.round(22 * verseTextScale)}px`, lineHeight: 2.05 }}
                            className="font-quran text-[#161E19] text-right select-text"
                          >
                            {words.map((word, idx) => {
                              const wKey = `${v.surahNumber}:${v.ayahNumber}:${idx}`;
                              const isMarked = marked.includes(wKey);
                              return (
                                <React.Fragment key={wKey}>
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleToggleWordError(wKey);
                                    }}
                                    className={`inline-block px-0.5 rounded transition-colors ${
                                      isMarked
                                        ? 'bg-[#FECACA] text-[#991B1B] underline decoration-[#DC2626]'
                                        : 'hover:bg-[#EAF0E7]'
                                    }`}
                                    title={isAr ? 'اضغط لتحديد أو إلغاء خطأ' : 'Tap to toggle error'}
                                  >
                                    {word}
                                  </span>{' '}
                                </React.Fragment>
                              );
                            })}
                            <span className="text-[#96701E] text-base mx-1">﴿{v.ayahNumber}﴾</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Synced Prev / Next Ayah Controls */}
              {verses.length > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-[#EAF0E7]">
                  <button
                    type="button"
                    onClick={() => {
                      const idx = verses.findIndex((v) => v.ayahNumber === sessionMeta.activeAyah);
                      const prev = idx > 0 ? verses[idx - 1] : verses[0];
                      if (prev) void updateActiveSessionFields({ activeAyah: prev.ayahNumber });
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#EAF0E7] hover:bg-[#D3DCD1] text-[#0E5C3E] text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>{isAr ? 'الآية السابقة' : 'Prev Ayah'}</span>
                  </button>
                  <span className="text-xs font-bold text-[#4B5650]">
                    {isAr
                      ? 'اضغط على أي كلمة لتسجيل ملاحظة تسميع'
                      : 'Tap any word to mark a recitation note'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const idx = verses.findIndex((v) => v.ayahNumber === sessionMeta.activeAyah);
                      const next = idx >= 0 && idx < verses.length - 1 ? verses[idx + 1] : verses[verses.length - 1];
                      if (next) void updateActiveSessionFields({ activeAyah: next.ayahNumber });
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#0E6340] hover:bg-[#0A4D31] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isAr ? 'الآية التالية' : 'Next Ayah'}</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* End Call Evaluation Modal */}
          {showEndEvalModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div className="w-full max-w-sm rounded-[24px] bg-white border border-[#C5CEBF] p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-extrabold font-display-islamic text-[#0E5C3E]">
                    {isAr ? 'تقييم جلسة السرد الثنائي' : 'Rate Duo Session'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowEndEvalModal(false)}
                    className="p-1 rounded-lg hover:bg-[#EAF0E7] text-[#4B5650] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {EVALUATION_CHOICES.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={endingBusy}
                      onClick={() => void finalizeEndCall(opt.id)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold cursor-pointer hover:opacity-90 ${opt.colorClass}`}
                    >
                      {isAr ? opt.labelAr : opt.labelEn}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={endingBusy}
                  onClick={() => void finalizeEndCall(null)}
                  className="w-full py-2.5 rounded-xl bg-[#A84A32] hover:bg-[#8E3B26] text-white text-xs font-bold cursor-pointer"
                >
                  {isAr ? 'إنهاء المكالمة الآن' : 'End Call Now'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 4. LOBBY VIEW (Friends, Invite Links, Curriculum Setup) */
        <div className="space-y-5">
          {/* Lobby Account Header */}
          <div className="rounded-[24px] bg-[#FFFFFF] border border-[#C5CEBF] p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#ECFDF3] border border-[#BBF7D0] flex items-center justify-center text-[#0E6340] font-extrabold">
                {myDisplayName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                {editingDisplayName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={displayNameDraft}
                      onChange={(e) => setDisplayNameDraft(e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-[#0E6340] text-xs font-bold text-[#161E19]"
                    />
                    <button
                      type="button"
                      onClick={handleSaveDisplayName}
                      className="px-2.5 py-1 rounded-lg bg-[#0E6340] text-white text-xs font-bold cursor-pointer"
                    >
                      {isAr ? 'حفظ' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingDisplayName(false)}
                      className="px-2 py-1 rounded-lg bg-[#EAF0E7] text-[#4B5650] text-xs font-bold cursor-pointer"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-extrabold font-display-islamic text-[#0E5C3E]">
                      {myDisplayName}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setDisplayNameDraft(myDisplayName);
                        setEditingDisplayName(true);
                      }}
                      className="text-[11px] text-[#96701E] font-bold underline cursor-pointer"
                    >
                      {isAr ? 'تعديل الاسم' : 'Edit'}
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-[#6E7A73]">
                  {isAr ? 'معرّف المشاركة:' : 'ID:'} {formatFriendShortCode(user.uid)} ·{' '}
                  {isAr ? 'صوت P2P مشفّر' : 'Encrypted P2P Audio'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenPrivacyTerms && (
                <button
                  type="button"
                  onClick={onOpenPrivacyTerms}
                  className="px-3 py-1.5 rounded-xl bg-[#F4F5EE] hover:bg-[#EAF0E7] text-[#0E5C3E] text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isAr ? 'الخصوصية' : 'Privacy'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="px-3 py-1.5 rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#A84A32] text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isAr ? 'خروج' : 'Sign Out'}</span>
              </button>
            </div>
          </div>

          {/* Post-Call Summary Banner */}
          {postCallSummary && (
            <div className="rounded-[20px] bg-[#ECFDF3] border border-[#15803D]/50 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[#14532D] font-extrabold text-sm">
                  <Sparkles className="w-4 h-4 text-[#96701E]" />
                  <span>
                    {isAr
                      ? `ملخص جلسة السرد مع ${postCallSummary.peerName}`
                      : `Session Summary with ${postCallSummary.peerName}`}
                  </span>
                </div>
                <p className="text-xs text-[#166534]">
                  {postCallSummary.surahLabel} · {formatDuration(postCallSummary.durationSeconds)} ·{' '}
                  {isAr
                    ? `الإتقان ${postCallSummary.accuracyPct}%`
                    : `Accuracy ${postCallSummary.accuracyPct}%`}
                  {postCallSummary.evaluation
                    ? ` · ${
                        isAr
                          ? EVALUATION_CHOICES.find((e) => e.id === postCallSummary.evaluation)?.labelAr
                          : EVALUATION_CHOICES.find((e) => e.id === postCallSummary.evaluation)?.labelEn
                      }`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPostCallSummary(null)}
                className="p-1.5 rounded-lg hover:bg-[#DCFCE7] text-[#14532D] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Status / Error Notice */}
          {lobbyNotice && (
            <div
              className={`rounded-2xl p-3.5 text-xs font-bold flex items-center justify-between gap-2 border ${
                lobbyNotice.type === 'error'
                  ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                  : lobbyNotice.type === 'success'
                  ? 'bg-[#ECFDF3] border-[#BBF7D0] text-[#14532D]'
                  : 'bg-[#FEFCE8] border-[#FDE047] text-[#713F12]'
              }`}
            >
              <span>{lobbyNotice.text}</span>
              <button
                type="button"
                onClick={() => setLobbyNotice(null)}
                className="p-1 rounded hover:bg-black/5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Curriculum Selection Card */}
          <div className="rounded-[24px] bg-[#FFFFFF] border border-[#C5CEBF] p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#0E6340]" />
                <h3 className="text-sm sm:text-base font-extrabold text-[#0E5C3E]">
                  {isAr ? 'تحديد المقرر والرواية للاتصال' : 'Session Curriculum & Riwayah'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHighPrivacyMasking((v) => !v)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border cursor-pointer ${
                  highPrivacyMasking
                    ? 'bg-[#0E6340] text-white border-[#0E6340]'
                    : 'bg-[#F4F5EE] text-[#4B5650] border-[#C5CEBF]'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{isAr ? 'حماية عالية للعنوان' : 'Relay Privacy Mode'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-1">
                <label className="block text-[11px] font-bold text-[#4B5650] mb-1">
                  {isAr ? 'الرواية' : 'Riwayah'}
                </label>
                <select
                  value={riwayah}
                  onChange={(e) => setRiwayah(e.target.value as QuranRiwayah)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF] text-xs font-bold text-[#161E19]"
                >
                  {RIWAYAH_OPTIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {isAr ? r.labelAr : r.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-[#4B5650] mb-1">
                  {isAr ? 'نطاق التسميع' : 'Curriculum Mode'}
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#F4F5EE]">
                  {(
                    [
                      { id: 'ayah', ar: 'آيات محددة', en: 'Ayahs' },
                      { id: 'surah', ar: 'سور كاملة', en: 'Surahs' },
                      { id: 'page', ar: 'صفحات المصحف', en: 'Pages' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setCurriculumMode(mode.id)}
                      className={`py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        curriculumMode === mode.id
                          ? 'bg-white text-[#0E5C3E] shadow-xs'
                          : 'text-[#4B5650]'
                      }`}
                    >
                      {isAr ? mode.ar : mode.en}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {curriculumMode === 'ayah' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#4B5650] mb-1">
                    {isAr ? 'السورة' : 'Surah'}
                  </label>
                  <select
                    value={surahNumber}
                    onChange={(e) => {
                      const num = Number(e.target.value);
                      const info = SURAH_LIST.find((s) => s.number === num) || SURAH_LIST[0];
                      setSurahNumber(num);
                      setAyahFrom(1);
                      setAyahTo(info.ayahCount);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF] text-xs font-bold text-[#161E19]"
                  >
                    {SURAH_LIST.map((s) => (
                      <option key={s.number} value={s.number}>
                        {s.number}. {isAr ? s.nameAr : s.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#4B5650] mb-1">
                    {isAr ? 'من آية' : 'From Ayah'}
                  </label>
                  <select
                    value={ayahFrom}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setAyahFrom(val);
                      if (val > ayahTo) setAyahTo(val);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF] text-xs font-bold text-[#161E19] cursor-pointer"
                  >
                    {Array.from({ length: selectedSurahInfo.ayahCount }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>
                        {isAr ? `الآية ${num}` : `Ayah ${num}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#4B5650] mb-1">
                    {isAr ? 'إلى آية' : 'To Ayah'}
                  </label>
                  <select
                    value={ayahTo}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setAyahTo(val);
                      if (val < ayahFrom) setAyahFrom(val);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF] text-xs font-bold text-[#161E19] cursor-pointer"
                  >
                    {Array.from({ length: selectedSurahInfo.ayahCount }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>
                        {isAr ? `الآية ${num}` : `Ayah ${num}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {curriculumMode === 'surah' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#4B5650] mb-1">
                    {isAr ? 'من سورة' : 'From Surah'}
                  </label>
                  <select
                    value={surahNumber}
                    onChange={(e) => setSurahNumber(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF] text-xs font-bold text-[#161E19]"
                  >
                    {SURAH_LIST.map((s) => (
                      <option key={s.number} value={s.number}>
                        {s.number}. {isAr ? s.nameAr : s.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#4B5650] mb-1">
                    {isAr ? 'إلى سورة' : 'To Surah'}
                  </label>
                  <select
                    value={surahEnd}
                    onChange={(e) => setSurahEnd(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF] text-xs font-bold text-[#161E19]"
                  >
                    {SURAH_LIST.filter((s) => s.number >= surahNumber && s.number <= surahNumber + 4).map((s) => (
                      <option key={s.number} value={s.number}>
                        {s.number}. {isAr ? s.nameAr : s.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {curriculumMode === 'page' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#4B5650] mb-1">
                    {isAr ? 'من صفحة' : 'From Page'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={604}
                    value={pageFrom}
                    onChange={(e) => {
                      const p = Math.max(1, Math.min(604, Number(e.target.value) || 1));
                      setPageFrom(p);
                      if (pageTo < p) setPageTo(p);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF] text-xs font-bold text-[#161E19]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#4B5650] mb-1">
                    {isAr ? 'إلى صفحة' : 'To Page'}
                  </label>
                  <input
                    type="number"
                    min={pageFrom}
                    max={Math.min(604, pageFrom + 9)}
                    value={pageTo}
                    onChange={(e) =>
                      setPageTo(Math.max(pageFrom, Math.min(604, pageFrom + 9, Number(e.target.value) || pageFrom)))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF] text-xs font-bold text-[#161E19]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Friends List & Direct Calling */}
          <div className="rounded-[24px] bg-[#FFFFFF] border border-[#C5CEBF] p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#0E6340]" />
                <h3 className="text-sm sm:text-base font-extrabold text-[#0E5C3E]">
                  {isAr ? `الأصدقاء المعتمدون (${friends.length})` : `Approved Friends (${friends.length})`}
                </h3>
              </div>
            </div>

            {friends.length === 0 ? (
              <div className="p-5 rounded-2xl bg-[#F4F5EE] text-center space-y-1.5">
                <p className="text-xs sm:text-sm font-bold text-[#161E19]">
                  {isAr ? 'لا يوجد أصدقاء بعد' : 'No friends added yet'}
                </p>
                <p className="text-xs text-[#6E7A73]">
                  {isAr
                    ? 'شارك رابط دعوتك الشخصي أدناه أو الصق رابط دعوة صديقك للبدء.'
                    : 'Share your personal invite link below or paste a friend’s link to connect.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {friends.map((friend) => {
                  const lastSeen = presenceMap[friend.friendUid] || 0;
                  const isOnline = lastSeen > 0 && Date.now() - lastSeen < 90_000;
                  const isConfirmingRemove = confirmRemoveFriendUid === friend.friendUid;

                  return (
                    <div
                      key={friend.friendUid}
                      className="p-3.5 rounded-2xl bg-[#FAFBF8] border border-[#D3DCD1] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              isOnline ? 'bg-[#16A34A]' : 'bg-[#9CA3AF]'
                            }`}
                          />
                          <p className="text-sm font-extrabold text-[#161E19] truncate">
                            {friend.friendName}
                          </p>
                        </div>
                        <p className="text-[11px] text-[#6E7A73] mt-0.5">
                          {isOnline
                            ? isAr
                              ? 'متصل الآن'
                              : 'Online now'
                            : isAr
                            ? 'متاح عند فتح التطبيق'
                            : 'Available when open'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => void startFriendAudioCall(friend)}
                          className="px-3.5 py-2 rounded-xl bg-[#0E6340] hover:bg-[#0A4D31] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>{isAr ? 'اتصال' : 'Call'}</span>
                        </button>

                        {isConfirmingRemove ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                setConfirmRemoveFriendUid(null);
                                await removeFriendWithCleanup(user, friend.friendUid);
                              }}
                              className="px-2 py-1.5 rounded-lg bg-[#A84A32] text-white text-[11px] font-bold cursor-pointer"
                            >
                              {isAr ? 'حذف' : 'Yes'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveFriendUid(null)}
                              className="px-2 py-1.5 rounded-lg bg-[#EAF0E7] text-[#4B5650] text-[11px] font-bold cursor-pointer"
                            >
                              {isAr ? 'لا' : 'No'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveFriendUid(friend.friendUid)}
                            className="p-2 rounded-xl text-[#6E7A73] hover:text-[#A84A32] hover:bg-[#FEF2F2] cursor-pointer"
                            title={isAr ? 'إزالة الصديق' : 'Remove friend'}
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

            {/* Incoming Friend Requests */}
            {incomingRequests.length > 0 && (
              <div className="pt-3 border-t border-[#EAF0E7] space-y-2">
                <h4 className="text-xs font-extrabold text-[#96701E]">
                  {isAr ? 'طلبات صداقة بانتظار موافقتك' : 'Pending Friend Requests'}
                </h4>
                {incomingRequests.map((req) => (
                  <div
                    key={req.requestId}
                    className="p-3 rounded-xl bg-[#FEFCE8] border border-[#DEC994] flex items-center justify-between gap-2"
                  >
                    <span className="text-xs font-bold text-[#161E19]">{req.fromName}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void declineIncomingFriendRequest(req)}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-[#D3DCD1] text-[#A84A32] text-xs font-bold cursor-pointer flex items-center gap-1"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>{isAr ? 'رفض' : 'Decline'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void approveIncomingFriendRequest(user, req)}
                        className="px-3 py-1.5 rounded-lg bg-[#0E6340] text-white text-xs font-bold cursor-pointer flex items-center gap-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{isAr ? 'موافقة' : 'Approve'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Outgoing Pending Requests */}
            {outgoingRequests.length > 0 && (
              <div className="pt-2 space-y-1.5">
                {outgoingRequests.map((req) => (
                  <p key={req.requestId} className="text-[11px] font-semibold text-[#6E7A73]">
                    {isAr
                      ? `• بانتظار موافقة «${req.toName}» على طلب الصداقة.`
                      : `• Waiting for "${req.toName}" to approve your request.`}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Share Invite Link & Add Friend Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* My Shareable Invite */}
            <div className="rounded-[24px] bg-[#FFFFFF] border border-[#C5CEBF] p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#96701E]" />
                <h3 className="text-sm font-extrabold text-[#0E5C3E]">
                  {isAr ? 'رابط دعوتك الشخصي' : 'Your Personal Invite Link'}
                </h3>
              </div>
              <p className="text-xs text-[#4B5650]">
                {isAr
                  ? 'أرسل هذا الرابط لصديقك — لن يُضاف إلا بعد موافقتك الصريحة.'
                  : 'Send this link to a friend — approval is required before calling.'}
              </p>
              <div className="p-2.5 rounded-xl bg-[#F4F5EE] border border-[#D3DCD1] text-[11px] font-mono text-[#161E19] truncate">
                {myInviteUrl || '...'}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="px-3 py-2 rounded-xl bg-[#0E6340] hover:bg-[#0A4D31] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {inviteCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{inviteCopied ? (isAr ? 'تم النسخ' : 'Copied') : isAr ? 'نسخ الرابط' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareInviteLink}
                  className="px-3 py-2 rounded-xl bg-[#EAF0E7] hover:bg-[#D3DCD1] text-[#0E5C3E] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isAr ? 'مشاركة' : 'Share'}</span>
                </button>
                <button
                  type="button"
                  disabled={inviteBusy}
                  onClick={handleRegenerateInvite}
                  className="px-3 py-2 rounded-xl bg-[#FEFCE8] border border-[#DEC994] text-[#8A6518] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${inviteBusy ? 'animate-spin' : ''}`} />
                  <span>{isAr ? 'تجديد الرابط' : 'Reset'}</span>
                </button>
              </div>
            </div>

            {/* Paste Friend Invite Link */}
            <div className="rounded-[24px] bg-[#FFFFFF] border border-[#C5CEBF] p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#0E6340]" />
                <h3 className="text-sm font-extrabold text-[#0E5C3E]">
                  {isAr ? 'إضافة صديق عبر الرابط' : 'Add Friend by Invite Link'}
                </h3>
              </div>
              <form onSubmit={handleLookupFriendInvite} className="flex gap-2">
                <input
                  type="text"
                  value={pasteInviteInput}
                  onChange={(e) => setPasteInviteInput(e.target.value)}
                  placeholder={isAr ? 'الصق رابط دعوة الصديق هنا...' : 'Paste friend invite link or code...'}
                  className="flex-1 px-3 py-2 rounded-xl bg-[#F4F5EE] border border-[#C5CEBF] text-xs text-[#161E19] focus:outline-none focus:border-[#0E6340]"
                />
                <button
                  type="submit"
                  disabled={lookupBusy || !pasteInviteInput.trim()}
                  className="px-3.5 py-2 rounded-xl bg-[#96701E] hover:bg-[#7A5A16] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {isAr ? 'تحقق' : 'Check'}
                </button>
              </form>

              {lookupInviteResult && (
                <div className="p-3 rounded-xl bg-[#ECFDF3] border border-[#BBF7D0] flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#14532D]">
                    {isAr
                      ? `إرسال طلب صداقة إلى «${lookupInviteResult.ownerName}»؟`
                      : `Send friend request to "${lookupInviteResult.ownerName}"?`}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLookupInviteResult(null)}
                      className="px-2.5 py-1 rounded-lg bg-white text-[#4B5650] text-xs font-bold cursor-pointer"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      disabled={lookupBusy}
                      onClick={handleSendLookupRequest}
                      className="px-3 py-1 rounded-lg bg-[#0E6340] text-white text-xs font-bold cursor-pointer"
                    >
                      {isAr ? 'إرسال' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
