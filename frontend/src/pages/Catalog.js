import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { apartmentService } from '../services/api';
import './Catalog.css';

const Catalog = () => {
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  
  const [filters, setFilters] = useState({
    priceMin: '',
    priceMax: '',
    rooms: [],
    areaMin: '',
    areaMax: '',
    source: '',
    metro: '',
    noCommission: false,
    hasPhotos: false,
  });

  const [sortBy, setSortBy] = useState('price_asc');

  useEffect(() => {
    loadApartments();
  }, []);

  const loadApartments = async () => {
    try {
      setLoading(true);
      const data = await apartmentService.getAll();
      setApartments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading apartments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredApartments = useMemo(() => {
    let result = [...apartments];

    // Фильтр по цене
    if (filters.priceMin) {
      result = result.filter(a => a.price >= parseInt(filters.priceMin));
    }
    if (filters.priceMax) {
      result = result.filter(a => a.price <= parseInt(filters.priceMax));
    }

    // Фильтр по комнатам
    if (filters.rooms.length > 0) {
      result = result.filter(a => {
        if (filters.rooms.includes('studio') && a.rooms === 0) return true;
        if (filters.rooms.includes(String(a.rooms))) return true;
        return false;
      });
    }

    // Фильтр по площади
    if (filters.areaMin) {
      result = result.filter(a => a.area >= parseInt(filters.areaMin));
    }
    if (filters.areaMax) {
      result = result.filter(a => a.area <= parseInt(filters.areaMax));
    }

    // Фильтр по источнику
    if (filters.source) {
      result = result.filter(a => a.source === filters.source);
    }

    // Фильтр по метро
    if (filters.metro) {
      result = result.filter(a => 
        a.metro_station?.toLowerCase().includes(filters.metro.toLowerCase())
      );
    }

    // Без комиссии
    if (filters.noCommission) {
      result = result.filter(a => a.no_commission);
    }

    // С фото
    if (filters.hasPhotos) {
      result = result.filter(a => a.photos && a.photos.length > 0);
    }

    // Сортировка
    switch (sortBy) {
      case 'price_asc':
        result.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price_desc':
        result.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'area_desc':
        result.sort((a, b) => (b.area || 0) - (a.area || 0));
        break;
      case 'date_desc':
        result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      default:
        break;
    }

    return result;
  }, [apartments, filters, sortBy]);

  const sources = useMemo(() => {
    const unique = [...new Set(apartments.map(a => a.source).filter(Boolean))];
    return unique;
  }, [apartments]);

  const handleRoomToggle = (room) => {
    setFilters(prev => ({
      ...prev,
      rooms: prev.rooms.includes(room)
        ? prev.rooms.filter(r => r !== room)
        : [...prev.rooms, room]
    }));
  };

  const clearFilters = () => {
    setFilters({
      priceMin: '',
      priceMax: '',
      rooms: [],
      areaMin: '',
      areaMax: '',
      source: '',
      metro: '',
      noCommission: false,
      hasPhotos: false,
    });
  };

  return (
    <div className="catalog">
      {/* Filters Sidebar */}
      <aside className="filters-sidebar">
        <div className="filters-header">
          <h3>Фильтры</h3>
          <button className="clear-btn" onClick={clearFilters}>Сбросить</button>
        </div>

        <div className="filter-group">
          <label>Цена, ₽/мес</label>
          <div className="range-inputs">
            <input
              type="number"
              placeholder="от"
              value={filters.priceMin}
              onChange={e => setFilters({ ...filters, priceMin: e.target.value })}
            />
            <span>—</span>
            <input
              type="number"
              placeholder="до"
              value={filters.priceMax}
              onChange={e => setFilters({ ...filters, priceMax: e.target.value })}
            />
          </div>
        </div>

        <div className="filter-group">
          <label>Комнаты</label>
          <div className="room-buttons">
            {['studio', '1', '2', '3', '4'].map(room => (
              <button
                key={room}
                className={`room-btn ${filters.rooms.includes(room) ? 'active' : ''}`}
                onClick={() => handleRoomToggle(room)}
              >
                {room === 'studio' ? 'Студия' : room}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label>Площадь, м²</label>
          <div className="range-inputs">
            <input
              type="number"
              placeholder="от"
              value={filters.areaMin}
              onChange={e => setFilters({ ...filters, areaMin: e.target.value })}
            />
            <span>—</span>
            <input
              type="number"
              placeholder="до"
              value={filters.areaMax}
              onChange={e => setFilters({ ...filters, areaMax: e.target.value })}
            />
          </div>
        </div>

        <div className="filter-group">
          <label>Метро</label>
          <input
            type="text"
            placeholder="Название станции"
            value={filters.metro}
            onChange={e => setFilters({ ...filters, metro: e.target.value })}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <label>Источник</label>
          <select
            value={filters.source}
            onChange={e => setFilters({ ...filters, source: e.target.value })}
            className="filter-select"
          >
            <option value="">Все источники</option>
            {sources.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.noCommission}
              onChange={e => setFilters({ ...filters, noCommission: e.target.checked })}
            />
            <span className="checkmark"></span>
            Без комиссии
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.hasPhotos}
              onChange={e => setFilters({ ...filters, hasPhotos: e.target.checked })}
            />
            <span className="checkmark"></span>
            С фотографиями
          </label>
        </div>
      </aside>

      {/* Main Content */}
      <div className="catalog-content">
        <div className="catalog-toolbar">
          <div className="results-count">
            Найдено: <strong>{filteredApartments.length}</strong> квартир
          </div>
          
          <div className="toolbar-actions">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="price_asc">Сначала дешевле</option>
              <option value="price_desc">Сначала дороже</option>
              <option value="area_desc">По площади</option>
              <option value="date_desc">По дате</option>
            </select>

            <div className="view-toggle">
              <button
                className={viewMode === 'grid' ? 'active' : ''}
                onClick={() => setViewMode('grid')}
              >▦</button>
              <button
                className={viewMode === 'list' ? 'active' : ''}
                onClick={() => setViewMode('list')}
              >☰</button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className={`apartments-${viewMode}`}>
            {[...Array(9)].map((_, i) => (
              <div key={i} className="apartment-skeleton skeleton"></div>
            ))}
          </div>
        ) : filteredApartments.length === 0 ? (
          <div className="no-results">
            <span className="no-results-icon">◈</span>
            <h3>Квартиры не найдены</h3>
            <p>Попробуйте изменить параметры фильтрации</p>
          </div>
        ) : (
          <div className={`apartments-${viewMode}`}>
            {filteredApartments.map((apt, index) => (
              viewMode === 'grid' 
                ? <ApartmentCard key={apt.id} apartment={apt} index={index} />
                : <ApartmentRow key={apt.id} apartment={apt} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ApartmentCard = ({ apartment, index }) => (
  <Link 
    to={`/apartment/${apartment.id}`} 
    className="catalog-card animate-fade-in"
    style={{ animationDelay: `${Math.min(index * 0.05, 0.5)}s` }}
  >
    <div className="catalog-card__image">
      {apartment.photos?.[0] ? (
        <img src={apartment.photos[0]} alt="" loading="lazy" />
      ) : (
        <div className="catalog-card__no-image">◈</div>
      )}
      <div className="catalog-card__overlay">
        <span className="view-btn">Подробнее</span>
      </div>
      {apartment.photos?.length > 1 && (
        <span className="photo-count">{apartment.photos.length} фото</span>
      )}
    </div>
    
    <div className="catalog-card__body">
      <div className="catalog-card__price">
        {formatPrice(apartment.price)} <span>₽/мес</span>
      </div>
      
      <div className="catalog-card__params">
        {apartment.rooms !== null && (
          <span>{apartment.rooms === 0 ? 'Студия' : `${apartment.rooms} комн.`}</span>
        )}
        {apartment.area && <span>{apartment.area} м²</span>}
        {apartment.floor && <span>{apartment.floor}/{apartment.total_floors} эт.</span>}
      </div>

      {apartment.metro_station && (
        <div className="catalog-card__metro">
          <span className="metro-icon">●</span>
          {apartment.metro_station}
          {apartment.metro_distance && <span className="metro-time">{apartment.metro_distance}</span>}
        </div>
      )}

      {apartment.address && (
        <div className="catalog-card__address">{apartment.address}</div>
      )}

      <div className="catalog-card__tags">
        {apartment.no_commission && <span className="tag tag--green">Без комиссии</span>}
        {apartment.deposit && <span className="tag">Залог {formatPrice(apartment.deposit)}₽</span>}
        {apartment.source && <span className="tag tag--source">{apartment.source}</span>}
      </div>
    </div>
  </Link>
);

const ApartmentRow = ({ apartment, index }) => (
  <Link 
    to={`/apartment/${apartment.id}`} 
    className="catalog-row animate-fade-in"
    style={{ animationDelay: `${Math.min(index * 0.03, 0.3)}s` }}
  >
    <div className="catalog-row__image">
      {apartment.photos?.[0] ? (
        <img src={apartment.photos[0]} alt="" loading="lazy" />
      ) : (
        <div className="catalog-row__no-image">◈</div>
      )}
    </div>
    
    <div className="catalog-row__content">
      <div className="catalog-row__main">
        <div className="catalog-row__title">
          {apartment.rooms === 0 ? 'Студия' : `${apartment.rooms}-комн. квартира`}
          {apartment.area && `, ${apartment.area} м²`}
        </div>
        {apartment.metro_station && (
          <div className="catalog-row__metro">
            <span className="metro-icon">●</span>
            {apartment.metro_station}
          </div>
        )}
        {apartment.address && (
          <div className="catalog-row__address">{apartment.address}</div>
        )}
      </div>
      
      <div className="catalog-row__price">
        {formatPrice(apartment.price)} ₽/мес
        <div className="catalog-row__tags">
          {apartment.no_commission && <span className="tag tag--green">Без комиссии</span>}
        </div>
      </div>
    </div>
  </Link>
);

const formatPrice = (price) => {
  return new Intl.NumberFormat('ru-RU').format(price);
};

export default Catalog;

