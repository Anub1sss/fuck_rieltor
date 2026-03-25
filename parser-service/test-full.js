const axios = require('axios');
const cheerio = require('cheerio');

// Copy helper functions from index.js
const DISTRICT_MAP = {
    'ЦАО': 'Центральный', 'САО': 'Северный', 'СВАО': 'Северо-Восточный',
    'ВАО': 'Восточный', 'ЮВАО': 'Юго-Восточный', 'ЮАО': 'Южный',
    'ЮЗАО': 'Юго-Западный', 'ЗАО': 'Западный', 'СЗАО': 'Северо-Западный',
    'НАО': 'Новомосковский', 'ТАО': 'Троицкий',
    'Новомосковский': 'Новомосковский', 'Троицкий': 'Троицкий',
    'Центральный': 'Центральный', 'Северный': 'Северный',
};

function detectDistrict(text) {
    if (!text) return null;
    for (const [key, val] of Object.entries(DISTRICT_MAP)) {
        if (text.includes(key)) return val;
    }
    return null;
}

function extractFromTitle(text) {
    const res = {};
    if (!text) return res;
    const rm = text.match(/(\d+)-комн/);
    res.rooms = rm ? parseInt(rm[1]) : (text.toLowerCase().includes('студ') ? 0 : null);
    const am = text.match(/([\d,.]+)\s*м[²2.\s,]/);
    res.area = am ? parseFloat(am[1].replace(',', '.')) : null;
    const fm = text.match(/этаж\s*(\d+)\s*[\/из]+\s*(\d+)/i) || text.match(/(\d+)\s*\/\s*(\d+)\s*эт/i);
    if (fm) { res.floor = parseInt(fm[1]); res.total_floors = parseInt(fm[2]); }
    return res;
}

function detectBuildingType(text) {
    if (!text) return null;
    const t = text.toLowerCase();
    if (t.includes('монолитно-кирпич') || (t.includes('монолит') && t.includes('кирпич'))) return 'монолитно-кирпичный';
    if (t.includes('монолит')) return 'монолитный';
    if (t.includes('кирпич')) return 'кирпичный';
    if (t.includes('панель')) return 'панельный';
    if (t.includes('блочн') || t.includes('блок')) return 'блочный';
    return null;
}

const url = process.argv[2] || 'https://www.cian.ru/sale/flat/327121629/';

async function test() {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9',
    };

    const resp = await axios.get(url, { headers, timeout: 15000 });
    const html = resp.data;
    const $ = cheerio.load(html);

    // Extract JSON-LD
    const jsonLd = [];
    $('script[type="application/ld+json"]').each((_, el) => {
        try { const p = JSON.parse($(el).html()); jsonLd.push(p); } catch {}
    });

    // Run parseCianHtml equivalent
    const data = {};

    // OG
    const og = {};
    $('meta[property^="og:"]').each((_, el) => { og[$(el).attr('property')] = $(el).attr('content') || ''; });
    const ogTitle = og['og:title'] || '';
    const ogDesc = og['og:description'] || '';

    const ogInfo = extractFromTitle(ogTitle);
    if (ogInfo.rooms !== null && ogInfo.rooms !== undefined) data.rooms = ogInfo.rooms;
    if (ogInfo.area) data.area = ogInfo.area;
    if (ogInfo.floor) { data.floor = ogInfo.floor; data.total_floors = ogInfo.total_floors; }

    const ogPriceMatch = ogTitle.match(/за\s+([\d\s]+)\s*руб/i);
    if (ogPriceMatch) data.price = parseFloat(ogPriceMatch[1].replace(/\s/g, ''));

    const rcMatch = ogTitle.match(/(?:квартира\s+в|студия\s+в|апартаменты\s+в)\s+(.+?)\s+за\s/i);
    if (rcMatch) data.residential_complex = rcMatch[1].trim();

    if (ogDesc) data.address = ogDesc;
    data.district = detectDistrict(ogDesc) || detectDistrict(ogTitle);

    // JSON-LD
    const product = jsonLd.find(j => j['@type'] === 'Product');
    if (product) {
        if (!data.price && product.offers) {
            const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
            data.price = parseFloat(String(offer.price || '').replace(/[^\d]/g, '')) || data.price;
        }
        const desc = product.description || '';
        if (desc) {
            data.description = desc.substring(0, 300);
            if (!data.building_type) data.building_type = detectBuildingType(desc);
            const ym = desc.match(/(?:постройки|построен|ввод.*эксплуатацию|сда[чн])\s*[:\-—–]?\s*(?:\d+\s*квартал\s*)?((?:19|20)\d{2})/i);
            if (ym) data.building_year = parseInt(ym[1]);
        }
        if (product.image) data.photos = Array.isArray(product.image) ? product.image.length : 1;
    }

    // H1
    const h1 = $('h1').first().text().trim();
    data.title = h1 || ogTitle;

    // Price
    if (!data.price) {
        const pt = $('[data-testid="price-amount"]').text().replace(/[^\d]/g, '');
        if (pt) data.price = parseFloat(pt);
    }

    // Metro
    const metros = [];
    $('[data-name="UndergroundItem"]').each((i, el) => {
        if (i < 3) metros.push($(el).text().trim().replace(/\s+/g, ' '));
    });
    if (metros.length > 0) {
        const main = metros[0];
        const sm = main.match(/^([А-ЯЁа-яё\s\-\.]+?)(\d+)/);
        if (sm) { data.metro_station = sm[1].trim(); data.metro_distance_min = parseInt(sm[2]); }
        else { data.metro_station = main.replace(/\d+\s*мин.*/, '').trim(); }
        data.nearby_metros = metros;
    }

    // Highways
    const hws = [];
    $('[data-name="HighwayItem"]').each((_, el) => hws.push($(el).text().trim().replace(/\s+/g, ' ')));
    if (hws.length) data.nearby_highways = hws;

    // MKAD
    $('[data-name="Geo"] span').each((_, el) => {
        const t = $(el).text().trim();
        const m = t.match(/(\d+)\s*км от МКАД/);
        if (m) data.mkad_distance_km = parseInt(m[1]);
    });

    // ObjectFactoids
    $('[data-name="ObjectFactoidsItem"]').each((_, el) => {
        const t = $(el).text().trim().replace(/\s+/g, ' ');
        if (!data.building_type) data.building_type = detectBuildingType(t);
        const ym = t.match(/(19|20)\d{2}/);
        if (ym && !data.building_year) data.building_year = parseInt(ym[0]);
    });

    // RC from ParentNew
    if (!data.residential_complex) {
        $('[data-name="ParentNew"] a').each((i, el) => {
            if (i === 0) { const t = $(el).text().trim(); if (t.length > 2) data.residential_complex = t; }
        });
    }

    console.log('\n=== RESULT ===');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n=== KEY FIELDS ===');
    console.log('Price:', data.price);
    console.log('Area:', data.area);
    console.log('Rooms:', data.rooms);
    console.log('Floor:', data.floor, '/', data.total_floors);
    console.log('Metro:', data.metro_station, data.metro_distance_min, 'min');
    console.log('District:', data.district);
    console.log('RC:', data.residential_complex);
    console.log('Building type:', data.building_type);
    console.log('Building year:', data.building_year);
    console.log('Address:', (data.address || '').substring(0, 100));
    console.log('Nearby metros:', data.nearby_metros);
    console.log('Nearby highways:', data.nearby_highways);
    console.log('MKAD km:', data.mkad_distance_km);
    console.log('Photos:', data.photos);
}

test().catch(e => console.log('ERROR:', e.message));
