import React, { useState } from 'react';
import { FlagProvider } from '@unleash/proxy-client-react';
import App from './App';

function AppContainer() {
  const [appName, setAppName] = useState('your-app-frontend-app');
  const [key, setKey] = useState(0);

  const handleAppNameChange = (newAppName) => {
    setAppName(newAppName);
    setKey(k => k + 1);
  };

  const config = {
    url: 'https://proxy.tolkachev.space/proxy/',
    // url: 'http://localhost:3000/proxy/',
    clientKey: 'some-secret',
    refreshInterval: 15,
    appName
  };

  return (
    <FlagProvider config={config} key={key}>
      <App appName={appName} onAppNameChange={handleAppNameChange} />
    </FlagProvider>
  );
}

export default AppContainer;
