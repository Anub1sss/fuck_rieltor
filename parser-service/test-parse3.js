const axios = require('axios');
const cheerio = require('cheerio');

const url = process.argv[2] || 'https://www.cian.ru/sale/flat/327121629/';

const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9',
};

async function test() {
    try {
        const resp = await axios.get(url, { headers, timeout: 15000 });
        const html = resp.data;
        const $ = cheerio.load(html);

        console.log('=== OG META (most reliable) ===');
        const ogData = {};
        $('meta[property^="og:"]').each((i, el) => {
            ogData[$(el).attr('property')] = $(el).attr('content');
        });
        console.log(JSON.stringify(ogData, null, 2));

        console.log('\n=== JSON-LD ===');
        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                const data = JSON.parse($(el).html());
                console.log(JSON.stringify(data, null, 2).substring(0, 1000));
            } catch(e) {}
        });

        console.log('\n=== H1 + Price ===');
        console.log('H1:', $('h1').first().text().trim());
        console.log('Price:', $('[data-testid="price-amount"]').text().trim());
        console.log('Price per m2:', $('[data-testid="price-per-meter"]').text().trim());

        console.log('\n=== ALL text with numbers and units ===');
        // Look for key apartment data in any element
        const allText = $('body').text();
        
        // Extract floor info from og:title
        const ogTitle = ogData['og:title'] || '';
        console.log('OG title:', ogTitle);
        const floorMatch = ogTitle.match(/этаж\s*(\d+)(?:\/(\d+))?/i);
        if (floorMatch) console.log('Floor from og:', floorMatch[1], '/', floorMatch[2]);

        // Area from og:title
        const areaMatch = ogTitle.match(/([\d,.]+)\s*м/);
        if (areaMatch) console.log('Area from og:', areaMatch[1]);

        // Price from og:title
        const priceMatch = ogTitle.match(/за\s*([\d\s]+)\s*руб/);
        if (priceMatch) console.log('Price from og:', priceMatch[1].replace(/\s/g, ''));

        // RC name from og:title
        const rcMatch = ogTitle.match(/(?:в|квартира\s+в)\s+(.+?)\s+за/i);
        if (rcMatch) console.log('RC from og:', rcMatch[1]);

        // Address from og:description
        console.log('Address from og:description:', ogData['og:description']);

        console.log('\n=== Geo/Metro elements ===');
        $('a[href*="metro"]').each((i, el) => {
            if (i < 5) console.log(`  metro link[${i}]:`, $(el).text().trim().substring(0, 80));
        });

        // data-name attributes (Cian uses these extensively)
        console.log('\n=== data-name elements ===');
        const dataNames = new Set();
        $('[data-name]').each((i, el) => {
            dataNames.add($(el).attr('data-name'));
        });
        console.log('Unique data-names:', [...dataNames].sort().join(', '));

        // Look for specific data-name elements
        ['ObjectSummaryDescription', 'BtiHouseData', 'OfferFactoids', 'GeneralInformation', 'OfferTitle', 'Geo', 'SpecialGeo', 'Parent', 'NewbuildingInfo'].forEach(name => {
            const el = $(`[data-name="${name}"]`);
            if (el.length) {
                console.log(`\n  [data-name="${name}"]:`);
                el.find('li, div > span, a').each((j, child) => {
                    const t = $(child).text().trim();
                    if (t.length > 1 && t.length < 120 && j < 15) console.log(`    [${j}]:`, t);
                });
            }
        });

        // Look for factoids/features section
        console.log('\n=== OfferSummaryInfoGroup ===');
        $('[data-testid="object-summary-description-info"] li, [data-testid="object-summary-description-value"]').each((i, el) => {
            console.log(`  [${i}]:`, $(el).text().trim());
        });

        // Building info section
        console.log('\n=== Building/House data ===');
        $('[data-testid*="house"], [data-testid*="building"]').each((i, el) => {
            console.log(`  [${i}]:`, $(el).text().trim().substring(0, 100));
        });

        // data-testid elements
        console.log('\n=== All data-testid elements (sample) ===');
        const testIds = new Set();
        $('[data-testid]').each((i, el) => { testIds.add($(el).attr('data-testid')); });
        console.log([...testIds].sort().join('\n'));

    } catch(e) {
        console.log('ERROR:', e.message);
    }
}
test();
