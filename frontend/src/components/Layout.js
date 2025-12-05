import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './Layout.css';

const Layout = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Обзор', icon: '◈' },
    { path: '/catalog', label: 'Каталог', icon: '▦' },
    { path: '/analytics', label: 'Аналитика', icon: '◐' },
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-icon">◆</span>
          <span className="logo-text">МоскваРент</span>
        </div>
        
        <nav className="nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-indicator">
            <span className="status-dot"></span>
            <span className="status-text">API Online</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="header">
          <div className="header-title">
            <h1>{getPageTitle(location.pathname)}</h1>
            <p className="header-subtitle">{getPageSubtitle(location.pathname)}</p>
          </div>
          <div className="header-actions">
            <div className="search-box">
              <span className="search-icon">⌕</span>
              <input type="text" placeholder="Поиск квартир..." />
            </div>
          </div>
        </header>

        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
};

const getPageTitle = (path) => {
  const titles = {
    '/': 'Обзор рынка',
    '/catalog': 'Каталог квартир',
    '/analytics': 'Аналитика',
  };
  if (path.startsWith('/apartment/')) return 'Детали квартиры';
  return titles[path] || 'МоскваРент';
};

const getPageSubtitle = (path) => {
  const subtitles = {
    '/': 'Актуальная статистика аренды в Москве',
    '/catalog': 'Найдите идеальную квартиру',
    '/analytics': 'Глубокий анализ рынка недвижимости',
  };
  if (path.startsWith('/apartment/')) return 'Полная информация об объекте';
  return subtitles[path] || '';
};

export default Layout;

