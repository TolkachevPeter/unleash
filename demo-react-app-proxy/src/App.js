import React, { useState } from 'react';
import './App.css';
import { useFlag } from '@unleash/proxy-client-react';

function FlagStatus({ toggleName }) {
  const enabled = useFlag(toggleName);
  return <div>Toggle {toggleName} is {enabled ? 'on' : 'off'}</div>;
}

function App() {
  const [toggleName, setToggleName] = useState('epic-name');
  const [key, setKey] = useState(0);

  const handleInputChange = (event) => {
    setToggleName(event.target.value);
    setKey(prevKey => prevKey + 1);
  };

  return (
    <div>
      <input type="text" value={toggleName} onChange={handleInputChange} />
      <FlagStatus key={key} toggleName={toggleName} />
    </div>
  );
}

export default App;
