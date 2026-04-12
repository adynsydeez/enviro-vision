# Quiz Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a 10-question interactive quiz about Australian bushfire safety, featuring a mascot with a speech bubble and randomized questions.

**Architecture:** Modular React components with a dedicated data file. State-based navigation in `App.jsx` handles view switching. The quiz uses a "MascotBubble" component for all interactive feedback and final results.

**Tech Stack:** React, Tailwind CSS v4, Lucide Icons.

---

### Task 1: Quiz Data Definition

**Files:**
- Create: `frontend/src/data/quiz-questions.js`

- [ ] **Step 1: Create the quiz data file**
Create `frontend/src/data/quiz-questions.js` with the 10 approved questions, options, correct indices, and fun facts.

```javascript
export const QUIZ_QUESTIONS = [
  {
    question: "What are the three factors in the 'Fire Behaviour Triangle'?",
    options: ["Oxygen, Heat, Fuel", "Vegetation, Weather, Terrain", "Wind, Slope, Humidity", "Ignition, Fuel, Suppression"],
    correctIndex: 1,
    fact: "While the 'Fire Triangle' (Oxygen/Heat/Fuel) starts a fire, the 'Behaviour Triangle' determines how it spreads!"
  },
  // ... (all 10 questions from spec)
];

export const SCORE_STATEMENTS = {
  low: "Don't sweat it, recruit! Even the best firefighters started as trainees. Let's hit the books and try again?",
  mid: "Nice work, Fire Watcher! You've got the basics down, but there's more to learn about the bush. Want to go again?",
  high: "Impressive! You're a Fire Warden in the making. Just a few more facts to master and you'll be unstoppable!",
  perfect: "Incredible! You're a Fire Commander! The forest is safer with you on watch. You've mastered the fire science!"
};
```

- [ ] **Step 2: Commit data definition**
```bash
git add frontend/src/data/quiz-questions.js
git commit -m "feat: add quiz questions and score statements data"
```

---

### Task 2: MascotBubble Component

**Files:**
- Create: `frontend/src/components/MascotBubble.jsx`

- [ ] **Step 1: Create the MascotBubble component**
Implement a component that displays the mascot and a friendly speech bubble.

```jsx
import mascotImg from '../assets/mascot.png';

export default function MascotBubble({ text, isVisible = true }) {
  if (!isVisible) return null;
  
  return (
    <div className="flex flex-col items-center gap-4 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative bg-white text-gray-900 p-6 rounded-3xl shadow-xl border-2 border-orange-100">
        <p className="text-lg font-medium leading-relaxed">{text}</p>
        {/* Bubble Tail */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-r-2 border-b-2 border-orange-100 rotate-45" />
      </div>
      <img src={mascotImg} alt="Mascot" className="w-32 h-32 object-contain drop-shadow-2xl" />
    </div>
  );
}
```

- [ ] **Step 2: Commit MascotBubble**
```bash
git add frontend/src/components/MascotBubble.jsx
git commit -m "feat: add MascotBubble component"
```

---

### Task 3: QuizPage Component

**Files:**
- Create: `frontend/src/components/QuizPage.jsx`

- [ ] **Step 1: Implement QuizPage logic and layout**
Create `frontend/src/components/QuizPage.jsx` with randomization, state for progress, and scoring.

