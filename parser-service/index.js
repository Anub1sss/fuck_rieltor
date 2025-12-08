const express = require('express');
const { chromium } = require('playwright');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DJANGO_API_URL = process.env.DJANGO_API_URL || 'http://localhost:8000/api';
const MAX_RETRIES = 3;
const DELAY_BETWEEN_REQUESTS = 2000;

let browser = null;
let browserContext = null;

async function initBrowser() {
    if (!browser) {
        const fs = require('fs');
        let executablePath = null;
        
        
        const possiblePaths = [
            '/Users/macbook/Library/Caches/ms-playwright/chromium-1169/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
            '/Users/macbook/Library/Caches/ms-playwright/chromium-1169/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
            '/Users/macbook/Library/Caches/ms-playwright/chromium-1169/chrome-mac/Chromium.app/Contents/MacOS/Google Chrome for Testing'
        ];
        
        for (const path of possiblePaths) {
            if (fs.existsSync(path)) {
                executablePath = path;
                console.log(`Using Chromium at: ${path}`);
                break;
            }
        }
        
        browser = await chromium.launch({
            executablePath: executablePath,
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage'
            ]
        });
        
        browserContext = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale: 'ru-RU',
            timezoneId: 'Europe/Moscow'
        });
    }
    return { browser, context: browserContext };
}

async function waitForElement(page, selector, timeout = 10000) {
    try {
        await page.waitForSelector(selector, { timeout, state: 'visible' });
        return true;
    } catch (e) {
        return false;
    }
}

async function scrollPage(page, scrollCount = 3) {
    for (let i = 0; i < scrollCount; i++) {
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
        });
        await page.waitForTimeout(1000);
    }
}

