import { useState, useEffect } from 'react';
import { Check, X, ArrowRight, RotateCcw, Home, Loader2 } from 'lucide-react';
import MascotBubble from './MascotBubble';

const SCORE_STATEMENTS = {
  perfect: "Incredible! You're a FireCommander expert!",
  high: "Great job! You know your bushfire safety.",
  mid: "Not bad! Keep learning about safety.",
  low: "Let's review the safety facts and try again."
};

export default function QuizPage({ onBack, scenarioId = null }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const fetchQuiz = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/education/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          num_questions: 5,
          year_group: 4,
          scenario_id: scenarioId
        })
      });
      if (!resp.ok) throw new Error("Failed to load quiz");
      const data = await resp.json();
      setQuestions(data.questions);
    } catch (err) {
      console.error(err);
      setError("Failed to generate AI quiz. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuiz();
  }, [scenarioId]);

  const handleSelect = (idx) => {
    if (isAnswered) return;
    setSelected(idx);
    setIsAnswered(true);
    if (idx === questions[currentIndex].correctIndex) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1);
      setSelected(null);
      setIsAnswered(false);
    } else {
      setIsFinished(true);
    }
  };

  const reset = () => {
    setCurrentIndex(0);
    setScore(0);
    setSelected(null);
    setIsAnswered(false);
    setIsFinished(false);
    fetchQuiz();
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-gray-950 flex flex-col items-center justify-center text-white">
        <Loader2 size={48} className="text-orange-500 animate-spin mb-4" />
        <p className="text-gray-400 animate-pulse font-bold uppercase tracking-widest text-xs">Generating AI Quiz...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen bg-gray-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <X size={48} className="text-red-500 mb-4" />
        <p className="text-gray-400 mb-6">{error}</p>
        <button onClick={fetchQuiz} className="bg-orange-600 px-6 py-2 rounded-lg font-bold">Retry</button>
      </div>
    );
  }

  if (isFinished) {
    const total = questions.length;
    let msg = SCORE_STATEMENTS.low;
    if (score === total) msg = SCORE_STATEMENTS.perfect;
    else if (score >= total * 0.8) msg = SCORE_STATEMENTS.high;
    else if (score >= total * 0.5) msg = SCORE_STATEMENTS.mid;

    return (
      <div className="min-h-[100svh] w-full flex flex-col items-center justify-center p-4 bg-gray-950 text-white relative py-12 md:py-4">
        <div className="flex flex-col items-center w-full max-w-2xl text-center shrink-0">
          <div className="relative z-10 mb-4">
            <h2 className="text-3xl md:text-4xl font-bold mb-1">Quiz Complete!</h2>
            <p className="text-orange-500 text-5xl md:text-6xl font-black">{score}/{total}</p>
          </div>
          <div className="relative z-10 w-full mb-6">
            <MascotBubble text={msg} />
          </div>
          <div className="relative z-10 flex gap-4 w-full justify-center">
            <button onClick={reset} className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-colors cursor-pointer">
              <RotateCcw size={20} /> Restart
            </button>
            <button onClick={onBack} className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold transition-colors cursor-pointer">
              <Home size={20} /> Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = questions[currentIndex];

  return (
    <div className="min-h-[100svh] w-full flex flex-col items-center p-4 bg-gray-950 text-white relative py-8 md:py-4">
      <div className="flex flex-col items-center w-full max-w-2xl min-h-full">
        <div className="relative z-10 w-full mt-4 mb-4 shrink-0">
          <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest">
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span>Score: {score}</span>
          </div>
          <div className="h-1 w-full bg-gray-900 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
          </div>
        </div>

        <div className="relative z-10 w-full flex flex-col items-center justify-center flex-1 min-h-0">
          <div className="w-full max-h-full flex flex-col items-center">
            <h2 className="text-xl md:text-2xl font-bold mb-4 leading-tight text-center shrink-0">{current.question}</h2>
            
            <div className="grid grid-cols-1 gap-2 w-full mb-4 shrink-0">
              {current.options.map((opt, i) => {
                let style = "bg-gray-900 border-gray-800 hover:border-gray-600 text-white";
                if (isAnswered) {
                  if (i === current.correctIndex) style = "bg-green-900/30 border-green-500 text-green-100";
                  else if (i === selected) style = "bg-red-900/30 border-red-500 text-red-100";
                  else style = "bg-gray-900/50 border-gray-800 opacity-50 text-gray-500";
                }
                
                return (
                  <button key={i} onClick={() => handleSelect(i)} disabled={isAnswered} className={`flex items-center justify-between p-3 rounded-xl border-2 text-left font-bold text-sm md:text-base transition-all cursor-pointer ${style}`}>
                    <span className="truncate mr-2">{opt}</span>
                    {isAnswered && i === current.correctIndex && <Check size={18} className="shrink-0 text-green-500" />}
                    {isAnswered && i === selected && i !== current.correctIndex && <X size={18} className="shrink-0 text-red-500" />}
                  </button>
                );
              })}
            </div>

            <div className={`w-full transition-all duration-500 transform shrink-0 ${isAnswered ? 'opacity-100 translate-y-0 scale-100 mb-8' : 'opacity-0 translate-y-4 scale-95 pointer-events-none h-0 overflow-hidden'}`}>
              <MascotBubble text={current.fact} />
              <button onClick={handleNext} className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-black text-lg transition-all shadow-xl shadow-orange-900/30 cursor-pointer">
                {currentIndex === questions.length - 1 ? "View Results" : "Next Question"} <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
