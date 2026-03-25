const axios = require('axios');
const cheerio = require('cheerio');

const url = process.argv[2] || 'https://www.cian.ru/rent/flat/307566249/';

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

        // Find all window.__ assignments
        const matches = html.match(/window\.(__\w+__)\s*=/g);
        console.log('window.__ assignments found:', matches);

        // Try broader regex for initial state
        const patterns = [
            /window\._cianConfig\[["']offer-card["']\]\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
            /window\.__cian_offer__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
            /window\._cianConfig\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
        ];
        for (const p of patterns) {
            const m = html.match(p);
            if (m) {
                console.log('Found pattern:', p.source.substring(0, 50));
                console.log('Value preview:', m[1].substring(0, 300));
            }
        }

        // Look at all <script> tags that contain offer-related data
        $('script').each((i, el) => {
            const text = $(el).html() || '';
            if (text.includes('offerData') || text.includes('offer_id') || text.includes('floorNumber') || text.includes('totalArea') || text.includes('bargainTerms')) {
                console.log(`\n=== Script #${i} contains offer data ===`);
                console.log(text.substring(0, 500));
                console.log('...');
            }
        });

        // Also check data attributes on body or main divs
        console.log('\n=== Checking data-offer attributes ===');
        $('[data-offer], [data-offer-id]').each((i, el) => {
            console.log('Found data-offer:', $(el).attr('data-offer')?.substring(0, 200));
        });

        // Check for meta og: tags
        console.log('\n=== OG Meta ===');
        $('meta[property^="og:"]').each((i, el) => {
            console.log(`${$(el).attr('property')}: ${$(el).attr('content')?.substring(0, 100)}`);
        });

        // Parse what we CAN get from HTML
        console.log('\n=== Direct HTML parsing ===');
        console.log('H1:', $('h1').first().text().trim());
        console.log('Price:', $('[data-testid="price-amount"]').text().trim());

        // Address from breadcrumbs or geo
        const geoSpans = $('[data-name="Geo"] span, [class*="geo"] span, [class*="address"] span');
        console.log('Geo spans count:', geoSpans.length);
        geoSpans.each((i, el) => {
            if (i < 5) console.log(`  Geo[${i}]:`, $(el).text().trim().substring(0, 80));
        });

        // Info items (area, rooms etc)
        $('[data-testid="object-summary-description-info"] li').each((i, el) => {
            console.log(`  Info[${i}]:`, $(el).text().trim());
        });

        // data-name="ObjectSummaryDescription"
        $('[data-name="ObjectSummaryDescription"] li, [data-name="ObjectSummaryDescription"] div').each((i, el) => {
            const t = $(el).text().trim();
            if (t.length > 2 && t.length < 100) console.log(`  OSD[${i}]:`, t);
        });

        // BtiHouseData
        $('[data-name="BtiHouseData"] li, [data-name="OfferFactoids"] li').each((i, el) => {
            console.log(`  BTI[${i}]:`, $(el).text().trim());
        });

        // Metro
        $('a[data-name="SpecialGeo"], [class*="metro"], [class*="underground"]').each((i, el) => {
            if (i < 3) console.log(`  Metro[${i}]:`, $(el).text().trim().substring(0, 80));
        });

    } catch(e) {
        console.log('ERROR:', e.message);
    }
}
test();
