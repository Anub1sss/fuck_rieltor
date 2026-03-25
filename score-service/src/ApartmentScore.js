import React, { useState } from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import './ApartmentScore.css';

const API = '/api/analytics';

const ApartmentScore = () => {
  const [step, setStep] = useState('form');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    source_url: '',
    buyer_type: 'couple',
    husband_work_address: '', wife_work_address: '',
    has_children: false, children_school_address: '', children_kindergarten_address: '',
    has_car: false, has_pets: false,
    priority_transport: true, priority_ecology: true, priority_infrastructure: true,
    priority_safety: true, priority_quietness: true, max_commute_minutes: 60,
  });

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/analyze/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.detail || err.source_url?.[0] || 'Ошибка'); }
      const data = await r.json();
      if (!data.price && !data.area) {
        throw new Error('Не удалось загрузить данные квартиры. Проверьте ссылку — она должна вести на страницу конкретной квартиры на Циан, Авито или Яндекс.Недвижимость.');
      }
      setResult(data); setStep('result');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  if (step === 'result' && result) return <AnalysisResult result={result} onBack={() => { setStep('form'); setResult(null); }} />;

  const showWorkFields = form.buyer_type === 'couple' || form.buyer_type === 'family';

  return (
    <div className="score-page">
      <div className="score-layout">
        <div className="score-form-section">
          <div className="score-card">
            <div className="score-card__header">
              <span className="score-card__icon">◈</span>
              <div>
                <h2>Глубокая оценка квартиры</h2>
                <p>Вставьте ссылку и расскажите о себе — получите персональный анализ по 100-балльной шкале с подробными пояснениями</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="score-form">
              <div className="form-group form-group--url">
                <label>Ссылка на объявление *</label>
                <input type="url" placeholder="https://cian.ru/... или avito.ru/... или realty.yandex.ru/..." value={form.source_url} onChange={e => setForm({...form, source_url: e.target.value})} required />
                <span className="form-hint">Циан, Авито, Яндекс.Недвижимость</span>
              </div>

              <div className="form-section-title">Кто покупает</div>
              <div className="buyer-type-row">
                {[
                  {v:'single', l:'Один человек', i:'👤'},
                  {v:'couple', l:'Пара', i:'👫'},
                  {v:'family', l:'Семья с детьми', i:'👨‍👩‍👧'},
                ].map(b => (
                  <button key={b.v} type="button"
                    className={`buyer-btn ${form.buyer_type === b.v ? 'buyer-btn--active' : ''}`}
                    onClick={() => setForm({...form, buyer_type: b.v, has_children: b.v === 'family' ? true : form.has_children})}>
                    <span>{b.i}</span><span>{b.l}</span>
                  </button>
                ))}
              </div>

              {showWorkFields && (
                <>
                  <div className="form-section-title">Место работы</div>
                  <div className="form-row">
                    <Field label={form.buyer_type === 'couple' || form.buyer_type === 'family' ? 'Работа (муж/партнёр 1)' : 'Работа'} placeholder="Адрес или станция метро" value={form.husband_work_address} onChange={v => setForm({...form, husband_work_address: v})} />
                    <Field label="Работа (жена/партнёр 2)" placeholder="Адрес или станция метро" value={form.wife_work_address} onChange={v => setForm({...form, wife_work_address: v})} />
                  </div>
                </>
              )}
              {form.buyer_type === 'single' && (
                <>
                  <div className="form-section-title">Место работы</div>
                  <Field label="Ваша работа" placeholder="Адрес или станция метро" value={form.husband_work_address} onChange={v => setForm({...form, husband_work_address: v})} />
                </>
              )}

              <div className="form-section-title">Дополнительно</div>
              <div className="toggle-row">
                {form.buyer_type !== 'family' && (
                  <Toggle label="Есть дети" active={form.has_children} onToggle={() => setForm({...form, has_children: !form.has_children})} />
                )}
                <Toggle label="Есть автомобиль" active={form.has_car} onToggle={() => setForm({...form, has_car: !form.has_car})} />
                <Toggle label="Домашние животные" active={form.has_pets} onToggle={() => setForm({...form, has_pets: !form.has_pets})} />
              </div>

              {form.has_children && (
                <div className="form-row animate-fade-in">
                  <Field label="Школа ребёнка" placeholder="Название или адрес" value={form.children_school_address} onChange={v => setForm({...form, children_school_address: v})} />
                  <Field label="Детский сад" placeholder="Название или адрес" value={form.children_kindergarten_address} onChange={v => setForm({...form, children_kindergarten_address: v})} />
                </div>
              )}

              <div className="form-section-title">Что для вас важно</div>
              <div className="priorities-grid">
                {[
                  {k:'priority_transport', l:'Транспорт', i:'🚇'},
                  {k:'priority_ecology', l:'Экология', i:'🌿'},
                  {k:'priority_infrastructure', l:'Инфраструктура', i:'🏪'},
                  {k:'priority_safety', l:'Безопасность', i:'🛡'},
                  {k:'priority_quietness', l:'Тишина', i:'🤫'},
                ].map(p => (
                  <button key={p.k} type="button" className={`priority-btn ${form[p.k] ? 'active' : ''}`}
                    onClick={() => setForm({...form, [p.k]: !form[p.k]})}><span>{p.i}</span><span>{p.l}</span></button>
                ))}
              </div>

              <div className="form-group">
                <label>Макс. время в дороге: <strong>{form.max_commute_minutes} мин</strong></label>
                <input type="range" min="15" max="120" value={form.max_commute_minutes} onChange={e => setForm({...form, max_commute_minutes: +e.target.value})} className="range-slider" />
              </div>

              {error && <div className="form-error">{error}</div>}
              <button type="submit" className="submit-btn" disabled={loading || !form.source_url}>
                {loading ? <><span className="spinner"></span>Анализируем...</> : 'Оценить квартиру'}
              </button>
            </form>
          </div>
        </div>



      </div>
    </div>
  );
};

