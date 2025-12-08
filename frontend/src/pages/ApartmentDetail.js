import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apartmentService } from '../services/api';
import './ApartmentDetail.css';

const ApartmentDetail = () => {
  const { id } = useParams();
  const [apartment, setApartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPhoto, setCurrentPhoto] = useState(0);

  useEffect(() => {
    loadApartment();
  }, [id]);

  const loadApartment = async () => {
    try {
      setLoading(true);
      const data = await apartmentService.getById(id);
      setApartment(data);
    } catch (error) {
      console.error('Error loading apartment:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!apartment) {
    return (
      <div className="not-found">
        <span className="not-found-icon">◈</span>
        <h2>Квартира не найдена</h2>
        <Link to="/catalog" className="back-link">← Вернуться в каталог</Link>
      </div>
    );
  }

  const photos = apartment.photos || [];

  return (
    <div className="apartment-detail">
      <Link to="/catalog" className="back-btn">← Назад к каталогу</Link>

      <div className="detail-grid">
        {/* Gallery */}
        <div className="detail-gallery">
          <div className="gallery-main">
            {photos.length > 0 ? (
              <img src={photos[currentPhoto]} alt="" />
            ) : (
              <div className="gallery-no-image">
                <span>◈</span>
                <p>Нет фотографий</p>
              </div>
            )}
            {photos.length > 1 && (
              <>
                <button
                  className="gallery-nav gallery-nav--prev"
                  onClick={() => setCurrentPhoto(prev => prev === 0 ? photos.length - 1 : prev - 1)}
                >
                  ‹
                </button>
                <button
                  className="gallery-nav gallery-nav--next"
                  onClick={() => setCurrentPhoto(prev => prev === photos.length - 1 ? 0 : prev + 1)}
                >
                  ›
                </button>
                <div className="gallery-counter">
                  {currentPhoto + 1} / {photos.length}
                </div>
              </>
            )}
          </div>
          {photos.length > 1 && (
            <div className="gallery-thumbs">
              {photos.slice(0, 8).map((photo, index) => (
                <button
                  key={index}
                  className={`gallery-thumb ${index === currentPhoto ? 'active' : ''}`}
                  onClick={() => setCurrentPhoto(index)}
                >
                  <img src={photo} alt="" />
                </button>
              ))}
              {photos.length > 8 && (
                <div className="gallery-more">+{photos.length - 8}</div>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="detail-info">
          <div className="detail-header">
            <div className="detail-price">
              {formatPrice(apartment.price)} <span>₽/мес</span>
            </div>
            <div className="detail-badges">
              {apartment.no_commission && <span className="badge badge--green">Без комиссии</span>}
              {apartment.source && <span className="badge badge--source">{apartment.source}</span>}
            </div>
          </div>

          <h1 className="detail-title">
            {apartment.rooms === 0 ? 'Квартира-студия' : `${apartment.rooms}-комнатная квартира`}
            {apartment.area && `, ${apartment.area} м²`}
          </h1>

          {apartment.address && (
            <div className="detail-address">
              <span className="address-icon">◉</span>
              {apartment.address}
            </div>
          )}

          {apartment.metro_station && (
            <div className="detail-metro">
              <span className="metro-dot"></span>
              {apartment.metro_station}
              {apartment.metro_distance && <span className="metro-distance">{apartment.metro_distance}</span>}
              {apartment.metro_transport && <span className="metro-transport">({apartment.metro_transport})</span>}
            </div>
          )}

          <div className="detail-params">
            <ParamItem label="Комнат" value={apartment.rooms === 0 ? 'Студия' : apartment.rooms} />
            <ParamItem label="Площадь" value={apartment.area ? `${apartment.area} м²` : '—'} />
            <ParamItem label="Этаж" value={apartment.floor ? `${apartment.floor}/${apartment.total_floors}` : '—'} />
            {apartment.living_area && <ParamItem label="Жилая" value={`${apartment.living_area} м²`} />}
            {apartment.kitchen_area && <ParamItem label="Кухня" value={`${apartment.kitchen_area} м²`} />}
            {apartment.building_type && <ParamItem label="Дом" value={apartment.building_type} />}
            {apartment.building_year && <ParamItem label="Год" value={apartment.building_year} />}
          </div>

          <div className="detail-conditions">
            <h3>Условия аренды</h3>
            <div className="conditions-grid">
              <ConditionItem 
                label="Залог" 
                value={apartment.deposit ? `${formatPrice(apartment.deposit)} ₽` : 'Не указан'} 
              />
              <ConditionItem 
                label="Комиссия" 
                value={apartment.no_commission ? 'Без комиссии' : 'Есть комиссия'} 
                highlight={apartment.no_commission}
              />
              <ConditionItem 
                label="ЖКУ" 
                value={apartment.utilities_included ? 'Включены' : 'Не включены'} 
              />
              <ConditionItem 
                label="Срок" 
                value={apartment.rental_period || 'Длительно'} 
              />
            </div>
          </div>

          <div className="detail-features">
            <h3>Удобства</h3>
            <div className="features-grid">
              <FeatureItem label="Мебель" active={apartment.has_furniture} />
              <FeatureItem label="Техника" active={apartment.has_appliances} />
              <FeatureItem label="Интернет" active={apartment.has_internet} />
              <FeatureItem label="Парковка" active={apartment.has_parking} />
              <FeatureItem label="Лифт" active={apartment.has_elevator} />
              <FeatureItem label="Балкон" active={apartment.has_balcony} />
            </div>
          </div>

          {/* Contact Info */}
          {(apartment.contact_name || apartment.contact_phone) && (
            <div className="detail-contact">
              <h3>Контакты</h3>
              <div className="contact-info">
                {apartment.contact_name && (
                  <div className="contact-item">
                    <span className="contact-label">Имя:</span>
                    <span className="contact-value">{apartment.contact_name}</span>
                  </div>
                )}
                {apartment.contact_phone && (
                  <div className="contact-item">
                    <span className="contact-label">Телефон:</span>
                    <a href={`tel:${apartment.contact_phone}`} className="contact-value contact-phone">
                      {apartment.contact_phone}
                    </a>
                  </div>
                )}
                {apartment.is_owner !== undefined && (
                  <div className="contact-item">
                    <span className="contact-label">Тип:</span>
                    <span className="contact-value">{apartment.is_owner ? 'Собственник' : 'Агент'}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Source Link */}
          {apartment.url && (
            <div className="detail-source-section">
              <a 
                href={apartment.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="detail-source-btn"
              >
                <span className="source-btn-icon">🔗</span>
                <span className="source-btn-text">
                  Открыть оригинальное объявление на {apartment.source_display || apartment.source || 'сайте'}
                </span>
                <span className="source-btn-arrow">→</span>
              </a>
              <p className="source-note">Откроется в новой вкладке</p>
            </div>
          )}

          {/* Additional Info */}
          <div className="detail-additional">
            <h3>Дополнительная информация</h3>
            <div className="additional-grid">
              {apartment.published_date && (
                <div className="additional-item">
                  <span className="additional-label">Дата публикации:</span>
                  <span className="additional-value">{apartment.published_date}</span>
                </div>
              )}
              {apartment.created_at && (
                <div className="additional-item">
                  <span className="additional-label">Добавлено в систему:</span>
                  <span className="additional-value">
                    {new Date(apartment.created_at).toLocaleDateString('ru-RU', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}
              {apartment.is_verified && (
                <div className="additional-item">
                  <span className="additional-label">Статус:</span>
                  <span className="additional-value verified">✓ Проверено</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {apartment.description && (
        <div className="detail-description">
          <h3>Описание</h3>
          <p>{apartment.description}</p>
        </div>
      )}
    </div>
  );
};

const ParamItem = ({ label, value }) => (
  <div className="param-item">
    <span className="param-label">{label}</span>
    <span className="param-value">{value}</span>
  </div>
);

const ConditionItem = ({ label, value, highlight }) => (
  <div className={`condition-item ${highlight ? 'condition-item--highlight' : ''}`}>
    <span className="condition-label">{label}</span>
    <span className="condition-value">{value}</span>
  </div>
);

const FeatureItem = ({ label, active }) => (
  <div className={`feature-item ${active ? 'feature-item--active' : ''}`}>
    <span className="feature-icon">{active ? '✓' : '×'}</span>
    <span className="feature-label">{label}</span>
  </div>
);

const DetailSkeleton = () => (
  <div className="apartment-detail">
    <div className="skeleton" style={{ width: '150px', height: '24px', marginBottom: '24px' }}></div>
    <div className="detail-grid">
      <div className="skeleton" style={{ height: '500px', borderRadius: '16px' }}></div>
      <div>
        <div className="skeleton" style={{ height: '60px', marginBottom: '24px' }}></div>
        <div className="skeleton" style={{ height: '30px', marginBottom: '16px' }}></div>
        <div className="skeleton" style={{ height: '200px' }}></div>
      </div>
    </div>
  </div>
);

const formatPrice = (price) => {
  return new Intl.NumberFormat('ru-RU').format(price);
};

export default ApartmentDetail;

