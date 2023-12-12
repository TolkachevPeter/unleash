import './App.css';
import { useFlag } from '@unleash/proxy-client-react';

function App() {
  const enabled = useFlag('epic-name');

  if (enabled) {
    return <div> toggle epic-name on </div>;
  }
  return <div> toggle epic-name off </div>;
};


export default App;
