import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

export const apartmentService = {
  getAll: async (params = {}) => {
    const response = await api.get('/apartments/', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/apartments/${id}/`);
    return response.data;
  },

  getStats: async () => {
    try {
      const response = await api.get('/apartments/stats/');
      return response.data;
    } catch (error) {
      // Если эндпоинт не существует, вычисляем статистику из списка
      const apartments = await apartmentService.getAll();
      return calculateStats(apartments);
    }
  },
};

const calculateStats = (apartments) => {
  if (!apartments || apartments.length === 0) {
    return {
      total: 0,
      avgPrice: 0,
      avgArea: 0,
      pricePerMeter: 0,
      byRooms: {},
      bySource: {},
      priceRanges: [],
    };
  }

  const total = apartments.length;
  const avgPrice = Math.round(apartments.reduce((sum, a) => sum + (a.price || 0), 0) / total);
  const avgArea = Math.round(apartments.reduce((sum, a) => sum + (a.area || 0), 0) / total * 10) / 10;
  const pricePerMeter = avgArea > 0 ? Math.round(avgPrice / avgArea) : 0;

  // По комнатам
  const byRooms = apartments.reduce((acc, a) => {
    const rooms = a.rooms ?? 'Студия';
    const key = rooms === 0 ? 'Студия' : `${rooms}-комн.`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  // По источникам
  const bySource = apartments.reduce((acc, a) => {
    const source = a.source || 'Неизвестно';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});

  // Диапазоны цен
  const priceRanges = [
    { range: 'до 50к', count: apartments.filter(a => a.price < 50000).length },
    { range: '50-80к', count: apartments.filter(a => a.price >= 50000 && a.price < 80000).length },
    { range: '80-120к', count: apartments.filter(a => a.price >= 80000 && a.price < 120000).length },
    { range: '120-200к', count: apartments.filter(a => a.price >= 120000 && a.price < 200000).length },
    { range: 'от 200к', count: apartments.filter(a => a.price >= 200000).length },
  ];

  // Средняя цена по комнатам
  const avgPriceByRooms = {};
  Object.keys(byRooms).forEach(key => {
    const roomApartments = apartments.filter(a => {
      const rooms = a.rooms ?? 'Студия';
      const aKey = rooms === 0 ? 'Студия' : `${rooms}-комн.`;
      return aKey === key;
    });
    avgPriceByRooms[key] = Math.round(
      roomApartments.reduce((sum, a) => sum + (a.price || 0), 0) / roomApartments.length
    );
  });

  return {
    total,
    avgPrice,
    avgArea,
    pricePerMeter,
    byRooms,
    bySource,
    priceRanges,
    avgPriceByRooms,
  };
};

export const parserService = {
  parseAll: async () => {
    const response = await axios.post('http://localhost:3000/parse/all', {}, { timeout: 600000 });
    return response.data;
  },

  parseCian: async () => {
    const response = await axios.post('http://localhost:3000/parse/cian', {}, { timeout: 600000 });
    return response.data;
  },

  parseYandex: async () => {
    const response = await axios.post('http://localhost:3000/parse/yandex', {}, { timeout: 600000 });
    return response.data;
  },

  parseAvito: async () => {
    const response = await axios.post('http://localhost:3000/parse/avito', {}, { timeout: 600000 });
    return response.data;
  },
};

export default api;

