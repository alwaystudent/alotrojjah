import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Unlock,
  Sparkles,
  Clock,
  ArrowRight,
  Brain,
  Headphones,
  Eye,
  EyeOff,
  Award,
  HelpCircle,
  Check,
  Calendar,
  Radio,
  Repeat,
  Layers,
  ChevronLeft,
} from 'lucide-react';
import {
  Language,
  QuranPlanItem,
  PlanEvaluation,
  SURAH_LIST,
  formatCurriculumTitle,
} from '@/src/data/quranData';
import { memoryManager } from '@/src/utils/memoryCleanup';
import { generateSpacedReviews } from '@/src/utils/spacedRepetition';

export type MemorizationStage = 'stage1_listen' | 'stage2_fadeout' | 'stage3_recitation';
export type ReciterChoice = 'hudhaify' | 'husary_muallim';

interface VerseData {
  surahNumber: number;
  ayahNumber: number;
  textUthmani: string;
  words: {
    raw: string;
    norm: string;
    globalIndex: number;
  }[];
}

interface CumulativeStep {
  stepIndex: number;
  type: 'single' | 'cumulative_link';
  verseIndices: number[]; // indices in verses array
  titleAr: string;
  titleEn: string;
}

interface SmartMemorizationSystemProps {
  lang: Language;
  plan: QuranPlanItem;
  onClose: () => void;
  onCompleteMemorization: (
    planId: string,
    evaluation: PlanEvaluation,
    spacedReviews?: QuranPlanItem[]
  ) => void;
}

// =====================================================================================
// ROBUST ARABIC QURANIC NORMALIZER & FUZZY MATCHER
// =====================================================================================

export function normalizeArabicWord(raw: string): string {
  if (!raw) return '';
  return raw
    // Strip Quranic tajweed symbols, pause marks, small superscripts, honorifics
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08F0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '')
    // Normalize Alef variants
    .replace(/[\u0622\u0623\u0625\u0671\u0672\u0673\u0675]/g, 'ا')
    // Uthmani Waw with dagger Alef: صلوة -> صلاة, زكوة -> زكاة, حيوة -> حياة
    .replace(/لو[ةه]/g, 'لاه')
    .replace(/كو[ةه]/g, 'كاه')
    .replace(/يو[ةه]/g, 'ياه')
    // Normalize Yaas
    .replace(/[\u0649\u06CC\u0626]/g, 'ي')
    // Normalize Taa Marbouta to Haa
    .replace(/\u0629/g, 'ه')
    // Normalize Waw variants
    .replace(/[\u0624]/g, 'و')
    // Remove isolated hamzas
    .replace(/[\u0621]/g, '')
    // Strip all non-Arabic characters
    .replace(/[^\u0621-\u064A]/g, '')
    .trim();
}

// Generate common Arabic prefix stems (ال، و، ف، ب، ل، ك)
export function getArabicStems(normWord: string): string[] {
  if (!normWord) return [];
  const stems = [normWord];

  // Strip 'ال'
  if (normWord.startsWith('ال') && normWord.length > 3) {
    stems.push(normWord.slice(2));
  }

  // Strip leading proclitic particles: و، ف، ب، ل، ك
  if (normWord.length > 3 && ['و', 'ف', 'ب', 'ل', 'ك'].includes(normWord[0])) {
    const withoutPrefix = normWord.slice(1);
    stems.push(withoutPrefix);
    if (withoutPrefix.startsWith('ال') && withoutPrefix.length > 3) {
      stems.push(withoutPrefix.slice(2));
    }
  }

  return stems;
}

export function wordsMatch(spoken: string, target: string): boolean {
  if (!spoken || !target) return false;
  const s = normalizeArabicWord(spoken);
  const t = normalizeArabicWord(target);
  if (!s || !t) return false;
  if (s === t) return true;

  // Cross-compare stems with/without prefixes
  const sStems = getArabicStems(s);
  const tStems = getArabicStems(t);
  for (const ss of sStems) {
    for (const tt of tStems) {
      if (ss === tt) return true;
      if (ss.length >= 3 && tt.length >= 3) {
        if (ss.includes(tt) || tt.includes(ss)) return true;
        // Compare consonantal skeleton (without weak letters ا و ي ه)
        const sk1 = ss.replace(/[اويءه]/g, '');
        const sk2 = tt.replace(/[اويءه]/g, '');
        if (sk1.length >= 2 && sk1 === sk2) return true;
      }
    }
  }

  return false;
}

function getReciterAudioUrl(reciter: ReciterChoice, surah: number, ayah: number): string {
  const s = String(surah).padStart(3, '0');
  const a = String(ayah).padStart(3, '0');
  const folder = reciter === 'hudhaify' ? 'Hudhaify_128kbps' : 'Husary_Muallim_128kbps';
  return `https://everyayah.com/data/${folder}/${s}${a}.mp3`;
}