async function extractTextSafe(element, selector, defaultValue = '') {
    try {
        if (element) {
            const text = await element.$eval(selector, el => el.textContent).catch(() => null);
            return text ? text.trim() : defaultValue;
        }
        return defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

async function extractAttributeSafe(element, selector, attribute, defaultValue = '') {
    try {
        if (element) {
            const attr = await element.$eval(selector, (el, attr) => el.getAttribute(attr), attribute).catch(() => null);
            return attr || defaultValue;
        }
        return defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

async function parsePrice(priceText) {
    if (!priceText) return 0;
    const cleaned = priceText.replace(/[^\d]/g, '');
    return parseFloat(cleaned) || 0;
}

async function parseNumber(text, regex) {
    if (!text) return null;
    const match = text.match(regex);
    if (match) {
        return parseFloat(match[1]?.replace(',', '.')) || parseInt(match[1]) || null;
    }
    return null;
}

async function getApartmentDetails(page, url) {
    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const details = {
            description: '',
            contact_phone: '',
            contact_name: '',
            total_floors: null,
            infrastructure: {}
        };
        
        const descriptionEl = await page.$('[data-name="Description"]').catch(() => null);
        if (descriptionEl) {
            details.description = await descriptionEl.textContent().catch(() => '');
        }
        
        const phoneEl = await page.$('[data-name="PhoneButton"]').catch(() => null);
        if (phoneEl) {
            details.contact_phone = await phoneEl.getAttribute('href')?.replace('tel:', '') || '';
        }
        
        const ownerEl = await page.$('[data-name="OwnerInfo"]').catch(() => null);
        if (ownerEl) {
            details.contact_name = await ownerEl.textContent().catch(() => '');
        }
        
        const floorInfo = await page.$eval('[data-name="FloorInfo"]', el => el.textContent).catch(() => '');
        if (floorInfo) {
            const match = floorInfo.match(/(\d+)\s*из\s*(\d+)/);
            if (match) {
                details.total_floors = parseInt(match[2]);
            }
        }
        
        return details;
    } catch (e) {
        console.error(`Error getting details from ${url}:`, e.message);
        return {
            description: '',
            contact_phone: '',
            contact_name: '',
            total_floors: null,
            infrastructure: {}
        };
    }
}

async function parseCian() {
    const { context } = await initBrowser();
    const page = await context.newPage();
    
    try {
        const baseUrl = 'https://www.cian.ru/cat.php?deal_type=rent&engine_version=2&max_commission=0&offer_type=flat&region=1&type=4';
        let allApartments = [];
        const maxPages = 3; 
        
        
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            console.log(`\n📄 === Страница ${pageNum} ===\n`);
            
            
            let pageUrl = baseUrl;
            if (pageNum > 1) {
                pageUrl = `${baseUrl}&p=${pageNum}`;
            }
            
            console.log(`🌐 Открываю URL: ${pageUrl}`);
            await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(3000);
            
            
            const currentUrl = page.url();
            console.log(`✅ Текущий URL после загрузки: ${currentUrl}`);
        
        const hasCaptcha = await page.$('.captcha').catch(() => null);
        if (hasCaptcha) {
                console.log('⚠️  Обнаружена капча, жду...');
            await page.waitForTimeout(10000);
        }
        
            
            console.log('Ищу карточки на странице...');
            
            
            let previousCount = 0;
            let cards = [];
            const maxScrolls = 10;
            
            for (let scroll = 0; scroll < maxScrolls; scroll++) {
                
                await page.evaluate(() => {
                    window.scrollBy(0, window.innerHeight * 2);
                });
                await page.waitForTimeout(2000);
                
                
                cards = await page.$$('article[data-name="CardComponent"]');
                console.log(`После скролла ${scroll + 1}: найдено ${cards.length} карточек`);
                
                
                if (cards.length === previousCount && scroll > 2) {
                    console.log('Количество карточек не увеличивается, останавливаю скролл');
                    break;
                }
                previousCount = cards.length;
            }
            
            
            cards = await page.$$('article[data-name="CardComponent"]');
            console.log(`✅ Всего найдено карточек на странице ${pageNum}: ${cards.length}`);
            
            if (cards.length === 0) {
                console.log('⚠️  Карточки не найдены, пробую альтернативные селекторы...');
                cards = await page.$$('[data-name="CardComponent"]');
                console.log(`Найдено с альтернативным селектором: ${cards.length}`);
                
                if (cards.length === 0) {
                    console.log(`⚠️  На странице ${pageNum} нет карточек, останавливаю парсинг`);
                    break;
                }
            }
        
        const apartments = [];
            const maxCards = Math.min(cards.length, 50);
        
        for (let i = 0; i < maxCards; i++) {
            try {
                const card = cards[i];
                
                
                const linkEl = await card.$('a.x31de4314--_65eab--link').catch(() => null) ||
                              await card.$('a[href*="/rent/flat/"]').catch(() => null);
                
                const linkHref = linkEl ? await linkEl.getAttribute('href').catch(() => '') : '';
                const fullUrl = linkHref.startsWith('http') ? linkHref : `https://www.cian.ru${linkHref}`;
                
                
                const externalId = linkHref.match(/\/rent\/flat\/(\d+)/)?.[1] || 
                                  fullUrl.match(/\/rent\/flat\/(\d+)/)?.[1] || '';
                
                if (!externalId) {
                    console.log(`⚠️  Пропускаю карточку ${i + 1}: нет external ID из URL ${linkHref}`);
                    continue;
                }
                
                console.log(`📋 Обрабатываю карточку ${i + 1}/${maxCards}: ID=${externalId}`);
                
                
                const title = await card.evaluate(el => {
                                    const titleEl = el.querySelector('span[data-mark="OfferTitle"]');
                                    return titleEl ? titleEl.textContent.trim() : '';
                                }).catch(() => '');
                
                
                const subtitle = await card.evaluate(el => {
                                    const subEl = el.querySelector('span[data-mark="OfferSubtitle"]');
                                    return subEl ? subEl.textContent.trim() : '';
                                }).catch(() => '');
                
                
                const roomsMatch = subtitle.match(/(\d+)\s*-?\s*комн/i);
                const rooms = roomsMatch ? parseInt(roomsMatch[1]) : null;
                
                const areaMatch = subtitle.match(/(\d+[.,]?\d*)\s*м²/i);
                const area = areaMatch ? parseFloat(areaMatch[1].replace(',', '.')) : null;
                
                const floorMatch = subtitle.match(/(\d+)\/(\d+)\s*этаж/i);
                const floor = floorMatch ? parseInt(floorMatch[1]) : null;
                const totalFloors = floorMatch ? parseInt(floorMatch[2]) : null;
                
                
                const priceText = await card.evaluate(el => {
                                    const priceEl = el.querySelector('span[data-mark="MainPrice"]');
                                    return priceEl ? priceEl.textContent.trim() : '';
                                }).catch(() => '');
                const price = await parsePrice(priceText);
                
                
                const metro = await card.evaluate(el => {
                                    const metroEl = el.querySelector('div[data-name="SpecialGeo"]');
                                    if (metroEl) {
                                        const metroText = metroEl.textContent.trim();
                                        const match = metroText.match(/^([^,•]+)/);
                                        return match ? match[1].trim() : '';
                                    }
                                    return '';
                                }).catch(() => '');
                
                
                const address = await card.evaluate(el => {
                                    const geoLabels = el.querySelectorAll('a[data-name="GeoLabel"]');
                                    const parts = Array.from(geoLabels).map(a => a.textContent.trim());
                                    return parts.join(', ');
                                }).catch(() => '');
                
                
                const district = address.split(',').find(part => part.includes('р-н'))?.replace('р-н', '').trim() || 
                                address.split(',').slice(1, 2).join('').trim() || '';
                
                
                const photos = await card.evaluate(el => {
                                    const gallery = el.querySelector('div[data-name="Gallery"]');
                                    if (!gallery) return [];
                                    const imgs = gallery.querySelectorAll('img[src*="images.cdn-cian.ru"]');
                                    return Array.from(imgs).slice(0, 10).map(img => {
                                        const src = img.getAttribute('src');
                                        return src && (src.startsWith('http') || src.startsWith('//'))
                                            ? (src.startsWith('//') ? `https:${src}` : src)
                                            : null;
                                    }).filter(Boolean);
                                }).catch(() => []);
                
                
                const description = await card.evaluate(el => {
                                    const descEl = el.querySelector('div[data-name="Description"] p');
                                    return descEl ? descEl.textContent.trim() : '';
                                }).catch(() => '');
                
                
                const descText = (description || subtitle || '').toLowerCase();
                const titleText = (title || '').toLowerCase();
                const fullText = `${descText} ${titleText}`;
                
                
                const yearMatch = fullText.match(/(\d{4})\s*г(?:\.|од|ода)?/i) || 
                                 fullText.match(/построен[а]?\s*в\s*(\d{4})/i) ||
                                 fullText.match(/(19\d{2}|20\d{2})\s*год/i);
                const buildingYear = yearMatch ? parseInt(yearMatch[1]) : null;
                
                
                let buildingType = null;
                if (fullText.includes('панель')) buildingType = 'панель';
                else if (fullText.includes('кирпич')) buildingType = 'кирпич';
                else if (fullText.includes('монолит')) buildingType = 'монолит';
                else if (fullText.includes('блочн')) buildingType = 'блочный';
                
                
                const livingAreaMatch = fullText.match(/(?:жилая|жил\.?)\s*площадь[:\s]+(\d+[.,]?\d*)/i) ||
                                       fullText.match(/(\d+[.,]?\d*)\s*м²\s*жил/i);
                const livingArea = livingAreaMatch ? parseFloat(livingAreaMatch[1].replace(',', '.')) : null;
                
                const kitchenAreaMatch = fullText.match(/(?:кухня|кухн\.?)\s*[:\s]+(\d+[.,]?\d*)/i) ||
                                        fullText.match(/(\d+[.,]?\d*)\s*м²\s*кух/i);
                const kitchenArea = kitchenAreaMatch ? parseFloat(kitchenAreaMatch[1].replace(',', '.')) : null;
                
                
                const hasFurniture = fullText.includes('мебель') || fullText.includes('меблирован');
                const hasAppliances = fullText.includes('техника') || fullText.includes('бытовая техника') || 
                                     fullText.includes('холодильник') || fullText.includes('стиральная') ||
                                     fullText.includes('посудомоечная');
                const hasInternet = fullText.includes('интернет') || fullText.includes('wi-fi') || fullText.includes('wifi');
                const hasParking = fullText.includes('парковк') || fullText.includes('гараж') || fullText.includes('стоянк');
                const hasElevator = fullText.includes('лифт');
                const hasBalcony = fullText.includes('балкон') || fullText.includes('лоджия') || fullText.includes('терраса');
                
                
                const features = [];
                if (hasFurniture) features.push('мебель');
                if (hasAppliances) features.push('техника');
                if (hasInternet) features.push('интернет');
                if (hasParking) features.push('парковка');
                if (hasElevator) features.push('лифт');
                if (hasBalcony) features.push('балкон');
                
                apartments.push({
                    external_id: externalId,
                    url: fullUrl,
                    price: price,
                    area: area,
                    rooms: rooms,
                    floor: floor,
                    total_floors: totalFloors,
                    district: district,
                    metro_station: metro,
                    address: address,
                    title: title || subtitle,
                    description: description || subtitle,
                    photos: photos,
                    is_owner: true,
                    no_commission: true,
                    
                    building_year: buildingYear,
                    building_type: buildingType,
                    living_area: livingArea,
                    kitchen_area: kitchenArea,
                    has_furniture: hasFurniture,
                    has_appliances: hasAppliances,
                    has_internet: hasInternet,
                    has_parking: hasParking,
                    has_elevator: hasElevator,
                    has_balcony: hasBalcony,
                    features: features,
                });
                
                if ((i + 1) % 10 === 0 || (i + 1) === maxCards) {
                    console.log(`✅ Обработано ${i + 1}/${maxCards} карточек из Циана`);
                }
                
                await page.waitForTimeout(200);
            } catch (err) {
                console.error(`Error parsing card ${i}:`, err.message);
            }
        }
        
            console.log(`✅ Обработано ${apartments.length} квартир со страницы ${pageNum}`);
            allApartments = allApartments.concat(apartments);
            
            
            await page.waitForTimeout(2000);
        }
        
        console.log(`\n✅ Всего успешно спарсено ${allApartments.length} квартир с Циана`);
        return allApartments;
    } catch (error) {
        console.error('Error in parseCian:', error);
        throw error;
    } finally {
        await page.close();
    }
}

async function getAvitoApartmentDetails(page, url) {
    try {
        console.log(`  🔍 Открываю детальную страницу: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const details = {
            description: '',
            contact_phone: '',
            contact_name: '',
            photos: [],
            building_year: null,
            building_type: null,
            living_area: null,
            kitchen_area: null,
            deposit: null,
            commission: null,
            utilities_included: false,
            rental_period: null,
            metro_distance: null,
            metro_transport: null,
            published_date: null,
            district: null,
            has_furniture: false,
            has_appliances: false,
            has_internet: false,
            has_parking: false,
            has_elevator: false,
            has_balcony: false,
            features: []
        };
        
        // Описание
        const descriptionEl = await page.$('[data-marker="item-view/item-description"]').catch(() => null) ||
                              await page.$('.item-description-text').catch(() => null);
        if (descriptionEl) {
            details.description = await descriptionEl.textContent().catch(() => '');
        }
        
        // Фотографии - получаем все фото с детальной страницы
        details.photos = await page.evaluate(() => {
            const photoUrls = [];
            // Ищем все изображения в галерее
            const galleryImgs = document.querySelectorAll('div[data-marker="image-frame"] img, .gallery-img img, img[data-marker="image-frame/image"]');
            galleryImgs.forEach(img => {
                let src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-url');
                if (src) {
                    // Убираем параметры для получения оригинального размера
                    src = src.split('?')[0];
                    if (src.includes('img.avito.st') || src.includes('avito.ru')) {
                        const fullSrc = src.startsWith('//') ? `https:${src}` :
                                      src.startsWith('http') ? src : `https:${src}`;
                        if (!photoUrls.includes(fullSrc)) {
                            photoUrls.push(fullSrc);
                        }
                    }
                }
            });
            // Также проверяем data-attribute с URL
            const dataImages = document.querySelectorAll('[data-image]');
            dataImages.forEach(el => {
                const dataUrl = el.getAttribute('data-image');
                if (dataUrl && dataUrl.includes('img.avito.st')) {
                    const fullSrc = dataUrl.startsWith('//') ? `https:${dataUrl}` :
                                  dataUrl.startsWith('http') ? dataUrl : `https:${dataUrl}`;
                    if (!photoUrls.includes(fullSrc)) {
                        photoUrls.push(fullSrc);
                    }
                }
            });
            return photoUrls.slice(0, 20); // До 20 фотографий
        }).catch(() => []);
        
        // Контактная информация
        const phoneEl = await page.$('a[data-marker="item-phone-button/phone"]').catch(() => null) ||
                        await page.$('[data-marker="phone-popup/phone"]').catch(() => null);
        if (phoneEl) {
            const phoneHref = await phoneEl.getAttribute('href').catch(() => '');
            details.contact_phone = phoneHref.replace('tel:', '').trim();
        }
        
        // Имя владельца
        const ownerEl = await page.$('[data-marker="seller-info/name"]').catch(() => null) ||
                        await page.$('.seller-info-name').catch(() => null);
        if (ownerEl) {
            details.contact_name = await ownerEl.textContent().catch(() => '');
        }
        
        // Проверяем, собственник или агент
        const ownerType = await page.evaluate(() => {
            const text = document.body.textContent || '';
            if (text.includes('Собственник') || text.includes('Владелец')) return true;
            if (text.includes('Агент') || text.includes('Агентство')) return false;
            return true; // По умолчанию считаем собственником
        }).catch(() => true);
        details.is_owner = ownerType;
        
        // Параметры квартиры
        const params = await page.evaluate(() => {
            const paramsObj = {};
            const paramItems = document.querySelectorAll('[data-marker="item-params/item"]');
            paramItems.forEach(item => {
                const label = item.querySelector('[data-marker="item-params/label"]')?.textContent?.trim() || '';
                const value = item.querySelector('[data-marker="item-params/value"]')?.textContent?.trim() || '';
                if (label && value) {
                    paramsObj[label.toLowerCase()] = value;
                }
            });
            return paramsObj;
        }).catch(() => ({}));
        
        // Год постройки
        if (params['год постройки'] || params['год']) {
            const yearMatch = (params['год постройки'] || params['год']).match(/(\d{4})/);
            if (yearMatch) details.building_year = parseInt(yearMatch[1]);
        }
        
        // Тип дома
        if (params['тип дома'] || params['материал стен']) {
            const type = (params['тип дома'] || params['материал стен']).toLowerCase();
            if (type.includes('кирпич')) details.building_type = 'кирпич';
            else if (type.includes('панель')) details.building_type = 'панель';
            else if (type.includes('монолит')) details.building_type = 'монолит';
            else if (type.includes('блочн')) details.building_type = 'блочный';
            else details.building_type = type;
        }
        
        // Жилая площадь
        if (params['жилая площадь'] || params['жилая']) {
            const livingMatch = (params['жилая площадь'] || params['жилая']).match(/(\d+[.,]?\d*)/);
            if (livingMatch) details.living_area = parseFloat(livingMatch[1].replace(',', '.'));
        }
        
        // Площадь кухни
        if (params['площадь кухни'] || params['кухня']) {
            const kitchenMatch = (params['площадь кухни'] || params['кухня']).match(/(\d+[.,]?\d*)/);
            if (kitchenMatch) details.kitchen_area = parseFloat(kitchenMatch[1].replace(',', '.'));
        }
        
        // Условия аренды
        const conditions = await page.evaluate(() => {
            const conditionsObj = {};
            const conditionItems = document.querySelectorAll('[data-marker="item-conditions/item"]');
            conditionItems.forEach(item => {
                const label = item.querySelector('[data-marker="item-conditions/label"]')?.textContent?.trim() || '';
                const value = item.querySelector('[data-marker="item-conditions/value"]')?.textContent?.trim() || '';
                if (label && value) {
                    conditionsObj[label.toLowerCase()] = value;
                }
            });
            return conditionsObj;
        }).catch(() => ({}));
        
        // Залог
        if (conditions['залог'] || conditions['депозит']) {
            const depositText = (conditions['залог'] || conditions['депозит']).replace(/[^\d]/g, '');
            if (depositText) details.deposit = parseFloat(depositText);
        }
        
        // Комиссия
        if (conditions['комиссия']) {
            const commissionText = conditions['комиссия'].toLowerCase();
            if (commissionText.includes('нет') || commissionText.includes('без')) {
                details.commission = 0;
            } else {
                const commMatch = conditions['комиссия'].match(/(\d+)/);
                if (commMatch) details.commission = parseFloat(commMatch[1]);
            }
        }
        
        // ЖКУ включены
        const utilitiesText = await page.evaluate(() => {
            const text = document.body.textContent || '';
            return text.toLowerCase();
        }).catch(() => '');
        details.utilities_included = utilitiesText.includes('жку включены') || 
                                     utilitiesText.includes('коммунальные включены');
        
        // Срок аренды
        if (conditions['срок аренды'] || conditions['срок']) {
            details.rental_period = conditions['срок аренды'] || conditions['срок'];
        }
        
        // Метро - расстояние и транспорт
        const metroInfo = await page.evaluate(() => {
            const metroEl = document.querySelector('[data-marker="item-address/metro"]');
            if (metroEl) {
                const text = metroEl.textContent || '';
                const distanceMatch = text.match(/(\d+)\s*(мин|минут)/);
                const transportMatch = text.match(/(пешком|транспортом|на машине)/i);
                return {
                    station: text.split(',')[0]?.trim() || '',
                    distance: distanceMatch ? `${distanceMatch[1]} ${distanceMatch[2]}` : null,
                    transport: transportMatch ? transportMatch[1] : 'пешком'
                };
            }
            return { station: '', distance: null, transport: null };
        }).catch(() => ({ station: '', distance: null, transport: null }));
        
        details.metro_distance = metroInfo.distance;
        details.metro_transport = metroInfo.transport;
        
        // Дата публикации
        const publishedEl = await page.$('[data-marker="item-view/item-date"]').catch(() => null);
        if (publishedEl) {
            details.published_date = await publishedEl.textContent().catch(() => '');
        }
        
        // Район
        const districtEl = await page.$('[data-marker="item-address/district"]').catch(() => null);
        if (districtEl) {
            details.district = await districtEl.textContent().catch(() => '');
        }
        
        // Удобства из описания
        const fullText = (details.description || '').toLowerCase();
        details.has_furniture = fullText.includes('мебель') || fullText.includes('меблирован');
        details.has_appliances = fullText.includes('техника') || fullText.includes('холодильник') || 
                                 fullText.includes('стиральная') || fullText.includes('посудомоечная') ||
                                 fullText.includes('микроволнов') || fullText.includes('кондиционер');
        details.has_internet = fullText.includes('интернет') || fullText.includes('wi-fi') || fullText.includes('wifi');
        details.has_parking = fullText.includes('парковк') || fullText.includes('гараж') || fullText.includes('стоянк');
        details.has_elevator = fullText.includes('лифт');
        details.has_balcony = fullText.includes('балкон') || fullText.includes('лоджия') || fullText.includes('терраса');
        
        // Список удобств
        if (details.has_furniture) details.features.push('мебель');
        if (details.has_appliances) details.features.push('техника');
        if (details.has_internet) details.features.push('интернет');
        if (details.has_parking) details.features.push('парковка');
        if (details.has_elevator) details.features.push('лифт');
        if (details.has_balcony) details.features.push('балкон');
        
        return details;
    } catch (e) {
        console.error(`  ⚠️  Ошибка при парсинге детальной страницы ${url}:`, e.message);
        return {
            description: '',
            contact_phone: '',
            contact_name: '',
            photos: [],
            building_year: null,
            building_type: null,
            living_area: null,
            kitchen_area: null,
            deposit: null,
            commission: null,
            utilities_included: false,
            rental_period: null,
            metro_distance: null,
            metro_transport: null,
            published_date: null,
            district: null,
            has_furniture: false,
            has_appliances: false,
            has_internet: false,
            has_parking: false,
            has_elevator: false,
            has_balcony: false,
            features: []
        };
    }
}

async function parseAvito() {
    const { context } = await initBrowser();
    const page = await context.newPage();
    
    try {
        const baseUrl = 'https://www.avito.ru/moskva/kvartiry/sdam/na_dlitelnyy_srok/bez_komissii-ASgBAgICA0SSA8gQ8AeQUp74DgI?context=H4sIAAAAAAAA_wFNALL_YToyOntzOjg6ImZyb21QYWdlIjtzOjEyOiJyZWNlbnRTZWFyY2giO3M6OToiZnJvbV9wYWdlIjtzOjEyOiJyZWNlbnRTZWFyY2giO32YQ9UcTQAAAA';
        
        let allApartments = [];
        const maxPages = 5; // Увеличиваем до 5 страниц 
        
        
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            console.log(`\n📄 === Авито, Страница ${pageNum} ===\n`);
            
            
            let pageUrl = baseUrl;
            if (pageNum > 1) {
                // Правильный формат URL для страниц: добавляем &p= в конец
                pageUrl = `${baseUrl}&p=${pageNum}`;
            }
            
            console.log(`🌐 Открываю URL: ${pageUrl}`);
            await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(3000);
            
            const currentUrl = page.url();
            console.log(`✅ Текущий URL после загрузки: ${currentUrl}`);
        
            
            console.log('Ищу карточки на странице...');
            
            
            let previousCount = 0;
            let items = [];
            const maxScrolls = 5;
            
            for (let scroll = 0; scroll < maxScrolls; scroll++) {
                await page.evaluate(() => {
                    window.scrollBy(0, window.innerHeight * 2);
                });
                await page.waitForTimeout(2000);
                
                
                items = await page.$$('[data-marker="item"]');
                console.log(`После скролла ${scroll + 1}: найдено ${items.length} карточек`);
                
                if (items.length === previousCount && scroll > 1) {
                    console.log('Количество карточек не увеличивается, останавливаю скролл');
                    break;
                }
                previousCount = items.length;
            }
            
            
            items = await page.$$('[data-marker="item"]');
            console.log(`✅ Всего найдено карточек на странице ${pageNum}: ${items.length}`);
            
            if (items.length === 0) {
                console.log(`⚠️  На странице ${pageNum} нет карточек, останавливаю парсинг`);
                break;
            }
        
        const apartments = [];
        const maxItems = Math.min(items.length, 100);
        
        for (let i = 0; i < maxItems; i++) {
            try {
                const item = items[i];
                
                const linkElement = await item.$('a[data-marker="item-title"]').catch(() => null);
                if (!linkElement) {
                    continue;
                }
                
                const href = await linkElement.getAttribute('href').catch(() => '');
                const fullUrl = href.startsWith('http') ? href : `https://www.avito.ru${href}`;
                const externalId = href.match(/\/(\d+)$/)?.[1] || fullUrl.split('/').pop()?.split('?')[0] || '';
                
                if (!externalId) {
                    continue;
                }
                
                
                const title = await item.evaluate(el => {
                    const titleEl = el.querySelector('a[data-marker="item-title"]');
                    return titleEl ? titleEl.textContent.trim() : '';
                }).catch(() => '');
                
                
                const areaMatch = title.match(/(\d+[.,]?\d*)\s*м²/i);
                const area = areaMatch ? parseFloat(areaMatch[1].replace(',', '.')) : null;
                
                let rooms = null;
                if (title.match(/студия/i)) {
                    rooms = 0;
                } else {
                    const roomsMatch = title.match(/(\d+)\s*-?\s*к\./i) || title.match(/(\d+)\s*-?\s*комнат/i);
                    if (roomsMatch) rooms = parseInt(roomsMatch[1]);
                }
                
                const floorMatch = title.match(/(\d+)\/(\d+)\s*эт/i);
                const floor = floorMatch ? parseInt(floorMatch[1]) : null;
                const totalFloors = floorMatch ? parseInt(floorMatch[2]) : null;
                
                
                const price = await item.evaluate(el => {
                    // Метод 1: Из meta itemprop="price"
                    const priceMeta = el.querySelector('meta[itemprop="price"]');
                    if (priceMeta) {
                        const priceValue = priceMeta.getAttribute('content');
                        if (priceValue) return parseFloat(priceValue);
                    }
                    
                    // Метод 2: Из data-marker="item-price"
                    const priceEl = el.querySelector('[data-marker="item-price"]');
                    if (priceEl) {
                        // Сначала проверяем meta внутри priceEl
                        const metaPrice = priceEl.querySelector('meta[itemprop="price"]');
                        if (metaPrice) {
                            const metaValue = metaPrice.getAttribute('content');
                            if (metaValue) return parseFloat(metaValue);
                        }
                        
                        // Затем из текста
                        const text = priceEl.textContent.trim();
                        const match = text.match(/(\d+[\s\u00A0]*\d*)/);
                        if (match) {
                            return parseFloat(match[1].replace(/[\s\u00A0]/g, ''));
                        }
                    }
                    return 0;
                }).catch(() => 0);
                
                
                const metro = await item.evaluate(el => {
                    const addressEl = el.querySelector('[data-marker="item-address"]');
                    if (addressEl) {
                        // Ищем метро в структуре geo-root
                        const geoRoot = addressEl.querySelector('[data-marker="item-location"]');
                        if (geoRoot) {
                            // Ищем название станции метро (обычно в span после иконки)
                            const metroSpans = geoRoot.querySelectorAll('span');
                            for (const span of metroSpans) {
                                const text = span.textContent.trim();
                                // Пропускаем пустые, иконки и время
                                if (text && !text.includes('мин.') && !text.includes('ул.') && 
                                    !text.includes('пр.') && text.length > 2 && 
                                    !text.match(/^\d+[А-Яа-я]/)) {
                                    // Проверяем, что это похоже на название станции
                                    if (text.match(/^[А-ЯЁ][а-яё]+/)) {
                                        return text;
                                    }
                                }
                            }
                        }
                        
                        // Альтернативный метод: ищем в тексте
                        const text = addressEl.textContent;
                        const lines = text.split('\n');
                        for (const line of lines) {
                            if (line.includes('мин.') || line.match(/^[А-ЯЁ][а-яё]+/)) {
                                const metroMatch = line.match(/([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*)/);
                                if (metroMatch && !line.includes('ул.') && !line.includes('пр.') && 
                                    !line.includes('мин.')) {
                                    return metroMatch[1].trim();
                                }
                            }
                        }
                    }
                    return '';
                }).catch(() => '');
                
                
                const address = await item.evaluate(el => {
                    const addressEl = el.querySelector('[data-marker="item-address"]');
                    if (addressEl) {
                        const geoRoot = addressEl.querySelector('[data-marker="item-location"]');
                        if (geoRoot) {
                            const streetLink = geoRoot.querySelector('a[data-marker="street_link"]');
                            const houseLink = geoRoot.querySelector('a[data-marker="house_link"]');
                            const parts = [];
                            if (streetLink) parts.push(streetLink.textContent.trim());
                            if (houseLink) parts.push(houseLink.textContent.trim());
                            return parts.join(', ');
                        }
                        
                        // Альтернативный метод
                        const streetLink = addressEl.querySelector('a[data-marker="street_link"]');
                        const houseLink = addressEl.querySelector('a[data-marker="house_link"]');
                        const parts = [];
                        if (streetLink) parts.push(streetLink.textContent.trim());
                        if (houseLink) parts.push(houseLink.textContent.trim());
                        return parts.join(', ');
                    }
                    return '';
                }).catch(() => '');
                
                
                const description = await item.evaluate(el => {
                    // Ищем описание в разных местах
                    let descText = '';
                    
                    // Метод 1: data-marker="item-line" (описание внизу карточки)
                    const descEl = el.querySelector('[data-marker="item-line"]') ||
                                 el.querySelector('p[data-marker="item-line"]');
                    if (descEl) {
                        descText = descEl.textContent.trim();
                    }
                    
                    // Метод 2: meta itemprop="description"
                    if (!descText) {
                        const metaDesc = el.querySelector('meta[itemprop="description"]');
                        if (metaDesc) {
                            descText = metaDesc.getAttribute('content') || '';
                        }
                    }
                    
                    // Метод 3: Ищем в тексте параграфов
                    if (!descText) {
                        const paragraphs = el.querySelectorAll('p');
                        for (const p of paragraphs) {
                            const text = p.textContent.trim();
                            if (text.length > 50 && !text.includes('₽') && !text.includes('м²')) {
                                descText = text;
                                break;
                            }
                        }
                    }
                    
                    return descText;
                }).catch(() => '');
                
                
                // Получаем базовые фото со списка - используем правильные селекторы
                let photos = await item.evaluate(el => {
                    const photoUrls = [];
                    
                    // Метод 1: Из data-marker="slider-image/image-..."
                    const sliderItems = el.querySelectorAll('[data-marker^="slider-image/image-"]');
                    sliderItems.forEach(item => {
                        const dataMarker = item.getAttribute('data-marker');
                        if (dataMarker) {
                            // Извлекаем URL из data-marker: slider-image/image-https://...
                            const urlMatch = dataMarker.match(/image-(https?:\/\/[^\s]+)/);
                            if (urlMatch) {
                                let url = urlMatch[1];
                                // Убираем параметры для получения оригинального размера
                                url = url.split('?')[0];
                                if (!photoUrls.includes(url)) {
                                    photoUrls.push(url);
                                }
                            }
                        }
                    });
                    
                    // Метод 2: Из img.photo-slider-image-cD891
                    const imgs = el.querySelectorAll('img.photo-slider-image-cD891');
                    imgs.forEach(img => {
                        let src = img.getAttribute('src') || img.getAttribute('data-src');
                        if (src) {
                            // Убираем параметры и получаем оригинальный размер
                            src = src.split('?')[0];
                            // Убираем размеры из URL (например, /208w, /236w и т.д.)
                            src = src.replace(/\/\d+w$/, '');
                            if (src.includes('img.avito.st') || src.startsWith('http')) {
                                const fullSrc = src.startsWith('//') ? `https:${src}` :
                                              src.startsWith('http') ? src : `https:${src}`;
                                if (!photoUrls.includes(fullSrc)) {
                                    photoUrls.push(fullSrc);
                                }
                            }
                        }
                    });
                    
                    return photoUrls.slice(0, 10); // Базовые фото со списка
                }).catch(() => []);
                
                // Парсим детальную страницу для получения расширенной информации
                console.log(`  📋 Парсинг детальной страницы для ID=${externalId}...`);
                const details = await getAvitoApartmentDetails(page, fullUrl);
                
                // Парсим дополнительные данные со списка, если их нет в детальной странице
                // Расстояние до метро и транспорт
                if (!details.metro_distance) {
                    const metroDistanceText = await item.evaluate(el => {
                        const addressEl = el.querySelector('[data-marker="item-address"]');
                        if (addressEl) {
                            const geoRoot = addressEl.querySelector('[data-marker="item-location"]');
                            if (geoRoot) {
                                const text = geoRoot.textContent || '';
                                const distanceMatch = text.match(/(\d+[–-]\d+|\d+)\s*(мин|минут)/);
                                if (distanceMatch) {
                                    return distanceMatch[0];
                                }
                            }
                        }
                        return null;
                    }).catch(() => null);
                    if (metroDistanceText) {
                        details.metro_distance = metroDistanceText;
                    }
                }
                
                // Условия аренды со списка (Без залога, Без комиссии, ЖКУ)
                const conditionsText = await item.evaluate(el => {
                    const paramsEl = el.querySelector('[data-marker="item-specific-params"]');
                    return paramsEl ? paramsEl.textContent.trim() : '';
                }).catch(() => '');
                
                if (conditionsText) {
                    const condLower = conditionsText.toLowerCase();
                    // Залог
                    if (condLower.includes('без залога') || condLower.includes('залог')) {
                        if (!details.deposit && !condLower.includes('без залога')) {
                            const depositMatch = conditionsText.match(/залог[:\s]+(\d+[\s\u00A0]*\d*)/i);
                            if (depositMatch) {
                                details.deposit = parseFloat(depositMatch[1].replace(/[\s\u00A0]/g, ''));
                            }
                        }
                    }
                    // Комиссия
                    if (condLower.includes('без комиссии')) {
                        details.commission = 0;
                    }
                    // ЖКУ
                    if (condLower.includes('жку')) {
                        const utilitiesMatch = conditionsText.match(/жку[:\s]+(\d+[\s\u00A0]*\d*)/i);
                        if (utilitiesMatch) {
                            details.utilities_included = false; // Указана сумма, значит не включены
                        } else if (condLower.includes('жку включены')) {
                            details.utilities_included = true;
                        }
                    }
                }
                
                // Дата публикации
                if (!details.published_date) {
                    const dateText = await item.evaluate(el => {
                        const dateEl = el.querySelector('[data-marker="item-date"]');
                        return dateEl ? dateEl.textContent.trim() : '';
                    }).catch(() => '');
                    if (dateText) {
                        details.published_date = dateText;
                    }
                }
                
                // Объединяем фото: сначала с детальной страницы, потом со списка
                if (details.photos && details.photos.length > 0) {
                    photos = [...details.photos, ...photos.filter(p => !details.photos.includes(p))].slice(0, 20);
                }
                
                
                // Используем данные с детальной страницы, если они есть
                const finalDescription = details.description || description;
                const descText = (finalDescription || '').toLowerCase();
                
                // Объединяем данные со списка и детальной страницы
                apartments.push({
                    external_id: externalId,
                    url: fullUrl,
                    price: price,
                    area: area,
                    rooms: rooms,
                    floor: floor,
                    total_floors: details.total_floors || totalFloors,
                    district: details.district || '',
                    metro_station: metro || details.metro_station || '',
                    metro_distance: details.metro_distance || null,
                    metro_transport: details.metro_transport || null,
                    address: address,
                    title: title || `${area ? area + ' м²' : ''} ${rooms !== null ? rooms + '-комн.' : 'квартира'}`,
                    description: finalDescription,
                    photos: photos,
                    contact_phone: details.contact_phone || '',
                    contact_name: details.contact_name || '',
                    is_owner: details.is_owner !== undefined ? details.is_owner : true,
                    no_commission: true,
                    building_year: details.building_year || null,
                    building_type: details.building_type || null,
                    living_area: details.living_area || null,
                    kitchen_area: details.kitchen_area || null,
                    deposit: details.deposit || null,
                    commission: details.commission || null,
                    utilities_included: details.utilities_included || false,
                    rental_period: details.rental_period || null,
                    published_date: details.published_date || null,
                    has_furniture: details.has_furniture || false,
                    has_appliances: details.has_appliances || false,
                    has_internet: details.has_internet || false,
                    has_parking: details.has_parking || false,
                    has_elevator: details.has_elevator || false,
                    has_balcony: details.has_balcony || false,
                    features: details.features || [],
                });
                
                console.log(`  ✅ ID=${externalId}, Цена=${price}₽, Площадь=${area}м², Комнаты=${rooms}, Этаж=${floor}/${totalFloors}`);
                
                if ((i + 1) % 10 === 0 || (i + 1) === maxItems) {
                    console.log(`✅ Обработано ${i + 1}/${maxItems} карточек со страницы ${pageNum}`);
                }
                
                await page.waitForTimeout(200);
            } catch (err) {
                console.error(`Error parsing item ${i}:`, err.message);
            }
        }
        
            console.log(`✅ Обработано ${apartments.length} квартир со страницы ${pageNum}`);
            allApartments = allApartments.concat(apartments);
            
            if (pageNum < maxPages) {
                console.log(`⏳ Пауза перед переходом на страницу ${pageNum + 1}...`);
                await page.waitForTimeout(2000);
            }
        }
        
        
        const uniqueApartments = [];
        const seenIds = new Set();
        for (const apt of allApartments) {
            if (!seenIds.has(apt.external_id)) {
                seenIds.add(apt.external_id);
                uniqueApartments.push(apt);
            }
        }
        
        console.log(`\n📊 Статистика парсинга Авито:`);
        console.log(`   Всего найдено: ${allApartments.length}`);
        console.log(`   Уникальных: ${uniqueApartments.length}`);
        
        console.log(`\n✅ Всего успешно спарсено ${uniqueApartments.length} уникальных квартир с Авито`);
        return uniqueApartments;
    } catch (error) {
        console.error('Error in parseAvito:', error);
        throw error;
    } finally {
        await page.close();
    }
}

async function parseYandex() {
    const { context } = await initBrowser();
    const page = await context.newPage();
    
    try {
        const baseUrl = 'https://realty.yandex.ru/moskva/snyat/kvartira/bez-komissii/';
        
        let allApartments = [];
        const maxPages = 3; 
        
        
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            console.log(`\n📄 === Яндекс.Недвижимость, Страница ${pageNum} ===\n`);
            
            
            let pageUrl = baseUrl;
            if (pageNum > 1) {
                pageUrl = `${baseUrl}?page=${pageNum}`;
            }
            
            console.log(`🌐 Открываю URL: ${pageUrl}`);
            await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60000 });
            await page.waitForTimeout(3000);
            
            const currentUrl = page.url();
            console.log(`✅ Текущий URL после загрузки: ${currentUrl}`);
            
            
            console.log('Ищу карточки на странице...');
            
            
            let previousCount = 0;
            let cards = [];
            const maxScrolls = 5;
            
            for (let scroll = 0; scroll < maxScrolls; scroll++) {
                await page.evaluate(() => {
                    window.scrollBy(0, window.innerHeight * 2);
                });
        await page.waitForTimeout(2000);
        
                
                cards = await page.$$('div.OffersSerp > ol > li');
                console.log(`После скролла ${scroll + 1}: найдено ${cards.length} карточек`);
                
                if (cards.length === previousCount && scroll > 1) {
                    console.log('Количество карточек не увеличивается, останавливаю скролл');
                    break;
                }
                previousCount = cards.length;
            }
            
            
            cards = await page.$$('div.OffersSerp > ol > li');
            console.log(`✅ Всего найдено карточек на странице ${pageNum}: ${cards.length}`);
            
            if (cards.length === 0) {
                console.log(`⚠️  На странице ${pageNum} нет карточек, останавливаю парсинг`);
                break;
            }
        
        const apartments = [];
            const maxCards = Math.min(cards.length, 50);
        
        for (let i = 0; i < maxCards; i++) {
            try {
                const card = cards[i];
                
                console.log(`📋 Обрабатываю карточку ${i + 1}/${maxCards} со страницы ${pageNum}`);
                
                
                const linkElement = await card.$('a.OffersSerpItem__link').catch(() => null) ||
                                  await card.$('a[href*="/offer/"]').catch(() => null);
                if (!linkElement) {
                    console.log(`⚠️  Пропускаю карточку ${i + 1}: нет ссылки`);
                    continue;
                }
                
                const href = await linkElement.getAttribute('href').catch(() => '');
                const fullUrl = href.startsWith('http') ? href : `https://realty.yandex.ru${href}`;
                
                const externalId = href.match(/\/offer\/(\d+)/)?.[1] || '';
                
                if (!externalId) {
                    console.log(`⚠️  Пропускаю карточку ${i + 1}: нет external ID из URL ${href}`);
                    continue;
                }
                
                
                const title = await card.evaluate(el => {
                    
                    const infoEl = el.querySelector('div.OffersSerpItem__generalInfo > div.OffersSerpItem__generalInfoInnerContainer > a > span > span');
                    return infoEl ? infoEl.textContent.trim() : '';
                }).catch(() => '');
                
                console.log(`  Основная информация: ${title.substring(0, 80)}`);
                
                
                const areaMatch = title.match(/(\d+[.,]?\d*)\s*м²/i);
                const area = areaMatch ? parseFloat(areaMatch[1].replace(',', '.')) : null;
                
                let rooms = null;
                if (title.match(/студия/i)) {
                    rooms = 0;
                } else {
                    
                    const roomsMatch = title.match(/(\d+)\s*-?\s*комнат/i) || 
                                     title.match(/(\d+)\s*-?\s*к\./i) ||
                                     title.match(/(\d+)\s*-?\s*комн/i);
                    if (roomsMatch) rooms = parseInt(roomsMatch[1]);
                }
                
                const floorMatch = title.match(/(\d+)\s*этаж\s*из\s*(\d+)/i);
                const floor = floorMatch ? parseInt(floorMatch[1]) : null;
                const totalFloors = floorMatch ? parseInt(floorMatch[2]) : null;
                
                
                const priceText = await card.evaluate(el => {
                    
                    const priceContainer = el.querySelector('div.OffersSerpItem__price.PriceWithDiscount__container--QehfS');
                    if (priceContainer) {
                        
                        const priceDiv = priceContainer.querySelector('div > div > div > div');
                        if (priceDiv) {
                            
                            const spans = priceDiv.querySelectorAll('span');
                            if (spans.length > 0) {
                                const firstSpan = spans[0];
                                const text = firstSpan.textContent.trim();
                                
                                const cleanText = text.replace(/[\s\u00A0\u2009]/g, '');
                                if (cleanText && /^\d+$/.test(cleanText)) {
                                    return cleanText;
                                }
                            }
                        }
                        
                        const allSpans = priceContainer.querySelectorAll('span');
                        for (const span of allSpans) {
                            const text = span.textContent.trim();
                            const cleanText = text.replace(/[\s\u00A0\u2009]/g, '');
                            
                            if (cleanText && /^\d+$/.test(cleanText) && cleanText.length >= 4) {
                                return cleanText;
                            }
                        }
                    }
                    return '';
                }).catch(() => '');
                
                console.log(`  Цена (текст): "${priceText}"`);
                
                const price = priceText ? parseFloat(priceText) : 0;
                if ((i + 1) % 10 === 0 || (i + 1) === maxCards) {
                    console.log(`✅ Обработано ${i + 1}/${maxCards} карточек со страницы ${pageNum}`);
                }
                
                
                const metro = await card.evaluate(el => {
                    const metroEl = el.querySelector('span.MetroStation__title') ||
                                  el.querySelector('a[data-test="LinkedMetroWithTimeLink"] span');
                    return metroEl ? metroEl.textContent.trim() : '';
                }).catch(() => '');
                
                
                const address = await card.evaluate(el => {
                    const addressEl = el.querySelector('div.AddressWithGeoLinks__addressContainer--4jzfZ');
                    if (addressEl) {
                        const parts = [];
                        const link = addressEl.querySelector('a');
                        const text = addressEl.textContent.trim();
                        return text || '';
                    }
                    return '';
                }).catch(() => '');
                
                
                const description = await card.evaluate(el => {
                    const descEl = el.querySelector('p.OffersSerpItem__description');
                    return descEl ? descEl.textContent.trim() : '';
                }).catch(() => '');
                
                
                const photos = await card.evaluate(el => {
                    const imgs = el.querySelectorAll('img.Gallery__activeImg, img.Gallery__item, img.OffersSerpItem__images-bottom-img');
                    const photoUrls = [];
                    imgs.forEach(img => {
                        const src = img.getAttribute('src') || img.getAttribute('data-src');
                        if (src && (src.includes('avatars.mds.yandex.net') || src.includes('get-realty'))) {
                            const fullSrc = src.startsWith('//') ? `https:${src}` :
                                          src.startsWith('http') ? src : `https:${src}`;
                            if (!photoUrls.includes(fullSrc)) {
                                photoUrls.push(fullSrc);
                            }
                        }
                    });
                    return photoUrls.slice(0, 10);
                }).catch(() => []);
                
                
                const descText = (description || '').toLowerCase();
                const hasFurniture = descText.includes('мебель') || descText.includes('меблирован');
                const hasAppliances = descText.includes('техника') || descText.includes('холодильник') || 
                                     descText.includes('стиральная') || descText.includes('телевизор') ||
                                     descText.includes('микроволновка') || descText.includes('бойлер');
                const hasInternet = descText.includes('интернет') || descText.includes('wi-fi');
                const hasParking = descText.includes('парковк') || descText.includes('гараж');
                const hasElevator = descText.includes('лифт');
                const hasBalcony = descText.includes('балкон') || descText.includes('лоджия');
                
                
                let buildingType = null;
                if (descText.includes('кирпич')) buildingType = 'кирпич';
                else if (descText.includes('панель')) buildingType = 'панель';
                else if (descText.includes('монолит')) buildingType = 'монолит';
                else if (descText.includes('блочн')) buildingType = 'блочный';
                
                const features = [];
                if (hasFurniture) features.push('мебель');
                if (hasAppliances) features.push('техника');
                if (hasInternet) features.push('интернет');
                if (hasParking) features.push('парковка');
                if (hasElevator) features.push('лифт');
                if (hasBalcony) features.push('балкон');
                
                apartments.push({
                    external_id: externalId,
                    url: fullUrl,
                    price: price,
                    area: area,
                    rooms: rooms,
                    floor: floor,
                    total_floors: totalFloors,
                    metro_station: metro,
                    address: address,
                    title: title || `${area ? area + ' м²' : ''} ${rooms !== null ? rooms + '-комн.' : 'квартира'}`,
                    description: description,
                    photos: photos,
                    is_owner: true,
                    no_commission: true,
                    building_type: buildingType,
                    has_furniture: hasFurniture,
                    has_appliances: hasAppliances,
                    has_internet: hasInternet,
                    has_parking: hasParking,
                    has_elevator: hasElevator,
                    has_balcony: hasBalcony,
                    features: features,
                });
                
                if ((i + 1) % 10 === 0 || (i + 1) === maxCards) {
                    console.log(`✅ Обработано ${i + 1}/${maxCards} карточек со страницы ${pageNum}`);
                }
                
                await page.waitForTimeout(200);
            } catch (err) {
                console.error(`Error parsing card ${i}:`, err.message);
            }
        }
        
            console.log(`✅ Обработано ${apartments.length} квартир со страницы ${pageNum}`);
            allApartments = allApartments.concat(apartments);
            
            if (pageNum < maxPages) {
                console.log(`⏳ Пауза перед переходом на страницу ${pageNum + 1}...`);
                await page.waitForTimeout(2000);
            }
        }
        
        
        const uniqueApartments = [];
        const seenIds = new Set();
        for (const apt of allApartments) {
            if (!seenIds.has(apt.external_id)) {
                seenIds.add(apt.external_id);
                uniqueApartments.push(apt);
            }
        }
        
        console.log(`\n📊 Статистика парсинга Яндекс.Недвижимости:`);
        console.log(`   Всего найдено: ${allApartments.length}`);
        console.log(`   Уникальных: ${uniqueApartments.length}`);
        
        console.log(`\n✅ Всего успешно спарсено ${uniqueApartments.length} уникальных квартир с Яндекс.Недвижимости`);
        return uniqueApartments;
    } catch (error) {
        console.error('Error in parseYandex:', error);
        throw error;
    } finally {
        await page.close();
    }
}

