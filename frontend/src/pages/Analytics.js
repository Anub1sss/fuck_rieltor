import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { apartmentService } from '../services/api';
import './Analytics.css';

const COLORS = ['#00d4ff', '#a855f7', '#ec4899', '#22c55e', '#f97316', '#ef4444', '#06b6d4', '#8b5cf6'];

const Analytics = () => {
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apartmentService.getAll();
      setApartments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <AnalyticsSkeleton />;
  }

  // Расчёт аналитики
  const avgPriceByRooms = calculateAvgPriceByRooms(apartments);
  const priceDistribution = calculatePriceDistribution(apartments);
  const areaDistribution = calculateAreaDistribution(apartments);
  const sourceDistribution = calculateSourceDistribution(apartments);
  const metroStats = calculateMetroStats(apartments);
  const featuresStats = calculateFeaturesStats(apartments);
  const floorDistribution = calculateFloorDistribution(apartments);

  // Вычисляем статистику цен
  const avgPrice = calculateAvgPrice(apartments);
  const medianPrice = calculateMedianPrice(apartments);
  const validPrices = apartments.filter(a => a.price && !isNaN(parseFloat(a.price))).map(a => parseFloat(a.price));
  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
  const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : 0;

  return (
    <div className="analytics">
      {/* Top Stats */}
      <div className="analytics-stats">
        <StatBox
          title="Средняя цена"
          value={formatPrice(avgPrice)}
          suffix="₽/мес"
          icon="◈"
        />
        <StatBox
          title="Медианная цена"
          value={formatPrice(medianPrice)}
          suffix="₽/мес"
          icon="◐"
        />
        <StatBox
          title="Мин. цена"
          value={formatPrice(minPrice)}
          suffix="₽/мес"
          icon="▽"
          color="green"
        />
        <StatBox
          title="Макс. цена"
          value={formatPrice(maxPrice)}
          suffix="₽/мес"
          icon="△"
          color="red"
        />
      </div>

      {/* Charts Grid */}
      <div className="analytics-grid">
        {/* Средняя цена по комнатам */}
        <div className="analytics-card analytics-card--wide">
          <h3>Средняя цена по типу квартиры</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={avgPriceByRooms} barRadius={[8, 8, 0, 0]}>
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={v => `${v/1000}к`} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [`${formatPrice(value)} ₽`, 'Средняя цена']}
              />
              <Bar dataKey="avgPrice" fill="url(#barGradient1)">
                {avgPriceByRooms.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
              <defs>
                <linearGradient id="barGradient1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d4ff" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Распределение цен */}
        <div className="analytics-card">
          <h3>Распределение по ценам</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={priceDistribution}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {priceDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Распределение по площади */}
        <div className="analytics-card">
          <h3>Распределение по площади</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={areaDistribution} barRadius={[4, 4, 0, 0]}>
              <XAxis dataKey="range" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#ec4899" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* По источникам */}
        <div className="analytics-card">
          <h3>Квартиры по источникам</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={sourceDistribution}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
              >
                {sourceDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Удобства */}
        <div className="analytics-card">
          <h3>Наличие удобств</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={featuresStats}>
              <PolarGrid stroke="var(--border-color)" />
              <PolarAngleAxis dataKey="feature" stroke="var(--text-muted)" fontSize={11} />
              <PolarRadiusAxis stroke="var(--text-muted)" fontSize={10} />
              <Radar
                name="% квартир"
                dataKey="percent"
                stroke="#00d4ff"
                fill="#00d4ff"
                fillOpacity={0.3}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Распределение по этажам */}
        <div className="analytics-card">
          <h3>Распределение по этажам</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={floorDistribution} layout="vertical" barRadius={[0, 4, 4, 0]}>
              <XAxis type="number" stroke="var(--text-muted)" fontSize={11} />
              <YAxis type="category" dataKey="range" stroke="var(--text-muted)" fontSize={11} width={80} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Топ станций метро */}
        <div className="analytics-card analytics-card--wide">
          <h3>Топ-10 станций метро</h3>
          <div className="metro-list">
            {metroStats.slice(0, 10).map((station, index) => (
              <div key={station.name} className="metro-item">
                <span className="metro-rank">#{index + 1}</span>
                <span className="metro-name">{station.name}</span>
                <div className="metro-bar-container">
                  <div 
                    className="metro-bar" 
                    style={{ width: `${(station.count / metroStats[0]?.count) * 100}%` }}
                  />
                </div>
                <span className="metro-count">{station.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatBox = ({ title, value, suffix, icon, color = 'cyan' }) => (
  <div className={`stat-box stat-box--${color}`}>
    <span className="stat-box__icon">{icon}</span>
    <div className="stat-box__content">
      <span className="stat-box__title">{title}</span>
      <div className="stat-box__value">
        {value}<span>{suffix}</span>
      </div>
    </div>
  </div>
);

const tooltipStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
};

// Функции расчёта
const calculateAvgPrice = (apartments) => {
  if (!apartments || apartments.length === 0) return 0;
  const validPrices = apartments.filter(a => a.price && !isNaN(parseFloat(a.price))).map(a => parseFloat(a.price));
  if (validPrices.length === 0) return 0;
  const sum = validPrices.reduce((acc, price) => acc + price, 0);
  const avg = sum / validPrices.length;
  return isNaN(avg) ? 0 : Math.round(avg);
};

const calculateMedianPrice = (apartments) => {
  if (!apartments || apartments.length === 0) return 0;
  const validPrices = apartments
    .filter(a => a.price && !isNaN(parseFloat(a.price)))
    .map(a => parseFloat(a.price))
    .sort((a, b) => a - b);
  if (validPrices.length === 0) return 0;
  const mid = Math.floor(validPrices.length / 2);
  const median = validPrices.length % 2 !== 0 
    ? validPrices[mid] 
    : (validPrices[mid - 1] + validPrices[mid]) / 2;
  return isNaN(median) ? 0 : Math.round(median);
};

const calculateAvgPriceByRooms = (apartments) => {
  const groups = {};
  apartments.forEach(a => {
    const key = a.rooms === 0 ? 'Студия' : a.rooms === null ? 'Н/Д' : `${a.rooms}-комн.`;
    if (!groups[key]) groups[key] = { sum: 0, count: 0 };
    groups[key].sum += a.price || 0;
    groups[key].count += 1;
  });
  return Object.entries(groups)
    .map(([name, data]) => ({ name, avgPrice: Math.round(data.sum / data.count), count: data.count }))
    .sort((a, b) => {
      if (a.name === 'Студия') return -1;
      if (b.name === 'Студия') return 1;
      return a.name.localeCompare(b.name);
    });
};

const calculatePriceDistribution = (apartments) => {
  const ranges = [
    { name: 'до 50к', min: 0, max: 50000 },
    { name: '50-80к', min: 50000, max: 80000 },
    { name: '80-120к', min: 80000, max: 120000 },
    { name: '120-200к', min: 120000, max: 200000 },
    { name: 'от 200к', min: 200000, max: Infinity },
  ];
  return ranges.map(r => ({
    name: r.name,
    value: apartments.filter(a => (a.price || 0) >= r.min && (a.price || 0) < r.max).length
  }));
};

const calculateAreaDistribution = (apartments) => {
  const ranges = [
    { range: '< 30м²', min: 0, max: 30 },
    { range: '30-50м²', min: 30, max: 50 },
    { range: '50-70м²', min: 50, max: 70 },
    { range: '70-100м²', min: 70, max: 100 },
    { range: '> 100м²', min: 100, max: Infinity },
  ];
  return ranges.map(r => ({
    range: r.range,
    count: apartments.filter(a => (a.area || 0) >= r.min && (a.area || 0) < r.max).length
  }));
};

const calculateSourceDistribution = (apartments) => {
  const sources = {};
  apartments.forEach(a => {
    const source = a.source || 'Неизвестно';
    sources[source] = (sources[source] || 0) + 1;
  });
  return Object.entries(sources).map(([name, value]) => ({ name, value }));
};

const calculateMetroStats = (apartments) => {
  const metros = {};
  apartments.forEach(a => {
    if (a.metro_station) {
      metros[a.metro_station] = (metros[a.metro_station] || 0) + 1;
    }
  });
  return Object.entries(metros)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

const calculateFeaturesStats = (apartments) => {
  const total = apartments.length || 1;
  return [
    { feature: 'Мебель', percent: Math.round(apartments.filter(a => a.has_furniture).length / total * 100) },
    { feature: 'Техника', percent: Math.round(apartments.filter(a => a.has_appliances).length / total * 100) },
    { feature: 'Интернет', percent: Math.round(apartments.filter(a => a.has_internet).length / total * 100) },
    { feature: 'Парковка', percent: Math.round(apartments.filter(a => a.has_parking).length / total * 100) },
    { feature: 'Лифт', percent: Math.round(apartments.filter(a => a.has_elevator).length / total * 100) },
    { feature: 'Балкон', percent: Math.round(apartments.filter(a => a.has_balcony).length / total * 100) },
  ];
};

const calculateFloorDistribution = (apartments) => {
  const ranges = [
    { range: '1-3 этаж', min: 1, max: 3 },
    { range: '4-9 этаж', min: 4, max: 9 },
    { range: '10-16 этаж', min: 10, max: 16 },
    { range: '17-25 этаж', min: 17, max: 25 },
    { range: '> 25 этаж', min: 26, max: Infinity },
  ];
  return ranges.map(r => ({
    range: r.range,
    count: apartments.filter(a => (a.floor || 0) >= r.min && (a.floor || 0) <= r.max).length
  }));
};

const formatPrice = (price) => {
  if (!price || isNaN(price) || price === null || price === undefined) {
    return '0';
  }
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) {
    return '0';
  }
  return new Intl.NumberFormat('ru-RU').format(numPrice);
};

const AnalyticsSkeleton = () => (
  <div className="analytics">
    <div className="analytics-stats">
      {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{height: '100px', borderRadius: '12px'}} />)}
    </div>
    <div className="analytics-grid">
      {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{height: '350px', borderRadius: '16px'}} />)}
    </div>
  </div>
);

export default Analytics;

