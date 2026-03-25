const axios = require('axios');
const cheerio = require('cheerio');

const url = process.argv[2] || 'https://www.cian.ru/rent/flat/307566249/';

const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9',
    'Cache-Control': 'max-age=0',
};

async function test() {
    try {
        console.log('Fetching:', url);
        const resp = await axios.get(url, { headers, timeout: 15000, maxRedirects: 5 });
        const html = resp.data;
        console.log('HTML length:', html.length);
        console.log('Status:', resp.status);

        if (html.includes('captcha') || html.includes('Captcha')) {
            console.log('!!! CAPTCHA DETECTED !!!');
        }

        const $ = cheerio.load(html);

        // JSON-LD
        const jsonLdScripts = $('script[type="application/ld+json"]');
        console.log('\nJSON-LD scripts:', jsonLdScripts.length);
        jsonLdScripts.each((i, el) => {
            try {
                const data = JSON.parse($(el).html());
                console.log(`  [${i}] @type=${data['@type']}`);
                console.log('   ', JSON.stringify(data).substring(0, 300));
            } catch(e) { console.log('  parse error:', e.message); }
        });

        // __initialState
        const stateMatch = html.match(/window\.__initial(?:State|Data)__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
        console.log('\n__initialState found:', !!stateMatch);
        if (stateMatch) {
            try {
                const state = JSON.parse(stateMatch[1]);
                const offer = state.offerData?.offer || state.offer || {};
                console.log('  price:', offer.bargainTerms?.priceRur || offer.bargainTerms?.price);
                console.log('  totalArea:', offer.totalArea);
                console.log('  rooms:', offer.roomsCount);
                console.log('  floor:', offer.floorNumber);
                console.log('  floors:', offer.building?.floorsCount);
                console.log('  address:', JSON.stringify(offer.geo?.address)?.substring(0, 200));
                console.log('  metro:', offer.geo?.undergrounds?.[0]?.name);
                console.log('  jk:', offer.newbuilding?.name || offer.jk?.name);
            } catch(e) { console.log('  state parse error:', e.message); }
        }

        // H1
        console.log('\nH1:', $('h1').first().text().trim().substring(0, 150));

        // Title
        console.log('Page title:', $('title').text().substring(0, 150));

        // Price
        console.log('Price [data-testid]:', $('[data-testid="price-amount"]').text().substring(0, 50));
        console.log('Price [class*=price]:', $('[class*="price_value"]').first().text().substring(0, 50));

        // First 300 chars
        console.log('\nFirst 300 chars of HTML:', html.substring(0, 300));

    } catch(e) {
        console.log('ERROR:', e.message);
        if (e.response) {
            console.log('Status:', e.response.status);
            console.log('Response headers:', JSON.stringify(e.response.headers).substring(0, 500));
            console.log('Body preview:', String(e.response.data).substring(0, 300));
        }
    }
}
test();
