import React, { useState, useEffect } from 'react';
import { FlagProvider } from '@unleash/proxy-client-react';
import App from './App';
import { generateAppNames } from './utils'; // Импортируем функцию генерации appNames

function AppContainer() {
  const [appNames, setAppNames] = useState([]);

  useEffect(() => {
    const generatedAppNames = generateAppNames(1000);
    setAppNames(generatedAppNames);
  }, []);

  const handleAppNameChange = (oldAppName, newAppName) => {
    setAppNames((prevAppNames) =>
      prevAppNames.map((name) => (name === oldAppName ? newAppName : name))
    );
  };

  return (
    <div>
      <h1>Тестирование Unleash Proxy с 1000 уникальных appName</h1>
      <div className="app-list" style={{ height: '80vh', overflowY: 'scroll' }}>
        {appNames.map((appName, index) => (
          <FlagProvider
            key={appName}
            config={{
              url: 'https://proxy.tolkachev.space/proxy/',
              clientKey: 'some-secret',
              refreshInterval: 15,
              appName,
            }}
          >
            <App
              appName={appName}
              onAppNameChange={(newAppName) => handleAppNameChange(appName, newAppName)}
            />
          </FlagProvider>
        ))}
      </div>
    </div>
  );
}

export default AppContainer;