async function parseWithRetry(parseFunction, source, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Attempt ${attempt}/${retries} to parse ${source}`);
            const result = await parseFunction();
            return result;
        } catch (error) {
            console.error(`Attempt ${attempt} failed for ${source}:`, error.message);
            if (attempt === retries) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS * attempt));
        }
    }
}

app.post('/parse/:source', async (req, res) => {
    const { source } = req.params;
    const startTime = Date.now();
    
    try {
        let apartments = [];
        let parseFunction;
        
        switch (source) {
            case 'cian':
                parseFunction = () => parseCian();
                break;
            case 'avito':
                parseFunction = () => parseAvito();
                break;
            case 'yandex':
                parseFunction = () => parseYandex();
                break;
            default:
                return res.status(400).json({ error: 'Invalid source. Use: cian, avito, yandex' });
        }
        
        apartments = await parseWithRetry(parseFunction, source);
        
        console.log(`Sending ${apartments.length} apartments to Django...`);
        const response = await axios.post(
            `${DJANGO_API_URL}/parser/update-apartments/`,
            { source, apartments },
            { 
                timeout: 60000,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        ).catch((err) => {
            console.error('Error sending to Django:', err.message);
            return null;
        });
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const result = {
            found: apartments.length,
            new: response?.data?.new || 0,
            updated: response?.data?.updated || 0,
            duration: `${duration}s`
        };
        
        console.log(`Parse completed for ${source}:`, result);
        res.json(result);
    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(`Parse error for ${source} after ${duration}s:`, error);
        res.status(500).json({ 
            error: error.message,
            duration: `${duration}s`
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        browser: browser ? 'connected' : 'not initialized',
        timestamp: new Date().toISOString()
    });
});

app.get('/stats', async (req, res) => {
    try {
        const response = await axios.get(`${DJANGO_API_URL}/apartments/stats/`).catch(() => null);
        res.json(response?.data || { error: 'Cannot fetch stats' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    if (browserContext) {
        await browserContext.close();
    }
    if (browser) {
        await browser.close();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Shutting down...');
    if (browserContext) {
        await browserContext.close();
    }
    if (browser) {
        await browser.close();
    }
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Parser service running on port ${PORT}`);
    console.log(`Django API: ${DJANGO_API_URL}`);
});
