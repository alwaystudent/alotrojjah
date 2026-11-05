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
} from 'lucide-react';
import {
  Language,
  QuranPlanItem,
  PlanEvaluation,
  QuizLevel,
  SURAH_LIST,
  JUZ_LIST,
  getPlanMushafPageRange,
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
  onClose: () => void;
  onCompletePlanSard: (
    planId: string,
    mistakesCount: number,
    evaluation?: PlanEvaluation,
    quizLevel?: QuizLevel
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

export function normalizeArabicForAlignment(raw: string, expandDaggerAlif = false): string {
  if (!raw) return '';
  let s = raw;

  // Convert Uthmani Tatweel+Hamza (ـٔ / ـٕ) to Alif before stripping diacritics
  s = s.replace(/\u0640[\u0654\u0655]/g, 'ا');

  if (expandDaggerAlif) {
    // In Uthmani script: وٰ -> ا (e.g. الصلوٰة -> الصلاة), ىٰ -> ي (علىٰ -> علي), ـٰ -> ا (الكتـٰب -> الكتاب), ۧ/ۦ -> ي (إبرٰهيـۧم -> ابراهيم), ۥ -> و
    s = s
      .replace(/\u0648\u0670/g, 'ا')
      .replace(/[\u0649\u064A]\u0670/g, 'ي')
      .replace(/\u0670/g, 'ا')
      .replace(/[\u06E6\u06E7]/g, 'ي')
      .replace(/\u06E5/g, 'و');
  }

  s = s
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08F0-\u08FF]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671\u0672\u0673\u0675]/g, 'ا')
    .replace(/[\u0649\u06CC]/g, 'ي')
    .replace(/\u0629/g, 'ه')
    .replace(/[\u0624\u0626]/g, 'ء')
    .replace(/[^\u0621-\u064A]/g, '');

  // Normalize Uthmani initial/medial ءا -> ا (e.g. ءامنوا -> امنوا, بالاخره -> بالاخره)
  s = s.replace(/ءا/g, 'ا').replace(/ا+/g, 'ا').replace(/ي+/g, 'ي').replace(/و+/g, 'و');

  if (UTHMANI_WORD_MAP[s]) {
    s = UTHMANI_WORD_MAP[s];
  }

  return s.trim();
}

function getConsonantalSkeleton(norm: string): string {
  return norm.replace(/[اويءه]/g, '');
}