export const SmartMemorizationSystem: React.FC<SmartMemorizationSystemProps> = ({
  lang,
  plan,
  onClose,
  onCompleteMemorization,
}) => {
  // Strict Progression State
  const [currentStage, setCurrentStage] = useState<MemorizationStage>('stage1_listen');
  const [completedStages, setCompletedStages] = useState<Set<MemorizationStage>>(new Set());

  // Verse Data
  const [verses, setVerses] = useState<VerseData[]>([]);
  const [loadingVerses, setLoadingVerses] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reciter Choice for Stage 1
  const [selectedReciter, setSelectedReciter] = useState<ReciterChoice>('husary_muallim');

  // Repetition Settings (مرات التكرار للآيات المتلوة دفعة واحدة وكامل المقرر)
  const [chunkReps, setChunkReps] = useState<number>(3); // Default 3 repetitions per segment
  const [fullPassageReps, setFullPassageReps] = useState<number>(1); // Default 1 full passage repetition
  const [currentStepRep, setCurrentStepRep] = useState<number>(0); // Current repetition of active step (0 to chunkReps - 1)
  const [currentPassageRep, setCurrentPassageRep] = useState<number>(0); // Current repetition of whole passage (0 to fullPassageReps - 1)

  // Stage 1 State: Cumulative Listening & Repetition
  const [cumulativeSteps, setCumulativeSteps] = useState<CumulativeStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [stage1Phase, setStage1Phase] = useState<'shaykh_reciting' | 'user_repeating'>('shaykh_reciting');
  const [activeRecitingVerseIdx, setActiveRecitingVerseIdx] = useState<number>(0);
  const [userRepeatCountdown, setUserRepeatCountdown] = useState<number>(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [stage1MatchedWordIndices, setStage1MatchedWordIndices] = useState<Set<number>>(new Set());
  const [stage1HeardTranscript, setStage1HeardTranscript] = useState<string>('');
  const [stage1ToastMessage, setStage1ToastMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stage 2 State: Real-Time Alignment & Progressive Fade-Out
  const [stage2WordIndex, setStage2WordIndex] = useState<number>(0);
  const [fadeDelayMultiplier, setFadeDelayMultiplier] = useState<number>(1.0); // Increases if repeated via 'متردد'
  const [isMicActiveStage2, setIsMicActiveStage2] = useState<boolean>(false);
  const [stage2LastHeard, setStage2LastHeard] = useState<string>('');

  // Stage 3 State: Smart Recitation from Pure Memory with Conditional Reveal
  const [revealedWordIndices, setRevealedWordIndices] = useState<Set<number>>(new Set());
  const [stage3CurrentTargetIdx, setStage3CurrentTargetIdx] = useState<number>(0);
  const [isMicActiveStage3, setIsMicActiveStage3] = useState<boolean>(false);
  const [stage3Mistakes, setStage3Mistakes] = useState<number>(0);
  const [lastMatchedSpokenWord, setLastMatchedSpokenWord] = useState<string>('');

  // Evaluation Dialog State
  const [showEvaluationModal, setShowEvaluationModal] = useState<boolean>(false);
  const [scheduledReviewsCount, setScheduledReviewsCount] = useState<number | null>(null);

  // Microphone Recognition & RAM Audio Recorder
  const recognitionRef = useRef<any>(null);
  const isRecognitionActiveRef = useRef<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedAudioChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Flattened words list across all verses in the plan
  const flatWords = useMemo(() => {
    const list: {
      raw: string;
      norm: string;
      globalIndex: number;
      surahNumber: number;
      ayahNumber: number;
    }[] = [];
    verses.forEach((v) => {
      v.words.forEach((w) => {
        list.push({
          ...w,
          surahNumber: v.surahNumber,
          ayahNumber: v.ayahNumber,
        });
      });
    });
    return list;
  }, [verses]);

  // Current step object
  const currentStep = cumulativeSteps[currentStepIndex];

  // Words that belong to the active cumulative step in Stage 1
  const activeStepWords = useMemo(() => {
    if (!currentStep || verses.length === 0) return [];
    const list: {
      raw: string;
      norm: string;
      globalIndex: number;
      stepWordIndex: number;
    }[] = [];
    let sIdx = 0;
    currentStep.verseIndices.forEach((vIdx) => {
      const v = verses[vIdx];
      if (v) {
        v.words.forEach((w) => {
          list.push({
            ...w,
            stepWordIndex: sIdx++,
          });
        });
      }
    });
    return list;
  }, [currentStep, verses]);

  // Active Surah Information for Header and Basmalah
  const surahInfo = useMemo(() => {
    const sNum = verses[0]?.surahNumber || plan.ayahSurah || plan.surahStart || 1;
    return SURAH_LIST.find((s) => s.number === sNum);
  }, [verses, plan]);

  // Fetch Verses for the Plan
  useEffect(() => {
    let cancelled = false;
    const fetchVerses = async () => {
      setLoadingVerses(true);
      setLoadError(null);

      try {
        let surahNum = plan.ayahSurah || plan.surahStart || 1;
        let ayahStart = plan.ayahFrom || 1;
        let ayahEnd = plan.ayahTo || 7;

        // If whole surah
        if (plan.scope === 'surah' && plan.surahStart) {
          surahNum = plan.surahStart;
          const sInfo = SURAH_LIST.find((s) => s.number === surahNum);
          ayahStart = 1;
          ayahEnd = sInfo ? Math.min(sInfo.ayahCount, 15) : 7;
        }

        const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/editions/quran-uthmani`);
        if (!res.ok) throw new Error('API request failed');
        const data = await res.json();

        if (cancelled) return;

        const allAyahs = data?.data?.[0]?.ayahs || [];
        const filtered = allAyahs.filter(
          (a: any) => a.numberInSurah >= ayahStart && a.numberInSurah <= ayahEnd
        );

        let gWordIdx = 0;
        const parsed: VerseData[] = filtered.map((a: any) => {
          let cleanText = (a.text || '').trim();
          // If Ayah 1 of any Surah except 1 & 9, strip the embedded Basmalah so it's placed cleanly at the top of the Surah
          if (
            surahNum !== 1 &&
            surahNum !== 9 &&
            a.numberInSurah === 1 &&
            cleanText.includes('بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ')
          ) {
            cleanText = cleanText.replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ', '').trim();
          }

          const rawWords = cleanText.split(/\s+/).filter(Boolean);
          const words = rawWords.map((rw: string) => {
            const item = {
              raw: rw,
              norm: normalizeArabicWord(rw),
              globalIndex: gWordIdx,
            };
            gWordIdx++;
            return item;
          });

          return {
            surahNumber: surahNum,
            ayahNumber: a.numberInSurah,
            textUthmani: cleanText,
            words,
          };
        });

        if (parsed.length === 0) {
          throw new Error('No verses found for the selected range');
        }

        setVerses(parsed);

        // Build Cumulative Steps (المرحلة الأولى: التلقين والاستماع التراكمي)
        const steps: CumulativeStep[] = [];
        if (parsed.length === 1) {
          steps.push({
            stepIndex: 0,
            type: 'single',
            verseIndices: [0],
            titleAr: `تلاوة الآية ${parsed[0].ayahNumber} وترديدها`,
            titleEn: `Recite and repeat Ayah ${parsed[0].ayahNumber}`,
          });
        } else {
          parsed.forEach((v, idx) => {
            if (idx === 0) {
              steps.push({
                stepIndex: steps.length,
                type: 'single',
                verseIndices: [0],
                titleAr: `تلاوة الآية ${v.ayahNumber} وترديدها`,
                titleEn: `Recite and repeat Ayah ${v.ayahNumber}`,
              });
            } else {
              // 1. Single next verse
              steps.push({
                stepIndex: steps.length,
                type: 'single',
                verseIndices: [idx],
                titleAr: `تلاوة الآية ${v.ayahNumber} وترديدها`,
                titleEn: `Recite and repeat Ayah ${v.ayahNumber}`,
              });

              // 2. Cumulative link (الربط التراكمي من البداية حتى الآية الحالية)
              const cumulativeRange = Array.from({ length: idx + 1 }, (_, i) => i);
              steps.push({
                stepIndex: steps.length,
                type: 'cumulative_link',
                verseIndices: cumulativeRange,
                titleAr: `الربط التراكمي: الآيات من ${parsed[0].ayahNumber} إلى ${v.ayahNumber} متصلة`,
                titleEn: `Cumulative Link: Ayahs ${parsed[0].ayahNumber} to ${v.ayahNumber} connected`,
              });
            }
          });
        }

        setCumulativeSteps(steps);
        setCurrentStepIndex(0);
        setCurrentStepRep(0);
        setCurrentPassageRep(0);
        setLoadingVerses(false);
      } catch (err: any) {
        if (!cancelled) {
          setLoadError(err?.message || 'تعذر تحميل الآيات من المصحف الشريف');
          setLoadingVerses(false);
        }
      }
    };

    fetchVerses();

    return () => {
      cancelled = true;
    };
  }, [plan]);

  // RAM Audio Cleanup
  const cleanupRamAudio = useCallback(() => {
    isRecognitionActiveRef.current = false;

    // 1. Stop SpeechRecognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    // 2. Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }

    // 3. Purge in-memory audio chunks
    recordedAudioChunksRef.current = [];

    // 4. Stop HTML5 audio playback
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
      } catch {
        // ignore
      }
    }

    // 5. Clear transition timer
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }

    // 6. Trigger Memory Manager full sweep
    memoryManager.runFullCleanup();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRamAudio();
    };
  }, [cleanupRamAudio]);

  // =====================================================================================
  // STAGE 1: CUMULATIVE RECITATION & AUDIO PLAYBACK (التلقين والاستماع التراكمي)
  // =====================================================================================

  // Advance to next step or next repetition
  const handleCompleteCurrentRepetition = useCallback(() => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);

    setStage1ToastMessage('✓ أحسنت! تم رصد الترديد بنجاح');

    // Check if more repetitions for this step are required
    if (currentStepRep + 1 < chunkReps) {
      // Advance repetition count of this step
      transitionTimerRef.current = setTimeout(() => {
        setStage1ToastMessage(null);
        setCurrentStepRep((prev) => prev + 1);
        setStage1Phase('shaykh_reciting');
        setStage1MatchedWordIndices(new Set());
        setStage1HeardTranscript('');
      }, 1200);
    } else {
      // Step repetitions fully completed!
      transitionTimerRef.current = setTimeout(() => {
        setStage1ToastMessage(null);
        setCurrentStepRep(0);
        setStage1MatchedWordIndices(new Set());
        setStage1HeardTranscript('');

        // Move to next cumulative step or check passage repetitions
        if (currentStepIndex + 1 < cumulativeSteps.length) {
          setCurrentStepIndex((prev) => prev + 1);
          setStage1Phase('shaykh_reciting');
        } else {
          // All cumulative steps completed! Check full passage repetitions
          if (currentPassageRep + 1 < fullPassageReps) {
            setCurrentPassageRep((prev) => prev + 1);
            setCurrentStepIndex(0);
            setStage1Phase('shaykh_reciting');
          } else {
            // Stage 1 completely finished! AUTO-ADVANCE to Stage 2!
            setCompletedStages((prev) => new Set([...prev, 'stage1_listen']));
            setCurrentStage('stage2_fadeout');
          }
        }
      }, 1200);
    }
  }, [currentStepRep, chunkReps, currentStepIndex, cumulativeSteps.length, currentPassageRep, fullPassageReps]);

  // Play audio for a specific verse index within the active cumulative step
  const playStepVerseAudio = useCallback(
    (verseIndexInStep: number) => {
      if (!currentStep || verses.length === 0) return;
      const vIdx = currentStep.verseIndices[verseIndexInStep];
      const targetVerse = verses[vIdx];
      if (!targetVerse) return;

      setActiveRecitingVerseIdx(vIdx);
      setIsPlayingAudio(true);
      setStage1Phase('shaykh_reciting');

      const url = getReciterAudioUrl(selectedReciter, targetVerse.surahNumber, targetVerse.ayahNumber);

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      audioRef.current.src = url;
      audioRef.current.play().catch(() => {
        setIsPlayingAudio(false);
      });

      audioRef.current.onended = () => {
        // Check if there is a next verse in this cumulative link
        if (verseIndexInStep + 1 < currentStep.verseIndices.length) {
          playStepVerseAudio(verseIndexInStep + 1);
        } else {
          // Finished Shaykh reciting phase -> Transition to user repeating phase!
          setIsPlayingAudio(false);
          setStage1Phase('user_repeating');
          setStage1MatchedWordIndices(new Set());
          setStage1HeardTranscript('');
          // Start countdown timer for user repeating (approx. 4s per verse)
          setUserRepeatCountdown(Math.max(6, currentStep.verseIndices.length * 4));
        }
      };
    },
    [currentStep, verses, selectedReciter]
  );

  // Auto-play when step starts, step repetition changes, or when entering Stage 1
  useEffect(() => {
    if (currentStage === 'stage1_listen' && currentStep && verses.length > 0 && stage1Phase === 'shaykh_reciting') {
      playStepVerseAudio(0);
    }
  }, [currentStage, currentStepIndex, currentStepRep, currentPassageRep, stage1Phase, currentStep, playStepVerseAudio, verses.length]);

  // Countdown timer for Stage 1 user repeating (fallback/assist)
  useEffect(() => {
    if (stage1Phase !== 'user_repeating' || userRepeatCountdown <= 0) return;
    const t = setInterval(() => {
      setUserRepeatCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          // If countdown ends, complete repetition automatically
          handleCompleteCurrentRepetition();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [stage1Phase, userRepeatCountdown, handleCompleteCurrentRepetition]);

  // SPEECH RECOGNITION FOR STAGE 1 (التعرف على صوت القارئ في مرحلة الترديد)
  useEffect(() => {
    if (currentStage !== 'stage1_listen' || stage1Phase !== 'user_repeating' || activeStepWords.length === 0) {
      if (recognitionRef.current && isRecognitionActiveRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
        isRecognitionActiveRef.current = false;
      }
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        isRecognitionActiveRef.current = true;
      };

      recognition.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        if (!lastResult) return;
        const transcript = lastResult[0]?.transcript || '';
        setStage1HeardTranscript(transcript);

        const spokenTokens = transcript.trim().split(/\s+/).filter(Boolean);

        setStage1MatchedWordIndices((prevIndices) => {
          const nextSet = new Set(prevIndices);

          for (const token of spokenTokens) {
            // Check match against any step word
            for (let i = 0; i < activeStepWords.length; i++) {
              if (!nextSet.has(i) && wordsMatch(token, activeStepWords[i].norm)) {
                nextSet.add(i);
                break;
              }
            }
          }

          // Check if completion threshold is reached (>= 60% of words or last word matched)
          const matchedCount = nextSet.size;
          const totalWords = activeStepWords.length;
          const hasLastWord = nextSet.has(totalWords - 1);

          if (matchedCount >= Math.ceil(totalWords * 0.6) || (matchedCount >= 2 && hasLastWord)) {
            // Successfully recognized! Move to next repetition / step!
            handleCompleteCurrentRepetition();
          }

          return nextSet;
        });
      };

      recognition.onerror = () => {
        // Soft fallback
      };

      recognition.onend = () => {
        isRecognitionActiveRef.current = false;
        if (currentStage === 'stage1_listen' && stage1Phase === 'user_repeating') {
          setTimeout(() => {
            try {
              if (currentStage === 'stage1_listen' && stage1Phase === 'user_repeating') {
                recognition.start();
                isRecognitionActiveRef.current = true;
              }
            } catch {
              // ignore
            }
          }, 150);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      // Speech recognition not permitted in this context
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      isRecognitionActiveRef.current = false;
    };
  }, [currentStage, stage1Phase, activeStepWords, handleCompleteCurrentRepetition]);

  // Re-listen to current cumulative step
  const handleReplayCurrentStep = () => {
    setCurrentStepRep(0);
    setStage1Phase('shaykh_reciting');
    playStepVerseAudio(0);
  };

  // =====================================================================================
  // STAGE 2: REAL-TIME ALIGNMENT & PROGRESSIVE FADE-OUT (المحاذاة اللحظية والتلاشي التدريجي)
  // FIX: Multi-word lookahead, robust Arabic normalization, safe reconnect loop
  // =====================================================================================
  const startMicStage2 = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsMicActiveStage2(true);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsMicActiveStage2(true);
        isRecognitionActiveRef.current = true;
      };

      recognition.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        if (!lastResult) return;
        const transcript = lastResult[0]?.transcript || '';
        setStage2LastHeard(transcript);

        const spokenTokens = transcript.trim().split(/\s+/).filter(Boolean);

        setStage2WordIndex((currIdx) => {
          let nextIdx = currIdx;

          // Process spoken tokens with forward lookahead window up to 4 words
          for (const token of spokenTokens) {
            if (nextIdx >= flatWords.length) break;

            let matchedPosition = -1;
            const lookaheadLimit = Math.min(flatWords.length, nextIdx + 4);

            for (let look = nextIdx; look < lookaheadLimit; look++) {
              if (wordsMatch(token, flatWords[look].norm)) {
                matchedPosition = look;
                break;
              }
            }

            if (matchedPosition !== -1) {
              // Advance directly past the matched word!
              nextIdx = matchedPosition + 1;
            }
          }

          return nextIdx;
        });
      };

      recognition.onerror = () => {
        // Soft fallback
      };

      recognition.onend = () => {
        isRecognitionActiveRef.current = false;
        // Auto-restart safely with debounce while in Stage 2
        if (currentStage === 'stage2_fadeout') {
          setTimeout(() => {
            try {
              if (currentStage === 'stage2_fadeout') {
                recognition.start();
                isRecognitionActiveRef.current = true;
              }
            } catch {
              // ignore
            }
          }, 150);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      setIsMicActiveStage2(true);
    }
  }, [flatWords, currentStage]);

  // Auto-start Mic when Stage 2 becomes active
  useEffect(() => {
    if (currentStage === 'stage2_fadeout') {
      setStage2WordIndex(0);
      setStage2LastHeard('');
      startMicStage2();
    }
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      isRecognitionActiveRef.current = false;
    };
  }, [currentStage, startMicStage2]);

  // Auto-pacing fallback in Stage 2 so user recitation advances automatically if speech recognition pauses
  useEffect(() => {
    if (
      currentStage !== 'stage2_fadeout' ||
      flatWords.length === 0 ||
      stage2WordIndex >= flatWords.length
    )
      return;
    const paceTimer = setTimeout(() => {
      setStage2WordIndex((prev) => Math.min(flatWords.length, prev + 1));
    }, 4500);
    return () => clearTimeout(paceTimer);
  }, [currentStage, stage2WordIndex, flatWords.length]);

  // Check if Stage 2 finished -> Auto-advance automatically to Stage 3!
  useEffect(() => {
    if (
      currentStage === 'stage2_fadeout' &&
      flatWords.length > 0 &&
      stage2WordIndex >= flatWords.length
    ) {
      setCompletedStages((prev) => new Set([...prev, 'stage2_fadeout']));
      // AUTO-ADVANCE: Move directly to Stage 3 automatically
      const autoTimer = setTimeout(() => {
        setCurrentStage('stage3_recitation');
      }, 700);
      return () => clearTimeout(autoTimer);
    }
  }, [currentStage, stage2WordIndex, flatWords.length]);

  // =====================================================================================
  // STAGE 3: SMART RECITATION FROM PURE MEMORY WITH CONDITIONAL REVEAL (التسميع الغيبي الذكي)
  // =====================================================================================
  const startMicAndRamRecordingStage3 = useCallback(() => {
    if (typeof window === 'undefined') return;

    // 1. Start in-memory RAM audio recording
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          micStreamRef.current = stream;
          memoryManager.registerStream(stream);

          try {
            const recorder = new MediaRecorder(stream);
            recordedAudioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) {
                // Held purely in RAM chunks
                recordedAudioChunksRef.current.push(e.data);
              }
            };

            recorder.start(1000);
            mediaRecorderRef.current = recorder;
          } catch {
            // MediaRecorder unsupported in sandbox
          }
        })
        .catch(() => {
          // Mic permission denied or unavailable
        });
    }

    // 2. Start Speech Recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsMicActiveStage3(true);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsMicActiveStage3(true);
        isRecognitionActiveRef.current = true;
      };

      recognition.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        if (!lastResult) return;
        const transcript = lastResult[0]?.transcript || '';
        const spokenTokens = transcript.trim().split(/\s+/).filter(Boolean);

        setStage3CurrentTargetIdx((targetIdx) => {
          let nextTarget = targetIdx;

          for (const token of spokenTokens) {
            if (nextTarget >= flatWords.length) break;

            // Forward lookahead up to 3 words
            let matchedPosition = -1;
            const lookLimit = Math.min(flatWords.length, nextTarget + 3);

            for (let i = nextTarget; i < lookLimit; i++) {
              if (wordsMatch(token, flatWords[i].norm)) {
                matchedPosition = i;
                break;
              }
            }

            if (matchedPosition !== -1) {
              // Reveal words up to matchedPosition
              setRevealedWordIndices((prev) => {
                const nextSet = new Set(prev);
                for (let j = nextTarget; j <= matchedPosition; j++) {
                  nextSet.add(j);
                }
                return nextSet;
              });
              setLastMatchedSpokenWord(token);
              nextTarget = matchedPosition + 1;
            } else {
              setStage3Mistakes((m) => m + 1);
            }
          }

          return nextTarget;
        });
      };

      recognition.onend = () => {
        isRecognitionActiveRef.current = false;
        if (currentStage === 'stage3_recitation') {
          setTimeout(() => {
            try {
              if (currentStage === 'stage3_recitation') {
                recognition.start();
                isRecognitionActiveRef.current = true;
              }
            } catch {
              // ignore
            }
          }, 150);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      setIsMicActiveStage3(true);
    }
  }, [flatWords, currentStage]);

  // Auto-start Mic and RAM recording when Stage 3 starts
  useEffect(() => {
    if (currentStage === 'stage3_recitation') {
      setRevealedWordIndices(new Set());
      setStage3CurrentTargetIdx(0);
      setStage3Mistakes(0);
      startMicAndRamRecordingStage3();
    }
    return () => {
      cleanupRamAudio();
    };
  }, [currentStage, startMicAndRamRecordingStage3, cleanupRamAudio]);

  // Auto-assist in Stage 3: if recitation pauses for 5.5s on a word, automatically reveal it and proceed
  useEffect(() => {
    if (
      currentStage !== 'stage3_recitation' ||
      flatWords.length === 0 ||
      stage3CurrentTargetIdx >= flatWords.length
    )
      return;
    const assistTimer = setTimeout(() => {
      setRevealedWordIndices((prev) => new Set([...prev, stage3CurrentTargetIdx]));
      setStage3CurrentTargetIdx((prev) => prev + 1);
    }, 5500);
    return () => clearTimeout(assistTimer);
  }, [currentStage, stage3CurrentTargetIdx, flatWords.length]);

  // When Stage 3 completes all words -> Show Evaluation Modal & Discard RAM Audio automatically!
  useEffect(() => {
    if (
      currentStage === 'stage3_recitation' &&
      flatWords.length > 0 &&
      revealedWordIndices.size >= flatWords.length
    ) {
      setCompletedStages((prev) => new Set([...prev, 'stage3_recitation']));
      // Purge RAM audio recordings immediately for device memory safety & privacy
      cleanupRamAudio();
      const autoModalTimer = setTimeout(() => {
        setShowEvaluationModal(true);
      }, 600);
      return () => clearTimeout(autoModalTimer);
    }
  }, [currentStage, revealedWordIndices.size, flatWords.length, cleanupRamAudio]);

  // Auto-close countdown when memorization is confirmed as Mastered
  const [autoCloseCountdown, setAutoCloseCountdown] = useState<number>(3);
  useEffect(() => {
    if (scheduledReviewsCount !== null) {
      setAutoCloseCountdown(3);
      const interval = setInterval(() => {
        setAutoCloseCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            onClose();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [scheduledReviewsCount, onClose]);

  // Manual word reveal click helper if mic is disabled or in case of stuck word
  const handleManualRevealNextWord = () => {
    if (stage3CurrentTargetIdx < flatWords.length) {
      setRevealedWordIndices((prev) => new Set([...prev, stage3CurrentTargetIdx]));
      setStage3CurrentTargetIdx((prev) => prev + 1);
    }
  };

  // =====================================================================================
  // FINAL EVALUATION HANDLERS (نظام التقييم النهائي الصارم)
  // =====================================================================================
  // 1. [🟩 متقن]
  const handleEvaluationMuthabbat = () => {
    cleanupRamAudio();
    const spacedReviews = generateSpacedReviews(plan);
    setScheduledReviewsCount(spacedReviews.length);
    onCompleteMemorization(plan.id, 'muthabbat', spacedReviews);
  };

  // 2. [🟨 متردد]
  const handleEvaluationMutaraddid = () => {
    cleanupRamAudio();
    setShowEvaluationModal(false);
    // Redirect directly to Stage 2 with extended text visibility factor!
    setFadeDelayMultiplier(2.0);
    setStage2WordIndex(0);
    setCurrentStage('stage2_fadeout');
  };

  // 3. [🟥 متفلت]
  const handleEvaluationMutafallit = () => {
    cleanupRamAudio();
    setShowEvaluationModal(false);
    // Reset progress completely and forcefully return to Stage 1 from the beginning!
    setCompletedStages(new Set());
    setCurrentStepIndex(0);
    setCurrentStepRep(0);
    setCurrentPassageRep(0);
    setStage2WordIndex(0);
    setRevealedWordIndices(new Set());
    setStage3CurrentTargetIdx(0);
    setCurrentStage('stage1_listen');
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-[#1A140E]/90 backdrop-blur-md flex flex-col justify-between overflow-y-auto w-full min-w-full min-h-screen text-[#261C14]"
    >
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-[#FFFDF9]/95 border-b border-[#DDD2BE] shadow-xs px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#C88A14]/15 border border-[#C88A14]/30 flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4 text-[#9E650C]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm sm:text-base font-display-islamic text-[#261C14]">
                {lang === 'ar' ? 'نظام إدارة خطة الحفظ الذكي' : 'Smart Quran Memorization System'}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#4A6144]/15 text-[#4A6144] border border-[#4A6144]/25">
                {lang === 'ar' ? '3 مراحل متتالية وصارمة' : '3 Strict Consecutive Stages'}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#C88A14]/15 text-[#9E650C] border border-[#C88A14]/25 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C88A14] animate-ping" />
                <span>{lang === 'ar' ? 'انتقال تلقائي شامل ⚡' : 'Auto-Transitions ⚡'}</span>
              </span>
            </div>
            <p className="text-[11px] text-[#84715E] truncate">
              {formatCurriculumTitle(plan, lang)} · {verses.length}{' '}
              {lang === 'ar' ? 'آيات' : 'Ayahs'} (~{flatWords.length}{' '}
              {lang === 'ar' ? 'كلمة' : 'Words'})
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            cleanupRamAudio();
            onClose();
          }}
          className="p-1.5 rounded-xl bg-[#F7F3EB] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-[#5C4B3B] hover:text-[#261C14] transition-colors cursor-pointer shrink-0"
          title={lang === 'ar' ? 'إغلاق ومغادرة الخطة' : 'Close'}
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Main Working Space */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-4 flex flex-col justify-start">
        {/* Strict 3-Stage Progress Nav */}
        <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] shadow-2xs">
          {/* Stage 1 */}
          <div
            className={`p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all ${
              currentStage === 'stage1_listen'
                ? 'bg-[#2D2218] text-[#FFFDF9] shadow-xs'
                : completedStages.has('stage1_listen')
                ? 'bg-[#4A6144]/15 text-[#4A6144] border border-[#4A6144]/30'
                : 'bg-[#F7F3EB] text-[#84715E]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Headphones className="w-4 h-4 shrink-0 text-[#EAB338]" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold opacity-80">
                  {lang === 'ar' ? 'المرحلة الأولى' : 'Stage 1'}
                </div>
                <div className="text-xs font-bold truncate">
                  {lang === 'ar' ? 'التلقين والاستماع التراكمي' : 'Cumulative Listening'}
                </div>
              </div>
            </div>
            {completedStages.has('stage1_listen') ? (
              <CheckCircle2 className="w-4 h-4 text-[#4A6144] shrink-0" />
            ) : (
              <span className="text-[10px] font-mono-tabular shrink-0">
                {currentStepIndex + 1}/{cumulativeSteps.length}
              </span>
            )}
          </div>

          {/* Stage 2 (Locked until Stage 1 complete) */}
          <div
            className={`p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all ${
              currentStage === 'stage2_fadeout'
                ? 'bg-[#2D2218] text-[#FFFDF9] shadow-xs'
                : completedStages.has('stage2_fadeout')
                ? 'bg-[#4A6144]/15 text-[#4A6144] border border-[#4A6144]/30'
                : !completedStages.has('stage1_listen')
                ? 'bg-[#EFE9DC]/60 text-[#84715E] opacity-75'
                : 'bg-[#F7F3EB] text-[#84715E]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <EyeOff className="w-4 h-4 shrink-0 text-[#C88A14]" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold opacity-80">
                  {lang === 'ar' ? 'المرحلة الثانية' : 'Stage 2'}
                </div>
                <div className="text-xs font-bold truncate">
                  {lang === 'ar' ? 'المحاذاة والتلاشي التدريجي' : 'Fade-Out Alignment'}
                </div>
              </div>
            </div>
            {!completedStages.has('stage1_listen') ? (
              <span title={lang === 'ar' ? 'مقفلة حتى إتمام المرحلة الأولى' : 'Locked'}>
                <Lock className="w-3.5 h-3.5 text-[#84715E] shrink-0" />
              </span>
            ) : completedStages.has('stage2_fadeout') ? (
              <CheckCircle2 className="w-4 h-4 text-[#4A6144] shrink-0" />
            ) : (
              <span className="text-[10px] font-mono-tabular shrink-0">
                {stage2WordIndex}/{flatWords.length}
              </span>
            )}
          </div>

          {/* Stage 3 (Locked until Stage 2 complete) */}
          <div
            className={`p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all ${
              currentStage === 'stage3_recitation'
                ? 'bg-[#2D2218] text-[#FFFDF9] shadow-xs'
                : completedStages.has('stage3_recitation')
                ? 'bg-[#4A6144]/15 text-[#4A6144] border border-[#4A6144]/30'
                : !completedStages.has('stage2_fadeout')
                ? 'bg-[#EFE9DC]/60 text-[#84715E] opacity-75'
                : 'bg-[#F7F3EB] text-[#84715E]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Brain className="w-4 h-4 shrink-0 text-[#A84A32]" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold opacity-80">
                  {lang === 'ar' ? 'المرحلة الثالثة' : 'Stage 3'}
                </div>
                <div className="text-xs font-bold truncate">
                  {lang === 'ar' ? 'التسميع الغيبي المشروط' : 'Conditional Recitation'}
                </div>
              </div>
            </div>
            {!completedStages.has('stage2_fadeout') ? (
              <span title={lang === 'ar' ? 'مقفلة حتى إتمام المرحلة الثانية' : 'Locked'}>
                <Lock className="w-3.5 h-3.5 text-[#84715E] shrink-0" />
              </span>
            ) : completedStages.has('stage3_recitation') ? (
              <CheckCircle2 className="w-4 h-4 text-[#4A6144] shrink-0" />
            ) : (
              <span className="text-[10px] font-mono-tabular shrink-0">
                {revealedWordIndices.size}/{flatWords.length}
              </span>
            )}
          </div>
        </div>

        {/* Loading / Error States */}
        {loadingVerses && (
          <div className="py-16 text-center space-y-3 bg-[#FFFDF9] rounded-2xl border border-[#DDD2BE] p-6 shadow-2xs">
            <div className="w-10 h-10 border-3 border-[#C88A14] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-[#84715E]">
              {lang === 'ar' ? 'جاري تجهيز الآيات برسم المصحف الشريف...' : 'Loading Mushaf verses...'}
            </p>
          </div>
        )}

        {loadError && (
          <div className="p-4 rounded-xl bg-[#A84A32]/10 border border-[#A84A32]/30 text-xs text-[#A84A32] flex items-center justify-between gap-3">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3 py-1 rounded-lg bg-[#A84A32] text-white font-bold cursor-pointer"
            >
              {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        )}

        {/* =================================================================================== */}
        {/* STAGE 1 UI: التلقين والاستماع التراكمي */}
        {/* =================================================================================== */}
        {!loadingVerses && !loadError && currentStage === 'stage1_listen' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Reciter & Repetitions Settings Bar */}
            <div className="p-3.5 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] space-y-3 shadow-2xs">
              {/* Row 1: Reciter Selection */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <Headphones className="w-4 h-4 text-[#C88A14]" />
                  <span className="font-bold text-[#2D2218]">
                    {lang === 'ar' ? 'اختيار القارئ للتلقين:' : 'Select Reciter:'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F7F3EB] border border-[#E5DEC9]">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReciter('husary_muallim');
                      playStepVerseAudio(0);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedReciter === 'husary_muallim'
                        ? 'bg-[#2D2218] text-[#EAB338] shadow-2xs'
                        : 'text-[#5C4B3B] hover:text-[#261C14]'
                    }`}
                  >
                    <span>{lang === 'ar' ? 'الشيخ الحصري (المصحف المعلم)' : 'Al-Husary (Muallim)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReciter('hudhaify');
                      playStepVerseAudio(0);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedReciter === 'hudhaify'
                        ? 'bg-[#2D2218] text-[#EAB338] shadow-2xs'
                        : 'text-[#5C4B3B] hover:text-[#261C14]'
                    }`}
                  >
                    <span>{lang === 'ar' ? 'الشيخ علي الحذيفي' : 'Ali Al-Hudhaify'}</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Repetition Controls (تكرار المقطع وتكرار المقرر كاملاً) */}
              <div className="pt-2.5 border-t border-[#EFE9DC] flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Chunk Reps (تكرار المقطع / الآيات المتلوة دفعة واحدة) */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[#5C4B3B] flex items-center gap-1">
                    <Repeat className="w-3.5 h-3.5 text-[#C88A14]" />
                    {lang === 'ar' ? 'تكرار المقطع مع الشيخ:' : 'Segment Reps:'}
                  </span>
                  <div className="flex items-center gap-1 bg-[#F7F3EB] p-0.5 rounded-lg border border-[#E5DEC9]">
                    {[1, 2, 3, 5, 7].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setChunkReps(num);
                          setCurrentStepRep(0);
                        }}
                        className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                          chunkReps === num
                            ? 'bg-[#C88A14] text-white shadow-2xs'
                            : 'text-[#5C4B3B] hover:bg-[#E5DEC9]'
                        }`}
                      >
                        {num}×
                      </button>
                    ))}
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[#C88A14]/15 text-[#9E650C] font-mono-tabular font-bold text-[11px]">
                    {lang === 'ar'
                      ? `التكرار ${currentStepRep + 1} من ${chunkReps}`
                      : `Rep ${currentStepRep + 1} of ${chunkReps}`}
                  </span>
                </div>

                {/* Full Passage Reps (تكرار كامل المقرر) */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[#5C4B3B] flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-[#4A6144]" />
                    {lang === 'ar' ? 'تكرار كامل المقرر:' : 'Passage Reps:'}
                  </span>
                  <div className="flex items-center gap-1 bg-[#F7F3EB] p-0.5 rounded-lg border border-[#E5DEC9]">
                    {[1, 2, 3, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setFullPassageReps(num);
                          setCurrentPassageRep(0);
                        }}
                        className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                          fullPassageReps === num
                            ? 'bg-[#4A6144] text-white shadow-2xs'
                            : 'text-[#5C4B3B] hover:bg-[#E5DEC9]'
                        }`}
                      >
                        {num}×
                      </button>
                    ))}
                  </div>
                  {fullPassageReps > 1 && (
                    <span className="px-2 py-0.5 rounded-md bg-[#4A6144]/15 text-[#4A6144] font-mono-tabular font-bold text-[11px]">
                      {lang === 'ar'
                        ? `دورة المقرر ${currentPassageRep + 1} من ${fullPassageReps}`
                        : `Cycle ${currentPassageRep + 1} of ${fullPassageReps}`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Current Cumulative Step Banner */}
            {currentStep && (
              <div className="p-3.5 rounded-2xl bg-[#FBF5E6] border border-[#E8D29F] flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                      currentStep.type === 'cumulative_link'
                        ? 'bg-[#C88A14] text-white'
                        : 'bg-[#4A6144] text-white'
                    }`}
                  >
                    {currentStepIndex + 1}
                  </span>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-[#2D2218] font-display-islamic">
                      {lang === 'ar' ? currentStep.titleAr : currentStep.titleEn}
                    </h3>
                    <p className="text-[11px] text-[#84715E]">
                      {currentStep.type === 'cumulative_link'
                        ? lang === 'ar'
                          ? 'ربط تراكمي للمقاطع السابقة لترسيخ الاتصال بين الآيات'
                          : 'Cumulative link of previous verses to solidify memory flow'
                        : lang === 'ar'
                        ? 'الاستماع للآية الجديدة ثم تكرارها ومحاكاتها'
                        : 'Listen to the new verse then repeat after the Shaykh'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleReplayCurrentStep}
                    className="p-2 rounded-xl bg-[#FFFDF9] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-[#5C4B3B] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    title={lang === 'ar' ? 'إعادة استماع المقطع' : 'Replay'}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#C88A14]" />
                    <span className="hidden sm:inline">{lang === 'ar' ? 'إعادة' : 'Replay'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Mushaf Canvas for Stage 1 with Active Recitation & Live Voice Recognition Feedback */}
            <div className="p-4 sm:p-6 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] shadow-sm space-y-4">
              <div className="text-center pb-2 border-b border-[#EFE9DC]">
                {stage1Phase === 'shaykh_reciting' ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#C88A14]/15 border border-[#C88A14]/30 text-xs font-bold text-[#9E650C] animate-pulse">
                    <Volume2 className="w-4 h-4 text-[#C88A14]" />
                    <span>
                      {lang === 'ar'
                        ? `الشيخ يتلو الآن (تكرار ${currentStepRep + 1} من ${chunkReps})... استمع بإنصات`
                        : `Shaykh is reciting (Rep ${currentStepRep + 1} of ${chunkReps})... Listen attentively`}
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex flex-col items-center gap-1">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#4A6144]/15 border border-[#4A6144]/30 text-xs font-bold text-[#4A6144]">
                      <Mic className="w-4 h-4 text-[#4A6144] animate-bounce" />
                      <span>
                        {lang === 'ar'
                          ? `دورك الآن في الترديد بصوت مسموع (تكرار ${currentStepRep + 1} من ${chunkReps})`
                          : `Your turn to repeat aloud (Rep ${currentStepRep + 1} of ${chunkReps})`}
                      </span>
                      <span className="text-[10px] opacity-80 font-mono-tabular">
                        ({userRepeatCountdown}s)
                      </span>
                    </div>

                    {/* Live speech feedback transcript / progress */}
                    <div className="text-[11px] text-[#5C4B3B] flex items-center gap-2 mt-1">
                      <span className="font-bold text-[#4A6144]">
                        {lang === 'ar'
                          ? `الكلمات المرددة: ${stage1MatchedWordIndices.size} / ${activeStepWords.length}`
                          : `Spoken words: ${stage1MatchedWordIndices.size} / ${activeStepWords.length}`}
                      </span>
                      {stage1HeardTranscript && (
                        <span className="text-[#84715E] italic truncate max-w-[250px] sm:max-w-md">
                          «{stage1HeardTranscript}»
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Toast Message when repetition recognized */}
              {stage1ToastMessage && (
                <div className="p-2.5 rounded-xl bg-[#4A6144]/15 border border-[#4A6144]/30 text-center text-xs font-bold text-[#4A6144] animate-in fade-in zoom-in-95 duration-200">
                  {stage1ToastMessage}
                </div>
              )}

              {/* Surah Header & Basmalah at the Top of the Surah */}
              <div className="text-center pb-3 mb-2 border-b border-[#EFE9DC]/80 space-y-1.5 select-none">
                <div className="inline-block py-1 px-5 rounded-xl bg-[#F6E9C8]/90 border border-[#C88A14] text-base sm:text-lg font-display-islamic font-bold text-[#2D2218] shadow-2xs">
                  سُورَةُ {surahInfo?.nameAr || ''}
                </div>
                {(verses[0]?.surahNumber || plan.ayahSurah || plan.surahStart || 1) !== 9 && (
                  <div className="font-uthmani text-lg sm:text-2xl text-[#2D2218] font-display-islamic tracking-wide pt-0.5">
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                  </div>
                )}
              </div>

              {/* Verses Layout with Active Step Highlights */}
              <div className="leading-loose text-lg sm:text-2xl font-serif text-justify font-display-islamic select-none text-[#261C14]">
                {verses.map((verse, vIdx) => {
                  const isInStep = currentStep?.verseIndices.includes(vIdx);
                  const isActivelyRecited = vIdx === activeRecitingVerseIdx;

                  return (
                    <span
                      key={verse.ayahNumber}
                      className={`inline transition-all rounded-lg p-1 ${
                        isActivelyRecited && stage1Phase === 'shaykh_reciting'
                          ? 'bg-[#C88A14]/25 ring-1 ring-[#C88A14]'
                          : isInStep
                          ? 'bg-[#F7F3EB]'
                          : 'opacity-40'
                      }`}
                    >
                      {/* Render individual words in active step with live repetition match highlights */}
                      {isInStep && stage1Phase === 'user_repeating' ? (
                        verse.words.map((w) => {
                          // Find this word's index in activeStepWords
                          const sIdx = activeStepWords.findIndex((sw) => sw.globalIndex === w.globalIndex);
                          const isMatched = sIdx !== -1 && stage1MatchedWordIndices.has(sIdx);

                          return (
                            <span
                              key={w.globalIndex}
                              className={`inline-block mx-0.5 transition-colors duration-200 ${
                                isMatched ? 'text-[#4A6144] font-bold bg-[#4A6144]/15 px-0.5 rounded' : ''
                              }`}
                            >
                              {w.raw}
                            </span>
                          );
                        })
                      ) : (
                        verse.textUthmani
                      )}{' '}
                      <span className="text-[#9E650C] font-mono-tabular text-sm font-bold mx-1">
                        ﴿{verse.ayahNumber}﴾
                      </span>{' '}
                    </span>
                  );
                })}
              </div>

              {/* Action Buttons for Stage 1 */}
              <div className="pt-3 border-t border-[#EFE9DC] flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-[#84715E] font-mono-tabular">
                  {lang === 'ar'
                    ? `المقطع ${currentStepIndex + 1} من ${cumulativeSteps.length} · تكرار ${currentStepRep + 1}/${chunkReps}`
                    : `Step ${currentStepIndex + 1} of ${cumulativeSteps.length} · Rep ${currentStepRep + 1}/${chunkReps}`}
                </span>

                <button
                  type="button"
                  onClick={handleCompleteCurrentRepetition}
                  className="mustard-gradient-btn text-white px-5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:brightness-105 transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>
                    {stage1Phase === 'user_repeating'
                      ? currentStepRep + 1 < chunkReps
                        ? lang === 'ar'
                          ? 'تم الترديد · انتقال لتلاوة الشيخ التالية ➔'
                          : 'Repeated · Replay Shaykh ➔'
                        : currentStepIndex + 1 === cumulativeSteps.length && currentPassageRep + 1 === fullPassageReps
                        ? lang === 'ar'
                          ? 'إتمام التلقين والانتقال للمرحلة الثانية ➔'
                          : 'Complete Stage 1 & Advance ➔'
                        : lang === 'ar'
                        ? 'تم الترديد والاستيعاب · المقطع التالي ➔'
                        : 'Repeated & Understood · Next Step ➔'
                      : lang === 'ar'
                      ? 'تخطي للترديد والمحاكاة ➔'
                      : 'Skip to Repeat ➔'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================================== */}
        {/* STAGE 2 UI: المحاذاة اللحظية والتلاشي التدريجي */}
        {/* =================================================================================== */}
        {!loadingVerses && !loadError && currentStage === 'stage2_fadeout' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Status & Mic Live Banner */}
            <div className="p-3.5 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#4A6144]/15 border border-[#4A6144]/30 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-[#4A6144] animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#2D2218]">
                    {lang === 'ar'
                      ? 'الميكروفون مفعّل تلقائياً · اقرأ بصوت مسموع'
                      : 'Microphone Active · Recite Aloud'}
                  </h3>
                  <p className="text-[11px] text-[#5C4B3B]">
                    {lang === 'ar'
                      ? 'الكلمات تتلاشى لحظياً مع تلاوتك؛ وتختفي الكلمات القادمة تدريجياً لتقرأ الأسطر الأخيرة غيباً.'
                      : 'Spoken words vanish, and upcoming lines fade out progressively into pure white.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono-tabular font-bold px-2.5 py-1 rounded-lg bg-[#F7F3EB] border border-[#DDD2BE] text-[#2D2218]">
                  {stage2WordIndex} / {flatWords.length} {lang === 'ar' ? 'كلمة' : 'Words'}
                </span>
                <span className="text-xs font-semibold text-[#C88A14]">
                  {Math.round((stage2WordIndex / (flatWords.length || 1)) * 100)}%
                </span>
              </div>
            </div>

            {/* Mushaf Canvas with Dynamic Progressive Fade-Out */}
            <div className="p-4 sm:p-8 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] shadow-sm min-h-[300px] flex flex-col justify-between">
              {/* Surah Header & Basmalah at the Top of the Surah */}
              <div className="text-center pb-3 mb-2 border-b border-[#EFE9DC]/80 space-y-1.5 select-none">
                <div className="inline-block py-1 px-5 rounded-xl bg-[#F6E9C8]/90 border border-[#C88A14] text-base sm:text-lg font-display-islamic font-bold text-[#2D2218] shadow-2xs">
                  سُورَةُ {surahInfo?.nameAr || ''}
                </div>
                {(verses[0]?.surahNumber || plan.ayahSurah || plan.surahStart || 1) !== 9 && (
                  <div className="font-uthmani text-lg sm:text-2xl text-[#2D2218] font-display-islamic tracking-wide pt-0.5">
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                  </div>
                )}
              </div>

              <div className="leading-loose text-xl sm:text-3xl font-serif text-justify font-display-islamic select-none">
                {flatWords.map((word, wIdx) => {
                  const isPast = wIdx < stage2WordIndex;
                  const isCurrent = wIdx === stage2WordIndex;

                  // Progressive fade formula:
                  // Spoken words disappear completely (opacity = 0)
                  // Upcoming words fade out smoothly based on progress
                  const progressRatio = stage2WordIndex / (flatWords.length || 1);
                  let opacity = 1.0;

                  if (isPast) {
                    opacity = 0; // Spoken words disappear
                  } else if (isCurrent) {
                    opacity = 1.0;
                  } else {
                    const distance = wIdx - stage2WordIndex;
                    // Adjusted by fadeDelayMultiplier (when repeated via 'متردد', stays longer)
                    const fadeThreshold = 0.25 * fadeDelayMultiplier;
                    if (progressRatio > fadeThreshold) {
                      const decay = (progressRatio - fadeThreshold) * 2.0;
                      opacity = Math.max(0, 1 - decay - distance * 0.07);
                    }
                  }

                  return (
                    <span
                      key={word.globalIndex}
                      style={{
                        opacity,
                        transition: 'opacity 0.3s ease-out',
                      }}
                      className={`inline-block mx-1 ${
                        isCurrent
                          ? 'border-b-2 border-[#C88A14] text-[#9E650C] font-bold'
                          : 'text-[#261C14]'
                      }`}
                    >
                      {word.raw}
                    </span>
                  );
                })}
              </div>

              {/* Progress Bar & Manual Skip Helpers */}
              <div className="pt-4 border-t border-[#EFE9DC] flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-[150px] h-2 rounded-full bg-[#EFE9DC] overflow-hidden">
                  <div
                    className="h-full bg-[#C88A14] transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (stage2WordIndex / (flatWords.length || 1)) * 100)}%`,
                    }}
                  />
                </div>

                {stage2LastHeard && (
                  <span className="text-[11px] text-[#84715E] italic truncate max-w-[200px]">
                    «{stage2LastHeard}»
                  </span>
                )}

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setStage2WordIndex((prev) => Math.min(flatWords.length, prev + 1));
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#EFE9DC] hover:bg-[#DDD2BE] text-[#5C4B3B] cursor-pointer"
                    title={lang === 'ar' ? 'تخطي كلمة واحدة' : 'Skip Word'}
                  >
                    {lang === 'ar' ? 'كلمة ➔' : '+1 Word'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      // Skip whole ayah forward
                      const currentWord = flatWords[stage2WordIndex];
                      if (currentWord) {
                        const nextAyahIdx = flatWords.findIndex(
                          (w, i) => i > stage2WordIndex && (w.ayahNumber !== currentWord.ayahNumber || w.surahNumber !== currentWord.surahNumber)
                        );
                        if (nextAyahIdx !== -1) {
                          setStage2WordIndex(nextAyahIdx);
                        } else {
                          setStage2WordIndex(flatWords.length);
                        }
                      } else {
                        setStage2WordIndex(flatWords.length);
                      }
                    }}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-[#EFE9DC] hover:bg-[#DDD2BE] text-[#5C4B3B] cursor-pointer"
                    title={lang === 'ar' ? 'تخطي آية كاملة' : 'Skip Ayah'}
                  >
                    {lang === 'ar' ? 'آية ➔' : '+1 Ayah'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================================== */}
        {/* STAGE 3 UI: التسميع الغيبي الذكي والتقييم */}
        {/* =================================================================================== */}
        {!loadingVerses && !loadError && currentStage === 'stage3_recitation' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Live Mic & Pure Memory Recitation Banner */}
            <div className="p-3.5 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#A84A32]/15 border border-[#A84A32]/30 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-[#A84A32]" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#2D2218]">
                    {lang === 'ar'
                      ? 'التسميع الغيبي الصارم (الظهور المشروط بالتطابق 100%)'
                      : 'Conditional Audio-Text Memory Recitation'}
                  </h3>
                  <p className="text-[11px] text-[#5C4B3B]">
                    {lang === 'ar'
                      ? 'الشاشة فارغة تماماً؛ لا تظهر الكلمة إلا إذا تطابقت قراءتك الصوتية غيباً مع النص الصحيح.'
                      : 'Canvas is completely blank; words only reveal upon exact correct pronunciation from memory.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono-tabular font-bold px-2.5 py-1 rounded-lg bg-[#4A6144]/15 border border-[#4A6144]/30 text-[#4A6144]">
                  {revealedWordIndices.size} / {flatWords.length} {lang === 'ar' ? 'متقنة' : 'Matched'}
                </span>
                <span className="text-xs font-semibold text-[#84715E]">
                  {Math.round((revealedWordIndices.size / (flatWords.length || 1)) * 100)}%
                </span>
              </div>
            </div>

            {/* Blank Canvas with Conditional Reveal on Correct Recitation */}
            <div className="p-4 sm:p-8 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] shadow-sm min-h-[320px] flex flex-col justify-between">
              {/* Surah Header & Basmalah at the Top of the Surah */}
              <div className="text-center pb-3 mb-2 border-b border-[#EFE9DC]/80 space-y-1.5 select-none">
                <div className="inline-block py-1 px-5 rounded-xl bg-[#F6E9C8]/90 border border-[#C88A14] text-base sm:text-lg font-display-islamic font-bold text-[#2D2218] shadow-2xs">
                  سُورَةُ {surahInfo?.nameAr || ''}
                </div>
                {(verses[0]?.surahNumber || plan.ayahSurah || plan.surahStart || 1) !== 9 && (
                  <div className="font-uthmani text-lg sm:text-2xl text-[#2D2218] font-display-islamic tracking-wide pt-0.5">
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                  </div>
                )}
              </div>

              <div className="leading-loose text-xl sm:text-3xl font-serif text-justify font-display-islamic select-none">
                {flatWords.map((word, wIdx) => {
                  const isRevealed = revealedWordIndices.has(wIdx);
                  const isCurrentTarget = wIdx === stage3CurrentTargetIdx;

                  if (isRevealed) {
                    return (
                      <span
                        key={word.globalIndex}
                        className="inline-block text-[#261C14] bg-[#4A6144]/10 rounded-md px-1 mx-1 font-bold animate-in fade-in zoom-in-90 duration-200"
                      >
                        {word.raw}
                      </span>
                    );
                  }

                  // Placeholder empty slot
                  return (
                    <span
                      key={word.globalIndex}
                      className={`inline-block border-b-2 mx-1 px-2.5 py-0.5 rounded-sm transition-all ${
                        isCurrentTarget
                          ? 'border-[#C88A14] bg-[#C88A14]/10 animate-pulse'
                          : 'border-[#DDD2BE] bg-[#F7F3EB]/40'
                      }`}
                    >
                      <span className="invisible text-base">{word.raw}</span>
                    </span>
                  );
                })}
              </div>

              {/* Status footer with manual help button */}
              <div className="pt-4 border-t border-[#EFE9DC] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-[#84715E]">
                  <Mic className="w-3.5 h-3.5 text-[#4A6144]" />
                  <span>
                    {lastMatchedSpokenWord
                      ? lang === 'ar'
                        ? `آخر كلمة تم التقاطها: "${lastMatchedSpokenWord}"`
                        : `Last matched: "${lastMatchedSpokenWord}"`
                      : lang === 'ar'
                      ? 'اقرأ من ذاكرتك بصوت واضح...'
                      : 'Recite from memory...'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleManualRevealNextWord}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-[#EFE9DC] hover:bg-[#DDD2BE] text-[#5C4B3B] cursor-pointer"
                    title={lang === 'ar' ? 'إظهار كلمة في حال التعثر' : 'Reveal Word'}
                  >
                    {lang === 'ar' ? 'إظهار كلمة (مساعدة) ➔' : 'Help Reveal ➔'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      // Force complete all words and evaluate
                      setRevealedWordIndices(new Set(flatWords.map((_, i) => i)));
                    }}
                    className="mustard-gradient-btn text-white px-3.5 py-1 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    {lang === 'ar' ? 'إنهاء التسميع والتقييم' : 'Finish & Evaluate'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =================================================================================== */}
      {/* FINAL SELF-EVALUATION DIALOG (نظام التقييم النهائي الصارم) */}
      {/* =================================================================================== */}
      {showEvaluationModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#FFFDF9] border-2 border-[#C88A14] p-5 sm:p-6 shadow-2xl text-[#261C14] space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center space-y-1.5 pb-3 border-b border-[#EFE9DC]">
              <div className="w-12 h-12 rounded-2xl bg-[#4A6144]/15 border border-[#4A6144]/30 flex items-center justify-center mx-auto">
                <Award className="w-6 h-6 text-[#4A6144]" />
              </div>
              <h2 className="text-lg font-bold font-display-islamic text-[#2D2218]">
                {lang === 'ar'
                  ? 'اكتملت مراحل الحفظ الذكي · التقييم النهائي'
                  : 'Smart Memorization Completed · Final Evaluation'}
              </h2>
              <p className="text-xs text-[#5C4B3B] leading-relaxed">
                {lang === 'ar'
                  ? 'اختر مستوى إتقانك للمقرر لاعتماد الإنجاز أو إعادة التثبيت الصارم وفق القواعد:'
                  : 'Select your mastery level to confirm or repeat per strict system rules:'}
              </p>
            </div>

            {/* 3 Strict Evaluation Buttons */}
            <div className="space-y-2.5">
              {/* Option 1: متقن */}
              <button
                type="button"
                onClick={handleEvaluationMuthabbat}
                className="w-full p-3.5 rounded-2xl bg-[#4A6144] hover:bg-[#3D5237] text-white text-start transition-all cursor-pointer shadow-xs flex items-center justify-between gap-3 group"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-white shrink-0" />
                    <span className="font-bold text-sm sm:text-base">
                      {lang === 'ar' ? '🟩 مُتقَن (اعتماد الحفظ والمباعدة الزمنية)' : '🟩 Mastered'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#E6EFE4] ps-5">
                    {lang === 'ar'
                      ? 'يُعتمد كمحفوظ بنجاح، وتتم جدولته تلقائياً في نظام المراجعة والمباعدة الزمنية (4 مراجعات دورية).'
                      : 'Saved successfully and scheduled in Spaced Repetition (4 periodic reviews).'}
                  </p>
                </div>
                <Check className="w-5 h-5 shrink-0 text-white" />
              </button>

              {/* Option 2: متردد */}
              <button
                type="button"
                onClick={handleEvaluationMutaraddid}
                className="w-full p-3.5 rounded-2xl bg-[#C88A14] hover:bg-[#B3780C] text-white text-start transition-all cursor-pointer shadow-xs flex items-center justify-between gap-3 group"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-white shrink-0" />
                    <span className="font-bold text-sm sm:text-base">
                      {lang === 'ar' ? '🟨 مُتردِّد (إعادة المرحلة الثانية مع إبقاء النص)' : '🟨 Hesitant'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#FFF6E3] ps-5">
                    {lang === 'ar'
                      ? 'يعيد التطبيق توجيهك فوراً إلى (المرحلة الثانية) لإعادة قراءتها مع إبقاء النص لفترة أطول قبل التلاشي.'
                      : 'Redirects to Stage 2 immediately with extended text visibility before fading.'}
                  </p>
                </div>
                <RotateCcw className="w-5 h-5 shrink-0 text-white" />
              </button>

              {/* Option 3: متفلت */}
              <button
                type="button"
                onClick={handleEvaluationMutafallit}
                className="w-full p-3.5 rounded-2xl bg-[#A84A32] hover:bg-[#913E28] text-white text-start transition-all cursor-pointer shadow-xs flex items-center justify-between gap-3 group"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-white shrink-0" />
                    <span className="font-bold text-sm sm:text-base">
                      {lang === 'ar' ? '🟥 مُتفلِّت (تصفير التقدم والعودة للمرحلة الأولى)' : '🟥 Slipping'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#FBEBE7] ps-5">
                    {lang === 'ar'
                      ? 'تصفير التقدم بالكامل في هذا المقرر والعودة إجبارياً إلى (المرحلة الأولى) لإعادة التلقين التراكمي مع الشيخ.'
                      : 'Resets all progress and returns you to Stage 1 to listen and repeat accumulatively.'}
                  </p>
                </div>
                <RotateCcw className="w-5 h-5 shrink-0 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation of Spaced Repetition Created */}
      {scheduledReviewsCount !== null && (
        <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#FFFDF9] border border-[#4A6144] p-5 shadow-2xl text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-[#4A6144] mx-auto" />
            <h3 className="text-base font-bold font-display-islamic text-[#2D2218]">
              {lang === 'ar' ? 'بارك الله لك في حفظك!' : 'Mubarak! Memorization Confirmed'}
            </h3>
            <p className="text-xs text-[#5C4B3B] leading-relaxed">
              {lang === 'ar'
                ? `تم اعتماد الحفظ وإدراج ${scheduledReviewsCount} مراجعات دورية تلقائية (بعد يوم، 3 أيام، أسبوع، شهر) لتثبيت هذا الوِرد الراسخ.`
                : `Successfully scheduled ${scheduledReviewsCount} periodic spaced reviews (after 1 day, 3 days, 1 week, 1 month) to solidify your memorization.`}
            </p>
            {/* Auto-transition countdown indicator */}
            <div className="py-2 px-3 rounded-xl bg-[#4A6144]/10 border border-[#4A6144]/20 text-xs text-[#4A6144] font-bold flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4A6144] animate-ping" />
              <span>
                {lang === 'ar'
                  ? `العودة التلقائية للجدول الرئيسي خلال ${autoCloseCountdown} ثوانٍ...`
                  : `Auto-returning to schedule in ${autoCloseCountdown}s...`}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-[#2D2218] text-white text-xs font-bold hover:bg-[#3D2F22] cursor-pointer"
            >
              {lang === 'ar' ? 'العودة الفورية الآن' : 'Return Now'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
