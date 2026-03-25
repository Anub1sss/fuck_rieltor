import React from 'react';
import ApartmentScore from './ApartmentScore';
import './App.css';

function App() {
  return (
    <div className="score-app">
      <header className="score-app__header">
        <div className="score-app__container">
          <h1 className="score-app__title">◈ Оценка квартиры</h1>
          <p className="score-app__subtitle">Глубокий персональный анализ по 100-балльной шкале</p>
        </div>
      </header>
      <main className="score-app__main">
        <div className="score-app__container">
          <ApartmentScore />
        </div>
      </main>
    </div>
  );
}

export default App;