const Field = ({label, placeholder, value, onChange}) => (
  <div className="form-group"><label>{label}</label>
    <input type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

const Toggle = ({label, active, onToggle}) => (
  <button type="button" className={`toggle-btn ${active ? 'toggle-btn--on' : ''}`} onClick={onToggle}>
    <span className="toggle-btn__indicator">{active ? '✓' : ''}</span>
    <span className="toggle-btn__label">{label}</span>
  </button>
);


// ════════════════════════════════════════════════════════════
// RESULT PAGE
// ════════════════════════════════════════════════════════════

const Explanation = ({text}) => text ? <p className="explanation">{text}</p> : null;

const AnalysisResult = ({ result: r, onBack }) => {
  const ex = r.explanations || {};
  const radarData = [
    { s: 'Транспорт', v: r.score_transport },
    { s: 'Экология', v: r.score_ecology },
    { s: 'Инфраструктура', v: r.score_infrastructure },
    { s: 'Безопасность', v: r.score_safety },
    { s: 'Цена/качество', v: r.score_price_quality },
    { s: 'Дом/ЖК', v: r.score_building },
    { s: 'Планировка', v: r.score_apartment_layout },
    { s: 'Этаж', v: r.score_floor },
    { s: 'Тишина', v: r.score_quietness },
    { s: 'Соц.инфра', v: r.score_social_infra },
    { s: 'Быт.комфорт', v: r.score_daily_comfort },
    { s: 'Перспективы', v: r.score_district_perspective },
  ];

  return (
    <div className="result-page animate-fade-in">
      <button className="back-btn" onClick={onBack}>← Новый анализ</button>

      {/* Buyer context */}
      {ex.buyer && <div className="buyer-context"><span>👤</span><p>{ex.buyer}</p></div>}

      <div className="result-header">
        <div className="result-header__main">
          <ScoreBadge score={r.score_total} size="lg" />
          <div>
            <h2>{r.title || 'Квартира'}</h2>
            <p className="result-subtitle">
              {r.rooms != null && (r.rooms === 0 ? 'Студия' : `${r.rooms}-комн.`)}
              {r.area && ` · ${r.area} м²`}
              {r.floor && ` · ${r.floor}/${r.total_floors} эт.`}
              {r.ceiling_height && ` · потолки ${r.ceiling_height} м`}
            </p>
            {r.residential_complex && <p className="result-rc">🏗 ЖК «{r.residential_complex}»</p>}
            {r.address && <p className="result-address">{r.address}</p>}
            {r.metro_station && <p className="result-metro">🚇 {r.metro_station}{r.metro_distance_min ? ` — ${r.metro_distance_min} мин пешком` : ''}</p>}
            {r.nearby_metros?.length > 1 && (
              <div className="result-metros-list">
                {r.nearby_metros.slice(1).map((m,i) => <span key={i} className="metro-tag">🚇 {m}</span>)}
              </div>
            )}
            {r.nearby_highways?.length > 0 && (
              <div className="result-highways">
                {r.nearby_highways.map((h,i) => <span key={i} className="highway-tag">🛣 {h}</span>)}
              </div>
            )}
            {r.mkad_distance_km && <p className="result-mkad">{r.mkad_distance_km} км от МКАД</p>}
          </div>
        </div>
        {r.price && (
          <div className="result-header__price">
            {fmtPrice(r.price)} <span>₽</span>
            {r.price_per_m2 && <div className="price-per-m2">{fmtPrice(r.price_per_m2)} ₽/м²</div>}
          </div>
        )}
      </div>

      {r.recommendation && <div className="result-recommendation"><span className="rec-icon">💡</span><p>{r.recommendation}</p></div>}

      {r.warnings?.length > 0 && (
        <div className="result-warnings">
          <h4>⚠ Что проверить при осмотре</h4>
          <ul>{r.warnings.map((w,i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}

      <div className="result-grid">
        {/* Radar */}
        <div className="result-card result-card--wide">
          <h3>Оценка по 12 критериям</h3>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border-color)" />
              <PolarAngleAxis dataKey="s" stroke="var(--text-secondary)" fontSize={11} />
              <PolarRadiusAxis domain={[0,100]} stroke="var(--text-muted)" fontSize={10} />
              <Radar dataKey="v" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.2} />
              <Tooltip contentStyle={TT} formatter={v => `${v}/100`} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Score bars with explanations */}
        <div className="result-card">
          <h3>Детализация баллов</h3>
          <div className="scores-list">
            <ScoreRowEx label="Транспорт" value={r.score_transport} explanation={ex.transport} />
            <ScoreRowEx label="Экология" value={r.score_ecology} explanation={ex.ecology} />
            <ScoreRowEx label="Безопасность" value={r.score_safety} explanation={ex.safety} />
            <ScoreRowEx label="Цена/качество" value={r.score_price_quality} explanation={ex.price} />
            <ScoreRowEx label="Дом/ЖК" value={r.score_building} explanation={ex.building} />
            <ScoreRowEx label="Планировка" value={r.score_apartment_layout} explanation={ex.layout} />
            <ScoreRowEx label="Этаж" value={r.score_floor} explanation={ex.floor} />
            <ScoreRowEx label="Тишина" value={r.score_quietness} explanation={ex.quietness} />
            <ScoreRowEx label="Инфраструктура" value={r.score_infrastructure} />
            <ScoreRowEx label="Соц.инфра" value={r.score_social_infra} />
            <ScoreRowEx label="Быт.комфорт" value={r.score_daily_comfort} />
            <ScoreRowEx label="Перспективы" value={r.score_district_perspective} explanation={ex.perspective} />
          </div>
        </div>

        {/* Commute */}
        {(r.commute_husband_min || r.commute_wife_min || r.commute_school_min) && (
          <div className="result-card">
            <h3>Время в дороге</h3>
            <div className="commute-list">
              {r.commute_husband_min && <Commute label={r.family_profile?.buyer_type === 'single' ? 'До работы' : 'Работа (партнёр 1)'} min={r.commute_husband_min} />}
              {r.commute_wife_min && <Commute label="Работа (партнёр 2)" min={r.commute_wife_min} />}
              {r.commute_school_min && <Commute label="Школа" min={r.commute_school_min} />}
              {r.commute_kindergarten_min && <Commute label="Детский сад" min={r.commute_kindergarten_min} />}
            </div>
            <p className="meta-note">Оценка: пешком до метро + среднее время в метро (~25 мин)</p>
          </div>
        )}

        {/* District */}
        <div className="result-card">
          <h3>Район</h3>
          <div className="district-info">
            {r.district && <DRow l="Округ" v={r.district} />}
            {r.district_avg_price && <DRow l="Средняя цена в округе" v={`${fmtPrice(r.district_avg_price)} ₽/м²`} />}
            {r.price_per_m2 && r.district_avg_price && (
              <DRow l="Ваша цена vs средняя" v={
                <span style={{color: parseFloat(r.price_per_m2) <= parseFloat(r.district_avg_price) ? 'var(--accent-green)' : 'var(--accent-red)'}}>
                  {parseFloat(r.price_per_m2) <= parseFloat(r.district_avg_price) ? 'ниже средней' : 'выше средней'} ({Math.round(parseFloat(r.price_per_m2) / parseFloat(r.district_avg_price) * 100)}%)
                </span>
              } />
            )}
            {r.district_price_trend && <DRow l="Тренд цен" v={<span className={`trend trend--${r.district_price_trend}`}>{r.district_price_trend === 'rising' ? '↑ Растёт' : '→ Стабильно'}</span>} />}
            {r.district_crime_level && <DRow l="Преступность" v={r.district_crime_level} />}
            {r.noise_level && <DRow l="Уровень шума" v={r.noise_level} />}
            {r.district_perspective && <p className="district-perspective">{r.district_perspective}</p>}
          </div>
          <div className="env-tags">
            {r.near_highway && <span className="env-tag env-tag--bad">Рядом магистраль</span>}
            {r.near_railway && <span className="env-tag env-tag--bad">Рядом ж/д</span>}
            {r.near_industrial_zone && <span className="env-tag env-tag--bad">Рядом промзона</span>}
            {r.near_airport_noise && <span className="env-tag env-tag--bad">Шум аэропорта</span>}
          </div>
          <p className="data-source">Цены: irn.ru, янв 2026. Криминал: прокуратура Москвы, 10 мес 2025.</p>
        </div>

        {/* Pros */}
        {r.advantages?.length > 0 && <div className="result-card"><h3>Преимущества</h3>
          <ul className="pros-cons-list">{r.advantages.map((x,i) => <li key={i}><span className="pro-icon">+</span>{x}</li>)}</ul></div>}

        {/* Cons */}
        {r.disadvantages?.length > 0 && <div className="result-card"><h3>Недостатки</h3>
          <ul className="pros-cons-list">{r.disadvantages.map((x,i) => <li key={i}><span className="con-icon">−</span>{x}</li>)}</ul></div>}

        {/* Building */}
        <div className="result-card">
          <h3>Дом / ЖК</h3>
          <div className="rc-info">
            {r.residential_complex && <div className="rc-name">{r.residential_complex}</div>}
            {r.building_type && <DRow l="Тип дома" v={r.building_type} />}
            {r.building_series && <DRow l="Серия" v={r.building_series} />}
            {r.rc_developer && <DRow l="Застройщик" v={r.rc_developer} />}
            {r.rc_class && <DRow l="Класс" v={r.rc_class} />}
            {r.rc_year_built && <DRow l="Год постройки" v={r.rc_year_built} />}
            {r.renovation_type && <DRow l="Ремонт" v={r.renovation_type} />}
            {r.bathroom_type && <DRow l="Санузел" v={r.bathroom_type} />}
            <div className="rc-features">
              {r.rc_parking && <span className="rc-tag">Парковка</span>}
              {r.rc_underground_parking && <span className="rc-tag">Подземный паркинг</span>}
              {r.rc_concierge && <span className="rc-tag">Консьерж</span>}
              {r.rc_playground && <span className="rc-tag">Детская площадка</span>}
              {r.rc_closed_territory && <span className="rc-tag">Закрытая территория</span>}
              {r.rc_sports_ground && <span className="rc-tag">Спорт.площадка</span>}
              {r.rc_dog_walking && <span className="rc-tag">Площадка для собак</span>}
              {r.has_passenger_elevator && <span className="rc-tag">Пассажирский лифт</span>}
              {r.has_freight_elevator && <span className="rc-tag">Грузовой лифт</span>}
              {r.has_balcony && <span className="rc-tag">Балкон</span>}
              {r.has_loggia && <span className="rc-tag">Лоджия</span>}
            </div>
          </div>
        </div>

        {/* Areas */}
        {(r.living_area || r.kitchen_area) && (
          <div className="result-card">
            <h3>Площади</h3>
            <div className="district-info">
              {r.area && <DRow l="Общая" v={`${r.area} м²`} />}
              {r.living_area && <DRow l="Жилая" v={`${r.living_area} м²`} />}
              {r.kitchen_area && <DRow l="Кухня" v={`${r.kitchen_area} м²`} />}
              {r.ceiling_height && <DRow l="Потолки" v={`${r.ceiling_height} м`} />}
            </div>
          </div>
        )}

        {/* Infrastructure */}
        <div className="result-card result-card--wide">
          <h3>Инфраструктура в округе</h3>
          <div className="infra-grid">
            <InfraBlock icon="🌳" title="Парки" items={r.nearby_parks} explanation={ex.ecology} />
            <InfraBlock icon="🏫" title="Школы" items={r.nearby_schools} total={r.schools_total_in_district} explanation={ex.schools} />
            <InfraBlock icon="👶" title="Детские сады" items={r.nearby_kindergartens} total={r.kindergartens_total_in_district} explanation={ex.kindergartens} />
            <InfraBlock icon="🛒" title="ТЦ" items={r.nearby_malls} explanation={ex.malls} />
            <InfraBlock icon="🏥" title="Медицина" items={r.nearby_clinics} explanation={ex.clinics} />
            <InfraBlock icon="💪" title="Фитнес" items={r.nearby_fitness} explanation={ex.fitness} />
          </div>
          <p className="data-source">Данные: mos.ru, 2gis, публичные реестры</p>
        </div>

        {/* Price dynamics */}
        {ex.price && (
          <div className="result-card">
            <h3>Динамика цен за м²</h3>
            <p className="price-dynamics-text">{ex.price}</p>
          </div>
        )}

        {/* Similar */}
        {r.similar_apartments?.length > 0 && <SimilarSection items={r.similar_apartments} rc={r.residential_complex} metro={r.metro_station} />}
      </div>
    </div>
  );
};

// Infrastructure block
const InfraBlock = ({ icon, title, items, total, explanation }) => {
  const [open, setOpen] = useState(false);
  const hasItems = items && items.length > 0;
  return (
    <div className="infra-block">
      <div className="infra-block__header" onClick={() => setOpen(!open)} style={{cursor: 'pointer'}}>
        <span className="infra-block__icon">{icon}</span>
        <span className="infra-block__title">{title}</span>
        {total && <span className="infra-block__total">~{total} в округе</span>}
        <span className="expand-hint">{open ? '▾' : '▸'}</span>
      </div>
      {hasItems && <div className="infra-block__items">{items.map((s,i) => <span key={i} className="nearby-item">{s}</span>)}</div>}
      {open && explanation && <p className="infra-block__explanation">{explanation}</p>}
    </div>
  );
};

// Similar apartments grouped
const SIMILAR_GROUPS = [
  { key: 'same_building', title: 'В этом ЖК / доме', icon: '🏢', empty: 'Нет объявлений в этом ЖК в нашей базе' },
  { key: 'same_metro', title: 'Рядом с той же станцией метро', icon: '🚇', empty: 'Нет объявлений у этой станции' },
  { key: 'similar', title: 'Похожие по параметрам', icon: '📋', empty: null },
];

const SimilarSection = ({ items, rc, metro }) => {
  const grouped = {};
  items.forEach(a => { const g = a.group || 'similar'; if (!grouped[g]) grouped[g] = []; grouped[g].push(a); });
  const hasAny = items.length > 0;
  if (!hasAny) return null;

  return (
    <div className="result-card result-card--wide">
      <h3>Аналогичные квартиры</h3>
      {SIMILAR_GROUPS.map(g => {
        const list = grouped[g.key] || [];
        if (list.length === 0 && !g.empty) return null;
        return (
          <div key={g.key} className="similar-group">
            <h4 className="similar-group__title">{g.icon} {g.title}{g.key === 'same_building' && rc ? ` «${rc}»` : ''}{g.key === 'same_metro' && metro ? ` (м. ${metro})` : ''}</h4>
            {list.length === 0 ? (
              <p className="similar-group__empty">{g.empty}</p>
            ) : (
              <div className="similar-list">
                {list.map((a,i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="similar-item">
                    <div className="similar-item__main">
                      <span className="similar-item__title">{a.title}</span>
                      <span className="similar-item__meta">{a.rooms && `${a.rooms}-комн.`}{a.area && ` · ${a.area} м²`}{a.metro_station && ` · м. ${a.metro_station}`}</span>
                      {a.address && <span className="similar-item__address">{a.address}</span>}
                    </div>
                    <div className="similar-item__price">{fmtPrice(a.price)} ₽</div>
                    <span className="similar-item__source">{a.source}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Score row with expandable explanation
const ScoreRowEx = ({label, value, explanation}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="score-row-ex">
      <div className="score-row" onClick={() => explanation && setOpen(!open)} style={explanation ? {cursor:'pointer'} : {}}>
        <span className="score-row__label">{label} {explanation && <span className="expand-hint">{open ? '▾' : '▸'}</span>}</span>
        <div className="score-row__bar"><div className="score-row__fill" style={{width:`${value}%`, background:clr(value)}} /></div>
        <span className="score-row__value" style={{color:clr(value)}}>{value}</span>
      </div>
      {open && explanation && <div className="score-row__explanation">{explanation}</div>}
    </div>
  );
};

const ScoreBadge = ({score, size='md'}) => {
  const c = clr(score);
  return <div className={`score-badge score-badge--${size}`} style={{borderColor:c, color:c}}>
    <span className="score-badge__value">{score}</span>
    {size !== 'sm' && <span className="score-badge__label">/ 100</span>}
  </div>;
};
const Commute = ({label, min}) => {
  const c = min <= 30 ? 'var(--accent-green)' : min <= 60 ? 'var(--accent-orange)' : 'var(--accent-red)';
  return <div className="commute-row"><span className="commute-row__label">{label}</span><span className="commute-row__value" style={{color:c}}>{min} мин</span></div>;
};
const DRow = ({l, v}) => <div className="district-row"><span>{l}</span><strong>{v}</strong></div>;

const TT = { background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'8px' };
function clr(s) { return s >= 75 ? '#22c55e' : s >= 55 ? '#f97316' : s >= 35 ? '#eab308' : '#ef4444'; }
function fmtPrice(p) { if (!p) return '0'; const n = typeof p === 'string' ? parseFloat(p) : p; return isNaN(n) ? '0' : new Intl.NumberFormat('ru-RU').format(Math.round(n)); }

export default ApartmentScore;
