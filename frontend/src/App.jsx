import { useState } from 'react';
import LandingPage from './LandingPage';
import MapView from './MapView';
import QuizPage from './components/QuizPage';

export default function App() {
  const [scenario, setScenario] = useState(null);
  const [view, setView] = useState('home');

  const handleBack = () => {
    setScenario(null);
    setView('home');
  };

  if (scenario) {
    return <MapView key={scenario.id} scenario={scenario} onBack={handleBack} />;
  }
  
  if (view === 'quiz') {
    return <QuizPage onBack={() => setView('home')} />;
  }

  return (
    <LandingPage 
      onSelect={setScenario} 
      onStartQuiz={() => setView('quiz')} 
    />
  );
}
