import { useState, useEffect } from 'react';
import { Check, X, ArrowRight, RotateCcw, Home } from 'lucide-react';
import { QUIZ_QUESTIONS, SCORE_STATEMENTS } from '../data/quiz-questions';
import MascotBubble from './MascotBubble';

export default function QuizPage({ onBack }) {
  const [shuffled, setShuffled] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    // Fisher-Yates shuffle for better randomization
    const s = [...QUIZ_QUESTIONS];
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    setShuffled(s.slice(0, 10));
  }, []);

  if (shuffled.length === 0) return null;

  const current = shuffled[currentIndex];

  const handleSelect = (idx) => {
    if (isAnswered) return;
    setSelected(idx);
    setIsAnswered(true);
    if (idx === current.correctIndex) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (currentIndex < 9) {
      setCurrentIndex(i => i + 1);
      setSelected(null);
      setIsAnswered(false);
    } else {
      setIsFinished(true);
    }
  };

  const reset = () => {
    const s = [...QUIZ_QUESTIONS];
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    setShuffled(s.slice(0, 10));
    setCurrentIndex(0);
    setScore(0);
    setSelected(null);
    setIsAnswered(false);
    setIsFinished(false);
  };

  if (isFinished) {
    let msg = SCORE_STATEMENTS.low;
    if (score === 10) msg = SCORE_STATEMENTS.perfect;
    else if (score >= 8) msg = SCORE_STATEMENTS.high;
    else if (score >= 4) msg = SCORE_STATEMENTS.mid;

    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center p-8 bg-gray-950 text-white overflow-hidden relative">
        <div className="relative z-10 mb-12 text-center">
          <h2 className="text-4xl font-bold mb-2">Quiz Complete!</h2>
          <p className="text-orange-500 text-6xl font-black">{score}/10</p>
        </div>
        <div className="relative z-10">
          <MascotBubble text={msg} />
        </div>
        <div className="relative z-10 mt-12 flex gap-4">
          <button onClick={reset} className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-colors cursor-pointer">
            <RotateCcw size={20} /> Restart
          </button>
          <button onClick={onBack} className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold transition-colors cursor-pointer">
            <Home size={20} /> Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center p-6 bg-gray-950 text-white overflow-hidden relative">
      {/* Progress */}
      <div className="relative z-10 max-w-2xl w-full mb-12">
        <div className="flex justify-between text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">
          <span>Question {currentIndex + 1} of 10</span>
          <span>Score: {score}</span>
        </div>
        <div className="h-1.5 w-full bg-gray-900 rounded-full overflow-hidden">
          <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${(currentIndex + 1) * 10}%` }} />
        </div>
      </div>

      <div className="relative z-10 max-w-2xl w-full flex flex-col items-center">
        <h2 className="text-3xl font-bold mb-10 leading-tight text-center">{current.question}</h2>
        
        <div className="grid grid-cols-1 gap-4 w-full mb-12">
          {current.options.map((opt, i) => {
            let style = "bg-gray-900 border-gray-800 hover:border-gray-600 text-white";
            if (isAnswered) {
              if (i === current.correctIndex) style = "bg-green-900/30 border-green-500 text-green-100";
              else if (i === selected) style = "bg-red-900/30 border-red-500 text-red-100";
              else style = "bg-gray-900/50 border-gray-800 opacity-50 text-gray-500";
            }
            
            return (
              <button key={i} onClick={() => handleSelect(i)} disabled={isAnswered} className={`flex items-center justify-between p-5 rounded-2xl border-2 text-left font-bold text-lg transition-all cursor-pointer ${style}`}>
                {opt}
                {isAnswered && i === current.correctIndex && <Check size={24} className="text-green-500" />}
                {isAnswered && i === selected && i !== current.correctIndex && <X size={24} className="text-red-500" />}
              </button>
            );
          })}
        </div>

        <div className={`w-full transition-all duration-500 transform ${isAnswered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95 pointer-events-none'}`}>
          <MascotBubble text={current.fact} />
          <button onClick={handleNext} className="mt-10 w-full flex items-center justify-center gap-3 px-8 py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black text-xl transition-all shadow-xl shadow-orange-900/30 cursor-pointer">
            {currentIndex === 9 ? "View Results" : "Next Question"} <ArrowRight size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
