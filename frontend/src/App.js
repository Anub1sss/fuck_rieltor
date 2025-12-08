import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import ApartmentDetail from './pages/ApartmentDetail';
import Analytics from './pages/Analytics';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/apartment/:id" element={<ApartmentDetail />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </Layout>
  );
}

export default App;


