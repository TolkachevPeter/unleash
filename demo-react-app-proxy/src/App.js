import React, { useState, useEffect } from 'react';
import './App.css';
import { useFlag } from '@unleash/proxy-client-react';

function FlagStatus({ toggleName }) {
  const enabled = useFlag(toggleName);
  return <div className={'flag-status' + (enabled ? ' on' : ' off')}>Toggle {toggleName} is {enabled ? 'on' : 'off'}</div>;
}

function Instructions() {
  return (
    <div className="instructions">
      <h2>Инструкция по использованию</h2>
      <p>Это демонстрационное приложение использует feature toggles, управляемые через Unleash.</p>

      <h3>Изменение имени приложения (appName)</h3>
      <p>Чтобы изменить имя приложения:</p>
      <ol>
        <li>Найдите поле ввода с меткой "App Name".</li>
        <li>Введите новое имя приложения.</li>
        <li>Нажмите кнопку "Change App Name" для обновления флагов функций.</li>
      </ol>

      <h3>Изменение названия флага (toggleName)</h3>
      <p>Чтобы проверить состояние определенного feature toggle:</p>
      <ol>
        <li>Найдите поле ввода с меткой "Toggle Name".</li>
        <li>Введите название флага функций, которое вы хотите проверить.</li>
        <li>Состояние флага ("on" или "off") будет отображено на странице.</li>
      </ol>
    </div>
  );
}

function App({ appName, onAppNameChange }) {
  const [toggleName, setToggleName] = useState('frontend-toggle');
  const [newAppName, setNewAppName] = useState(appName);
  const [error, setError] = useState('');

  useEffect(() => {
    setNewAppName(appName);
  }, [appName]);

  const handleToggleNameChange = (event) => {
    setToggleName(event.target.value);
  };

  const handleAppNameChange = (event) => {
    setNewAppName(event.target.value);
    setError('');
  };

  const applyAppNameChange = () => {
    if (!newAppName.trim()) {
      setError('App Name is required');
      return;
    }
    onAppNameChange(newAppName);
  };

  return (
    <div className="app-container">
      <div className="input-group">
        <p1>App Name: </p1>
        <input
          type="text"
          value={newAppName}
          onChange={handleAppNameChange}
          placeholder="App Name"
          className={error ? 'error' : ''}
        />
        <button onClick={applyAppNameChange}>Change App Name</button>
      </div>
      {error && <div className="error-message">{error}</div>}
      <div className="input-group">
        <p1>Toggle Name: </p1>
        <input
          type="text"
          value={toggleName}
          onChange={handleToggleNameChange}
          placeholder="Toggle Name"
        />
        <FlagStatus key={toggleName} toggleName={toggleName} />
      </div>
      <Instructions />
    </div>
  );
}

export default App;