```jsx
import { useState, useEffect, useMemo } from 'react';
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
    const s = [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 10);
    setShuffled(s);
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
    setShuffled([...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 10));
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-950">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-bold mb-2">Quiz Complete!</h2>
          <p className="text-orange-500 text-6xl font-black">{score}/10</p>
        </div>
        <MascotBubble text={msg} />
        <div className="mt-12 flex gap-4">
          <button onClick={reset} className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold transition-colors">
            <RotateCcw size={20} /> Restart
          </button>
          <button onClick={onBack} className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 rounded-xl font-bold transition-colors">
            <Home size={20} /> Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 bg-gray-950 overflow-y-auto">
      {/* Progress */}
      <div className="max-w-2xl mx-auto w-full mb-8">
        <div className="flex justify-between text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">
          <span>Question {currentIndex + 1} of 10</span>
          <span>Score: {score}</span>
        </div>
        <div className="h-1.5 w-full bg-gray-900 rounded-full overflow-hidden">
          <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${(currentIndex + 1) * 10}%` }} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
        <h2 className="text-2xl font-bold mb-8 leading-tight">{current.question}</h2>
        
        <div className="grid gap-3 mb-12">
          {current.options.map((opt, i) => {
            let style = "bg-gray-900 border-gray-800 hover:border-gray-600";
            if (isAnswered) {
              if (i === current.correctIndex) style = "bg-green-900/30 border-green-500 text-green-100";
              else if (i === selected) style = "bg-red-900/30 border-red-500 text-red-100";
              else style = "bg-gray-900/50 border-gray-800 opacity-50";
            }
            
            return (
              <button key={i} onClick={() => handleSelect(i)} disabled={isAnswered} className={`flex items-center justify-between p-4 rounded-xl border-2 text-left font-medium transition-all ${style}`}>
                {opt}
                {isAnswered && i === current.correctIndex && <Check size={20} className="text-green-500" />}
                {isAnswered && i === selected && i !== current.correctIndex && <X size={20} className="text-red-500" />}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className="mt-auto animate-in fade-in slide-in-from-bottom-4">
            <MascotBubble text={current.fact} />
            <button onClick={handleNext} className="mt-8 w-full flex items-center justify-center gap-2 px-8 py-4 bg-orange-600 hover:bg-orange-500 rounded-2xl font-black text-lg transition-all shadow-lg shadow-orange-900/20">
              {currentIndex === 9 ? "View Results" : "Next Question"} <ArrowRight size={22} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit QuizPage**
```bash
git add frontend/src/components/QuizPage.jsx
git commit -m "feat: implement QuizPage and scoring logic"
```

---

### Task 4: App Integration

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/LandingPage.jsx`

- [ ] **Step 1: Add Quiz view state to App.jsx**
Modify `App.jsx` to handle the `quiz` view.

```jsx
import { useState } from 'react';
import LandingPage from './LandingPage';
import MapView from './MapView';
import QuizPage from './components/QuizPage'; // Add this

export default function App() {
  const [scenario, setScenario] = useState(null);
  const [view, setView] = useState('home'); // Add this

  const handleBack = () => {
    setScenario(null);
    setView('home');
  };

  if (scenario) {
    return <MapView scenario={scenario} onBack={handleBack} />;
  }
  
  if (view === 'quiz') {
    return <QuizPage onBack={() => setView('home')} />;
  }

  return <LandingPage onSelect={setScenario} onStartQuiz={() => setView('quiz')} />;
}
```

- [ ] **Step 2: Add Quiz button to LandingPage.jsx header**
Modify the header in `LandingPage.jsx` to include the Quiz button.

```jsx
// Find the header div and add the Quiz button
<div className="flex items-center gap-3">
  {/* Existing mascot and title */}
  <button 
    onClick={onStartQuiz}
    className="ml-4 text-xs font-bold px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-lg hover:bg-orange-500/20 transition-all cursor-pointer"
  >
    Take the Quiz
  </button>
</div>
```

- [ ] **Step 3: Commit Integration**
```bash
git add frontend/src/App.jsx frontend/src/LandingPage.jsx
git commit -m "feat: integrate quiz into App and LandingPage"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Verify the quiz flow manually**
1. Start the dev server.
2. Click "Take the Quiz" from the landing page.
3. Verify questions are randomized.
4. Answer questions and check mascot bubble feedback.
5. Reach the results screen and verify the final statement matches the score.
6. Test "Restart" and "Home" buttons.

- [ ] **Step 2: Final Commit**
```bash
git commit --allow-empty -m "feat: quiz feature complete and verified"
```
