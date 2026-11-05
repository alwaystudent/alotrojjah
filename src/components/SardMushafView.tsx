import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Mic,
  MicOff,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  CheckCircle2,
  BookOpen,
  Sparkles,
  AlertCircle,
  X,
  Repeat,
  HelpCircle,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  Language,
  QuranPlanItem,
  PlanEvaluation,
  QuizLevel,
  SURAH_LIST,
  JUZ_LIST,
  getPlanMushafPageRange,
  getPlanMushafPages,
  formatCurriculumTitle,
  getPlanTypeLabel,
} from '@/src/data/quranData';
import { t } from '@/src/data/translations';

export interface MushafWordItem {
  globalIndex: number;
  surahNumber: number;
  surahNameAr: string;
  ayahNumber: number;
  ayahGroupIndex: number;
  wordPosition: number;
  textUthmani: string;
  normalizedText: string;
  normalizedWithDagger: string;
  skeletonText: string;
  phoneticSkeleton: string;
  syllableWeight: number;
  isFirstWordInAyah: boolean;
  isLastWordInAyah: boolean;
}

export interface MushafAyahGroup {
  groupIndex: number;
  surahNumber: number;
  surahNameAr: string;
  ayahNumber: number;
  isFirstAyahOfSurah: boolean;
  words: MushafWordItem[];
}

export type ReviewQuizFormat = 'word_completion' | 'ayah_connection' | 'verse_endings';

interface SardMushafViewProps {
  lang: Language;
  plan: QuranPlanItem;
  defaultSyncSpeed?: number;
  defaultTargetReps?: number;
  defaultQuizLevel?: QuizLevel;
  focusModeEnabled?: boolean;
  onToggleFocusMode?: () => void;
  onClose: () => void;
  onCompletePlanSard: (
    planId: string,
    mistakesCount: number,
    evaluation?: PlanEvaluation,
    quizLevel?: QuizLevel,
    markAsCompleted?: boolean
  ) => void;
}

function toArabicNumerals(n: number): string {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

const UTHMANI_WORD_MAP: Record<string, string> = {
  الرحمن: 'الرحمن',
  الصلوه: 'الصلاه',
  صلوه: 'صلاه',
  الزكوه: 'الزكاه',
  زكوه: 'زكاه',
  الحيوه: 'الحياه',
  حيوه: 'حياه',
  الغدوه: 'الغداه',
  مشكوه: 'مشكاه',
  نجوه: 'نجاه',
  منوه: 'مناه',
  الربوا: 'الربا',
  العلمين: 'العالمين',
  السموت: 'السماوات',
  سموت: 'سماوات',
  الصلحت: 'الصالحات',
  صلحت: 'صالحات',
  ذلك: 'ذالك',
  ذالك: 'ذالك',
  هؤلاء: 'هاؤلاء',
  هاؤلاء: 'هاؤلاء',
  اولئك: 'اولءك',
  اولاءك: 'اولءك',
  اولءك: 'اولءك',
  اله: 'الاه',
  اللهم: 'اللهم',
  ابرهم: 'ابراهيم',
  ابرهيم: 'ابراهيم',
  اسمعيل: 'اسماعيل',
  اسحق: 'اسحاق',
  هرون: 'هارون',
  سليمن: 'سليمان',
  لقمن: 'لقمان',
  قرءان: 'قران',
  القرءان: 'القران',
  سبحن: 'سبحان',
  سلطن: 'سلطان',
  شيطن: 'شيطان',
  الشيطن: 'الشيطان',
  الانسن: 'الانسان',
  انسن: 'انسان',
};

// Map Quranic Muqatta'at (disjoined letters at the start of Surahs) to their spoken letter names
const MUQATTAAT_SPOKEN_FORMS: Record<string, string[]> = {
  الم: ['الم', 'الفلامميم', 'الف', 'لام', 'ميم'],
  المص: ['المص', 'الفلامميمصاد', 'الف', 'صاد'],
  الر: ['الر', 'الفلامرا', 'الف', 'را', 'راء'],
  المر: ['المر', 'الفلامميمرا', 'الف', 'را', 'راء'],
  كهيعص: ['كهيعص', 'كافهاياينصاد', 'كاف', 'صاد'],
  طه: ['طه', 'طاها', 'طا', 'ها'],
  طسم: ['طسم', 'طاسينميم', 'طا', 'سين', 'ميم'],
  طس: ['طس', 'طاسين', 'طا', 'سين'],
  يس: ['يس', 'ياسين', 'يا', 'سين'],
  ص: ['ص', 'صاد'],
  حم: ['حم', 'حاميم', 'حا', 'ميم'],
  عسق: ['عسق', 'عينسينقاف', 'عين', 'سين', 'قاف'],
  ق: ['ق', 'قاف'],
  ن: ['ن', 'نون'],
};

// Pre-compiled regular expressions & bounded O(1) caches to prevent main-thread regex/GC overhead during live recitation
const RE_TATWEEL_HAMZA = /\u0640[\u0654\u0655]/g;
const RE_WAW_DAGGER = /\u0648\u0670/g;
const RE_YA_DAGGER = /[\u0649\u064A]\u0670/g;
const RE_DAGGER_ALIF = /\u0670/g;
const RE_SMALL_YA = /[\u06E6\u06E7]/g;
const RE_SMALL_WAW = /\u06E5/g;
const RE_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08F0-\u08FF]/g;
const RE_ALIF_VARIANTS = /[\u0622\u0623\u0625\u0671\u0672\u0673\u0675]/g;
const RE_YA_VARIANTS = /[\u0649\u06CC]/g;
const RE_TA_MARBUTA = /\u0629/g;
const RE_HAMZA_CARRIERS = /[\u0624\u0626]/g;
const RE_NON_ARABIC = /[^\u0621-\u064A]/g;
const RE_HAMZA_ALIF = /ءا/g;
const RE_MULTI_ALIF = /ا+/g;
const RE_MULTI_YA = /ي+/g;
const RE_MULTI_WAW = /و+/g;
const RE_SKELETON_STRIP = /[اويءه]/g;

const NORM_CACHE = new Map<string, string>();
const SKELETON_CACHE = new Map<string, string>();
const PHONETIC_CACHE = new Map<string, string>();
const MEMORY_PAGE_CACHE = new Map<
  number,
  { surahNumber: number; ayahNumber: number; textUthmani: string; juz?: number }[]
>();

export function normalizeArabicForAlignment(raw: string, expandDaggerAlif = false): string {
  if (!raw) return '';
  const cacheKey = expandDaggerAlif ? `1:${raw}` : `0:${raw}`;
  const cached = NORM_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;

  let s = raw.replace(RE_TATWEEL_HAMZA, 'ا');

  if (expandDaggerAlif) {
    s = s
      .replace(RE_WAW_DAGGER, 'ا')
      .replace(RE_YA_DAGGER, 'ي')
      .replace(RE_DAGGER_ALIF, 'ا')
      .replace(RE_SMALL_YA, 'ي')
      .replace(RE_SMALL_WAW, 'و');
  }

  s = s
    .replace(RE_DIACRITICS, '')
    .replace(RE_ALIF_VARIANTS, 'ا')
    .replace(RE_YA_VARIANTS, 'ي')
    .replace(RE_TA_MARBUTA, 'ه')
    .replace(RE_HAMZA_CARRIERS, 'ء')
    .replace(RE_NON_ARABIC, '');

  s = s
    .replace(RE_HAMZA_ALIF, 'ا')
    .replace(RE_MULTI_ALIF, 'ا')
    .replace(RE_MULTI_YA, 'ي')
    .replace(RE_MULTI_WAW, 'و');

  if (UTHMANI_WORD_MAP[s]) {
    s = UTHMANI_WORD_MAP[s];
  }

  const res = s.trim();
  if (NORM_CACHE.size > 4000) NORM_CACHE.clear();
  NORM_CACHE.set(cacheKey, res);
  return res;
}

function getConsonantalSkeleton(norm: string): string {
  const cached = SKELETON_CACHE.get(norm);
  if (cached !== undefined) return cached;
  const res = norm.replace(RE_SKELETON_STRIP, '');
  if (SKELETON_CACHE.size > 4000) SKELETON_CACHE.clear();
  SKELETON_CACHE.set(norm, res);
  return res;
}

function getPhoneticSkeleton(norm: string): string {
  const cached = PHONETIC_CACHE.get(norm);
  if (cached !== undefined) return cached;
  const res = norm
    .replace(/ء/g, 'ا')
    .replace(/ص/g, 'س')
    .replace(/ض/g, 'ذ')
    .replace(/ظ/g, 'ذ')
    .replace(/ط/g, 'ت')
    .replace(/ق/g, 'ك')
    .replace(RE_SKELETON_STRIP, '');
  if (PHONETIC_CACHE.size > 4000) PHONETIC_CACHE.clear();
  PHONETIC_CACHE.set(norm, res);
  return res;
}

// Compute realistic acoustic syllable weight of a Quranic word (letters + Madd elongations)
function computeWordSyllableWeight(textUthmani: string, norm: string): number {
  const baseLetters = Math.max(2, norm.length);
  const maddCount = (textUthmani.match(/[\u0653\u0670\u0622\u06E4]/g) || []).length;
  const longVowels = (norm.match(/[اوي]/g) || []).length;
  const shaddahCount = (textUthmani.match(/\u0651/g) || []).length;
  return Math.max(
    2.2,
    Math.min(9.5, baseLetters * 0.68 + maddCount * 1.15 + longVowels * 0.4 + shaddahCount * 0.45)
  );
}

function singleFormMatchScore(
  spokenNorm: string,
  targetNorm: string,
  targetSkeleton: string,
  targetPhonetic: string
): number {
  if (!spokenNorm || !targetNorm) return 0;
  if (spokenNorm === targetNorm) return 1.0;

  // Check if target is a Muqatta'at word (e.g. الم, كهيعص, طه, يس, حم, ص, ق, ن)
  const muqattaatForms = MUQATTAAT_SPOKEN_FORMS[targetNorm];
  if (muqattaatForms && muqattaatForms.includes(spokenNorm)) {
    return 0.98;
  }

  // Handle verb plural silent alif differences (e.g. قالوا vs قالو, امنوا vs امنو)
  if (
    spokenNorm.replace(/وا$/, 'و') === targetNorm.replace(/وا$/, 'و') &&
    targetNorm.length >= 3
  ) {
    return 0.97;
  }

  // Handle final yaa / kasrah in short roots (e.g. رب vs ربي)
  if (
    spokenNorm.replace(/ي$/, '') === targetNorm.replace(/ي$/, '') &&
    Math.max(spokenNorm.length, targetNorm.length) <= 4
  ) {
    return 0.95;
  }

  const spokenSkeleton = getConsonantalSkeleton(spokenNorm);
  if (
    spokenSkeleton.length >= 2 &&
    targetSkeleton.length >= 2 &&
    spokenSkeleton === targetSkeleton &&
    Math.abs(spokenNorm.length - targetNorm.length) <= 2
  ) {
    return 0.94;
  }

  const spokenPhonetic = getPhoneticSkeleton(spokenNorm);
  if (
    spokenPhonetic.length >= 2 &&
    targetPhonetic.length >= 2 &&
    spokenPhonetic === targetPhonetic &&
    Math.abs(spokenNorm.length - targetNorm.length) <= 2
  ) {
    return 0.89;
  }

  const minLen = Math.min(spokenNorm.length, targetNorm.length);
  const maxLen = Math.max(spokenNorm.length, targetNorm.length);
  if (maxLen === 0) return 0;

  // Allow substring containment if shorter word >= 3 letters and >= 72% of longer word
  if (
    minLen >= 3 &&
    minLen / maxLen >= 0.72 &&
    (spokenNorm.includes(targetNorm) || targetNorm.includes(spokenNorm))
  ) {
    return 0.86;
  }

  // Edit distance / character overlap for inflected Quranic words
  if (minLen >= 3 && Math.abs(spokenNorm.length - targetNorm.length) <= 2) {
    let matches = 0;
    for (let i = 0; i < minLen; i++) {
      if (spokenNorm[i] === targetNorm[i]) matches++;
    }
    const ratio = matches / maxLen;
    if (ratio >= 0.75) return ratio;
  }

  return 0;
}

// Match spoken Arabic word against both Uthmani (no-dagger) and Imla'i (with-dagger) forms of the Mushaf word
export function scoreSpokenAgainstMushafWord(spokenNorm: string, word: MushafWordItem): number {
  if (!spokenNorm || !word) return 0;
  const s1 = singleFormMatchScore(
    spokenNorm,
    word.normalizedText,
    word.skeletonText,
    word.phoneticSkeleton
  );
  if (s1 >= 0.95) return s1;
  const s2 = singleFormMatchScore(
    spokenNorm,
    word.normalizedWithDagger,
    word.skeletonText,
    word.phoneticSkeleton
  );
  return Math.max(s1, s2);
}

// Determine whether a word should be hidden in Review Mode according to the 4 levels (مبتدئ / متوسط / متقدم / حافظ)
function isWordHiddenForQuizLevel(
  word: MushafWordItem,
  level: QuizLevel,
  format: ReviewQuizFormat
): boolean {
  if (format === 'verse_endings') {
    if (level === 'beginner') return word.isLastWordInAyah;
    if (level === 'intermediate') return word.isLastWordInAyah || word.wordPosition === 2;
    if (level === 'advanced') return word.isLastWordInAyah || word.globalIndex % 2 === 1;
    return !word.isFirstWordInAyah;
  }

  if (format === 'ayah_connection') {
    if (level === 'beginner') {
      return word.ayahGroupIndex % 4 === 1 && !word.isFirstWordInAyah;
    }
    if (level === 'intermediate') {
      return word.ayahGroupIndex % 3 !== 0 && !word.isFirstWordInAyah;
    }
    if (level === 'advanced') {
      return word.ayahGroupIndex % 2 === 1;
    }
    return !(word.ayahGroupIndex % 4 === 0 && word.isFirstWordInAyah);
  }

  // Default format: 'word_completion'
  if (level === 'beginner') {
    return word.globalIndex % 5 === 2;
  }
  if (level === 'intermediate') {
    return word.globalIndex % 3 === 1;
  }
  if (level === 'advanced') {
    // 50% hidden ("اخف 50% لمستوى المتقدم")
    return word.globalIndex % 2 === 1;
  }
  // 'hafiz': Hide ~88% of words ("واخف اغلب الايات لمستوى الحافظ")
  return !(word.isFirstWordInAyah && word.ayahGroupIndex % 2 === 0);
}

