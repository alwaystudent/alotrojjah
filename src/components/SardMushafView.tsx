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
  skeletonText: string;
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

export function normalizeArabicForAlignment(raw: string): string {
  if (!raw) return '';
  let s = raw
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08F0-\u08FF]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671\u0672\u0673\u0675]/g, 'ا')
    .replace(/[\u0649\u06CC]/g, 'ي')
    .replace(/\u0629/g, 'ه')
    .replace(/[\u0624\u0626]/g, 'ء')
    .replace(/[^\u0621-\u064A]/g, '');

  const uthmaniMap: Record<string, string> = {
    الرحمن: 'الرحمن',
    الصلوه: 'الصلاه',
    الزكوه: 'الزكاه',
    الحيوه: 'الحياه',
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
    هؤلاء: 'هاؤلاء',
    اولئك: 'اولاءك',
    اله: 'الاه',
    اللهم: 'اللهم',
  };

  if (uthmaniMap[s]) {
    s = uthmaniMap[s];
  }

  return s.trim();
}

function getConsonantalSkeleton(norm: string): string {
  return norm.replace(/[اويءه]/g, '');
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

// Strict word matching so short prefixes ("ال", "من", "في") NEVER trigger false jumps ahead
function wordMatchScore(spokenNorm: string, targetNorm: string, targetSkeleton: string): number {
  if (!spokenNorm || !targetNorm) return 0;
  if (spokenNorm === targetNorm) return 1.0;

  const spokenSkeleton = getConsonantalSkeleton(spokenNorm);
  if (
    spokenSkeleton.length >= 2 &&
    targetSkeleton.length >= 2 &&
    spokenSkeleton === targetSkeleton
  ) {
    return 0.95;
  }

  const minLen = Math.min(spokenNorm.length, targetNorm.length);
  const maxLen = Math.max(spokenNorm.length, targetNorm.length);
  if (maxLen === 0) return 0;

  // Only allow substring containment if the shorter word is at least 4 letters AND >= 75% of the longer word
  if (
    minLen >= 4 &&
    minLen / maxLen >= 0.75 &&
    (spokenNorm.includes(targetNorm) || targetNorm.includes(spokenNorm))
  ) {
    return 0.88;
  }

  // Prefix + character overlap for inflected Quranic words
  if (minLen >= 3 && Math.abs(spokenNorm.length - targetNorm.length) <= 2) {
    let matches = 0;
    for (let i = 0; i < minLen; i++) {
      if (spokenNorm[i] === targetNorm[i]) matches++;
    }
    const ratio = matches / maxLen;
    return ratio >= 0.78 ? ratio : 0;
  }

  return 0;
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
  const pageRange = getPlanMushafPageRange(plan);

  const [currentPage, setCurrentPage] = useState<number>(pageRange.startPage);
  const [ayahGroups, setAyahGroups] = useState<MushafAyahGroup[]>([]);
  const [flatWords, setFlatWords] = useState<MushafWordItem[]>([]);
  const [loadingPage, setLoadingPage] = useState<boolean>(false);
  const [pageJuz, setPageJuz] = useState<number>(1);
  const [selectedEvaluation, setSelectedEvaluation] = useState<PlanEvaluation | undefined>(
    plan.evaluation
  );
  const [showExtraControls, setShowExtraControls] = useState<boolean>(false);

  // ============================================================================
  // MODE 1: SARD (`plan.planType === 'sard'`) — Real-Time Voice Alignment
  // ============================================================================
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0);
  const [sardStarted, setSardStarted] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceActive, setVoiceActive] = useState<boolean>(false);
  const [mistakeIndices, setMistakeIndices] = useState<number[]>([]);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [syncSpeedFactor, setSyncSpeedFactor] = useState<number>(defaultSyncSpeed);

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

  // Refs for continuous, non-cutting, non-leading real-time voice alignment
  const recognitionRef = useRef<any>(null);
  const recognitionRestartTimerRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const flatWordsRef = useRef<MushafWordItem[]>([]);
  const ayahGroupsRef = useRef<MushafAyahGroup[]>([]);
  const currentIndexRef = useRef<number>(0);
  const lastWordAdvanceTimeRef = useRef<number>(0);
  const lastVoiceDetectedTimeRef = useRef<number>(0);
  const accumulatedVoiceUnitsRef = useRef<number>(0);
  const noiseFloorRef = useRef<number>(4.5);
  const syncSpeedFactorRef = useRef<number>(defaultSyncSpeed);
  const processedResultIndexRef = useRef<number>(0);
  const processedTokenCountRef = useRef<number>(0);
  const activeWordDomRef = useRef<HTMLSpanElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserIntervalRef = useRef<any>(null);

  // Refs for Repetition mode inside interval
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

  // Build words list from fetched Uthmani verses
  const buildWordsFromVerses = useCallback(
    (
      verses: { surahNumber: number; ayahNumber: number; textUthmani: string; juz?: number }[]
    ) => {
      let filteredVerses = verses;

      if (plan.scope === 'ayah' && plan.ayahSurah) {
        const fromA = plan.ayahFrom || 1;
        const toA = plan.ayahTo || 286;
        const matchingInRange = verses.filter(
          (v) =>
            v.surahNumber === plan.ayahSurah &&
            v.ayahNumber >= fromA &&
            v.ayahNumber <= toA
        );
        if (matchingInRange.length > 0) {
          filteredVerses = matchingInRange;
        }
      } else if (plan.scope === 'surah' && plan.surahStart) {
        const s1 = Math.min(plan.surahStart, plan.surahEnd || plan.surahStart);
        const s2 = Math.max(plan.surahStart, plan.surahEnd || plan.surahStart);
        const matchingSurahs = verses.filter(
          (v) => v.surahNumber >= s1 && v.surahNumber <= s2
        );
        if (matchingSurahs.length > 0) {
          filteredVerses = matchingSurahs;
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

        const rawTokens = cleanText
          .split(/\s+/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0 && !/^[\u06D6-\u06ED\u06DD٠-٩0-9]+$/.test(t));

        const ayahWords: MushafWordItem[] = rawTokens.map((token, idx) => {
          const norm = normalizeArabicForAlignment(token);
          const item: MushafWordItem = {
            globalIndex: globalIdx++,
            surahNumber: v.surahNumber,
            surahNameAr,
            ayahNumber: v.ayahNumber,
            ayahGroupIndex: gIdx,
            wordPosition: idx + 1,
            textUthmani: token,
            normalizedText: norm,
            skeletonText: getConsonantalSkeleton(norm),
            syllableWeight: computeWordSyllableWeight(token, norm),
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
      setActiveAyahIdx(0);
      setCurrentAyahRepCount(0);
      setAyahWordOffset(0);
      setCurrentQuizStep(0);
      setSolvedQuizIndices([]);
      if (filteredVerses[0]?.juz) {
        setPageJuz(filteredVerses[0].juz);
      }
    },
    [plan.id, plan.scope, plan.ayahSurah, plan.ayahFrom, plan.ayahTo, plan.surahStart, plan.surahEnd]
  );

  // Fetch Uthmani verses from King Fahd Complex / Quran.com API v4
  useEffect(() => {
    let cancelled = false;
    const fetchMushafVerses = async () => {
      setLoadingPage(true);
      try {
        if (
          plan.scope === 'ayah' &&
          plan.ayahSurah &&
          (plan.ayahTo || 15) - (plan.ayahFrom || 1) <= 35
        ) {
          const fromA = plan.ayahFrom || 1;
          const toA = plan.ayahTo || 15;
          const count = toA - fromA + 1;
          const res = await fetch(
            `https://api.quran.com/api/v4/verses/by_chapter/${plan.ayahSurah}?words=false&fields=text_uthmani,chapter_id,verse_number,juz_number&page=1&per_page=300`
          );
          if (res.ok) {
            const data = await res.json();
            if (!cancelled && Array.isArray(data.verses) && data.verses.length > 0) {
              const sliced = data.verses
                .filter(
                  (v: any) =>
                    Number(v.verse_number) >= fromA && Number(v.verse_number) <= toA
                )
                .slice(0, count)
                .map((v: any) => ({
                  surahNumber: Number(plan.ayahSurah),
                  ayahNumber: Number(v.verse_number),
                  textUthmani: v.text_uthmani,
                  juz: v.juz_number || 1,
                }));
              if (sliced.length > 0) {
                buildWordsFromVerses(sliced);
                setLoadingPage(false);
                return;
              }
            }
          }
        }

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
            juz: v.juz_number || 1,
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
  }, [currentPage, buildWordsFromVerses, plan.scope, plan.ayahSurah, plan.ayahFrom, plan.ayahTo]);

  // Stop microphone & audio analyzer cleanly
  const stopListeningSession = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    setVoiceActive(false);

    if (recognitionRestartTimerRef.current) {
      clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }

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

    if (analyserIntervalRef.current) {
      clearInterval(analyserIntervalRef.current);
      analyserIntervalRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
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
  }, []);

  // Multi-page advance during Sard (keeps microphone alive if moving to next page in range; stops only after final word of final page)
  useEffect(() => {
    if (
      plan.planType === 'sard' &&
      sardStarted &&
      !loadingPage &&
      flatWords.length > 0 &&
      currentWordIndex >= flatWords.length
    ) {
      if (currentPage < pageRange.endPage) {
        setCurrentPage((p) => p + 1);
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
    pageRange.endPage,
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
        } else if (currentPage < pageRange.endPage) {
          setCurrentPage((p) => p + 1);
        } else {
          stopListeningSession();
        }
      }
    }
  }, [currentPage, pageRange.endPage, stopListeningSession]);

  // Real-Time Speech Synchronizer — strictly locked to current word so it NEVER precedes the reader
  const synchronizeWithSpokenWords = useCallback(
    (newSpokenTokens: string[]) => {
      if (newSpokenTokens.length === 0) return;
      const now = Date.now();
      const minIntervalMs = Math.round(540 / syncSpeedFactorRef.current);

      if (plan.planType === 'new_memorization') {
        const groups = ayahGroupsRef.current;
        const currentGroup = groups[activeAyahIdxRef.current];
        if (!currentGroup) return;
        const lastSpoken = newSpokenTokens[newSpokenTokens.length - 1];
        const targetW = currentGroup.words[ayahWordOffsetRef.current];
        if (
          targetW &&
          now - lastWordAdvanceTimeRef.current >= minIntervalMs &&
          wordMatchScore(lastSpoken, targetW.normalizedText, targetW.skeletonText) >= 0.8
        ) {
          accumulatedVoiceUnitsRef.current = 0;
          lastWordAdvanceTimeRef.current = now;
          stepRepetitionWord();
        }
        return;
      }

      // SARD MODE (`plan.planType === 'sard'`)
      const wordsList = flatWordsRef.current;
      if (wordsList.length === 0) return;

      // Enforce cooldown so ASR and acoustic syllable tracker never double-advance or jump ahead
      if (now - lastWordAdvanceTimeRef.current < minIntervalMs) {
        return;
      }

      const pointer = currentIndexRef.current;
      if (pointer >= wordsList.length) return;

      const currentTarget = wordsList[pointer];
      // Check only the latest spoken word against the current expected word first
      const latestWord = newSpokenTokens[newSpokenTokens.length - 1];
      const directScore = wordMatchScore(
        latestWord,
        currentTarget.normalizedText,
        currentTarget.skeletonText
      );

      if (directScore >= 0.8) {
        accumulatedVoiceUnitsRef.current = 0;
        lastWordAdvanceTimeRef.current = now;
        currentIndexRef.current = pointer + 1;
        setCurrentWordIndex(pointer + 1);
        return;
      }

      // Only allow advancing to pointer + 1 if user has been speaking long enough for 2 words AND latestWord strongly matches nextTarget
      if (
        pointer + 1 < wordsList.length &&
        now - lastWordAdvanceTimeRef.current >= minIntervalMs * 2.1 &&
        latestWord.length >= 3
      ) {
        const nextTarget = wordsList[pointer + 1];
        const nextScore = wordMatchScore(
          latestWord,
          nextTarget.normalizedText,
          nextTarget.skeletonText
        );
        if (nextScore >= 0.92 && directScore < 0.4) {
          accumulatedVoiceUnitsRef.current = 0;
          lastWordAdvanceTimeRef.current = now;
          currentIndexRef.current = pointer + 1;
          setCurrentWordIndex(pointer + 1);
        }
      }
    },
    [plan.planType, stepRepetitionWord]
  );

  // Start Continuous Microphone Session (Dual Time-Domain RMS + Vocal Formants + Auto-Resuming ASR)
  const startListeningSession = async () => {
    setSpeechError(null);
    setSardStarted(true);
    accumulatedVoiceUnitsRef.current = 0;
    lastWordAdvanceTimeRef.current = Date.now();
    lastVoiceDetectedTimeRef.current = 0;
    processedResultIndexRef.current = 0;
    processedTokenCountRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.35;
      source.connect(analyser);

      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const timeData = new Uint8Array(analyser.fftSize);
      const TICK_MS = 45;

      analyserIntervalRef.current = setInterval(() => {
        if (!isListeningRef.current) return;

        // Keep AudioContext awake if browser tries to suspend it
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }

        // Keep microphone tracks enabled
        const tracks = mediaStreamRef.current?.getAudioTracks();
        if (!tracks || tracks.length === 0 || tracks[0].readyState === 'ended') {
          return;
        }

        analyser.getByteFrequencyData(freqData);
        analyser.getByteTimeDomainData(timeData);

        // 1. Time-domain RMS amplitude (captures even soft/calm voice close to mic)
        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) {
          const centered = timeData[i] - 128;
          sumSq += centered * centered;
        }
        const rms = Math.sqrt(sumSq / timeData.length);

        // 2. Vocal fundamental + formant frequencies (~100Hz - 2400Hz)
        let freqSum = 0;
        const startBin = 2;
        const endBin = 28;
        for (let i = startBin; i <= endBin; i++) {
          freqSum += freqData[i];
        }
        const avgFreq = freqSum / (endBin - startBin + 1);

        // Combined vocal signal metric
        const vocalSignal = rms * 1.9 + avgFreq * 0.55;

        // Only update ambient noise floor when room is genuinely quiet (capped at 7.5 so it never drifts up to block the reader's voice)
        if (vocalSignal < noiseFloorRef.current + 2.5) {
          noiseFloorRef.current = Math.min(
            7.5,
            Math.max(2.5, noiseFloorRef.current * 0.95 + vocalSignal * 0.05)
          );
        }

        // Sensitive, stable voice threshold so normal recitation NEVER cuts off
        const voiceThreshold = Math.max(7.2, Math.min(13.5, noiseFloorRef.current + 3.8));
        const now = Date.now();
        const isRawVoice = vocalSignal >= voiceThreshold;

        if (isRawVoice) {
          lastVoiceDetectedTimeRef.current = now;
        }

        // 190ms syllable-bridge grace window so consonant stops (ق، ط، ب، ت، ك) don't drop voice state,
        // while genuine silence (> 190ms) immediately freezes word reveal
        const isSpeakingNow = isRawVoice || now - lastVoiceDetectedTimeRef.current <= 190;
        setVoiceActive(isSpeakingNow);

        if (!isSpeakingNow) {
          // User is silent: immediately stop revealing words!
          accumulatedVoiceUnitsRef.current = 0;
          return;
        }

        // User is actively reciting into the microphone!
        // Clamp intensity to [0.9, 1.08] so reading louder NEVER makes words race ahead of the reader
        const intensity = isRawVoice
          ? Math.min(1.08, Math.max(0.9, (vocalSignal - voiceThreshold) / 35 + 0.92))
          : 0.5;
        const speedMul = syncSpeedFactorRef.current;

        accumulatedVoiceUnitsRef.current += TICK_MS * intensity * speedMul;

        const minWordCooldown = Math.round(580 / speedMul);
        if (now - lastWordAdvanceTimeRef.current < minWordCooldown) {
          return;
        }

        if (plan.planType === 'sard') {
          const wordsList = flatWordsRef.current;
          const currW = wordsList[currentIndexRef.current];
          if (!currW) return;

          // Calibrated Quranic word duration: ~245ms per syllable weight unit (e.g. ~750ms - 1250ms per word in natural Tartil)
          const requiredVoiceUnits = Math.max(660, currW.syllableWeight * 245);

          if (accumulatedVoiceUnitsRef.current >= requiredVoiceUnits) {
            accumulatedVoiceUnitsRef.current = 0;
            lastWordAdvanceTimeRef.current = now;
            if (currentIndexRef.current < wordsList.length) {
              currentIndexRef.current += 1;
              setCurrentWordIndex(currentIndexRef.current);
            }
          }
        } else if (plan.planType === 'new_memorization') {
          const groups = ayahGroupsRef.current;
          const currentGroup = groups[activeAyahIdxRef.current];
          const currW = currentGroup?.words[ayahWordOffsetRef.current];
          const weight = currW?.syllableWeight || 3.2;
          const requiredVoiceUnits = Math.max(680, weight * 250);

          if (accumulatedVoiceUnitsRef.current >= requiredVoiceUnits) {
            accumulatedVoiceUnitsRef.current = 0;
            lastWordAdvanceTimeRef.current = now;
            stepRepetitionWord();
          }
        }
      }, TICK_MS);
    } catch {
      setSpeechError(
        lang === 'ar'
          ? 'يرجى السماح بصلاحية الميكروفون في المتصفح ليتزامن ظهور الآيات مع قراءتك الصوتية.'
          : 'Please allow microphone access in your browser to synchronize verse display with your voice.'
      );
      return;
    }

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRec) {
      const startRecognitionInstance = () => {
        if (!isListeningRef.current) return;
        try {
          const recognition = new SpeechRec();
          recognition.lang = 'ar-SA';
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;

          processedResultIndexRef.current = 0;
          processedTokenCountRef.current = 0;

          recognition.onresult = (event: any) => {
            if (!isListeningRef.current) return;
            const resIdx = event.results.length - 1;
            const latestResult = event.results[resIdx];
            if (!latestResult || !latestResult[0]) return;

            if (resIdx !== processedResultIndexRef.current) {
              processedResultIndexRef.current = resIdx;
              processedTokenCountRef.current = 0;
            }

            const transcript = String(latestResult[0].transcript || '');
            const allTokens = transcript
              .trim()
              .split(/\s+/)
              .map((w) => normalizeArabicForAlignment(w))
              .filter((w) => w.length > 0);

            if (allTokens.length > processedTokenCountRef.current) {
              const newlySpoken = allTokens.slice(processedTokenCountRef.current);
              processedTokenCountRef.current = allTokens.length;
              lastVoiceDetectedTimeRef.current = Date.now();
              synchronizeWithSpokenWords(newlySpoken);
            }
          };

          recognition.onerror = () => {
            // Do not stop session on transient ASR errors; auto-restart smoothly
          };

          recognition.onend = () => {
            if (isListeningRef.current) {
              if (recognitionRestartTimerRef.current) {
                clearTimeout(recognitionRestartTimerRef.current);
              }
              recognitionRestartTimerRef.current = setTimeout(() => {
                if (isListeningRef.current) {
                  startRecognitionInstance();
                }
              }, 140);
            }
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch {
          // Acoustic syllable analyzer continues uninterrupted
        }
      };

      isListeningRef.current = true;
      setIsListening(true);
      startRecognitionInstance();
    } else {
      isListeningRef.current = true;
      setIsListening(true);
    }
  };

  const toggleMicrophoneSession = () => {
    if (isListening) {
      stopListeningSession();
    } else {
      startListeningSession();
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
      const nextSolved = [...solvedQuizIndices, currentQ.wordIndex];
      setSolvedQuizIndices(nextSolved);

      if (currentQuizStep + 1 < quizQuestions.length) {
        setCurrentQuizStep((s) => s + 1);
      } else if (currentPage < pageRange.endPage) {
        setCurrentPage((p) => p + 1);
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
          {pageRange.endPage > pageRange.startPage ? (
            <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg border border-white/15 text-xs font-mono-tabular text-[#FFFDF9]">
              <button
                type="button"
                disabled={currentPage <= pageRange.startPage}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-0.5 disabled:opacity-35 hover:text-[#EAB338] cursor-pointer"
                title={dict.prevPageBtn}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <span className="px-1 font-bold">
                ص {toArabicNumerals(currentPage)}/{toArabicNumerals(pageRange.endPage)}
              </span>
              <button
                type="button"
                disabled={currentPage >= pageRange.endPage}
                onClick={() => setCurrentPage((p) => Math.min(604, p + 1))}
                className="p-0.5 disabled:opacity-35 hover:text-[#EAB338] cursor-pointer"
                title={dict.nextPageBtn}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <span className="text-xs font-mono-tabular text-[#E6D7BE] bg-white/10 px-2.5 py-1 rounded-lg">
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
      <div className="basis-2/3 flex-1 min-h-[64dvh] overflow-y-auto px-2.5 py-2.5 sm:px-6 sm:py-4">
        <div className="max-w-4xl mx-auto min-h-full rounded-2xl sm:rounded-3xl bg-[#FFFDF7] border-2 border-[#C88A14]/60 shadow-sm p-3.5 sm:p-7 bg-gradient-to-b from-[#FFFDF9] to-[#FAF4E6] flex flex-col justify-between">
          <div>
            {/* Mushaf Page Header Marginalia */}
            <div className="flex items-center justify-between pb-2 mb-3.5 border-b border-[#DFD2B8] text-xs font-display-islamic font-bold text-[#5C4B3B]">
              <span>
                {JUZ_LIST.find((j) => j.number === pageJuz)?.nameAr || `الجزء ${pageJuz}`}
              </span>
              <span className="text-[#C88A14]">صفحة {toArabicNumerals(currentPage)}</span>
              <span>{ayahGroups[0] ? `سُورَةُ ${ayahGroups[0].surahNameAr}` : ''}</span>
            </div>

            {loadingPage ? (
              <div className="py-16 text-center text-base font-display-islamic font-bold text-[#5C4B3B]">
                جاري استجلاب الآيات بالرسم العثماني...
              </div>
            ) : (
              <div dir="rtl" className="text-justify leading-[2.45] sm:leading-[2.6] select-none">
                {ayahGroups.map((group) => {
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
                        if (plan.planType === 'sard') {
                          const isRecited = word.globalIndex < currentWordIndex;
                          const isCurrent = word.globalIndex === currentWordIndex;
                          const isHiddenDuringSard = sardStarted && !isRecited;

                          return (
                            <React.Fragment key={word.globalIndex}>
                              <span
                                ref={isCurrent ? activeWordDomRef : null}
                                onClick={() => {
                                  currentIndexRef.current = word.globalIndex + 1;
                                  setCurrentWordIndex(word.globalIndex + 1);
                                }}
                                className={`font-uthmani text-xl sm:text-[26px] inline-block px-1.5 py-0.5 mx-0.5 my-0.5 rounded-lg transition-all duration-150 cursor-pointer ${
                                  isRecited
                                    ? 'text-[#261C14] bg-[#4A6144]/12'
                                    : isCurrent && sardStarted
                                    ? 'bg-[#C88A14]/25 border border-dashed border-[#C88A14] text-transparent select-none'
                                    : isHiddenDuringSard
                                    ? 'bg-[#EFE9DC]/70 text-transparent select-none rounded-md'
                                    : 'text-[#261C14] hover:bg-[#EFE9DC]'
                                }`}
                              >
                                {word.textUthmani}
                              </span>
                              {word.isLastWordInAyah && (
                                <span
                                  className={`font-uthmani text-base sm:text-xl mx-1 select-none ${
                                    isHiddenDuringSard && !isRecited
                                      ? 'text-[#D5C7B2]'
                                      : 'text-[#C88A14]'
                                  }`}
                                >
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
                          const hideInBlindRep = isBlindRepPhase && !isWordSpokenInRep;

                          return (
                            <React.Fragment key={word.globalIndex}>
                              <span
                                ref={isCurrentRepWord ? activeWordDomRef : null}
                                onClick={() => {
                                  setActiveAyahIdx(group.groupIndex);
                                  setAyahWordOffset(wIdxInAyah);
                                }}
                                className={`font-uthmani text-xl sm:text-[26px] inline-block px-1.5 py-0.5 mx-0.5 my-0.5 rounded-lg transition-all duration-150 cursor-pointer ${
                                  isCurrentRepWord
                                    ? 'bg-[#C88A14] text-[#FFFDF9] shadow-2xs'
                                    : isWordSpokenInRep || isPastRepAyah
                                    ? 'text-[#3B5934] bg-[#4A6144]/12'
                                    : isCurrentRepAyah
                                    ? hideInBlindRep
                                      ? 'bg-[#EFE9DC] text-transparent select-none'
                                      : 'bg-[#FBF5E6] text-[#261C14] border-b border-[#C88A14]/40'
                                    : 'text-[#84715E]/60'
                                }`}
                              >
                                {word.textUthmani}
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
                                    ? 'bg-[#C88A14] text-transparent border-2 border-[#2D2218] min-w-[60px] text-center select-none'
                                    : 'bg-[#EFE9DC] text-transparent border border-dashed border-[#84715E]/60 min-w-[50px] select-none'
                                  : isSolved
                                  ? 'bg-[#4A6144]/20 text-[#3B5934] font-bold'
                                  : 'text-[#261C14]'
                              }`}
                            >
                              {word.textUthmani}
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================================
          2. FLEXIBLE COMPACT CONTROL & EVALUATION DOCK (1/3 OF SCREEN — `max-h-[34dvh]`)
         ================================================================================= */}
      <div className="shrink-0 max-h-[36dvh] overflow-y-auto px-3 py-2.5 sm:px-6 sm:py-3.5 earthy-gradient-banner text-[#FFFDF9] border-t border-[#C88A14]/50 shadow-lg">
        <div className="max-w-4xl mx-auto space-y-2.5">
          {/* Thin Progress Bar */}
          <div className="w-full h-1 rounded-full bg-black/30 overflow-hidden">
            <div
              className="h-full bg-[#EAB338] transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* --- SARD CONTROLS (`plan.planType === 'sard'`) --- */}
          {plan.planType === 'sard' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Primary Start/Pause Sard Button + Live Voice Status */}
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <button
                    type="button"
                    onClick={toggleMicrophoneSession}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs shrink-0 ${
                      isListening
                        ? 'bg-[#A84A32] hover:bg-[#8E3B25] text-white'
                        : 'mustard-gradient-btn text-[#FFFDF9]'
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>{isListening ? dict.stopSardBtn : dict.startSardBtn}</span>
                  </button>

                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#E6D7BE] truncate">
                    <Sparkles
                      className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                        voiceActive ? 'text-[#EAB338] scale-125' : 'text-[#E6D7BE]/45'
                      }`}
                    />
                    <span className="truncate">
                      {!isListening
                        ? lang === 'ar'
                          ? 'اضغط بدء السرد واقرأ في الميكروفون'
                          : 'Press Start Sard & recite'
                        : voiceActive
                        ? lang === 'ar'
                          ? 'متزامن مع قراءتك الآن...'
                          : 'Synced with your voice...'
                        : lang === 'ar'
                        ? 'متوقف عند السكوت — واصل القراءة'
                        : 'Paused on silence — keep reading'}
                    </span>
                  </div>
                </div>

                {/* Speed Calibration + Counter + Reset */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-black/25 border border-white/15">
                    {(
                      [
                        { factor: 0.75, labelAr: 'ترتيل', labelEn: 'Slow' },
                        { factor: 1.0, labelAr: 'متزامن', labelEn: 'Sync' },
                        { factor: 1.28, labelAr: 'حدر', labelEn: 'Fast' },
                      ] as const
                    ).map((mode) => (
                      <button
                        key={mode.factor}
                        type="button"
                        onClick={() => setSyncSpeedFactor(mode.factor)}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                          Math.abs(syncSpeedFactor - mode.factor) < 0.08
                            ? 'bg-[#C88A14] text-[#FFFDF9]'
                            : 'text-[#E6D7BE] hover:text-white'
                        }`}
                      >
                        {lang === 'ar' ? mode.labelAr : mode.labelEn}
                      </button>
                    ))}
                  </div>

                  <span className="text-xs font-mono-tabular text-[#EAB338] font-bold px-1">
                    {currentWordIndex}/{flatWords.length}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      stopListeningSession();
                      setSardStarted(false);
                      currentIndexRef.current = 0;
                      setCurrentWordIndex(0);
                      setMistakeIndices([]);
                    }}
                    title={dict.resetSessionBtn}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#E6D7BE] hover:text-white cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- NEW MEMORIZATION CONTROLS (`plan.planType === 'new_memorization'`) --- */}
          {plan.planType === 'new_memorization' && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMicrophoneSession}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                    isListening
                      ? 'bg-[#A84A32] text-white'
                      : 'mustard-gradient-btn text-[#FFFDF9]'
                  }`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                  <span>{isListening ? dict.stopRepeatBtn : dict.startRepeatBtn}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextRep = currentAyahRepCount + 1;
                    if (nextRep < targetReps) {
                      setCurrentAyahRepCount(nextRep);
                      setAyahWordOffset(0);
                    } else if (activeAyahIdx + 1 < ayahGroups.length) {
                      setActiveAyahIdx((a) => a + 1);
                      setCurrentAyahRepCount(0);
                      setAyahWordOffset(0);
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-bold text-[#FFFDF9] cursor-pointer"
                >
                  {lang === 'ar'
                    ? `تكرار (${currentAyahRepCount + 1}/${targetReps})`
                    : `Rep (${currentAyahRepCount + 1}/${targetReps})`}
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-black/25 border border-white/15">
                  {[3, 5, 7, 10].map((rNum) => (
                    <button
                      key={rNum}
                      type="button"
                      onClick={() => {
                        setTargetReps(rNum);
                        setCurrentAyahRepCount(0);
                      }}
                      className={`px-2 py-1 rounded-md text-xs font-mono-tabular font-bold cursor-pointer ${
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
                    setActiveAyahIdx(0);
                    setCurrentAyahRepCount(0);
                    setAyahWordOffset(0);
                  }}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#E6D7BE] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* --- REVIEW QUIZ CONTROLS (`plan.planType === 'review'`) --- */}
          {plan.planType === 'review' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      { id: 'beginner', labelAr: 'مبتدئ', labelEn: 'Easy' },
                      { id: 'intermediate', labelAr: 'متوسط', labelEn: 'Medium' },
                      { id: 'advanced', labelAr: 'متقدم 50%', labelEn: 'Adv 50%' },
                      { id: 'hafiz', labelAr: 'حافظ', labelEn: 'Hafiz' },
                    ] as const
                  ).map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setQuizLevel(lvl.id)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
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
                    className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-[#EAB338] flex items-center gap-1 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'نوع الاختبار' : 'Quiz Type'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
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
                    className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold text-[#FFFDF9] cursor-pointer"
                  >
                    {lang === 'ar' ? 'إظهار الكلمة' : 'Reveal'}
                  </button>
                  <span className="font-mono-tabular text-[#EAB338] font-bold">
                    {solvedQuizIndices.length}/{quizQuestions.length}
                  </span>
                </div>
              </div>

              {showExtraControls && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {(
                    [
                      { id: 'word_completion', labelAr: 'إكمال الكلمات', labelEn: 'Word Blanks' },
                      { id: 'ayah_connection', labelAr: 'ربط الآيات', labelEn: 'Verse Recall' },
                      { id: 'verse_endings', labelAr: 'خواتيم الآيات', labelEn: 'Verse Endings' },
                    ] as const
                  ).map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setQuizFormat(fmt.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
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
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  {quizQuestions[currentQuizStep].choices.map((choice) => {
                    const isWrong = wrongChoiceFlash === choice;
                    return (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => handleSelectQuizChoice(choice)}
                        className={`py-1.5 px-2 rounded-xl font-uthmani text-lg sm:text-xl transition-all cursor-pointer border text-center truncate ${
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
                 (مُثبَّت | مُتردِّد | مُتفلِّت | إنهاء الخطة | إلغاء)
             ================================================================================= */}
          <div className="pt-2 border-t border-white/15 flex flex-wrap items-center justify-between gap-2">
            {/* Evaluation Pills: مثبت | متردد | متفلت */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-[#EAB338] me-0.5">
                {lang === 'ar' ? 'التقييم:' : 'Rating:'}
              </span>

              <button
                type="button"
                onClick={() => handleExplicitFinishWithEvaluation('muthabbat')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                  selectedEvaluation === 'muthabbat'
                    ? 'bg-[#4A6144] text-white border-[#88B87E]'
                    : 'bg-[#4A6144]/90 hover:bg-[#4A6144] text-white border-white/20'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'مُثبَّت' : 'Mastered'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleExplicitFinishWithEvaluation('mutaraddid')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
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
                className="px-3.5 py-1.5 rounded-xl bg-[#FFFDF9] hover:bg-[#F6E9C8] text-[#2D2218] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4A6144]" />
                <span>{lang === 'ar' ? 'إنهاء الخطة' : 'Finish Plan'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopListeningSession();
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-[#FFFDF9] text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>{dict.cancelBtn}</span>
              </button>
            </div>
          </div>

          {speechError && (
            <div className="p-2 rounded-xl bg-black/30 border border-[#EAB338]/40 text-xs text-[#F6E9C8] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#EAB338] shrink-0" />
              <span>{speechError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
