import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Award,
  CheckCircle2,
  AlertCircle,
  Mic,
  MicOff,
  Volume2,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Calendar,
  Clock,
} from 'lucide-react';
import { QuranRandomQuizItem, Language } from '@/src/data/quranData';
import { cleanArabicDiacritics } from '@/src/utils/memorizationReports';

interface RandomQuizModalProps {
  quiz: QuranRandomQuizItem;
  lang: Language;
  onClose: () => void;
  onCompleteQuiz: (quizId: string, score: number) => void;
}

interface Question {
  id: number;
  type: 'complete_ayah' | 'next_ayah' | 'recite_ayah';
  prompt: string;
  sourceAyahNumber: number;
  targetText: string;
  options?: string[];
  correctOptionIndex?: number;
}

export const RandomQuizModal: React.FC<RandomQuizModalProps> = ({
  quiz,
  lang,
  onClose,
  onCompleteQuiz,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState<number>(0);
  const [isQuizCompleted, setIsQuizCompleted] = useState<boolean>(false);

  // Speech Recognition for Recitation question
  const [isListening, setIsListening] = useState<boolean>(false);
  const [spokenTranscript, setSpokenTranscript] = useState<string>('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadAyahsAndGenerateQuestions = async () => {
      try {
        setLoading(true);
        const res = await fetch(`https://api.alquran.cloud/v1/surah/${quiz.surahNumber}/quran-uthmani`);
        const json = await res.json();
        if (isCancelled) return;

        const allAyahs: { numberInSurah: number; text: string }[] = json.data?.ayahs || [];
        const filtered = allAyahs.filter(
          (a) => a.numberInSurah >= quiz.ayahFrom && a.numberInSurah <= quiz.ayahTo
        );

        const pool = filtered.length > 0 ? filtered : allAyahs.slice(0, 7);

        // Generate 3 random questions
        const generated: Question[] = [];

        // Question 1: Complete the Ayah
        const randomAyah1 = pool[Math.floor(Math.random() * pool.length)];
        const clean1 = cleanArabicDiacritics(randomAyah1.text);
        const words1 = clean1.split(/\s+/).filter(Boolean);
        const splitIdx = Math.max(2, Math.floor(words1.length / 2));
        const prompt1 = words1.slice(0, splitIdx).join(' ') + ' ...';
        const correctContinuation = words1.slice(splitIdx).join(' ');

        // Create 2 distractors from other ayahs
        const distractors1: string[] = [];
        pool.forEach((a) => {
          if (a.numberInSurah !== randomAyah1.numberInSurah && distractors1.length < 2) {
            const w = cleanArabicDiacritics(a.text).split(/\s+/).filter(Boolean);
            if (w.length > 3) {
              distractors1.push(w.slice(Math.floor(w.length / 2)).join(' '));
            }
          }
        });
        while (distractors1.length < 2) {
          distractors1.push('إِنَّ ٱللَّهَ كَانَ عَلِيمًا حَكِيمًا');
        }

        const options1 = [correctContinuation, distractors1[0], distractors1[1]].sort(
          () => Math.random() - 0.5
        );

        generated.push({
          id: 1,
          type: 'complete_ayah',
          prompt: prompt1,
          sourceAyahNumber: randomAyah1.numberInSurah,
          targetText: correctContinuation,
          options: options1,
          correctOptionIndex: options1.indexOf(correctContinuation),
        });

        // Question 2: What is the next Ayah?
        const eligibleForNext = pool.filter((a) => a.numberInSurah < (quiz.ayahTo || pool[pool.length - 1].numberInSurah));
        const randomAyah2 =
          eligibleForNext.length > 0
            ? eligibleForNext[Math.floor(Math.random() * eligibleForNext.length)]
            : pool[0];
        const nextAyah =
          allAyahs.find((a) => a.numberInSurah === randomAyah2.numberInSurah + 1) || pool[0];

        const distractors2: string[] = [];
        allAyahs.forEach((a) => {
          if (
            a.numberInSurah !== nextAyah.numberInSurah &&
            a.numberInSurah !== randomAyah2.numberInSurah &&
            distractors2.length < 2
          ) {
            distractors2.push(a.text);
          }
        });
        while (distractors2.length < 2) {
          distractors2.push('وَٱللَّهُ غَفُورٌ رَّحِيمٌ');
        }

        const options2 = [nextAyah.text, distractors2[0], distractors2[1]].sort(
          () => Math.random() - 0.5
        );

        generated.push({
          id: 2,
          type: 'next_ayah',
          prompt: randomAyah2.text,
          sourceAyahNumber: randomAyah2.numberInSurah,
          targetText: nextAyah.text,
          options: options2,
          correctOptionIndex: options2.indexOf(nextAyah.text),
        });

        // Question 3: Recitation / Voice Test of an Ayah
        const randomAyah3 = pool[Math.floor(Math.random() * pool.length)];
        generated.push({
          id: 3,
          type: 'recite_ayah',
          prompt: `سَمِّع الآية رقم (${randomAyah3.numberInSurah}) بصوتك:`,
          sourceAyahNumber: randomAyah3.numberInSurah,
          targetText: randomAyah3.text,
        });

        setQuestions(generated);
        setLoading(false);
      } catch {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadAyahsAndGenerateQuestions();

    return () => {
      isCancelled = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [quiz]);

  const currentQ = questions[currentQuestionIdx];

  // Speech Recognition for Question 3
  const handleToggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(lang === 'ar' ? 'المتصفح لا يدعم التعرف على الصوت' : 'Speech recognition not supported');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        if (!lastResult) return;
        const transcript = lastResult[0]?.transcript || '';
        setSpokenTranscript(transcript);

        // Check matching
        const cleanSpoken = cleanArabicDiacritics(transcript);
        const cleanTarget = cleanArabicDiacritics(currentQ.targetText);
        const spokenTokens = cleanSpoken.split(/\s+/).filter(Boolean);
        const targetTokens = cleanTarget.split(/\s+/).filter(Boolean);

        let matches = 0;
        spokenTokens.forEach((tok) => {
          if (targetTokens.some((t) => t.includes(tok) || tok.includes(t))) {
            matches++;
          }
        });

        if (matches >= Math.min(2, targetTokens.length)) {
          setIsCorrect(true);
          setIsAnswerChecked(true);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      setIsListening(false);
    }
  };

  const handleSelectOption = (index: number) => {
    if (isAnswerChecked) return;
    setSelectedOption(index);
    setIsAnswerChecked(true);
    const correct = index === currentQ?.correctOptionIndex;
    setIsCorrect(correct);
    if (correct) {
      setCorrectAnswersCount((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    setSelectedOption(null);
    setIsAnswerChecked(false);
    setIsCorrect(false);
    setSpokenTranscript('');

    if (currentQuestionIdx + 1 < questions.length) {
      setCurrentQuestionIdx((prev) => prev + 1);
    } else {
      // Quiz completed!
      setIsQuizCompleted(true);
      const scorePct = Math.round(
        ((correctAnswersCount + (isCorrect ? 1 : 0)) / questions.length) * 100
      );
      onCompleteQuiz(quiz.id, scorePct);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
    >
      <div className="w-full max-w-xl rounded-3xl bg-[#FFFDF9] border-2 border-[#C88A14] shadow-2xl text-[#261C14] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <header className="px-5 py-4 bg-[#FBF5E6] border-b border-[#E8D29F] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#C88A14]/15 border border-[#C88A14]/30 flex items-center justify-center text-[#9E650C]">
              <Sparkles className="w-5 h-5 text-[#C88A14]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold font-display-islamic text-[#2D2218]">
                {lang === 'ar' ? 'الاختبار العشوائي لتثبيت الحفظ' : 'Random Retention Quiz'}
              </h2>
              <p className="text-[11px] text-[#84715E] flex items-center gap-1.5">
                <span>سورة {quiz.surahNameAr}</span>
                <span>·</span>
                <span>
                  الآيات ({quiz.ayahFrom} - {quiz.ayahTo})
                </span>
                <span>·</span>
                <span className="font-semibold text-[#9E650C]">{quiz.frequencyLabelAr}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#84715E] hover:text-[#2D2218] hover:bg-[#EFE9DC] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-[#C88A14] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-[#84715E]">
                {lang === 'ar'
                  ? 'جاري إعداد الأسئلة العشوائية من الآيات المقررة...'
                  : 'Preparing random questions...'}
              </p>
            </div>
          ) : isQuizCompleted ? (
            /* Quiz Completed Screen */
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-[#4A6144]/15 border border-[#4A6144]/30 flex items-center justify-center mx-auto text-[#4A6144]">
                <Award className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold font-display-islamic text-[#2D2218]">
                  {lang === 'ar' ? 'ما شاء الله! اكتمل الاختبار العشوائي' : 'Quiz Completed!'}
                </h3>
                <p className="text-xs text-[#5C4B3B]">
                  {lang === 'ar'
                    ? `تم اجتياز الاختبار بنجاح، وجدولة الموعد القادم وفق تقييم المقرر (${quiz.frequencyLabelAr}).`
                    : `Quiz completed successfully. Next test scheduled based on rating.`}
                </p>
              </div>

              {/* Score Card */}
              <div className="p-4 rounded-2xl bg-[#FBF5E6] border border-[#E8D29F] flex items-center justify-around gap-4 max-w-sm mx-auto">
                <div className="text-center">
                  <span className="text-[11px] text-[#84715E] block">الإجابات الصحيحة</span>
                  <span className="text-xl font-bold font-mono-tabular text-[#4A6144]">
                    {correctAnswersCount + (isCorrect ? 1 : 0)} / {questions.length}
                  </span>
                </div>
                <div className="w-px h-8 bg-[#E8D29F]" />
                <div className="text-center">
                  <span className="text-[11px] text-[#84715E] block">النتيجة الإجمالية</span>
                  <span className="text-xl font-bold font-mono-tabular text-[#C88A14]">
                    {Math.round(
                      ((correctAnswersCount + (isCorrect ? 1 : 0)) / questions.length) * 100
                    )}
                    %
                  </span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-[#4A6144] hover:bg-[#3D5237] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  {lang === 'ar' ? 'تم واعتماد النتيجة في الإحصائيات' : 'Finish & Save to Stats'}
                </button>
              </div>
            </div>
          ) : currentQ ? (
            <div className="space-y-4">
              {/* Progress Indicator */}
              <div className="flex items-center justify-between text-xs text-[#84715E]">
                <span>
                  السؤال {currentQuestionIdx + 1} من {questions.length}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#EFE9DC] text-[#5C4B3B] font-semibold text-[11px]">
                  {currentQ.type === 'complete_ayah'
                    ? 'أكمل الآية'
                    : currentQ.type === 'next_ayah'
                    ? 'الآية التالية'
                    : 'تسميع صوتي'}
                </span>
              </div>

              {/* Question Card */}
              <div className="p-4 rounded-2xl bg-[#F7F3EB] border border-[#DDD2BE] space-y-2">
                <span className="text-xs font-bold text-[#84715E] block">
                  {currentQ.type === 'complete_ayah'
                    ? 'أكمل قوله تعالى:'
                    : currentQ.type === 'next_ayah'
                    ? 'ما هي الآية التالية لقوله تعالى:'
                    : 'سَمِّع الآية الكريمة التالية بصوتك:'}
                </span>
                <p className="font-uthmani text-lg sm:text-xl text-[#261C14] leading-relaxed select-none">
                  «{currentQ.prompt}»
                </p>
              </div>

              {/* Options or Voice Input */}
              {currentQ.type === 'recite_ayah' ? (
                <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] text-center space-y-3">
                  <p className="text-xs text-[#5C4B3B]">
                    اضغط على الميكروفون واردد الآية بصوت واضح للتحقق التلقائي:
                  </p>

                  <button
                    type="button"
                    onClick={handleToggleListening}
                    className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto transition-all cursor-pointer shadow-md ${
                      isListening
                        ? 'bg-[#A84A32] text-white animate-pulse'
                        : 'bg-[#4A6144] text-white hover:bg-[#3D5237]'
                    }`}
                  >
                    {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </button>

                  {spokenTranscript && (
                    <div className="text-xs text-[#84715E] italic bg-[#F7F3EB] p-2.5 rounded-xl border border-[#DDD2BE]">
                      «{spokenTranscript}»
                    </div>
                  )}

                  {isAnswerChecked && (
                    <div className="p-2.5 rounded-xl bg-[#4A6144]/15 border border-[#4A6144]/30 text-xs font-bold text-[#4A6144]">
                      ✓ ممتاز! تم التحقق من تلاوتك ومطابقتها للآية الكريمة بنجاح
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {currentQ.options?.map((opt, idx) => {
                    let btnStyle = 'bg-[#FFFDF9] border-[#DDD2BE] text-[#261C14] hover:bg-[#FBF5E6]';
                    if (isAnswerChecked) {
                      if (idx === currentQ.correctOptionIndex) {
                        btnStyle = 'bg-[#4A6144]/15 border-[#4A6144] text-[#4A6144] font-bold';
                      } else if (idx === selectedOption) {
                        btnStyle = 'bg-[#A84A32]/15 border-[#A84A32] text-[#A84A32]';
                      } else {
                        btnStyle = 'opacity-50 border-[#DDD2BE] text-[#84715E]';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={isAnswerChecked}
                        onClick={() => handleSelectOption(idx)}
                        className={`w-full p-3 rounded-xl border text-start transition-all cursor-pointer flex items-center justify-between gap-3 text-xs sm:text-sm font-uthmani ${btnStyle}`}
                      >
                        <span className="leading-relaxed">{opt}</span>
                        {isAnswerChecked && idx === currentQ.correctOptionIndex && (
                          <CheckCircle2 className="w-4 h-4 text-[#4A6144] shrink-0" />
                        )}
                        {isAnswerChecked &&
                          idx === selectedOption &&
                          idx !== currentQ.correctOptionIndex && (
                            <AlertCircle className="w-4 h-4 text-[#A84A32] shrink-0" />
                          )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Next Question Button */}
              {isAnswerChecked && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="px-5 py-2.5 rounded-xl bg-[#4A6144] hover:bg-[#3D5237] text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <span>
                      {currentQuestionIdx + 1 < questions.length ? 'السؤال التالي' : 'إنهاء الاختبار'}
                    </span>
                    <ArrowLeft className="w-4 h-4 rtl:rotate-0" />
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
