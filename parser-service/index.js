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

async function parseAvito() {
    const { context } = await initBrowser();
    const page = await context.newPage();
    
    try {
        const baseUrl = 'https://www.avito.ru/moskva/kvartiry/sdam/na_dlitelnyy_srok/bez_komissii-ASgBAgICA0SSA8gQ8AeQUp74DgI';
        
        let allApartments = [];
        const maxPages = 3; 
        
        
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            console.log(`\n📄 === Авито, Страница ${pageNum} ===\n`);
            
            
            let pageUrl = baseUrl;
            if (pageNum > 1) {
                pageUrl = `${baseUrl}?p=${pageNum}`;
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
                    
                    const priceMeta = el.querySelector('meta[itemprop="price"]');
                    if (priceMeta) {
                        const priceValue = priceMeta.getAttribute('content');
                        if (priceValue) return parseFloat(priceValue);
                    }
                    
                    const priceEl = el.querySelector('[data-marker="item-price"]');
                    if (priceEl) {
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
                        
                        const text = addressEl.textContent;
                        
                        const lines = text.split('\n');
                        for (const line of lines) {
                            if (line.includes('мин.') || line.match(/^[А-ЯЁ][а-яё]+/)) {
                                const metroMatch = line.match(/([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*)/);
                                if (metroMatch && !line.includes('ул.') && !line.includes('пр.')) {
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
                    const descEl = el.querySelector('[data-marker="item-description"]') ||
                                 el.querySelector('p[style*="max-lines"]');
                    return descEl ? descEl.textContent.trim() : '';
                }).catch(() => '');
                
                
                const photos = await item.evaluate(el => {
                    const imgs = el.querySelectorAll('img.photo-slider-image-cD891, img[alt*="квартира"]');
                    const photoUrls = [];
                    imgs.forEach(img => {
                        const src = img.getAttribute('src') || img.getAttribute('data-src');
                        if (src && (src.includes('img.avito.st') || src.startsWith('http'))) {
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
                                     descText.includes('стиральная') || descText.includes('посудомоечная') ||
                                     descText.includes('микроволнов') || descText.includes('кондиционер');
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
