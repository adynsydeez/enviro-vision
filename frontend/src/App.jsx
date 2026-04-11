import { useState } from 'react';
import LandingPage from './LandingPage';
import MapView from './MapView';

export default function App() {
  const [scenario, setScenario] = useState(null);

  if (scenario) {
    return <MapView key={scenario.id} scenario={scenario} onBack={() => setScenario(null)} />;
  }

  return <LandingPage onSelect={setScenario} />;
}
