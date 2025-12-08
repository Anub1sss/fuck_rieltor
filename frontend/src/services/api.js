import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

export const apartmentService = {
  getAll: async (params = {}) => {
    let allResults = [];
    let nextUrl = '/apartments/';
    let hasMore = true;
    let isFirstRequest = true;
    
    // Получаем все страницы, если есть пагинация
    while (hasMore) {
      const requestParams = isFirstRequest ? params : {};
      const response = await api.get(nextUrl, { params: requestParams });
      const data = response.data;
      
      // Если это пагинированный ответ DRF
      if (data.results && Array.isArray(data.results)) {
        allResults = [...allResults, ...data.results];
        hasMore = !!data.next;
        if (data.next) {
          // Извлекаем путь из полного URL (может быть полный URL или относительный)
          if (data.next.startsWith('http')) {
            // Полный URL - извлекаем путь после baseURL
            const url = new URL(data.next);
            nextUrl = url.pathname + url.search;
          } else {
            // Относительный путь
            nextUrl = data.next;
          }
        }
        isFirstRequest = false;
      } else {
        // Если это не пагинированный ответ, возвращаем как есть
        return Array.isArray(data) ? data : [];
      }
    }
    
    return allResults;
  },

  getById: async (id) => {
    const response = await api.get(`/apartments/${id}/`);
    return response.data;
  },

  getStats: async () => {
    try {
      const response = await api.get('/apartments/stats/');
      const data = response.data;
      
      // Получаем все квартиры для вычисления недостающих данных
      const apartments = await apartmentService.getAll();
      
      // Нормализуем формат данных (API возвращает snake_case, но мы используем camelCase)
      const normalized = {
        total: data.total || 0,
        avgPrice: data.avg_price || data.avgPrice || 0,
        avgArea: data.avg_area || data.avgArea || 0,
        pricePerMeter: data.pricePerMeter || (data.avg_price && data.avg_area ? Math.round(data.avg_price / data.avg_area) : 0),
        byRooms: data.byRooms || calculateByRooms(apartments),
        bySource: data.by_source || data.bySource || {},
        priceRanges: data.priceRanges || calculatePriceRanges(apartments),
      };
      
      return normalized;
    } catch (error) {
      // Если эндпоинт не существует, вычисляем статистику из списка
      const apartments = await apartmentService.getAll();
      return calculateStats(apartments);
    }
  },
};

const calculateByRooms = (apartments) => {
  if (!apartments || apartments.length === 0) return {};
  const byRooms = {};
  apartments.forEach(a => {
    const rooms = a.rooms ?? null;
    const key = rooms === 0 ? 'Студия' : rooms === null ? 'Н/Д' : `${rooms}-комн.`;
    byRooms[key] = (byRooms[key] || 0) + 1;
  });
  return byRooms;
};

const calculatePriceRanges = (apartments) => {
  if (!apartments || apartments.length === 0) return [];
  return [
    { range: 'до 50к', count: apartments.filter(a => (a.price || 0) < 50000).length },
    { range: '50-80к', count: apartments.filter(a => (a.price || 0) >= 50000 && (a.price || 0) < 80000).length },
    { range: '80-120к', count: apartments.filter(a => (a.price || 0) >= 80000 && (a.price || 0) < 120000).length },
    { range: '120-200к', count: apartments.filter(a => (a.price || 0) >= 120000 && (a.price || 0) < 200000).length },
    { range: 'от 200к', count: apartments.filter(a => (a.price || 0) >= 200000).length },
  ];
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