const FALLBACK_PAGE_1_AYAHS: { surahNumber: number; ayahNumber: number; text: string }[] = [
  { surahNumber: 1, ayahNumber: 1, text: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ' },
  { surahNumber: 1, ayahNumber: 2, text: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ' },
  { surahNumber: 1, ayahNumber: 3, text: 'ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ' },
  { surahNumber: 1, ayahNumber: 4, text: 'مَـٰلِكِ يَوْمِ ٱلدِّينِ' },
  { surahNumber: 1, ayahNumber: 5, text: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ' },
  { surahNumber: 1, ayahNumber: 6, text: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ' },
  {
    surahNumber: 1,
    ayahNumber: 7,
    text: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
  },
];

export const SardMushafView: React.FC<SardMushafViewProps> = ({
  lang,
  plan,
  defaultSyncSpeed = 1.0,
  defaultTargetReps = 5,
  defaultQuizLevel = 'intermediate',
  focusModeEnabled = false,
  onToggleFocusMode,
  onClose,
  onCompletePlanSard,
}) => {
  const dict = t(lang);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(focusModeEnabled);

  useEffect(() => {
    if (focusModeEnabled !== undefined) {
      setIsFocusMode(focusModeEnabled);
    }
  }, [focusModeEnabled]);

  const handleToggleFocus = useCallback(() => {
    setIsFocusMode((prev) => !prev);
    if (onToggleFocusMode) {
      onToggleFocusMode();
    }
  }, [onToggleFocusMode]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false);
        if (onToggleFocusMode) {
          onToggleFocusMode();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFocusMode, onToggleFocusMode]);

  const initialRange = useMemo(() => getPlanMushafPageRange(plan), [plan]);
  const orderedPlanPages = useMemo(() => getPlanMushafPages(plan), [plan]);

  const [actualPageRange, setActualPageRange] = useState<{ startPage: number; endPage: number }>(
    initialRange
  );
  const [currentPage, setCurrentPage] = useState<number>(orderedPlanPages[0] || initialRange.startPage);
  const totalPlanPages = Math.max(1, orderedPlanPages.length);
  const currentPageIndex = orderedPlanPages.indexOf(currentPage);
  const currentPlanPageOrder = Math.max(1, currentPageIndex >= 0 ? currentPageIndex + 1 : 1);

  const hasNextPage = currentPageIndex >= 0 && currentPageIndex < orderedPlanPages.length - 1;
  const nextMushafPage = hasNextPage ? orderedPlanPages[currentPageIndex + 1] : null;

  const hasPrevPage = currentPageIndex > 0;
  const prevMushafPage = hasPrevPage ? orderedPlanPages[currentPageIndex - 1] : null;

  const [ayahGroups, setAyahGroups] = useState<MushafAyahGroup[]>([]);
  const [flatWords, setFlatWords] = useState<MushafWordItem[]>([]);
  const [loadingPage, setLoadingPage] = useState<boolean>(true);
  const [pageJuz, setPageJuz] = useState<number>(1);
  const [selectedEvaluation, setSelectedEvaluation] = useState<PlanEvaluation | undefined>(
    plan.evaluation || 'muthabbat'
  );
  const [showExtraControls, setShowExtraControls] = useState<boolean>(false);
  const [showFinishConfirmDialog, setShowFinishConfirmDialog] = useState<boolean>(false);

  // ============================================================================
  // MODE 1: SARD (`plan.planType === 'sard'`) — Strict Real-Time Speech-to-Verse Matching
  // ============================================================================
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0);
  const [sardStarted, setSardStarted] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceActive, setVoiceActive] = useState<boolean>(false);
  const [mistakeIndices, setMistakeIndices] = useState<number[]>([]);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [syncSpeedFactor, setSyncSpeedFactor] = useState<number>(defaultSyncSpeed);
  const [lastMatchedSpoken, setLastMatchedSpoken] = useState<string>('');
  const [lastMismatchSpoken, setLastMismatchSpoken] = useState<string>('');
  const [revealAllPreview, setRevealAllPreview] = useState<boolean>(false);

  // ============================================================================
  // MODE 2: NEW MEMORIZATION (`plan.planType === 'new_memorization'`) — Repetition
  // ============================================================================
  const [targetReps, setTargetReps] = useState<number>(defaultTargetReps);
  const [activeAyahIdx, setActiveAyahIdx] = useState<number>(0);
  const [currentAyahRepCount, setCurrentAyahRepCount] = useState<number>(0);
  const [ayahWordOffset, setAyahWordOffset] = useState<number>(0);

  // ============================================================================
  // MODE 3: REVIEW (`plan.planType === 'review'`) — Multi-Level & Varied Quizzes
  // ============================================================================
  const [quizLevel, setQuizLevel] = useState<QuizLevel>(plan.quizLevel || defaultQuizLevel);
  const [quizFormat, setQuizFormat] = useState<ReviewQuizFormat>('word_completion');
  const [quizStarted] = useState<boolean>(true);
  const [currentQuizStep, setCurrentQuizStep] = useState<number>(0);
  const [solvedQuizIndices, setSolvedQuizIndices] = useState<number[]>([]);
  const [wrongQuizAttempts, setWrongQuizAttempts] = useState<number>(0);
  const [wrongChoiceFlash, setWrongChoiceFlash] = useState<string | null>(null);

  // Refs for continuous, strict on-device speech & vocal formant alignment across all 3 plan types
  const recognitionRef = useRef<any>(null);
  const recognitionRestartTimerRef = useRef<any>(null);
  const voiceActivityTimeoutRef = useRef<any>(null);
  const voiceActiveRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const dspIntervalRef = useRef<any>(null);
  const noiseFloorRef = useRef<number>(0.008);
  const accumulatedVoiceUnitsRef = useRef<number>(0);
  const prevVoicedEnergyRef = useRef<number>(0);
  const isListeningRef = useRef<boolean>(false);
  const asrConsecutiveFailuresRef = useRef<number>(0);
  const asrDisabledForSessionRef = useRef<boolean>(false);
  const lastAsrStartTimestampRef = useRef<number>(0);
  const lastScrollTimeRef = useRef<number>(0);
  const flatWordsRef = useRef<MushafWordItem[]>([]);
  const ayahGroupsRef = useRef<MushafAyahGroup[]>([]);
  const currentIndexRef = useRef<number>(0);
  const lastWordAdvanceTimeRef = useRef<number>(0);
  const lastAsrAdvanceTimeRef = useRef<number>(0);
  const lastVoiceDetectedTimeRef = useRef<number>(0);
  const syncSpeedFactorRef = useRef<number>(defaultSyncSpeed);
  const processedResultIndexRef = useRef<number>(0);
  const processedTokenCountRef = useRef<number>(0);
  const lastConsumedTokenNormRef = useRef<string>('');
  const activeWordDomRef = useRef<HTMLSpanElement | null>(null);
  const mushafScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const handleSpeechResultRef = useRef<((event: any) => void) | null>(null);

  // Refs for Repetition & Review modes inside on-device speech & DSP callbacks
  const activeAyahIdxRef = useRef<number>(0);
  const ayahWordOffsetRef = useRef<number>(0);
  const currentAyahRepCountRef = useRef<number>(0);
  const targetRepsRef = useRef<number>(defaultTargetReps);
  const currentQuizStepRef = useRef<number>(0);
  const quizQuestionsRef = useRef<
    { wordIndex: number; targetWord: MushafWordItem; choices: string[] }[]
  >([]);

  useEffect(() => {
    flatWordsRef.current = flatWords;
  }, [flatWords]);

  useEffect(() => {
    ayahGroupsRef.current = ayahGroups;
  }, [ayahGroups]);

  useEffect(() => {
    syncSpeedFactorRef.current = syncSpeedFactor;
  }, [syncSpeedFactor]);

  useEffect(() => {
    activeAyahIdxRef.current = activeAyahIdx;
  }, [activeAyahIdx]);

  useEffect(() => {
    ayahWordOffsetRef.current = ayahWordOffset;
  }, [ayahWordOffset]);

  useEffect(() => {
    currentAyahRepCountRef.current = currentAyahRepCount;
  }, [currentAyahRepCount]);

  useEffect(() => {
    targetRepsRef.current = targetReps;
  }, [targetReps]);

  useEffect(() => {
    currentQuizStepRef.current = currentQuizStep;
  }, [currentQuizStep]);

  // High-performance smart scroll: only scrolls when the active word nears the top/bottom edge of the container, throttled to prevent layout thrashing
  useEffect(() => {
    currentIndexRef.current = currentWordIndex;
    const wordEl = activeWordDomRef.current;
    const containerEl = mushafScrollContainerRef.current;
    if (!wordEl || !containerEl) return;

    const now = Date.now();
    if (now - lastScrollTimeRef.current < 420) return;

    const wordRect = wordEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    const topThreshold = containerRect.top + containerRect.height * 0.16;
    const bottomThreshold = containerRect.bottom - containerRect.height * 0.2;

    if (wordRect.top < topThreshold || wordRect.bottom > bottomThreshold) {
      lastScrollTimeRef.current = now;
      const offsetWithinContainer =
        wordRect.top - containerRect.top + containerEl.scrollTop - containerRect.height * 0.35;
      containerEl.scrollTo({
        top: Math.max(0, offsetWithinContainer),
        behavior: 'smooth',
      });
    }
  }, [currentWordIndex, ayahWordOffset, currentQuizStep]);

  // Resolve exact Madinah Mushaf startPage and endPage when plan.scope === 'ayah' (with local browser cache)
  useEffect(() => {
    let cancelled = false;
    const baseRange = getPlanMushafPageRange(plan);
    setActualPageRange(baseRange);
    setCurrentPage(baseRange.startPage);

    if (plan.scope === 'ayah' && plan.ayahSurah) {
      const surahObj = SURAH_LIST.find((s) => s.number === plan.ayahSurah);
      const maxA = surahObj ? surahObj.ayahCount : 286;
      const a1 = Math.max(1, Math.min(plan.ayahFrom || 1, plan.ayahTo || 1, maxA));
      const a2 = Math.min(maxA, Math.max(plan.ayahFrom || 1, plan.ayahTo || 1, 1));
      const rangeCacheKey = `al_utrujjah_ayah_range_v1_${plan.ayahSurah}_${a1}_${a2}`;

      const resolveExactAyahPages = async () => {
        try {
          const cachedRange = localStorage.getItem(rangeCacheKey);
          if (cachedRange) {
            const parsed = JSON.parse(cachedRange);
            if (!cancelled && parsed?.startPage >= 1 && parsed?.endPage >= 1) {
              setActualPageRange({ startPage: parsed.startPage, endPage: parsed.endPage });
              setCurrentPage(parsed.startPage);
              return;
            }
          }
        } catch {
          // Ignore storage read error
        }

        try {
          const [res1, res2] = await Promise.all([
            fetch(
              `https://api.quran.com/api/v4/verses/by_key/${plan.ayahSurah}:${a1}?fields=page_number`
            ),
            fetch(
              `https://api.quran.com/api/v4/verses/by_key/${plan.ayahSurah}:${a2}?fields=page_number`
            ),
          ]);
          if (res1.ok && res2.ok) {
            const [d1, d2] = await Promise.all([res1.json(), res2.json()]);
            const p1 = Number(d1?.verse?.page_number);
            const p2 = Number(d2?.verse?.page_number);
            if (!cancelled && p1 >= 1 && p2 >= 1) {
              const exactStart = Math.min(p1, p2);
              const exactEnd = Math.max(p1, p2);
              try {
                localStorage.setItem(
                  rangeCacheKey,
                  JSON.stringify({ startPage: exactStart, endPage: exactEnd })
                );
              } catch {
                // Ignore quota error
              }
              setActualPageRange({ startPage: exactStart, endPage: exactEnd });
              setCurrentPage(exactStart);
              return;
            }
          }
        } catch {
          // Fallback to AlQuran.cloud
        }

        try {
          const [r1, r2] = await Promise.all([
            fetch(`https://api.alquran.cloud/v1/ayah/${plan.ayahSurah}:${a1}`),
            fetch(`https://api.alquran.cloud/v1/ayah/${plan.ayahSurah}:${a2}`),
          ]);
          if (r1.ok && r2.ok) {
            const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
            const p1 = Number(j1?.data?.page);
            const p2 = Number(j2?.data?.page);
            if (!cancelled && p1 >= 1 && p2 >= 1) {
              const exactStart = Math.min(p1, p2);
              const exactEnd = Math.max(p1, p2);
              try {
                localStorage.setItem(
                  rangeCacheKey,
                  JSON.stringify({ startPage: exactStart, endPage: exactEnd })
                );
              } catch {
                // Ignore quota error
              }
              setActualPageRange({ startPage: exactStart, endPage: exactEnd });
              setCurrentPage(exactStart);
            }
          }
        } catch {
          // Keep baseRange if offline
        }
      };

      resolveExactAyahPages();
    }

    return () => {
      cancelled = true;
    };
  }, [plan]);

  // Helper to navigate to a specific page in order and reset scroll to top
  const goToMushafPage = useCallback(
    (targetPage: number) => {
      let pageToSet = targetPage;
      if (!orderedPlanPages.includes(pageToSet)) {
        pageToSet = orderedPlanPages[0] || actualPageRange.startPage;
      }
      currentIndexRef.current = 0;
      setCurrentWordIndex(0);
      activeAyahIdxRef.current = 0;
      setActiveAyahIdx(0);
      ayahWordOffsetRef.current = 0;
      setAyahWordOffset(0);
      currentAyahRepCountRef.current = 0;
      setCurrentAyahRepCount(0);
      setCurrentQuizStep(0);
      setSolvedQuizIndices([]);
      setLastMatchedSpoken('');
      setLastMismatchSpoken('');
      lastConsumedTokenNormRef.current = '';
      setLoadingPage(true);
      setCurrentPage(pageToSet);
      if (mushafScrollContainerRef.current) {
        mushafScrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [orderedPlanPages, actualPageRange.startPage]
  );

  // Build Hidden Words & Interactive Questions for Review Mode
  const hiddenWordIndicesSet = useMemo(() => {
    if (plan.planType !== 'review' || flatWords.length === 0) return new Set<number>();
    const set = new Set<number>();
    flatWords.forEach((w) => {
      if (isWordHiddenForQuizLevel(w, quizLevel, quizFormat)) {
        set.add(w.globalIndex);
      }
    });
    if (set.size === 0 && flatWords.length > 0) {
      set.add(flatWords[flatWords.length - 1].globalIndex);
    }
    return set;
  }, [plan.planType, flatWords, quizLevel, quizFormat]);

  const quizQuestions = useMemo(() => {
    if (plan.planType !== 'review' || flatWords.length === 0) return [];
    const hiddenIndices = Array.from(hiddenWordIndicesSet).sort((a, b) => a - b);

    return hiddenIndices.map((wIdx) => {
      const w = flatWords[wIdx];
      const distractors = flatWords
        .filter(
          (other) =>
            other.globalIndex !== w.globalIndex &&
            other.normalizedText !== w.normalizedText &&
            other.normalizedText.length >= 2
        )
        .slice(0, 24);

      const pickedDistractors: string[] = [];
      for (let d = 0; d < distractors.length && pickedDistractors.length < 3; d++) {
        const idx = (wIdx * 5 + d * 7) % distractors.length;
        const candidate = distractors[idx].textUthmani;
        if (!pickedDistractors.includes(candidate) && candidate !== w.textUthmani) {
          pickedDistractors.push(candidate);
        }
      }

      const fallbackPool = ['ٱلْعَـٰلَمِينَ', 'ٱلْمُؤْمِنُونَ', 'ٱلصَّـٰلِحَـٰتِ', 'ٱلْمُتَّقِينَ'];
      let fIdx = 0;
      while (pickedDistractors.length < 3) {
        const nextD = fallbackPool[fIdx % fallbackPool.length];
        fIdx++;
        if (!pickedDistractors.includes(nextD) && nextD !== w.textUthmani) {
          pickedDistractors.push(nextD);
        } else {
          pickedDistractors.push('ٱلْحَكِيمُ');
        }
      }

      const allChoices = [...pickedDistractors, w.textUthmani];
      allChoices.sort((a, b) => a.localeCompare(b));

      return {
        wordIndex: w.globalIndex,
        targetWord: w,
        choices: allChoices,
      };
    });
  }, [plan.planType, flatWords, hiddenWordIndicesSet]);

  // O(1) lookup sets and maps so the 150-word Mushaf page render loop never runs O(N) array scans
  const mistakeIndicesSet = useMemo(() => new Set(mistakeIndices), [mistakeIndices]);
  const solvedQuizIndicesSet = useMemo(() => new Set(solvedQuizIndices), [solvedQuizIndices]);
  const quizQuestionIndexByWordIndex = useMemo(() => {
    const map = new Map<number, number>();
    quizQuestions.forEach((q, idx) => {
      map.set(q.wordIndex, idx);
    });
    return map;
  }, [quizQuestions]);

  useEffect(() => {
    quizQuestionsRef.current = quizQuestions;
  }, [quizQuestions]);

  useEffect(() => {
    setCurrentQuizStep(0);
    currentQuizStepRef.current = 0;
    setSolvedQuizIndices([]);
    setWrongQuizAttempts(0);
  }, [quizLevel, quizFormat]);

  // Build words list from fetched Uthmani verses in strict ascending (surahNumber, ayahNumber) order
  const buildWordsFromVerses = useCallback(
    (
      verses: { surahNumber: number; ayahNumber: number; textUthmani: string; juz?: number }[]
    ) => {
      // 1. Always sort verses in strict ascending Quranic order (Surah ascending, then Ayah ascending)
      const sortedVerses = [...verses].sort((a, b) =>
        a.surahNumber !== b.surahNumber
          ? a.surahNumber - b.surahNumber
          : a.ayahNumber - b.ayahNumber
      );

      let filteredVerses = sortedVerses;

      if (plan.scope === 'ayah' && plan.ayahSurah) {
        const a1 = Math.min(plan.ayahFrom || 1, plan.ayahTo || 286);
        const a2 = Math.max(plan.ayahFrom || 1, plan.ayahTo || 286);
        const matchingInRange = sortedVerses.filter(
          (v) =>
            v.surahNumber === plan.ayahSurah &&
            v.ayahNumber >= a1 &&
            v.ayahNumber <= a2
        );
        if (matchingInRange.length > 0) {
          filteredVerses = matchingInRange;
        }
      } else if (plan.scope === 'surah') {
        if (plan.selectedSurahs && plan.selectedSurahs.length > 0) {
          const selectedSet = new Set(plan.selectedSurahs);
          const matchingSurahs = sortedVerses.filter((v) => selectedSet.has(v.surahNumber));
          if (matchingSurahs.length > 0) {
            filteredVerses = matchingSurahs;
          }
        } else if (plan.surahStart) {
          const s1 = Math.min(plan.surahStart, plan.surahEnd || plan.surahStart);
          const s2 = Math.max(plan.surahStart, plan.surahEnd || plan.surahStart);
          const matchingSurahs = sortedVerses.filter(
            (v) => v.surahNumber >= s1 && v.surahNumber <= s2
          );
          if (matchingSurahs.length > 0) {
            filteredVerses = matchingSurahs;
          }
        }
      } else if (plan.scope === 'juz' && plan.juzStart) {
        const j1 = Math.min(plan.juzStart, plan.juzEnd || plan.juzStart);
        const j2 = Math.max(plan.juzStart, plan.juzEnd || plan.juzStart);
        const matchingJuz = sortedVerses.filter(
          (v) => !v.juz || (v.juz >= j1 && v.juz <= j2)
        );
        if (matchingJuz.length > 0) {
          filteredVerses = matchingJuz;
        }
      }

      const groups: MushafAyahGroup[] = [];
      const allWords: MushafWordItem[] = [];
      let globalIdx = 0;

      filteredVerses.forEach((v, gIdx) => {
        const surahObj = SURAH_LIST.find((s) => s.number === v.surahNumber);
        const surahNameAr = surahObj ? surahObj.nameAr : `${v.surahNumber}`;

        let cleanText = v.textUthmani.trim();
        if (
          v.surahNumber !== 1 &&
          v.surahNumber !== 9 &&
          v.ayahNumber === 1 &&
          cleanText.startsWith('بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ')
        ) {
          cleanText = cleanText
            .replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ', '')
            .trim();
        }

        // Filter out non-word pause symbols (ۖ ۗ ۘ ۙ ۚ ۛ ۜ ۞ ۩) so only real Quranic words are matched
        const rawTokens = cleanText
          .split(/\s+/)
          .map((t) => t.trim())
          .filter(
            (t) =>
              t.length > 0 &&
              !/^[\u06D6-\u06ED\u06DD٠-٩0-9]+$/.test(t) &&
              normalizeArabicForAlignment(t, false).length > 0
          );

        const ayahWords: MushafWordItem[] = rawTokens.map((token, idx) => {
          // Strip Uthmani Silah signs (ۥ / ۦ) after Ha' Al-Kinayah (هۥ / هۦ) so لهۥ/بهۦ/إنهۥ match Imla'i له/به/إنه
          const cleanedTokenForDagger = token.replace(/\u0647[\u06E5\u06E6]/g, 'ه');
          const normNoDagger = normalizeArabicForAlignment(token, false);
          const normWithDagger = normalizeArabicForAlignment(cleanedTokenForDagger, true);
          const item: MushafWordItem = {
            globalIndex: globalIdx++,
            surahNumber: v.surahNumber,
            surahNameAr,
            ayahNumber: v.ayahNumber,
            ayahGroupIndex: gIdx,
            wordPosition: idx + 1,
            textUthmani: token,
            normalizedText: normNoDagger,
            normalizedWithDagger: normWithDagger,
            skeletonText: getConsonantalSkeleton(normWithDagger),
            phoneticSkeleton: getPhoneticSkeleton(normWithDagger),
            syllableWeight: computeWordSyllableWeight(token, normWithDagger),
            isFirstWordInAyah: idx === 0,
            isLastWordInAyah: idx === rawTokens.length - 1,
          };
          allWords.push(item);
          return item;
        });

        groups.push({
          groupIndex: gIdx,
          surahNumber: v.surahNumber,
          surahNameAr,
          ayahNumber: v.ayahNumber,
          isFirstAyahOfSurah: v.ayahNumber === 1,
          words: ayahWords,
        });
      });

      setAyahGroups(groups);
      setFlatWords(allWords);
      setCurrentWordIndex(0);
      currentIndexRef.current = 0;
      setMistakeIndices([]);
      setLastMatchedSpoken('');
      setLastMismatchSpoken('');
      lastConsumedTokenNormRef.current = '';
      accumulatedVoiceUnitsRef.current = 0;
      setActiveAyahIdx(0);
      activeAyahIdxRef.current = 0;
      setCurrentAyahRepCount(0);
      currentAyahRepCountRef.current = 0;
      setAyahWordOffset(0);
      ayahWordOffsetRef.current = 0;
      setCurrentQuizStep(0);
      currentQuizStepRef.current = 0;
      setSolvedQuizIndices([]);
      if (filteredVerses[0]?.juz) {
        setPageJuz(filteredVerses[0].juz);
      }
      if (mushafScrollContainerRef.current) {
        mushafScrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [
      plan.id,
      plan.scope,
      plan.ayahSurah,
      plan.ayahFrom,
      plan.ayahTo,
      plan.surahStart,
      plan.surahEnd,
      plan.selectedSurahs,
      plan.juzStart,
      plan.juzEnd,
    ]
  );

  // Fetch Uthmani verses strictly page-by-page with RAM + localStorage cache so pages load instantaneously
  useEffect(() => {
    let cancelled = false;
    const pageCacheKey = `al_utrujjah_mushaf_page_v2_${currentPage}`;

    const fetchMushafVerses = async () => {
      // 0. Check in-memory RAM cache first (0ms latency, zero JSON.parse on main thread)
      const memCached = MEMORY_PAGE_CACHE.get(currentPage);
      if (memCached && memCached.length > 0) {
        buildWordsFromVerses(memCached);
        setLoadingPage(false);
        return;
      }

      setLoadingPage(true);

      // 1. Check local browser storage next so previously loaded pages run 100% from the user's device
      try {
        const cachedPageJson = localStorage.getItem(pageCacheKey);
        if (cachedPageJson) {
          const parsedVerses = JSON.parse(cachedPageJson);
          if (!cancelled && Array.isArray(parsedVerses) && parsedVerses.length > 0) {
            MEMORY_PAGE_CACHE.set(currentPage, parsedVerses);
            buildWordsFromVerses(parsedVerses);
            setLoadingPage(false);
            return;
          }
        }
      } catch {
        // Ignore storage error and proceed to fetch
      }

      try {
        const res = await fetch(
          `https://api.quran.com/api/v4/verses/by_page/${currentPage}?words=false&fields=text_uthmani,chapter_id,verse_number,juz_number&per_page=50`
        );
        if (!res.ok) throw new Error('Primary API error');
        const data = await res.json();
        if (!cancelled && Array.isArray(data.verses) && data.verses.length > 0) {
          const mapped = data.verses.map((v: any) => ({
            surahNumber: Number(v.chapter_id || String(v.verse_key).split(':')[0]),
            ayahNumber: Number(v.verse_number || String(v.verse_key).split(':')[1]),
            textUthmani: v.text_uthmani,
            juz: Number(v.juz_number || 1),
          }));
          MEMORY_PAGE_CACHE.set(currentPage, mapped);
          try {
            localStorage.setItem(pageCacheKey, JSON.stringify(mapped));
          } catch {
            // Ignore storage quota
          }
          buildWordsFromVerses(mapped);
          setLoadingPage(false);
          return;
        }
        throw new Error('Empty primary response');
      } catch {
        try {
          const res2 = await fetch(
            `https://api.alquran.cloud/v1/page/${currentPage}/quran-uthmani`
          );
          if (!res2.ok) throw new Error('Secondary API error');
          const data2 = await res2.json();
          if (!cancelled && data2?.data?.ayahs?.length > 0) {
            const mapped2 = data2.data.ayahs.map((a: any) => ({
              surahNumber: Number(a.surah.number),
              ayahNumber: Number(a.numberInSurah),
              textUthmani: a.text,
              juz: Number(a.juz || 1),
            }));
            MEMORY_PAGE_CACHE.set(currentPage, mapped2);
            try {
              localStorage.setItem(pageCacheKey, JSON.stringify(mapped2));
            } catch {
              // Ignore storage quota
            }
            buildWordsFromVerses(mapped2);
            setLoadingPage(false);
            return;
          }
        } catch {
          if (!cancelled) {
            buildWordsFromVerses(
              FALLBACK_PAGE_1_AYAHS.map((a) => ({
                surahNumber: a.surahNumber,
                ayahNumber: a.ayahNumber,
                textUthmani: a.text,
                juz: 1,
              }))
            );
            setLoadingPage(false);
          }
        }
      }
    };

    fetchMushafVerses();
    return () => {
      cancelled = true;
    };
  }, [currentPage, buildWordsFromVerses]);

  // Stop microphone, on-device Web Audio DSP & speech recognition session cleanly
  const stopListeningSession = useCallback(() => {
    isListeningRef.current = false;
    voiceActiveRef.current = false;
    setIsListening(false);
    setVoiceActive(false);
    accumulatedVoiceUnitsRef.current = 0;

    if (voiceActivityTimeoutRef.current) {
      clearTimeout(voiceActivityTimeoutRef.current);
      voiceActivityTimeoutRef.current = null;
    }

    if (dspIntervalRef.current) {
      clearInterval(dspIntervalRef.current);
      dspIntervalRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // Ignore
      }
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // Ignore
      }
      audioContextRef.current = null;
    }

    if (recognitionRestartTimerRef.current) {
      clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onspeechstart = null;
        recognitionRef.current.onsoundstart = null;
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }
  }, []);

  // Multi-page advance during Sard (advances strictly 1 page at a time in ascending order once all words on page are matched)
  useEffect(() => {
    if (
      plan.planType === 'sard' &&
      sardStarted &&
      !loadingPage &&
      flatWords.length > 0 &&
      currentWordIndex >= flatWords.length
    ) {
      if (hasNextPage && nextMushafPage !== null) {
        goToMushafPage(nextMushafPage);
      } else {
        stopListeningSession();
        setShowFinishConfirmDialog(true);
      }
    }
  }, [
    plan.planType,
    sardStarted,
    loadingPage,
    flatWords.length,
    currentWordIndex,
    hasNextPage,
    nextMushafPage,
    goToMushafPage,
    stopListeningSession,
  ]);

  // Step 1 word in Repetition Mode (`new_memorization`)
  const stepRepetitionWord = useCallback(() => {
    const groups = ayahGroupsRef.current;
    if (groups.length === 0) return;

    const currentGroup = groups[activeAyahIdxRef.current];
    if (!currentGroup) return;

    const nextWordOffset = ayahWordOffsetRef.current + 1;
    if (nextWordOffset < currentGroup.words.length) {
      ayahWordOffsetRef.current = nextWordOffset;
      setAyahWordOffset(nextWordOffset);
    } else {
      const nextRep = currentAyahRepCountRef.current + 1;
      if (nextRep < targetRepsRef.current) {
        currentAyahRepCountRef.current = nextRep;
        setCurrentAyahRepCount(nextRep);
        ayahWordOffsetRef.current = 0;
        setAyahWordOffset(0);
      } else {
        const nextAyahIndex = activeAyahIdxRef.current + 1;
        if (nextAyahIndex < groups.length) {
          activeAyahIdxRef.current = nextAyahIndex;
          setActiveAyahIdx(nextAyahIndex);
          currentAyahRepCountRef.current = 0;
          setCurrentAyahRepCount(0);
          ayahWordOffsetRef.current = 0;
          setAyahWordOffset(0);
        } else if (hasNextPage && nextMushafPage !== null) {
          goToMushafPage(nextMushafPage);
        } else {
          stopListeningSession();
          setShowFinishConfirmDialog(true);
        }
      }
    }
  }, [hasNextPage, nextMushafPage, goToMushafPage, stopListeningSession]);

  // Helper to verify whether a spoken token (or alternative hypotheses) matches a target MushafWordItem
  // Helper to verify whether a spoken token (or alternative hypotheses) matches a target MushafWordItem
  const checkTokenMatchesWord = useCallback(
    (
      spokenTokensAtPos: string[],
      nextSpokenToken: string | undefined,
      targetWord: MushafWordItem,
      nextTargetWord: MushafWordItem | undefined,
      prevTargetWord?: MushafWordItem
    ): {
      matched: boolean;
      wordsAdvanced: 1 | 2;
      tokensConsumed: 1 | 2;
      matchedText: string;
      isRepeatOfPrevious?: boolean;
    } => {
      for (const rawSpoken of spokenTokensAtPos) {
        const spokenNorm = normalizeArabicForAlignment(rawSpoken, false);
        if (!spokenNorm) continue;

        // 1. Check if the reciter repeated the previous word (Waqf & Ibtida / وقف واستئناف)
        // Consume the spoken token smoothly without advancing or flagging a false mismatch
        if (
          prevTargetWord &&
          targetWord.normalizedText !== prevTargetWord.normalizedText &&
          targetWord.normalizedWithDagger !== prevTargetWord.normalizedWithDagger
        ) {
          const prevScore = scoreSpokenAgainstMushafWord(spokenNorm, prevTargetWord);
          if (prevScore >= 0.84) {
            return {
              matched: false,
              wordsAdvanced: 1,
              tokensConsumed: 1,
              matchedText: rawSpoken,
              isRepeatOfPrevious: true,
            };
          }
        }

        // 2. Direct single-word match against Uthmani or Imla'i form
        const directScore = scoreSpokenAgainstMushafWord(spokenNorm, targetWord);
        if (directScore >= 0.78) {
          return {
            matched: true,
            wordsAdvanced: 1,
            tokensConsumed: 1,
            matchedText: rawSpoken,
          };
        }

        // 3. Prefix-attached/detached match (e.g. "والعصر" vs "العصر", "فسبح" vs "سبح", "بالله" vs "الله")
        const prefixes = ['و', 'ف', 'ب', 'ل'];
        for (const p of prefixes) {
          if (spokenNorm.length >= 3 && spokenNorm.startsWith(p)) {
            const strippedScore = scoreSpokenAgainstMushafWord(spokenNorm.slice(1), targetWord);
            if (strippedScore >= 0.84) {
              return {
                matched: true,
                wordsAdvanced: 1,
                tokensConsumed: 1,
                matchedText: rawSpoken,
              };
            }
          }
          if (
            targetWord.normalizedWithDagger.length >= 3 &&
            targetWord.normalizedWithDagger.startsWith(p)
          ) {
            const targetWithoutPrefix: MushafWordItem = {
              ...targetWord,
              normalizedText: targetWord.normalizedText.startsWith(p)
                ? targetWord.normalizedText.slice(1)
                : targetWord.normalizedText,
              normalizedWithDagger: targetWord.normalizedWithDagger.slice(1),
            };
            if (scoreSpokenAgainstMushafWord(spokenNorm, targetWithoutPrefix) >= 0.84) {
              return {
                matched: true,
                wordsAdvanced: 1,
                tokensConsumed: 1,
                matchedText: rawSpoken,
              };
            }
          }
        }

        // 4. Merged Previous + Current Word in ASR (e.g. ASR merges "الحمد" + "لله" into "الحمدلله" after "الحمد" was already matched)
        if (prevTargetWord) {
          const prevPlusCurr: MushafWordItem = {
            ...targetWord,
            normalizedText: prevTargetWord.normalizedText + targetWord.normalizedText,
            normalizedWithDagger:
              prevTargetWord.normalizedWithDagger + targetWord.normalizedWithDagger,
            skeletonText: prevTargetWord.skeletonText + targetWord.skeletonText,
            phoneticSkeleton: prevTargetWord.phoneticSkeleton + targetWord.phoneticSkeleton,
          };
          if (scoreSpokenAgainstMushafWord(spokenNorm, prevPlusCurr) >= 0.84) {
            return {
              matched: true,
              wordsAdvanced: 1,
              tokensConsumed: 1,
              matchedText: rawSpoken,
            };
          }
        }

        // 5. Compound 2-spoken-words -> 1-Uthmani-word (e.g. "يا أيها" -> "يَـٰٓأَيُّهَا", "يا قوم" -> "يَـٰقَوْمِ")
        if (nextSpokenToken) {
          const joinedSpoken = normalizeArabicForAlignment(rawSpoken + nextSpokenToken, false);
          if (scoreSpokenAgainstMushafWord(joinedSpoken, targetWord) >= 0.82) {
            return {
              matched: true,
              wordsAdvanced: 1,
              tokensConsumed: 2,
              matchedText: `${rawSpoken} ${nextSpokenToken}`,
            };
          }
        }

        // 6. Compound 1-spoken-word -> 2-Uthmani-words (e.g. "ألا" -> "أَن لَّا", "مما" -> "مِن مَّا", "الحمدلله" -> "ٱلْحَمْدُ لِلَّهِ")
        // Only legitimate linguistic contractions where spoken word actually contains both target words
        if (nextTargetWord) {
          const combinedTarget: MushafWordItem = {
            ...targetWord,
            normalizedText: targetWord.normalizedText + nextTargetWord.normalizedText,
            normalizedWithDagger:
              targetWord.normalizedWithDagger + nextTargetWord.normalizedWithDagger,
            skeletonText: targetWord.skeletonText + nextTargetWord.skeletonText,
            phoneticSkeleton: targetWord.phoneticSkeleton + nextTargetWord.phoneticSkeleton,
          };
          if (scoreSpokenAgainstMushafWord(spokenNorm, combinedTarget) >= 0.84) {
            return {
              matched: true,
              wordsAdvanced: 2,
              tokensConsumed: 1,
              matchedText: rawSpoken,
            };
          }
        }
      }

      return {
        matched: false,
        wordsAdvanced: 1,
        tokensConsumed: 1,
        matchedText: '',
      };
    },
    []
  );

  // Keep fresh speech result handler in a ref so continuous SpeechRecognition NEVER suffers from stale closures
  handleSpeechResultRef.current = (event: any) => {
    if (!isListeningRef.current) return;

    asrConsecutiveFailuresRef.current = 0;
    setVoiceActive(true);
    lastVoiceDetectedTimeRef.current = Date.now();
    if (voiceActivityTimeoutRef.current) {
      clearTimeout(voiceActivityTimeoutRef.current);
    }
    voiceActivityTimeoutRef.current = setTimeout(() => {
      setVoiceActive(false);
    }, 1100);

    const startRIdx = Math.min(
      processedResultIndexRef.current,
      typeof event.resultIndex === 'number' ? event.resultIndex : 0
    );

    for (let rIdx = startRIdx; rIdx < event.results.length; rIdx++) {
      if (rIdx < processedResultIndexRef.current) continue;

      const resultObj = event.results[rIdx];
      if (!resultObj || !resultObj[0]) continue;

      if (rIdx > processedResultIndexRef.current) {
        processedResultIndexRef.current = rIdx;
        processedTokenCountRef.current = 0;
        lastConsumedTokenNormRef.current = '';
      }

      const primaryTranscript = String(resultObj[0].transcript || '').trim();
      if (!primaryTranscript) continue;

      const primaryTokens = primaryTranscript
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => normalizeArabicForAlignment(t, false).length > 0);

      if (primaryTokens.length === 0) continue;

      const alt1Tokens = resultObj[1]?.transcript
        ? String(resultObj[1].transcript)
            .trim()
            .split(/\s+/)
            .filter((t) => normalizeArabicForAlignment(t, false).length > 0)
        : [];
      const alt2Tokens = resultObj[2]?.transcript
        ? String(resultObj[2].transcript)
            .trim()
            .split(/\s+/)
            .filter((t) => normalizeArabicForAlignment(t, false).length > 0)
        : [];

      // If ASR compressed two earlier tokens into one (e.g. "الحمد لله" -> "الحمدلله") and added a new word at the end,
      // adjust processedTokenCountRef so the new word at the end is never skipped!
      const lastTokenNorm = normalizeArabicForAlignment(
        primaryTokens[primaryTokens.length - 1],
        false
      );
      if (
        processedTokenCountRef.current >= primaryTokens.length &&
        lastTokenNorm !== lastConsumedTokenNormRef.current
      ) {
        processedTokenCountRef.current = Math.max(0, primaryTokens.length - 1);
      }

      const startScanIdx = Math.max(0, processedTokenCountRef.current);
      let i = startScanIdx;

      while (i < primaryTokens.length) {
        const candidatesAtPos: string[] = [primaryTokens[i]];
        if (alt1Tokens[i] && !candidatesAtPos.includes(alt1Tokens[i])) {
          candidatesAtPos.push(alt1Tokens[i]);
        }
        if (alt2Tokens[i] && !candidatesAtPos.includes(alt2Tokens[i])) {
          candidatesAtPos.push(alt2Tokens[i]);
        }

        const nextSpoken = primaryTokens[i + 1];
        const currentSpokenNorm = normalizeArabicForAlignment(primaryTokens[i], false);

        // Introductory Isti'adhah / Basmalah words when the reader starts reciting
        const isIntroductoryFormulaWord = [
          'اعوذ',
          'بالله',
          'الشيطان',
          'الرجيم',
          'بسم',
          'الله',
          'الرحمن',
          'الرحيم',
        ].includes(currentSpokenNorm);

        // ====================================================================
        // PLAN TYPE 1: SARD (`plan.planType === 'sard'`)
        // ====================================================================
        if (plan.planType === 'sard') {
          const wordsList = flatWordsRef.current;
          const currIdx = currentIndexRef.current;
          const targetWord = wordsList[currIdx];
          if (!targetWord) break;

          const nextTargetWord = wordsList[currIdx + 1];
          const prevTargetWord = currIdx > 0 ? wordsList[currIdx - 1] : undefined;

          const matchRes = checkTokenMatchesWord(
            candidatesAtPos,
            nextSpoken,
            targetWord,
            nextTargetWord,
            prevTargetWord
          );

          if (matchRes.matched) {
            const nextWordIdx = Math.min(
              wordsList.length,
              currIdx + matchRes.wordsAdvanced
            );
            currentIndexRef.current = nextWordIdx;
            setCurrentWordIndex(nextWordIdx);
            setLastMatchedSpoken(matchRes.matchedText);
            setLastMismatchSpoken('');
            lastWordAdvanceTimeRef.current = Date.now();
            lastAsrAdvanceTimeRef.current = Date.now();
            accumulatedVoiceUnitsRef.current = 0;
            lastConsumedTokenNormRef.current = normalizeArabicForAlignment(
              primaryTokens[Math.min(primaryTokens.length - 1, i + matchRes.tokensConsumed - 1)],
              false
            );
            i += matchRes.tokensConsumed;
            processedTokenCountRef.current = i;
          } else if (matchRes.isRepeatOfPrevious) {
            // Reciter repeated previous word (Waqf & Ibtida) - acknowledge without false error or skip
            setLastMatchedSpoken(matchRes.matchedText);
            setLastMismatchSpoken('');
            lastConsumedTokenNormRef.current = currentSpokenNorm;
            i += matchRes.tokensConsumed;
            processedTokenCountRef.current = i;
          } else if (
            isIntroductoryFormulaWord &&
            (currIdx === 0 || targetWord.isFirstWordInAyah) &&
            !['اعوذ', 'بالله', 'بسم', 'الله', 'الرحمن', 'الرحيم'].includes(targetWord.normalizedText)
          ) {
            // Gracefully accept Isti'adhah / Basmalah before a Surah begins without flagging a mismatch
            setLastMatchedSpoken(primaryTokens[i]);
            setLastMismatchSpoken('');
            lastConsumedTokenNormRef.current = currentSpokenNorm;
            i += 1;
            processedTokenCountRef.current = i;
          } else {
            if (i < primaryTokens.length - 1 || resultObj.isFinal) {
              setLastMismatchSpoken(primaryTokens[i]);
              lastConsumedTokenNormRef.current = currentSpokenNorm;
              processedTokenCountRef.current = i + 1;
            }
            i += 1;
          }
        }
        // ====================================================================
        // PLAN TYPE 2: NEW MEMORIZATION (`plan.planType === 'new_memorization'`)
        // ====================================================================
        else if (plan.planType === 'new_memorization') {
          const groups = ayahGroupsRef.current;
          const currentGroup = groups[activeAyahIdxRef.current];
          const currOffset = ayahWordOffsetRef.current;
          const targetWord = currentGroup?.words[currOffset];
          if (!targetWord) break;

          const nextTargetWord = currentGroup?.words[currOffset + 1];
          const prevTargetWord =
            currOffset > 0 ? currentGroup?.words[currOffset - 1] : undefined;

          const matchRes = checkTokenMatchesWord(
            candidatesAtPos,
            nextSpoken,
            targetWord,
            nextTargetWord,
            prevTargetWord
          );

          if (matchRes.matched) {
            stepRepetitionWord();
            if (matchRes.wordsAdvanced === 2) {
              stepRepetitionWord();
            }
            setLastMatchedSpoken(matchRes.matchedText);
            setLastMismatchSpoken('');
            lastWordAdvanceTimeRef.current = Date.now();
            lastAsrAdvanceTimeRef.current = Date.now();
            accumulatedVoiceUnitsRef.current = 0;
            lastConsumedTokenNormRef.current = normalizeArabicForAlignment(
              primaryTokens[Math.min(primaryTokens.length - 1, i + matchRes.tokensConsumed - 1)],
              false
            );
            i += matchRes.tokensConsumed;
            processedTokenCountRef.current = i;
          } else if (matchRes.isRepeatOfPrevious) {
            setLastMatchedSpoken(matchRes.matchedText);
            setLastMismatchSpoken('');
            lastConsumedTokenNormRef.current = currentSpokenNorm;
            i += matchRes.tokensConsumed;
            processedTokenCountRef.current = i;
          } else if (
            isIntroductoryFormulaWord &&
            currOffset === 0 &&
            !['اعوذ', 'بالله', 'بسم', 'الله', 'الرحمن', 'الرحيم'].includes(targetWord.normalizedText)
          ) {
            setLastMatchedSpoken(primaryTokens[i]);
            setLastMismatchSpoken('');
            lastConsumedTokenNormRef.current = currentSpokenNorm;
            i += 1;
            processedTokenCountRef.current = i;
          } else {
            if (i < primaryTokens.length - 1 || resultObj.isFinal) {
              setLastMismatchSpoken(primaryTokens[i]);
              lastConsumedTokenNormRef.current = currentSpokenNorm;
              processedTokenCountRef.current = i + 1;
            }
            i += 1;
          }
        }
        // ====================================================================
        // PLAN TYPE 3: REVIEW (`plan.planType === 'review'`)
        // ====================================================================
        else if (plan.planType === 'review') {
          const currentQ = quizQuestions[currentQuizStep];
          if (!currentQ) break;

          const targetWord = currentQ.targetWord;
          const wordsList = flatWordsRef.current;
          const prevTargetWord =
            targetWord.globalIndex > 0 ? wordsList[targetWord.globalIndex - 1] : undefined;

          const matchRes = checkTokenMatchesWord(
            candidatesAtPos,
            nextSpoken,
            targetWord,
            undefined,
            prevTargetWord
          );

          if (matchRes.matched) {
            setWrongChoiceFlash(null);
            setLastMatchedSpoken(matchRes.matchedText);
            setLastMismatchSpoken('');
            lastWordAdvanceTimeRef.current = Date.now();
            lastAsrAdvanceTimeRef.current = Date.now();
            accumulatedVoiceUnitsRef.current = 0;
            if (!solvedQuizIndices.includes(currentQ.wordIndex)) {
              setSolvedQuizIndices((prev) => [...prev, currentQ.wordIndex]);
            }
            if (currentQuizStep + 1 < quizQuestions.length) {
              setCurrentQuizStep((s) => s + 1);
            } else if (hasNextPage && nextMushafPage !== null) {
              goToMushafPage(nextMushafPage);
            } else {
              stopListeningSession();
              setShowFinishConfirmDialog(true);
            }
            lastConsumedTokenNormRef.current = normalizeArabicForAlignment(
              primaryTokens[Math.min(primaryTokens.length - 1, i + matchRes.tokensConsumed - 1)],
              false
            );
            i += matchRes.tokensConsumed;
            processedTokenCountRef.current = i;
          } else {
            // Check if the reader is reciting the visible context words leading up to the blank
            const contextStart = Math.max(0, targetWord.globalIndex - 5);
            let isContextWord = isIntroductoryFormulaWord;
            for (let cIdx = contextStart; cIdx < targetWord.globalIndex; cIdx++) {
              if (
                scoreSpokenAgainstMushafWord(currentSpokenNorm, wordsList[cIdx]) >= 0.78
              ) {
                isContextWord = true;
                break;
              }
            }

            if (isContextWord) {
              setLastMatchedSpoken(primaryTokens[i]);
              setLastMismatchSpoken('');
              lastConsumedTokenNormRef.current = currentSpokenNorm;
              i += 1;
              processedTokenCountRef.current = i;
            } else {
              if (i < primaryTokens.length - 1 || resultObj.isFinal) {
                setLastMismatchSpoken(primaryTokens[i]);
                lastConsumedTokenNormRef.current = currentSpokenNorm;
                processedTokenCountRef.current = i + 1;
              }
              i += 1;
            }
          }
        }
      }

      if (resultObj.isFinal) {
        processedResultIndexRef.current = rIdx + 1;
        processedTokenCountRef.current = 0;
        lastConsumedTokenNormRef.current = '';
      }
    }
  };

  // Start High-Performance On-Device Browser Synchronization Engine (Lightweight 512-FFT DSP + Circuit-Protected Local ASR)
  const startListeningSession = async () => {
    setSpeechError(null);
    setSardStarted(true);
    setRevealAllPreview(false);
    setLastMatchedSpoken('');
    setLastMismatchSpoken('');
    lastWordAdvanceTimeRef.current = 0;
    lastAsrAdvanceTimeRef.current = 0;
    lastVoiceDetectedTimeRef.current = 0;
    processedResultIndexRef.current = 0;
    processedTokenCountRef.current = 0;
    lastConsumedTokenNormRef.current = '';
    accumulatedVoiceUnitsRef.current = 0;
    prevVoicedEnergyRef.current = 0;
    asrConsecutiveFailuresRef.current = 0;
    asrDisabledForSessionRef.current = false;

    // Clean up any previous session before starting
    stopListeningSession();

    isListeningRef.current = true;
    setIsListening(true);

    let localDspStarted = false;

    // 1. Start Ultra-Light On-Device Browser Web Audio API Vocal Formant & Syllable Cadence Synchronizer
    // Uses fftSize = 512 at 65ms (~15 ticks/sec) with zero timer churn and auto-pause when tab is hidden
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (!isListeningRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        mediaStreamRef.current = stream;
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const micSource = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.45;
        // Connect ONLY to analyser (never to audioCtx.destination so zero sound is emitted)
        micSource.connect(analyser);

        const timeData = new Float32Array(analyser.fftSize);
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        const sampleRate = audioCtx.sampleRate || 44100;
        const binHz = sampleRate / analyser.fftSize;
        const vocalMinBin = Math.max(1, Math.floor(100 / binHz));
        const vocalMaxBin = Math.min(analyser.frequencyBinCount - 1, Math.ceil(2600 / binHz));
        const hissMinBin = Math.min(analyser.frequencyBinCount - 1, Math.floor(3800 / binHz));

        localDspStarted = true;

        dspIntervalRef.current = setInterval(() => {
          if (!isListeningRef.current || document.hidden) return;

          analyser.getFloatTimeDomainData(timeData);
          analyser.getByteFrequencyData(freqData);

          let sumSq = 0;
          for (let i = 0; i < timeData.length; i += 2) {
            sumSq += timeData[i] * timeData[i];
          }
          const rms = Math.sqrt(sumSq / (timeData.length >> 1));

          let vocalEnergySum = 0;
          const vocalBinCount = Math.max(1, vocalMaxBin - vocalMinBin + 1);
          for (let b = vocalMinBin; b <= vocalMaxBin; b++) {
            vocalEnergySum += freqData[b];
          }
          const vocalBandAvg = vocalEnergySum / vocalBinCount;

          let hissEnergySum = 0;
          const hissBinCount = Math.max(1, analyser.frequencyBinCount - hissMinBin);
          for (let b = hissMinBin; b < analyser.frequencyBinCount; b++) {
            hissEnergySum += freqData[b];
          }
          const hissBandAvg = hissEnergySum / hissBinCount;

          // Continuously adapt ambient room noise floor when quiet
          if (rms < noiseFloorRef.current * 1.45) {
            noiseFloorRef.current = Math.max(
              0.0035,
              Math.min(0.03, noiseFloorRef.current * 0.93 + rms * 0.07)
            );
          }

          const dynamicRmsThreshold = Math.max(0.011, noiseFloorRef.current * 2.25);
          const isHumanVocalFormant =
            rms > dynamicRmsThreshold &&
            vocalBandAvg >= 22 &&
            vocalBandAvg > hissBandAvg * 1.35;

          const now = Date.now();

          if (isHumanVocalFormant) {
            lastVoiceDetectedTimeRef.current = now;
            if (!voiceActiveRef.current) {
              voiceActiveRef.current = true;
              setVoiceActive(true);
            }
            prevVoicedEnergyRef.current = vocalBandAvg;
          } else {
            prevVoicedEnergyRef.current = vocalBandAvg * 0.5;
            if (voiceActiveRef.current && now - lastVoiceDetectedTimeRef.current > 500) {
              voiceActiveRef.current = false;
              setVoiceActive(false);
            }
          }
        }, 65);
      } catch {
        // If getUserMedia fails, fall back to SpeechRecognition below
      }
    }

    // 2. Also attach Browser SpeechRecognition with robust restart handling
    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (SpeechRecognitionAPI) {
      try {
        const recognition = new SpeechRecognitionAPI();
        recognition.lang = 'ar-SA';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        if ('processLocally' in recognition) {
          try {
            recognition.processLocally = true;
          } catch {
            // Ignore read-only property
          }
        }

        recognition.onresult = (event: any) => {
          handleSpeechResultRef.current?.(event);
        };

        recognition.onerror = (event: any) => {
          const errCode = event?.error;
          // Ignore normal pauses in speech
          if (errCode === 'no-speech') {
            return;
          }

          if (
            errCode === 'not-allowed' ||
            errCode === 'service-not-allowed'
          ) {
            setSpeechError(
              lang === 'ar'
                ? 'يرجى السماح بصلاحية الميكروفون في المتصفح لمطابقة كلامك مع الآيات.'
                : 'Please allow microphone access to match your speech with the verses.'
            );
            stopListeningSession();
            return;
          }

          if (errCode === 'audio-capture') {
            setSpeechError(
              lang === 'ar'
                ? 'تعذر الوصول إلى الميكروفون. تأكد من عدم استخدامه بواسطة تطبيق آخر.'
                : 'Microphone is unavailable or in use by another application.'
            );
            stopListeningSession();
            return;
          }

          asrConsecutiveFailuresRef.current += 1;
          if (asrConsecutiveFailuresRef.current >= 8) {
            asrDisabledForSessionRef.current = true;
          }
        };

        recognition.onend = () => {
          if (!isListeningRef.current || asrDisabledForSessionRef.current) return;

          recognitionRestartTimerRef.current = setTimeout(() => {
            if (
              !isListeningRef.current ||
              !recognitionRef.current ||
              asrDisabledForSessionRef.current
            ) {
              return;
            }
            try {
              processedResultIndexRef.current = 0;
              processedTokenCountRef.current = 0;
              lastConsumedTokenNormRef.current = '';
              lastAsrStartTimestampRef.current = Date.now();
              recognitionRef.current.start();
            } catch {
              // Ignore if already active
            }
          }, 150);
        };

        recognitionRef.current = recognition;
        lastAsrStartTimestampRef.current = Date.now();
        recognition.start();
      } catch {
        if (!localDspStarted) {
          setSpeechError(
            lang === 'ar'
              ? 'تعذر بدء المزامنة الصوتية من المتصفح. تأكد من السماح بصلاحية الميكروفون.'
              : 'Could not start browser voice synchronization. Please check microphone permissions.'
          );
          stopListeningSession();
        }
      }
    } else if (!localDspStarted) {
      setSpeechError(
        lang === 'ar'
          ? 'يرجى السماح بصلاحية الميكروفون في متصفحك لتشغيل تقنية المزامنة الصوتية من جهازك.'
          : 'Please allow microphone access in your browser to run on-device voice synchronization.'
      );
      stopListeningSession();
    }
  };

  const toggleMicrophoneSession = () => {
    if (isListening) {
      stopListeningSession();
    } else {
      startListeningSession();
    }
  };

  // Reveal current word manually if the reader forgot it (logs a mistake so they can continue reciting)
  const handleRevealCurrentWordHint = () => {
    if (plan.planType === 'sard' && currentWordIndex < flatWords.length) {
      const idxToReveal = currentWordIndex;
      setMistakeIndices((prev) => (prev.includes(idxToReveal) ? prev : [...prev, idxToReveal]));
      currentIndexRef.current = idxToReveal + 1;
      setCurrentWordIndex(idxToReveal + 1);
      setLastMismatchSpoken('');
    } else if (plan.planType === 'new_memorization') {
      stepRepetitionWord();
      setLastMismatchSpoken('');
    }
  };

  useEffect(() => {
    return () => {
      stopListeningSession();
    };
  }, [stopListeningSession]);

  // Handle Quiz Multiple Choice Answer (`plan.planType === 'review'`)
  const handleSelectQuizChoice = (choiceText: string) => {
    const currentQ = quizQuestions[currentQuizStep];
    if (!currentQ) return;

    if (choiceText === currentQ.targetWord.textUthmani) {
      setWrongChoiceFlash(null);
      setLastMatchedSpoken(choiceText);
      setLastMismatchSpoken('');
      const nextSolved = [...solvedQuizIndices, currentQ.wordIndex];
      setSolvedQuizIndices(nextSolved);

      if (currentQuizStep + 1 < quizQuestions.length) {
        setCurrentQuizStep((s) => s + 1);
      } else if (hasNextPage && nextMushafPage !== null) {
        goToMushafPage(nextMushafPage);
      } else {
        stopListeningSession();
        setShowFinishConfirmDialog(true);
      }
    } else {
      setWrongChoiceFlash(choiceText);
      setWrongQuizAttempts((w) => w + 1);
      setTimeout(() => setWrongChoiceFlash(null), 650);
    }
  };

  // Finish & Evaluation Handlers — Plan is never completed unless explicitly chosen
  const handleOpenFinishConfirmDialog = (evalChoice?: PlanEvaluation) => {
    if (evalChoice) {
      setSelectedEvaluation(evalChoice);
    }
    stopListeningSession();
    setShowFinishConfirmDialog(true);
  };

  const handleConfirmPlanFinish = (markAsCompleted: boolean, evalChoice?: PlanEvaluation) => {
    stopListeningSession();
    const finalEval = evalChoice || selectedEvaluation || 'muthabbat';
    const totalMistakes =
      plan.planType === 'review' ? wrongQuizAttempts : mistakeIndices.length;
    onCompletePlanSard(plan.id, totalMistakes, finalEval, quizLevel, markAsCompleted);
    setShowFinishConfirmDialog(false);
  };



  // Active Ayah group index during Sard (so future verses do not appear until reached and matched)
  const currentSardAyahGroupIndex = useMemo(() => {
    if (flatWords.length === 0) return 0;
    if (currentWordIndex >= flatWords.length) return ayahGroups.length;
    return flatWords[currentWordIndex]?.ayahGroupIndex ?? 0;
  }, [flatWords, currentWordIndex, ayahGroups.length]);

  const progressPct =
    plan.planType === 'sard'
      ? flatWords.length > 0
        ? Math.round((currentWordIndex / flatWords.length) * 100)
        : 0
      : plan.planType === 'new_memorization'
      ? ayahGroups.length > 0
        ? Math.round(
            ((activeAyahIdx * targetReps + currentAyahRepCount) /
              (ayahGroups.length * targetReps)) *
              100
          )
        : 0
      : quizQuestions.length > 0
      ? Math.round((solvedQuizIndices.length / quizQuestions.length) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col h-dvh bg-[#F7F3EB] text-[#261C14] islamic-pattern-subtle overflow-hidden">
      {/* Top Bar: Minimal Floating Pill in Focus Mode | Full Dark Banner in Standard Mode */}
      {isFocusMode ? (
        <div
          dir="rtl"
          className="absolute top-2.5 inset-x-3 sm:inset-x-6 z-40 flex items-center justify-between pointer-events-none"
        >
          {/* Right: Minimal clean info badge without dates or distraction */}
          <div className="pointer-events-auto bg-[#2D2218]/88 backdrop-blur-md border border-[#C88A14]/40 text-[#FFFDF9] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm">
            <span className="text-[#EAB338] font-display-islamic">
              {ayahGroups[0] ? `سُورَةُ ${ayahGroups[0].surahNameAr}` : ''}
            </span>
            <span className="text-white/40">·</span>
            <span className="font-mono-tabular text-xs">ص {toArabicNumerals(currentPage)}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#C88A14]/25 text-[#EAB338] text-[10px] font-semibold">
              {dict.focusModeActiveBadge}
            </span>
          </div>

          {/* Left: Quick Exit Focus Button & Close Button */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleFocus}
              className="px-2.5 py-1 rounded-full bg-[#2D2218]/88 hover:bg-[#2D2218] backdrop-blur-md border border-white/20 text-xs font-bold text-[#FFFDF9] hover:text-[#EAB338] shadow-sm transition-all cursor-pointer flex items-center gap-1"
              title={dict.exitFocusMode}
            >
              <Minimize2 className="w-3.5 h-3.5 text-[#EAB338]" />
              <span className="hidden sm:inline">{dict.exitFocusMode}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopListeningSession();
                onClose();
              }}
              className="p-1.5 rounded-full bg-[#2D2218]/88 hover:bg-[#2D2218] backdrop-blur-md border border-white/20 text-[#FFFDF9] shadow-sm transition-all cursor-pointer"
              title={lang === 'ar' ? 'رجوع' : 'Back'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <header className="px-3 sm:px-6 py-2 bg-[#2D2218] text-[#FFFDF9] border-b border-[#C88A14]/50 flex items-center justify-between gap-2 shrink-0 shadow-xs">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold min-w-0">
            <BookOpen className="w-4 h-4 text-[#EAB338] shrink-0" />
            <span className="font-display-islamic text-base sm:text-lg text-[#FFFDF9] truncate">
              {formatCurriculumTitle(plan, lang)}
            </span>
            <span className="text-[#84715E] shrink-0">·</span>
            <span className="text-xs text-[#EAB338] shrink-0">
              {getPlanTypeLabel(plan.planType, lang)}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Focus Mode Button */}
            <button
              type="button"
              onClick={handleToggleFocus}
              title={dict.enterFocusMode}
              className="px-2.5 py-1 rounded-lg bg-[#C88A14]/20 hover:bg-[#C88A14]/30 border border-[#EAB338]/40 text-xs font-bold text-[#EAB338] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{dict.enterFocusMode}</span>
            </button>

            {totalPlanPages > 1 ? (
              <div
                dir="rtl"
                className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg border border-white/15 text-xs text-[#FFFDF9]"
              >
                <button
                  type="button"
                  disabled={!hasPrevPage}
                  onClick={() => prevMushafPage !== null && goToMushafPage(prevMushafPage)}
                  className="p-0.5 disabled:opacity-35 hover:text-[#EAB338] cursor-pointer"
                  title={dict.prevPageBtn}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <select
                  value={currentPage}
                  onChange={(e) => goToMushafPage(Number(e.target.value))}
                  className="bg-transparent text-[#FFFDF9] font-bold text-xs focus:outline-none cursor-pointer px-1"
                  aria-label="ترتيب صفحات الورد"
                >
                  {orderedPlanPages.map((pageNum, idx) => (
                    <option key={pageNum} value={pageNum} className="bg-[#2D2218] text-[#FFFDF9]">
                      {`صفحة ${toArabicNumerals(idx + 1)} من ${toArabicNumerals(
                        totalPlanPages
                      )} (ص ${toArabicNumerals(pageNum)})`}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={!hasNextPage}
                  onClick={() => nextMushafPage !== null && goToMushafPage(nextMushafPage)}
                  className="p-0.5 disabled:opacity-35 hover:text-[#EAB338] cursor-pointer"
                  title={dict.nextPageBtn}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span
                dir="rtl"
                className="text-xs font-bold text-[#E6D7BE] bg-white/10 px-2.5 py-1 rounded-lg"
              >
                ص {toArabicNumerals(currentPage)}
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                stopListeningSession();
                onClose();
              }}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-[#FFFDF9] transition-colors cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'رجوع' : 'Back'}</span>
            </button>
          </div>
        </header>
      )}

      {/* =================================================================================
          1. MUSHAF VERSES PAGE — FULL-SCREEN IN FOCUS MODE (`flex-1 h-full`)
         ================================================================================= */}
      <div
        ref={mushafScrollContainerRef}
        className={
          isFocusMode
            ? 'flex-1 h-full min-h-0 overflow-y-auto px-2 py-3 sm:px-6 sm:py-6 pb-24 sm:pb-28 transition-all'
            : 'basis-2/3 flex-1 min-h-[64dvh] overflow-y-auto px-2.5 py-2.5 sm:px-6 sm:py-4 transition-all'
        }
      >
        <div
          className={
            isFocusMode
              ? 'max-w-4xl mx-auto min-h-full rounded-2xl sm:rounded-3xl bg-[#FFFDF7] border border-[#C88A14]/30 shadow-md p-4 sm:p-9 pt-10 sm:pt-12 bg-gradient-to-b from-[#FFFDF9] to-[#FAF4E6] flex flex-col justify-between'
              : 'max-w-4xl mx-auto min-h-full rounded-2xl sm:rounded-3xl bg-[#FFFDF7] border-2 border-[#C88A14]/60 shadow-sm p-3.5 sm:p-7 bg-gradient-to-b from-[#FFFDF9] to-[#FAF4E6] flex flex-col justify-between'
          }
        >
          <div>
            {/* Mushaf Page Header Marginalia (Always RTL for authentic Mushaf order) */}
            <div
              dir="rtl"
              className="flex items-center justify-between pb-2 mb-3.5 border-b border-[#DFD2B8] text-xs font-display-islamic font-bold text-[#5C4B3B]"
            >
              <span>{ayahGroups[0] ? `سُورَةُ ${ayahGroups[0].surahNameAr}` : ''}</span>
              <span className="text-[#C88A14]">
                {totalPlanPages > 1
                  ? `الورقة ${toArabicNumerals(currentPlanPageOrder)} من ${toArabicNumerals(
                      totalPlanPages
                    )} · صفحة المصحف ${toArabicNumerals(currentPage)}`
                  : `صفحة المصحف ${toArabicNumerals(currentPage)}`}
              </span>
              <span>
                {JUZ_LIST.find((j) => j.number === pageJuz)?.nameAr || `الجزء ${pageJuz}`}
              </span>
            </div>

            {loadingPage ? (
              <div className="py-16 text-center text-base font-display-islamic font-bold text-[#5C4B3B]">
                جاري استجلاب الآيات بالرسم العثماني...
              </div>
            ) : (
              <div
                dir="rtl"
                className={
                  isFocusMode
                    ? 'text-justify leading-[2.7] sm:leading-[3.1] select-none text-xl sm:text-2xl'
                    : 'text-justify leading-[2.45] sm:leading-[2.6] select-none'
                }
              >
                {ayahGroups.map((group) => {
                  // In Sard mode, future verses DO NOT appear at all until the reader reaches them via matched speech
                  if (
                    plan.planType === 'sard' &&
                    !revealAllPreview &&
                    group.groupIndex > currentSardAyahGroupIndex
                  ) {
                    return null;
                  }

                  const isCurrentRepAyah =
                    plan.planType === 'new_memorization' && group.groupIndex === activeAyahIdx;
                  const isPastRepAyah =
                    plan.planType === 'new_memorization' && group.groupIndex < activeAyahIdx;

                  const isBlindRepPhase =
                    isCurrentRepAyah &&
                    targetReps >= 3 &&
                    currentAyahRepCount >= targetReps - 2;

                  return (
                    <React.Fragment key={`${group.surahNumber}-${group.ayahNumber}`}>
                      {group.isFirstAyahOfSurah && (
                        <div className="my-3 text-center space-y-2">
                          <div className="py-1 px-4 mx-auto max-w-xs rounded-xl bg-[#F6E9C8]/80 border border-[#C88A14] text-base sm:text-lg font-display-islamic font-bold text-[#2D2218]">
                            سُورَةُ {group.surahNameAr}
                          </div>
                          {group.surahNumber !== 1 && group.surahNumber !== 9 && (
                            <div className="font-uthmani text-lg sm:text-2xl text-[#2D2218]">
                              بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                            </div>
                          )}
                        </div>
                      )}

                      {group.words.map((word, wIdxInAyah) => {
                        // --- CASE A: SARD MODE (`plan.planType === 'sard'`) ---
                        // Words & verses DO NOT appear unless the reader's speech via microphone matches them!
                        if (plan.planType === 'sard') {
                          const isRecited = word.globalIndex < currentWordIndex;
                          const isCurrent = word.globalIndex === currentWordIndex;
                          const wasHintedMistake = mistakeIndicesSet.has(word.globalIndex);

                          // Hide all words after the current expected word unless preview is toggled
                          if (!revealAllPreview && word.globalIndex > currentWordIndex) {
                            return null;
                          }

                          return (
                            <React.Fragment key={word.globalIndex}>
                              <span
                                ref={isCurrent ? activeWordDomRef : null}
                                onClick={() => {
                                  if (isCurrent) {
                                    handleRevealCurrentWordHint();
                                  }
                                }}
                                title={
                                  isCurrent
                                    ? lang === 'ar'
                                      ? 'انقر لكشف الكلمة الحالية إذا نسيتها'
                                      : 'Click to reveal current word'
                                    : undefined
                                }
                                className={`font-uthmani text-xl sm:text-[26px] inline-block px-1.5 py-0.5 mx-0.5 my-0.5 rounded-lg transition-colors duration-100 ${
                                  isRecited
                                    ? wasHintedMistake
                                      ? 'text-[#A84A32] bg-[#A84A32]/12 border border-[#A84A32]/30'
                                      : 'text-[#261C14] bg-[#4A6144]/12'
                                    : isCurrent && !revealAllPreview
                                    ? lastMismatchSpoken
                                      ? 'bg-[#A84A32]/20 border-2 border-dashed border-[#A84A32] text-transparent select-none min-w-[68px] cursor-pointer animate-pulse'
                                      : 'bg-[#C88A14]/20 border-2 border-dashed border-[#C88A14] text-transparent select-none min-w-[68px] cursor-pointer'
                                    : 'text-[#84715E]/70 bg-[#EFE9DC]/50'
                                }`}
                              >
                                {isRecited || revealAllPreview ? word.textUthmani : '••••'}
                              </span>
                              {word.isLastWordInAyah && (isRecited || revealAllPreview) && (
                                <span className="font-uthmani text-base sm:text-xl mx-1 select-none text-[#C88A14]">
                                  ﴿{toArabicNumerals(group.ayahNumber)}﴾
                                </span>
                              )}
                            </React.Fragment>
                          );
                        }

                        // --- CASE B: NEW MEMORIZATION REPETITION MODE (`plan.planType === 'new_memorization'`) ---
                        if (plan.planType === 'new_memorization') {
                          const isWordSpokenInRep =
                            isCurrentRepAyah && wIdxInAyah < ayahWordOffset;
                          const isCurrentRepWord =
                            isCurrentRepAyah && wIdxInAyah === ayahWordOffset;
                          const hideInBlindRep =
                            isBlindRepPhase &&
                            !isWordSpokenInRep &&
                            !revealAllPreview;

                          return (
                            <React.Fragment key={word.globalIndex}>
                              <span
                                ref={isCurrentRepWord ? activeWordDomRef : null}
                                onClick={() => {
                                  if (isCurrentRepWord && hideInBlindRep) {
                                    handleRevealCurrentWordHint();
                                  } else {
                                    activeAyahIdxRef.current = group.groupIndex;
                                    setActiveAyahIdx(group.groupIndex);
                                    ayahWordOffsetRef.current = wIdxInAyah;
                                    setAyahWordOffset(wIdxInAyah);
                                  }
                                }}
                                className={`font-uthmani text-xl sm:text-[26px] inline-block px-1.5 py-0.5 mx-0.5 my-0.5 rounded-lg transition-colors duration-100 cursor-pointer ${
                                  isCurrentRepWord
                                    ? hideInBlindRep
                                      ? lastMismatchSpoken
                                        ? 'bg-[#A84A32]/20 border-2 border-dashed border-[#A84A32] text-transparent select-none min-w-[64px] animate-pulse'
                                        : 'bg-[#C88A14]/25 border-2 border-dashed border-[#C88A14] text-transparent select-none min-w-[64px]'
                                      : 'bg-[#C88A14] text-[#FFFDF9] shadow-2xs'
                                    : isWordSpokenInRep || isPastRepAyah
                                    ? 'text-[#3B5934] bg-[#4A6144]/12'
                                    : isCurrentRepAyah
                                    ? hideInBlindRep
                                      ? 'bg-[#EFE9DC]/60 text-transparent select-none'
                                      : 'bg-[#FBF5E6] text-[#261C14] border-b border-[#C88A14]/40'
                                    : 'text-[#84715E]/60'
                                }`}
                              >
                                {isCurrentRepAyah && hideInBlindRep ? '••••' : word.textUthmani}
                              </span>
                              {word.isLastWordInAyah && (
                                <span className="font-uthmani text-base sm:text-xl text-[#C88A14] mx-1 select-none">
                                  ﴿{toArabicNumerals(group.ayahNumber)}﴾
                                </span>
                              )}
                            </React.Fragment>
                          );
                        }

                        // --- CASE C: REVIEW QUIZ MODE (`plan.planType === 'review'`) ---
                        const isQuizBlank = hiddenWordIndicesSet.has(word.globalIndex);
                        const isSolved = solvedQuizIndicesSet.has(word.globalIndex);
                        const isCurrentQuestion =
                          quizQuestions[currentQuizStep]?.wordIndex === word.globalIndex;

                        return (
                          <React.Fragment key={word.globalIndex}>
                            <span
                              ref={isCurrentQuestion ? activeWordDomRef : null}
                              onClick={() => {
                                const qIdx = quizQuestionIndexByWordIndex.get(word.globalIndex);
                                if (qIdx !== undefined) {
                                  setCurrentQuizStep(qIdx);
                                }
                              }}
                              className={`font-uthmani text-xl sm:text-[26px] inline-block px-2 py-0.5 mx-0.5 my-0.5 rounded-lg transition-colors duration-100 cursor-pointer ${
                                isQuizBlank && quizStarted && !isSolved
                                  ? isCurrentQuestion
                                    ? lastMismatchSpoken
                                      ? 'bg-[#A84A32]/30 text-transparent border-2 border-dashed border-[#A84A32] min-w-[64px] text-center select-none animate-pulse'
                                      : 'bg-[#C88A14] text-transparent border-2 border-[#2D2218] min-w-[64px] text-center select-none'
                                    : 'bg-[#EFE9DC] text-transparent border border-dashed border-[#84715E]/60 min-w-[50px] select-none'
                                  : isSolved
                                  ? 'bg-[#4A6144]/20 text-[#3B5934] font-bold'
                                  : 'text-[#261C14]'
                              }`}
                            >
                              {isQuizBlank && quizStarted && !isSolved ? '••••' : word.textUthmani}
                            </span>
                            {word.isLastWordInAyah && (
                              <span className="font-uthmani text-base sm:text-xl text-[#C88A14] mx-1 select-none">
                                ﴿{toArabicNumerals(group.ayahNumber)}﴾
                              </span>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}

                {plan.planType === 'sard' && !revealAllPreview && currentWordIndex === 0 && (
                  <div className="my-6 p-4 rounded-2xl bg-[#F6E9C8]/45 border border-dashed border-[#C88A14]/60 text-center space-y-1">
                    <p className="font-display-islamic font-bold text-sm sm:text-base text-[#2D2218]">
                      {lang === 'ar'
                        ? 'الآيات والكلمات مخفية — ابدأ السرد بالميكروفون وستظهر كل كلمة وآية فور تطابق قراءتك معها'
                        : 'Verses and words are hidden — start reciting into the microphone and each word will appear as it matches your voice'}
                    </p>
                    <p className="text-xs text-[#5C4B3B]">
                      {lang === 'ar'
                        ? `الآية الحالية: سورة ${
                            ayahGroups[0]?.surahNameAr || ''
                          } — الآية ${toArabicNumerals(ayahGroups[0]?.ayahNumber || 1)}`
                        : `Current Verse: Surah ${ayahGroups[0]?.surahNameAr || ''} — Ayah ${
                            ayahGroups[0]?.ayahNumber || 1
                          }`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sequential Mushaf Page Navigation Footer inside the Mushaf Card */}
          {!isFocusMode && totalPlanPages > 1 && (
            <div
              dir="rtl"
              className="mt-4 pt-2.5 border-t border-[#DFD2B8] flex items-center justify-between gap-2 text-xs"
            >
              <button
                type="button"
                disabled={!hasPrevPage}
                onClick={() => prevMushafPage !== null && goToMushafPage(prevMushafPage)}
                className="px-3 py-1 rounded-lg bg-[#F7F3EB] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-[#2D2218] font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <ChevronRight className="w-3.5 h-3.5 text-[#C88A14]" />
                <span>الصفحة السابقة</span>
              </button>

              <span className="font-display-islamic font-bold text-[#5C4B3B]">
                صفحة {toArabicNumerals(currentPlanPageOrder)} من {toArabicNumerals(totalPlanPages)}{' '}
                (ص {toArabicNumerals(currentPage)})
              </span>

              <button
                type="button"
                disabled={!hasNextPage}
                onClick={() => nextMushafPage !== null && goToMushafPage(nextMushafPage)}
                className="px-3 py-1 rounded-lg bg-[#F7F3EB] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-[#2D2218] font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <span>الصفحة التالية</span>
                <ChevronLeft className="w-3.5 h-3.5 text-[#C88A14]" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* =================================================================================
          2. CONTROL DOCK: FLOATING MINIMAL DOCK IN FOCUS MODE | FULL 34dvh DOCK IN STANDARD MODE
         ================================================================================= */}
      {!isFocusMode ? (
        <div className="shrink-0 max-h-[34dvh] overflow-y-auto px-3 py-2 sm:px-5 sm:py-2.5 earthy-gradient-banner text-[#FFFDF9] border-t border-[#C88A14]/50 shadow-lg">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Thin Progress Bar */}
          <div className="w-full h-1 rounded-full bg-black/30 overflow-hidden">
            <div
              className="h-full bg-[#EAB338] transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* --- SARD CONTROLS (`plan.planType === 'sard'`) --- */}
          {plan.planType === 'sard' && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Primary Start/Pause Sard Button + Live Speech Match Status */}
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <button
                    type="button"
                    onClick={toggleMicrophoneSession}
                    className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs shrink-0 ${
                      isListening
                        ? 'bg-[#A84A32] hover:bg-[#8E3B25] text-white'
                        : 'mustard-gradient-btn text-[#FFFDF9]'
                    }`}
                  >
                    {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{isListening ? dict.stopSardBtn : dict.startSardBtn}</span>
                  </button>

                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#E6D7BE] truncate">
                    <Sparkles
                      className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                        voiceActive ? 'text-[#EAB338] scale-125' : 'text-[#E6D7BE]/45'
                      }`}
                    />
                    {lastMismatchSpoken ? (
                      <span className="text-[#F8B4A0] font-semibold truncate">
                        {lang === 'ar'
                          ? `لم تتطابق: "${lastMismatchSpoken}" — أعد قراءة الكلمة`
                          : `Mismatch: "${lastMismatchSpoken}" — repeat word`}
                      </span>
                    ) : lastMatchedSpoken ? (
                      <span className="text-[#A8E09F] font-semibold truncate">
                        {lang === 'ar'
                          ? `تطابق: "${lastMatchedSpoken}"`
                          : `Matched: "${lastMatchedSpoken}"`}
                      </span>
                    ) : (
                      <span className="truncate">
                        {!isListening
                          ? lang === 'ar'
                            ? 'اضغط بدء السرد واقرأ ليظهر النص المتطابق'
                            : 'Start & recite to reveal matching words'
                          : voiceActive
                          ? lang === 'ar'
                            ? 'جاري الإنصات ومطابقة الكلمات...'
                            : 'Listening & matching words...'
                          : lang === 'ar'
                          ? 'بانتظار قراءتك الصوتية'
                          : 'Waiting for your recitation'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Hint Current Word + Preview Toggle + Counter + Reset */}
                <div className="flex items-center gap-1.5">
                  {currentWordIndex < flatWords.length && (
                    <button
                      type="button"
                      onClick={handleRevealCurrentWordHint}
                      className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-[11px] font-bold text-[#EAB338] cursor-pointer flex items-center gap-1"
                      title={
                        lang === 'ar'
                          ? 'كشف الكلمة الحالية عند النسيان'
                          : 'Reveal current word hint'
                      }
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>{lang === 'ar' ? 'كشف كلمة' : 'Hint'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setRevealAllPreview((p) => !p)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                      revealAllPreview
                        ? 'bg-[#C88A14] text-[#FFFDF9] border-[#EAB338]'
                        : 'bg-black/25 text-[#E6D7BE] border-white/15 hover:text-white'
                    }`}
                  >
                    {lang === 'ar'
                      ? revealAllPreview
                        ? 'إخفاء للسرد'
                        : 'معاينة'
                      : revealAllPreview
                      ? 'Hide'
                      : 'Preview'}
                  </button>

                  <span className="text-xs font-mono-tabular text-[#EAB338] font-bold px-1">
                    {currentWordIndex}/{flatWords.length}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      stopListeningSession();
                      setSardStarted(true);
                      setRevealAllPreview(false);
                      currentIndexRef.current = 0;
                      setCurrentWordIndex(0);
                      setMistakeIndices([]);
                      setLastMatchedSpoken('');
                      setLastMismatchSpoken('');
                      lastConsumedTokenNormRef.current = '';
                    }}
                    title={dict.resetSessionBtn}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#E6D7BE] hover:text-white cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- NEW MEMORIZATION CONTROLS (`plan.planType === 'new_memorization'`) --- */}
          {plan.planType === 'new_memorization' && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                  <button
                    type="button"
                    onClick={toggleMicrophoneSession}
                    className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0 ${
                      isListening
                        ? 'bg-[#A84A32] text-white'
                        : 'mustard-gradient-btn text-[#FFFDF9]'
                    }`}
                  >
                    {isListening ? (
                      <MicOff className="w-3.5 h-3.5" />
                    ) : (
                      <Mic className="w-3.5 h-3.5" />
                    )}
                    <span>{isListening ? dict.stopRepeatBtn : dict.startRepeatBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const nextRep = currentAyahRepCountRef.current + 1;
                      if (nextRep < targetRepsRef.current) {
                        currentAyahRepCountRef.current = nextRep;
                        setCurrentAyahRepCount(nextRep);
                        ayahWordOffsetRef.current = 0;
                        setAyahWordOffset(0);
                      } else if (activeAyahIdxRef.current + 1 < ayahGroups.length) {
                        const nextAyah = activeAyahIdxRef.current + 1;
                        activeAyahIdxRef.current = nextAyah;
                        setActiveAyahIdx(nextAyah);
                        currentAyahRepCountRef.current = 0;
                        setCurrentAyahRepCount(0);
                        ayahWordOffsetRef.current = 0;
                        setAyahWordOffset(0);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-bold text-[#FFFDF9] cursor-pointer shrink-0"
                  >
                    {lang === 'ar'
                      ? `تكرار (${currentAyahRepCount + 1}/${targetReps})`
                      : `Rep (${currentAyahRepCount + 1}/${targetReps})`}
                  </button>

                  <div className="flex items-center gap-1 text-[11px] sm:text-xs text-[#E6D7BE] truncate">
                    <Sparkles
                      className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                        voiceActive ? 'text-[#EAB338] scale-125' : 'text-[#E6D7BE]/45'
                      }`}
                    />
                    {lastMismatchSpoken ? (
                      <span className="text-[#F8B4A0] font-semibold truncate">
                        {lang === 'ar'
                          ? `لم تتطابق: "${lastMismatchSpoken}"`
                          : `Mismatch: "${lastMismatchSpoken}"`}
                      </span>
                    ) : lastMatchedSpoken ? (
                      <span className="text-[#A8E09F] font-semibold truncate">
                        {lang === 'ar'
                          ? `تطابق: "${lastMatchedSpoken}"`
                          : `Matched: "${lastMatchedSpoken}"`}
                      </span>
                    ) : (
                      <span className="truncate">
                        {!isListening
                          ? lang === 'ar'
                            ? 'اضغط وابدأ القراءة للتكرار الصوتي'
                            : 'Start voice repetition'
                          : lang === 'ar'
                          ? 'جاري الإنصات ومطابقة الكلمات...'
                          : 'Listening & matching...'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRevealAllPreview((p) => !p)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                      revealAllPreview
                        ? 'bg-[#C88A14] text-[#FFFDF9] border-[#EAB338]'
                        : 'bg-black/25 text-[#E6D7BE] border-white/15 hover:text-white'
                    }`}
                  >
                    {lang === 'ar'
                      ? revealAllPreview
                        ? 'إخفاء للاستظهار'
                        : 'معاينة'
                      : revealAllPreview
                      ? 'Hide'
                      : 'Preview'}
                  </button>

                  <button
                    type="button"
                    onClick={handleRevealCurrentWordHint}
                    className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-[11px] font-bold text-[#EAB338] cursor-pointer flex items-center gap-1"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'كشف كلمة' : 'Hint'}</span>
                  </button>

                  <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-black/25 border border-white/15">
                    {[3, 5, 7, 10].map((rNum) => (
                      <button
                        key={rNum}
                        type="button"
                        onClick={() => {
                          targetRepsRef.current = rNum;
                          setTargetReps(rNum);
                          currentAyahRepCountRef.current = 0;
                          setCurrentAyahRepCount(0);
                        }}
                        className={`px-2 py-0.5 rounded-md text-xs font-mono-tabular font-bold cursor-pointer ${
                          targetReps === rNum
                            ? 'bg-[#C88A14] text-[#FFFDF9]'
                            : 'text-[#E6D7BE]'
                        }`}
                      >
                        {rNum}×
                      </button>
                    ))}
                  </div>

                  <span className="text-xs font-mono-tabular text-[#EAB338] font-bold">
                    {activeAyahIdx + 1}/{ayahGroups.length}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      stopListeningSession();
                      activeAyahIdxRef.current = 0;
                      setActiveAyahIdx(0);
                      currentAyahRepCountRef.current = 0;
                      setCurrentAyahRepCount(0);
                      ayahWordOffsetRef.current = 0;
                      setAyahWordOffset(0);
                      setLastMatchedSpoken('');
                      setLastMismatchSpoken('');
                      lastConsumedTokenNormRef.current = '';
                    }}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#E6D7BE] cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- REVIEW QUIZ CONTROLS (`plan.planType === 'review'`) --- */}
          {plan.planType === 'review' && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Microphone Voice Review Button */}
                  <button
                    type="button"
                    onClick={toggleMicrophoneSession}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                      isListening
                        ? 'bg-[#A84A32] text-white'
                        : 'mustard-gradient-btn text-[#FFFDF9]'
                    }`}
                  >
                    {isListening ? (
                      <MicOff className="w-3.5 h-3.5" />
                    ) : (
                      <Mic className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isListening
                        ? lang === 'ar'
                          ? 'إيقاف الإنصات'
                          : 'Stop Mic'
                        : lang === 'ar'
                        ? 'إنصات للمراجعة'
                        : 'Voice Review'}
                    </span>
                  </button>

                  {(
                    [
                      { id: 'beginner', labelAr: 'مبتدئ', labelEn: 'Easy' },
                      { id: 'intermediate', labelAr: 'متوسط', labelEn: 'Med' },
                      { id: 'advanced', labelAr: 'متقدم 50%', labelEn: 'Adv 50%' },
                      { id: 'hafiz', labelAr: 'حافظ', labelEn: 'Hafiz' },
                    ] as const
                  ).map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setQuizLevel(lvl.id)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                        quizLevel === lvl.id
                          ? 'bg-[#C88A14] text-[#FFFDF9]'
                          : 'bg-black/25 text-[#E6D7BE] hover:text-white'
                      }`}
                    >
                      {lang === 'ar' ? lvl.labelAr : lvl.labelEn}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setShowExtraControls((s) => !s)}
                    className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-[#EAB338] flex items-center gap-1 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'النمط' : 'Mode'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {isListening && (
                    <span className="text-[11px] font-semibold truncate max-w-[170px]">
                      {lastMismatchSpoken ? (
                        <span className="text-[#F8B4A0]">
                          {lang === 'ar'
                            ? `لم تتطابق: "${lastMismatchSpoken}"`
                            : `Mismatch: "${lastMismatchSpoken}"`}
                        </span>
                      ) : lastMatchedSpoken ? (
                        <span className="text-[#A8E09F]">
                          {lang === 'ar'
                            ? `تطابق: "${lastMatchedSpoken}"`
                            : `Matched: "${lastMatchedSpoken}"`}
                        </span>
                      ) : (
                        <span className="text-[#E6D7BE]">
                          {lang === 'ar' ? 'انطق الكلمة المفقودة...' : 'Speak missing word...'}
                        </span>
                      )}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const currentQ = quizQuestions[currentQuizStep];
                      if (!currentQ) return;
                      if (!solvedQuizIndices.includes(currentQ.wordIndex)) {
                        setSolvedQuizIndices((prev) => [...prev, currentQ.wordIndex]);
                      }
                      if (currentQuizStep + 1 < quizQuestions.length) {
                        setCurrentQuizStep((s) => s + 1);
                      }
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold text-[#FFFDF9] cursor-pointer"
                  >
                    {lang === 'ar' ? 'كشف' : 'Reveal'}
                  </button>
                  <span className="font-mono-tabular text-[#EAB338] font-bold">
                    {solvedQuizIndices.length}/{quizQuestions.length}
                  </span>
                </div>
              </div>

              {showExtraControls && (
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  {(
                    [
                      { id: 'word_completion', labelAr: 'إكمال الكلمات', labelEn: 'Words' },
                      { id: 'ayah_connection', labelAr: 'ربط الآيات', labelEn: 'Verses' },
                      { id: 'verse_endings', labelAr: 'الخواتيم', labelEn: 'Endings' },
                    ] as const
                  ).map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setQuizFormat(fmt.id)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold cursor-pointer ${
                        quizFormat === fmt.id
                          ? 'bg-[#FFFDF9] text-[#2D2218]'
                          : 'bg-black/25 text-[#E6D7BE]'
                      }`}
                    >
                      {lang === 'ar' ? fmt.labelAr : fmt.labelEn}
                    </button>
                  ))}
                </div>
              )}

              {quizQuestions[currentQuizStep] && (
                <div className="grid grid-cols-4 gap-1.5">
                  {quizQuestions[currentQuizStep].choices.map((choice) => {
                    const isWrong = wrongChoiceFlash === choice;
                    return (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => handleSelectQuizChoice(choice)}
                        className={`py-1 px-2 rounded-xl font-uthmani text-base sm:text-lg transition-all cursor-pointer border text-center truncate ${
                          isWrong
                            ? 'bg-[#A84A32] text-white border-[#A84A32]'
                            : 'bg-[#FFFDF9] text-[#261C14] border-[#C88A14] hover:bg-[#F6E9C8]'
                        }`}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =================================================================================
              3. FLEXIBLE EVALUATION & PLAN COMPLETION BAR
                 (مُثبَّت | مُتردِّد | مُتفلِّت | إنهاء | إلغاء)
             ================================================================================= */}
          <div className="pt-1.5 border-t border-white/15 flex flex-wrap items-center justify-between gap-2">
            {/* Evaluation Pills: مثبت | متردد | متفلت */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-[#EAB338]">
                {lang === 'ar' ? 'التقييم:' : 'Rate:'}
              </span>

              <button
                type="button"
                onClick={() => handleOpenFinishConfirmDialog('muthabbat')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                  selectedEvaluation === 'muthabbat'
                    ? 'bg-[#4A6144] text-white border-[#88B87E]'
                    : 'bg-[#4A6144]/90 hover:bg-[#4A6144] text-white border-white/20'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>{lang === 'ar' ? 'مُثبَّت' : 'Mastered'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenFinishConfirmDialog('mutaraddid')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  selectedEvaluation === 'mutaraddid'
                    ? 'bg-[#C88A14] text-white border-[#F6E9C8]'
                    : 'bg-[#C88A14]/90 hover:bg-[#C88A14] text-white border-white/20'
                }`}
              >
                <span>{lang === 'ar' ? 'مُتردِّد' : 'Hesitant'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenFinishConfirmDialog('mutafallit')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  selectedEvaluation === 'mutafallit'
                    ? 'bg-[#A84A32] text-white border-[#F3B5A4]'
                    : 'bg-[#A84A32]/90 hover:bg-[#A84A32] text-white border-white/20'
                }`}
              >
                <span>{lang === 'ar' ? 'مُتفلِّت' : 'Slipping'}</span>
              </button>
            </div>

            {/* Finish Plan & Cancel Buttons */}
            <div className="flex items-center gap-1.5 ms-auto">
              <button
                type="button"
                onClick={() => handleOpenFinishConfirmDialog(selectedEvaluation)}
                className="px-3 py-1 rounded-lg bg-[#FFFDF9] hover:bg-[#F6E9C8] text-[#2D2218] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <CheckCircle2 className="w-3 h-3 text-[#4A6144]" />
                <span>{lang === 'ar' ? 'إنهاء' : 'Finish'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopListeningSession();
                  onClose();
                }}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-[#FFFDF9] text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>{dict.cancelBtn}</span>
              </button>
            </div>
          </div>

          {speechError && (
            <div className="p-1.5 rounded-lg bg-black/30 border border-[#EAB338]/40 text-xs text-[#F6E9C8] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-[#EAB338] shrink-0" />
              <span>{speechError}</span>
            </div>
          )}
        </div>
      </div>
      ) : (
        /* Floating Focus Mode Minimal Dock — Distraction-Free Luxury Recitation Bar */
        <div className="fixed bottom-3 sm:bottom-5 inset-x-0 z-40 flex items-center justify-center pointer-events-none px-3">
          <div className="pointer-events-auto bg-[#2D2218]/94 backdrop-blur-md border border-[#C88A14]/60 text-[#FFFDF9] rounded-2xl shadow-xl px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 max-w-xl w-full justify-between">
            {/* 1. Microphone Session Toggle */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={toggleMicrophoneSession}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shrink-0 ${
                  isListening
                    ? 'bg-[#A84A32] hover:bg-[#8E3B25] text-white animate-pulse'
                    : 'mustard-gradient-btn text-[#FFFDF9]'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>
                  {isListening
                    ? plan.planType === 'sard'
                      ? dict.stopSardBtn
                      : dict.stopRepeatBtn
                    : plan.planType === 'sard'
                    ? dict.startSardBtn
                    : dict.startRepeatBtn}
                </span>
              </button>

              {/* Live Match Voice Indicator */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#E6D7BE] truncate">
                <Sparkles
                  className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                    voiceActive ? 'text-[#EAB338] scale-125' : 'text-[#E6D7BE]/45'
                  }`}
                />
                {lastMismatchSpoken ? (
                  <span className="text-[#F8B4A0] font-semibold truncate">
                    {lang === 'ar'
                      ? `لم تتطابق: "${lastMismatchSpoken}"`
                      : `Mismatch: "${lastMismatchSpoken}"`}
                  </span>
                ) : lastMatchedSpoken ? (
                  <span className="text-[#A8E09F] font-semibold truncate">
                    {lang === 'ar'
                      ? `تطابق: "${lastMatchedSpoken}"`
                      : `Matched: "${lastMatchedSpoken}"`}
                  </span>
                ) : (
                  <span className="truncate">
                    {isListening
                      ? lang === 'ar'
                        ? 'إنصات ومطابقة...'
                        : 'Listening...'
                      : lang === 'ar'
                      ? 'وضع التركيز'
                      : 'Focus Mode'}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Middle Tools: Word Hint + Counter + Optional Page Stepping */}
            <div className="flex items-center gap-1.5 shrink-0">
              {currentWordIndex < flatWords.length && (
                <button
                  type="button"
                  onClick={handleRevealCurrentWordHint}
                  className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-[#EAB338] cursor-pointer flex items-center gap-1"
                  title={lang === 'ar' ? 'كشف الكلمة التالية' : 'Hint'}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{lang === 'ar' ? 'كشف كلمة' : 'Hint'}</span>
                </button>
              )}

              <span className="text-xs font-mono-tabular text-[#EAB338] font-bold px-2 py-1 rounded-lg bg-black/30 border border-white/10">
                {plan.planType === 'sard'
                  ? `${currentWordIndex}/${flatWords.length}`
                  : `${activeAyahIdx + 1}/${ayahGroups.length}`}
              </span>

              {/* Multi-page stepping in Focus Mode */}
              {totalPlanPages > 1 && (
                <div
                  dir="rtl"
                  className="flex items-center gap-0.5 bg-black/30 p-0.5 rounded-lg border border-white/10"
                >
                  <button
                    type="button"
                    disabled={!hasPrevPage}
                    onClick={() => prevMushafPage !== null && goToMushafPage(prevMushafPage)}
                    className="p-1 disabled:opacity-30 hover:text-[#EAB338] text-white cursor-pointer"
                    title={dict.prevPageBtn}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono-tabular font-bold text-[#E6D7BE] px-1">
                    {toArabicNumerals(currentPage)}
                  </span>
                  <button
                    type="button"
                    disabled={!hasNextPage}
                    onClick={() => nextMushafPage !== null && goToMushafPage(nextMushafPage)}
                    className="p-1 disabled:opacity-30 hover:text-[#EAB338] text-white cursor-pointer"
                    title={dict.nextPageBtn}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* 3. Finish / Done & Exit Focus Mode Buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() =>
                  handleOpenFinishConfirmDialog(selectedEvaluation || 'muthabbat')
                }
                className="px-2.5 py-1.5 rounded-xl bg-[#4A6144] hover:bg-[#3D5237] text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                title={lang === 'ar' ? 'إنهاء وحفظ' : 'Finish'}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{lang === 'ar' ? 'إنهاء' : 'Done'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleFocus}
                title={dict.exitFocusMode}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-[#EAB338] hover:text-white transition-colors cursor-pointer"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          FINISH & PLAN COMPLETION CONFIRMATION MODAL
          Ensures the plan is NEVER automatically marked completed unless explicitly chosen
          ===================================================================== */}
      {showFinishConfirmDialog && (
        <div
          className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          <div className="bg-[#FFFDF9] rounded-2xl max-w-md w-full border border-[#DDD2BE] shadow-2xl p-5 sm:p-6 text-[#2D2218] space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD2BE]/70">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#4A6144]/15 text-[#4A6144] flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#2D2218]">
                    {lang === 'ar' ? 'إنهاء جلسة التلاوة' : 'Finish Recitation Session'}
                  </h3>
                  <p className="text-xs text-[#84715E]">
                    {formatCurriculumTitle(plan, lang)} · {getPlanTypeLabel(plan.planType, lang)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFinishConfirmDialog(false)}
                className="p-1.5 rounded-lg text-[#84715E] hover:text-[#2D2218] hover:bg-[#F0ECE1] transition-colors cursor-pointer"
                title={lang === 'ar' ? 'إغلاق' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Session Stats */}
            <div className="bg-[#F7F3EB] rounded-xl p-3 border border-[#DDD2BE]/70 grid grid-cols-2 gap-2 text-center text-xs">
              <div>
                <span className="text-[#84715E] block text-[11px]">
                  {lang === 'ar' ? 'الصفحة الحالية' : 'Current Page'}
                </span>
                <span className="font-bold text-[#2D2218] text-sm font-mono-tabular">
                  {lang === 'ar' ? `صفحة ${toArabicNumerals(currentPage)}` : `p. ${currentPage}`}
                </span>
              </div>
              <div>
                <span className="text-[#84715E] block text-[11px]">
                  {lang === 'ar' ? 'عدد التنبيهات / الأخطاء' : 'Notes / Mistakes'}
                </span>
                <span className="font-bold text-[#A84A32] text-sm font-mono-tabular">
                  {lang === 'ar'
                    ? toArabicNumerals(
                        plan.planType === 'review' ? wrongQuizAttempts : mistakeIndices.length
                      )
                    : plan.planType === 'review'
                    ? wrongQuizAttempts
                    : mistakeIndices.length}
                </span>
              </div>
            </div>

            {/* Evaluation selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#2D2218] block">
                {lang === 'ar' ? 'تقييم الحفظ والإتقان في هذه الجلسة:' : 'Session Mastery Rating:'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEvaluation('muthabbat')}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    selectedEvaluation === 'muthabbat'
                      ? 'bg-[#4A6144] text-white border-[#4A6144] shadow-xs'
                      : 'bg-[#F7F3EB] text-[#4A6144] border-[#DDD2BE] hover:border-[#4A6144]'
                  }`}
                >
                  <span className="text-[13px]">{lang === 'ar' ? 'مُثبَّت' : 'Mastered'}</span>
                  <span className="text-[9px] opacity-80">{lang === 'ar' ? 'متقن' : 'Fluent'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedEvaluation('mutaraddid')}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    selectedEvaluation === 'mutaraddid'
                      ? 'bg-[#C88A14] text-white border-[#C88A14] shadow-xs'
                      : 'bg-[#F7F3EB] text-[#C88A14] border-[#DDD2BE] hover:border-[#C88A14]'
                  }`}
                >
                  <span className="text-[13px]">{lang === 'ar' ? 'مُتردِّد' : 'Hesitant'}</span>
                  <span className="text-[9px] opacity-80">{lang === 'ar' ? 'متوسط' : 'Moderate'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedEvaluation('mutafallit')}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    selectedEvaluation === 'mutafallit'
                      ? 'bg-[#A84A32] text-white border-[#A84A32] shadow-xs'
                      : 'bg-[#F7F3EB] text-[#A84A32] border-[#DDD2BE] hover:border-[#A84A32]'
                  }`}
                >
                  <span className="text-[13px]">{lang === 'ar' ? 'مُتفلِّت' : 'Slipping'}</span>
                  <span className="text-[9px] opacity-80">{lang === 'ar' ? 'بحاجة لمراجعة' : 'Needs Work'}</span>
                </button>
              </div>
            </div>

            {/* The Main Decision: Complete or Keep Incomplete */}
            <div className="pt-2 border-t border-[#DDD2BE]/70 space-y-2.5">
              <p className="text-xs font-bold text-[#2D2218] text-center">
                {lang === 'ar'
                  ? 'هل ترغب في اعتماد الخطة كمكتملة في جدولك الأسبوعي؟'
                  : 'Do you want to mark this plan as completed in your weekly schedule?'}
              </p>

              <div className="space-y-2">
                {/* Option 1: Yes, Mark as Completed */}
                <button
                  type="button"
                  onClick={() => handleConfirmPlanFinish(true, selectedEvaluation)}
                  className="w-full p-3 rounded-xl bg-[#4A6144] hover:bg-[#3D5237] text-white font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-xs flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 text-start">
                    <CheckCircle2 className="w-5 h-5 text-[#88B87E] shrink-0" />
                    <div>
                      <div>{lang === 'ar' ? 'نعم، اعتماد الخطة كمكتملة' : 'Yes, mark plan as completed'}</div>
                      <div className="text-[10px] text-white/80 font-normal">
                        {lang === 'ar'
                          ? 'سيتم تعليم الخطة كمنجزة في الجدول الأسبوعي'
                          : 'Plan will be checked as done in your schedule'}
                      </div>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 shrink-0 opacity-80 rtl:rotate-0 ltr:rotate-180" />
                </button>

                {/* Option 2: Finish but Keep Incomplete */}
                <button
                  type="button"
                  onClick={() => handleConfirmPlanFinish(false, selectedEvaluation)}
                  className="w-full p-3 rounded-xl bg-[#F7F3EB] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-[#2D2218] font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-2xs flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 text-start">
                    <RotateCcw className="w-4 h-4 text-[#C88A14] shrink-0" />
                    <div>
                      <div>{lang === 'ar' ? 'إنهاء وإبقاء الخطة غير مكتملة' : 'Finish & keep plan incomplete'}</div>
                      <div className="text-[10px] text-[#84715E] font-normal">
                        {lang === 'ar'
                          ? 'لحفظ الملاحظات ومتابعة تلاوتها لاحقاً'
                          : 'Saves notes & keeps it pending to practice later'}
                      </div>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 shrink-0 text-[#84715E] rtl:rotate-0 ltr:rotate-180" />
                </button>
              </div>

              {/* Cancel / Resume Button */}
              <button
                type="button"
                onClick={() => setShowFinishConfirmDialog(false)}
                className="w-full py-2 text-center text-xs font-semibold text-[#84715E] hover:text-[#2D2218] transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'العودة لمتابعة القراءة' : 'Resume / Continue Reading'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