function getPhoneticSkeleton(norm: string): string {
  return norm
    .replace(/ء/g, 'ا')
    .replace(/ص/g, 'س')
    .replace(/ض/g, 'ذ')
    .replace(/ظ/g, 'ذ')
    .replace(/ط/g, 'ت')
    .replace(/ق/g, 'ك')
    .replace(/[اويءه]/g, '');
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
  onClose,
  onCompletePlanSard,
}) => {
  const dict = t(lang);
  const initialRange = useMemo(() => getPlanMushafPageRange(plan), [plan]);

  const [actualPageRange, setActualPageRange] = useState<{ startPage: number; endPage: number }>(
    initialRange
  );
  const [currentPage, setCurrentPage] = useState<number>(initialRange.startPage);
  const [ayahGroups, setAyahGroups] = useState<MushafAyahGroup[]>([]);
  const [flatWords, setFlatWords] = useState<MushafWordItem[]>([]);
  const [loadingPage, setLoadingPage] = useState<boolean>(true);
  const [pageJuz, setPageJuz] = useState<number>(1);
  const [selectedEvaluation, setSelectedEvaluation] = useState<PlanEvaluation | undefined>(
    plan.evaluation
  );
  const [showExtraControls, setShowExtraControls] = useState<boolean>(false);

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

  // Refs for continuous, strict speech-to-word alignment across all 3 plan types
  const recognitionRef = useRef<any>(null);
  const recognitionRestartTimerRef = useRef<any>(null);
  const voiceActivityTimeoutRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const flatWordsRef = useRef<MushafWordItem[]>([]);
  const ayahGroupsRef = useRef<MushafAyahGroup[]>([]);
  const currentIndexRef = useRef<number>(0);
  const lastWordAdvanceTimeRef = useRef<number>(0);
  const lastVoiceDetectedTimeRef = useRef<number>(0);
  const syncSpeedFactorRef = useRef<number>(defaultSyncSpeed);
  const processedResultIndexRef = useRef<number>(0);
  const processedTokenCountRef = useRef<number>(0);
  const lastConsumedTokenNormRef = useRef<string>('');
  const activeWordDomRef = useRef<HTMLSpanElement | null>(null);
  const mushafScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const handleSpeechResultRef = useRef<((event: any) => void) | null>(null);

  // Refs for Repetition & Review modes inside speech callback
  const activeAyahIdxRef = useRef<number>(0);
  const ayahWordOffsetRef = useRef<number>(0);
  const currentAyahRepCountRef = useRef<number>(0);
  const targetRepsRef = useRef<number>(defaultTargetReps);

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
    currentIndexRef.current = currentWordIndex;
    if (activeWordDomRef.current) {
      activeWordDomRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentWordIndex, ayahWordOffset, currentQuizStep]);

  // Resolve exact Madinah Mushaf startPage and endPage when plan.scope === 'ayah'
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

      const resolveExactAyahPages = async () => {
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
      const clamped = Math.max(
        actualPageRange.startPage,
        Math.min(actualPageRange.endPage, targetPage)
      );
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
      setCurrentPage(clamped);
      if (mushafScrollContainerRef.current) {
        mushafScrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [actualPageRange.startPage, actualPageRange.endPage]
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

  useEffect(() => {
    setCurrentQuizStep(0);
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
      } else if (plan.scope === 'surah' && plan.surahStart) {
        const s1 = Math.min(plan.surahStart, plan.surahEnd || plan.surahStart);
        const s2 = Math.max(plan.surahStart, plan.surahEnd || plan.surahStart);
        const matchingSurahs = sortedVerses.filter(
          (v) => v.surahNumber >= s1 && v.surahNumber <= s2
        );
        if (matchingSurahs.length > 0) {
          filteredVerses = matchingSurahs;
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
      setActiveAyahIdx(0);
      activeAyahIdxRef.current = 0;
      setCurrentAyahRepCount(0);
      currentAyahRepCountRef.current = 0;
      setAyahWordOffset(0);
      ayahWordOffsetRef.current = 0;
      setCurrentQuizStep(0);
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
      plan.juzStart,
      plan.juzEnd,
    ]
  );

  // Fetch Uthmani verses strictly page-by-page according to official Madinah Mushaf page numbers
  useEffect(() => {
    let cancelled = false;
    const fetchMushafVerses = async () => {
      setLoadingPage(true);
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

  // Stop microphone & speech recognition session cleanly
  const stopListeningSession = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    setVoiceActive(false);

    if (voiceActivityTimeoutRef.current) {
      clearTimeout(voiceActivityTimeoutRef.current);
      voiceActivityTimeoutRef.current = null;
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
      if (currentPage < actualPageRange.endPage) {
        goToMushafPage(currentPage + 1);
      } else {
        stopListeningSession();
      }
    }
  }, [
    plan.planType,
    sardStarted,
    loadingPage,
    flatWords.length,
    currentWordIndex,
    currentPage,
    actualPageRange.endPage,
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
        } else if (currentPage < actualPageRange.endPage) {
          goToMushafPage(currentPage + 1);
        } else {
          stopListeningSession();
        }
      }
    }
  }, [currentPage, actualPageRange.endPage, goToMushafPage, stopListeningSession]);

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
    } => {
      for (const rawSpoken of spokenTokensAtPos) {
        const spokenNorm = normalizeArabicForAlignment(rawSpoken, false);
        if (!spokenNorm) continue;

        // 1. Direct single-word match against Uthmani or Imla'i form
        const directScore = scoreSpokenAgainstMushafWord(spokenNorm, targetWord);
        if (directScore >= 0.76) {
          return {
            matched: true,
            wordsAdvanced: 1,
            tokensConsumed: 1,
            matchedText: rawSpoken,
          };
        }

        // 2. Prefix-attached/detached match (e.g. "والعصر" vs "العصر", "ولا" vs "لا", "فسبح" vs "سبح")
        if (
          spokenNorm.length >= 3 &&
          (spokenNorm.startsWith('و') || spokenNorm.startsWith('ف'))
        ) {
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
          (targetWord.normalizedWithDagger.startsWith('و') ||
            targetWord.normalizedWithDagger.startsWith('ف'))
        ) {
          const targetWithoutConjunction: MushafWordItem = {
            ...targetWord,
            normalizedText: targetWord.normalizedText.slice(1),
            normalizedWithDagger: targetWord.normalizedWithDagger.slice(1),
          };
          if (scoreSpokenAgainstMushafWord(spokenNorm, targetWithoutConjunction) >= 0.84) {
            return {
              matched: true,
              wordsAdvanced: 1,
              tokensConsumed: 1,
              matchedText: rawSpoken,
            };
          }
        }

        // 2b. Merged Previous + Current Word in ASR (e.g. ASR merges "الحمد" + "لله" into "الحمدلله" after "الحمد" was already matched)
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

        // 3. Compound 2-spoken-words -> 1-Uthmani-word (e.g. "يا أيها" -> "يَـٰٓأَيُّهَا", "يا قوم" -> "يَـٰقَوْمِ")
        if (nextSpokenToken) {
          const joinedSpoken = normalizeArabicForAlignment(rawSpoken + nextSpokenToken, false);
          if (scoreSpokenAgainstMushafWord(joinedSpoken, targetWord) >= 0.8) {
            return {
              matched: true,
              wordsAdvanced: 1,
              tokensConsumed: 2,
              matchedText: `${rawSpoken} ${nextSpokenToken}`,
            };
          }
        }

        // 4. Compound 1-spoken-word -> 2-Uthmani-words (e.g. "ألا" -> "أَن لَّا", "مما" -> "مِن مَّا", "الحمدلله" -> "ٱلْحَمْدُ لِلَّهِ")
        if (nextTargetWord) {
          const combinedTarget: MushafWordItem = {
            ...targetWord,
            normalizedText: targetWord.normalizedText + nextTargetWord.normalizedText,
            normalizedWithDagger:
              targetWord.normalizedWithDagger + nextTargetWord.normalizedWithDagger,
            skeletonText: targetWord.skeletonText + nextTargetWord.skeletonText,
            phoneticSkeleton: targetWord.phoneticSkeleton + nextTargetWord.phoneticSkeleton,
          };
          if (scoreSpokenAgainstMushafWord(spokenNorm, combinedTarget) >= 0.82) {
            return {
              matched: true,
              wordsAdvanced: 2,
              tokensConsumed: 1,
              matchedText: rawSpoken,
            };
          }
        }

        // 5A. Contextual 2-token lock: if token[i+1] matches nextTargetWord strongly, then token[i] + token[i+1] are targetWord + nextTargetWord
        if (nextSpokenToken && nextTargetWord) {
          const nextSpokenNorm = normalizeArabicForAlignment(nextSpokenToken, false);
          if (scoreSpokenAgainstMushafWord(nextSpokenNorm, nextTargetWord) >= 0.84) {
            return {
              matched: true,
              wordsAdvanced: 2,
              tokensConsumed: 2,
              matchedText: `${rawSpoken} ${nextSpokenToken}`,
            };
          }
        }

        // 5B. 1-word lookahead bridge when ASR drops/fuses a word and clearly recognizes the immediately following word
        if (
          nextTargetWord &&
          nextTargetWord.normalizedText !== targetWord.normalizedText &&
          (targetWord.normalizedText.length <= 3 || !targetWord.isFirstWordInAyah)
        ) {
          const nextScore = Math.max(
            scoreSpokenAgainstMushafWord(spokenNorm, nextTargetWord),
            spokenNorm.length >= 4 && (spokenNorm.startsWith('و') || spokenNorm.startsWith('ف'))
              ? scoreSpokenAgainstMushafWord(spokenNorm.slice(1), nextTargetWord)
              : 0
          );
          if (nextScore >= 0.86) {
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
            lastConsumedTokenNormRef.current = normalizeArabicForAlignment(
              primaryTokens[Math.min(primaryTokens.length - 1, i + matchRes.tokensConsumed - 1)],
              false
            );
            i += matchRes.tokensConsumed;
            processedTokenCountRef.current = i;
          } else if (
            isIntroductoryFormulaWord &&
            (currIdx === 0 || targetWord.isFirstWordInAyah)
          ) {
            // Gracefully accept Isti'adhah / Basmalah at the start of a verse without flagging a mismatch
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
            lastConsumedTokenNormRef.current = normalizeArabicForAlignment(
              primaryTokens[Math.min(primaryTokens.length - 1, i + matchRes.tokensConsumed - 1)],
              false
            );
            i += matchRes.tokensConsumed;
            processedTokenCountRef.current = i;
          } else if (isIntroductoryFormulaWord && currOffset === 0) {
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
            if (!solvedQuizIndices.includes(currentQ.wordIndex)) {
              setSolvedQuizIndices((prev) => [...prev, currentQ.wordIndex]);
            }
            if (currentQuizStep + 1 < quizQuestions.length) {
              setCurrentQuizStep((s) => s + 1);
            } else if (currentPage < actualPageRange.endPage) {
              goToMushafPage(currentPage + 1);
            } else {
              stopListeningSession();
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

  // Start Real-Time Speech-to-Verse Matching Session (Synchronous start, zero getUserMedia mic contention!)
  const startListeningSession = () => {
    setSpeechError(null);
    setSardStarted(true);
    setRevealAllPreview(false);
    setLastMatchedSpoken('');
    setLastMismatchSpoken('');
    lastWordAdvanceTimeRef.current = 0;
    lastVoiceDetectedTimeRef.current = 0;
    processedResultIndexRef.current = 0;
    processedTokenCountRef.current = 0;
    lastConsumedTokenNormRef.current = '';

    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setSpeechError(
        lang === 'ar'
          ? 'متصفحك الحالي لا يدعم التعرف الصوتي المباشر (SpeechRecognition). يرجى استخدام متصفح Chrome أو Edge أو Safari لمطابقة القراءة الصوتية مع الآيات.'
          : 'Your browser does not support Web SpeechRecognition. Please use Chrome, Edge, or Safari to match spoken recitation with verses.'
      );
      return;
    }

    // Stop any previous instance cleanly before starting
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;

      recognition.onsoundstart = () => {
        if (!isListeningRef.current) return;
        setVoiceActive(true);
      };

      recognition.onspeechstart = () => {
        if (!isListeningRef.current) return;
        setVoiceActive(true);
      };

      recognition.onresult = (event: any) => {
        handleSpeechResultRef.current?.(event);
      };

      recognition.onerror = (event: any) => {
        const errCode = event?.error;
        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          setSpeechError(
            lang === 'ar'
              ? 'يرجى السماح بصلاحية الميكروفون في المتصفح لمطابقة كلامك مع الآيات.'
              : 'Please allow microphone access to match your speech with the verses.'
          );
          stopListeningSession();
        } else if (errCode === 'audio-capture') {
          setSpeechError(
            lang === 'ar'
              ? 'تعذر الوصول إلى الميكروفون. تأكد من عدم استخدامه بواسطة تطبيق آخر.'
              : 'Microphone is unavailable or in use by another application.'
          );
          stopListeningSession();
        }
      };

      recognition.onend = () => {
        if (!isListeningRef.current) return;
        // Reconnect recognition session smoothly if the browser ended the stream after a pause
        recognitionRestartTimerRef.current = setTimeout(() => {
          if (!isListeningRef.current || !recognitionRef.current) return;
          try {
            processedResultIndexRef.current = 0;
            processedTokenCountRef.current = 0;
            lastConsumedTokenNormRef.current = '';
            recognitionRef.current.start();
          } catch {
            // Ignore if already started
          }
        }, 300);
      };

      recognitionRef.current = recognition;
      isListeningRef.current = true;
      setIsListening(true);
      recognition.start();
    } catch {
      setSpeechError(
        lang === 'ar'
          ? 'تعذر بدء التعرف الصوتي. تأكد من صلاحية الميكروفون.'
          : 'Could not start speech recognition. Please check microphone permissions.'
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
      } else if (currentPage < actualPageRange.endPage) {
        goToMushafPage(currentPage + 1);
      }
    } else {
      setWrongChoiceFlash(choiceText);
      setWrongQuizAttempts((w) => w + 1);
      setTimeout(() => setWrongChoiceFlash(null), 650);
    }
  };

  // Explicit Evaluation or Finish Handler (The ONLY way the plan finishes!)
  const handleExplicitFinishWithEvaluation = (evalChoice?: PlanEvaluation) => {
    stopListeningSession();
    const finalEval = evalChoice || selectedEvaluation;
    const totalMistakes =
      plan.planType === 'review' ? wrongQuizAttempts : mistakeIndices.length;
    onCompletePlanSard(plan.id, totalMistakes, finalEval, quizLevel);
  };

  const totalPlanPages = Math.max(1, actualPageRange.endPage - actualPageRange.startPage + 1);
  const currentPlanPageOrder = Math.max(
    1,
    Math.min(totalPlanPages, currentPage - actualPageRange.startPage + 1)
  );
  const orderedPlanPages = useMemo(() => {
    const arr: number[] = [];
    for (let p = actualPageRange.startPage; p <= actualPageRange.endPage; p++) {
      arr.push(p);
    }
    return arr;
  }, [actualPageRange.startPage, actualPageRange.endPage]);

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
      {/* Compact Top Bar of the Plan Execution Screen */}
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
          {actualPageRange.endPage > actualPageRange.startPage ? (
            <div
              dir="rtl"
              className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg border border-white/15 text-xs text-[#FFFDF9]"
            >
              <button
                type="button"
                disabled={currentPage <= actualPageRange.startPage}
                onClick={() => goToMushafPage(currentPage - 1)}
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
                disabled={currentPage >= actualPageRange.endPage}
                onClick={() => goToMushafPage(currentPage + 1)}
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

      {/* =================================================================================
          1. MUSHAF VERSES PAGE — OCCUPIES TWO-THIRDS (2/3) OF THE SCREEN (`basis-2/3 flex-1`)
         ================================================================================= */}
      <div
        ref={mushafScrollContainerRef}
        className="basis-2/3 flex-1 min-h-[64dvh] overflow-y-auto px-2.5 py-2.5 sm:px-6 sm:py-4"
      >
        <div className="max-w-4xl mx-auto min-h-full rounded-2xl sm:rounded-3xl bg-[#FFFDF7] border-2 border-[#C88A14]/60 shadow-sm p-3.5 sm:p-7 bg-gradient-to-b from-[#FFFDF9] to-[#FAF4E6] flex flex-col justify-between">
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
              <div dir="rtl" className="text-justify leading-[2.45] sm:leading-[2.6] select-none">
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
                          const wasHintedMistake = mistakeIndices.includes(word.globalIndex);

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
                                className={`font-uthmani text-xl sm:text-[26px] inline-block px-1.5 py-0.5 mx-0.5 my-0.5 rounded-lg transition-all duration-150 ${
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
                            (isBlindRepPhase || isListening) &&
                            !isWordSpokenInRep &&
                            !revealAllPreview;

                          // Hide future verses during active listening unless preview is on
                          if (
                            isListening &&
                            !revealAllPreview &&
                            group.groupIndex > activeAyahIdx
                          ) {
                            return null;
                          }

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
                                className={`font-uthmani text-xl sm:text-[26px] inline-block px-1.5 py-0.5 mx-0.5 my-0.5 rounded-lg transition-all duration-150 cursor-pointer ${
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
                        const isSolved = solvedQuizIndices.includes(word.globalIndex);
                        const isCurrentQuestion =
                          quizQuestions[currentQuizStep]?.wordIndex === word.globalIndex;

                        return (
                          <React.Fragment key={word.globalIndex}>
                            <span
                              ref={isCurrentQuestion ? activeWordDomRef : null}
                              onClick={() => {
                                const qIdx = quizQuestions.findIndex(
                                  (q) => q.wordIndex === word.globalIndex
                                );
                                if (qIdx !== -1) {
                                  setCurrentQuizStep(qIdx);
                                }
                              }}
                              className={`font-uthmani text-xl sm:text-[26px] inline-block px-2 py-0.5 mx-0.5 my-0.5 rounded-lg transition-all duration-150 cursor-pointer ${
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
          {totalPlanPages > 1 && (
            <div
              dir="rtl"
              className="mt-4 pt-2.5 border-t border-[#DFD2B8] flex items-center justify-between gap-2 text-xs"
            >
              <button
                type="button"
                disabled={currentPage <= actualPageRange.startPage}
                onClick={() => goToMushafPage(currentPage - 1)}
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
                disabled={currentPage >= actualPageRange.endPage}
                onClick={() => goToMushafPage(currentPage + 1)}
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
          2. FLEXIBLE COMPACT CONTROL & EVALUATION DOCK (1/3 OF SCREEN — `max-h-[34dvh]`)
         ================================================================================= */}
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
                onClick={() => handleExplicitFinishWithEvaluation('muthabbat')}
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
                onClick={() => handleExplicitFinishWithEvaluation('mutaraddid')}
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
                onClick={() => handleExplicitFinishWithEvaluation('mutafallit')}
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
                onClick={() => handleExplicitFinishWithEvaluation(selectedEvaluation)}
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
    </div>
  );
};
