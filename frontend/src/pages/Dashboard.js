import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { apartmentService } from '../services/api';
import './Dashboard.css';

const COLORS = ['#00d4ff', '#a855f7', '#ec4899', '#22c55e', '#f97316', '#ef4444'];

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, apartmentsData] = await Promise.all([
        apartmentService.getStats(),
        apartmentService.getAll()
      ]);
      setStats(statsData);
      setApartments(Array.isArray(apartmentsData) ? apartmentsData : []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  const roomsData = stats?.byRooms ? Object.entries(stats.byRooms).map(([name, value]) => ({ name, value })) : [];
  const sourceData = stats?.bySource ? Object.entries(stats.bySource).map(([name, value]) => ({ name, value })) : [];
  const priceData = stats?.priceRanges || [];
  const recentApartments = apartments.slice(0, 6);

  return (
    <div className="dashboard">
      {/* Stat Cards */}
      <div className="stat-cards">
        <StatCard
          title="Всего квартир"
          value={stats?.total || 0}
          icon="▦"
          color="cyan"
          trend="+12%"
        />
        <StatCard
          title="Средняя цена"
          value={formatPrice(stats?.avgPrice || 0)}
          suffix="₽/мес"
          icon="◈"
          color="purple"
        />
        <StatCard
          title="Средняя площадь"
          value={stats?.avgArea || 0}
          suffix="м²"
          icon="◐"
          color="pink"
        />
        <StatCard
          title="Цена за м²"
          value={formatPrice(stats?.pricePerMeter || 0)}
          suffix="₽"
          icon="◉"
          color="green"
        />
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <h3>Распределение по комнатам</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={roomsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {roomsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              {roomsData.map((item, index) => (
                <div key={item.name} className="legend-item">
                  <span className="legend-dot" style={{ background: COLORS[index % COLORS.length] }}></span>
                  <span className="legend-label">{item.name}</span>
                  <span className="legend-value">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="chart-card">
          <h3>Распределение цен</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={priceData} barRadius={[8, 8, 0, 0]}>
                <XAxis dataKey="range" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="url(#barGradient)" />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00d4ff" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <h3>По источникам</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={sourceData}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="#ec4899" fill="url(#areaGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Apartments */}
      <div className="recent-section">
        <div className="section-header">
          <h3>Последние добавленные</h3>
          <Link to="/catalog" className="view-all-btn">
            Смотреть все →
          </Link>
        </div>
        <div className="apartments-grid">
          {recentApartments.map((apt, index) => (
            <ApartmentCard key={apt.id} apartment={apt} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, suffix, icon, color, trend }) => (
  <div className={`stat-card stat-card--${color}`}>
    <div className="stat-card__icon">{icon}</div>
    <div className="stat-card__content">
      <span className="stat-card__title">{title}</span>
      <div className="stat-card__value">
        {value}{suffix && <span className="stat-card__suffix">{suffix}</span>}
      </div>
      {trend && <span className="stat-card__trend">{trend}</span>}
    </div>
  </div>
);

const ApartmentCard = ({ apartment, index }) => (
  <Link to={`/apartment/${apartment.id}`} className="apartment-card animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
    <div className="apartment-card__image">
      {apartment.photos?.[0] ? (
        <img src={apartment.photos[0]} alt={apartment.title} />
      ) : (
        <div className="apartment-card__no-image">◈</div>
      )}
      <div className="apartment-card__badges">
        {apartment.no_commission && <span className="badge badge--green">Без комиссии</span>}
        {apartment.source && <span className="badge badge--source">{apartment.source}</span>}
      </div>
    </div>
    <div className="apartment-card__content">
      <div className="apartment-card__price">{formatPrice(apartment.price)} ₽/мес</div>
      <div className="apartment-card__info">
        {apartment.rooms !== null && (
          <span>{apartment.rooms === 0 ? 'Студия' : `${apartment.rooms}-комн.`}</span>
        )}
        {apartment.area && <span>{apartment.area} м²</span>}
        {apartment.floor && <span>{apartment.floor}/{apartment.total_floors} эт.</span>}
      </div>
      {apartment.metro_station && (
        <div className="apartment-card__metro">
          <span className="metro-dot"></span>
          {apartment.metro_station}
        </div>
      )}
    </div>
  </Link>
);

const DashboardSkeleton = () => (
  <div className="dashboard">
    <div className="stat-cards">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="stat-card skeleton" style={{ height: '120px' }}></div>
      ))}
    </div>
    <div className="charts-row">
      {[1, 2, 3].map(i => (
        <div key={i} className="chart-card skeleton" style={{ height: '320px' }}></div>
      ))}
    </div>
  </div>
);

const formatPrice = (price) => {
  return new Intl.NumberFormat('ru-RU').format(price);
};

export default Dashboard;

