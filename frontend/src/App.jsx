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

  if (scenario && view !== 'quiz') {
    return (
      <MapView 
        key={scenario.id} 
        scenario={scenario} 
        onBack={handleBack}
        onQuiz={() => setView('quiz')}
      />
    );
  }
  
  if (view === 'quiz') {
    return <QuizPage onBack={() => setView('home')} scenarioId={scenario?.id} />;
  }

  return (
    <LandingPage 
      onSelect={setScenario} 
      onStartQuiz={() => setView('quiz')} 
    />
  );
}
