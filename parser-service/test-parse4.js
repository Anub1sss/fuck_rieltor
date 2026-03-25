const axios = require('axios');
const cheerio = require('cheerio');

const url = process.argv[2] || 'https://www.cian.ru/sale/flat/327121629/';

const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9',
};

async function test() {
    const resp = await axios.get(url, { headers, timeout: 15000 });
    const html = resp.data;
    const $ = cheerio.load(html);

    console.log('=== ObjectFactoids ===');
    $('[data-name="ObjectFactoidsItem"]').each((i, el) => {
        console.log(`  [${i}]:`, $(el).text().trim().replace(/\s+/g, ' '));
    });

    console.log('\n=== OfferSummaryInfoItem ===');
    $('[data-testid="OfferSummaryInfoItem"]').each((i, el) => {
        console.log(`  [${i}]:`, $(el).text().trim().replace(/\s+/g, ' '));
    });

    console.log('\n=== offer-facts ===');
    $('[data-testid="offer-facts"]').children().each((i, el) => {
        console.log(`  [${i}]:`, $(el).text().trim().replace(/\s+/g, ' ').substring(0, 100));
    });
    // Also direct
    $('[data-testid="offer-facts"] [data-name="OfferFactItem"]').each((i, el) => {
        console.log(`  fact[${i}]:`, $(el).text().trim().replace(/\s+/g, ' '));
    });

    console.log('\n=== OfferSummaryInfoGroup children ===');
    $('[data-testid="OfferSummaryInfoGroup"]').find('div, span').each((i, el) => {
        const t = $(el).text().trim().replace(/\s+/g, ' ');
        if (t.length > 2 && t.length < 80 && i < 30) console.log(`  [${i}]:`, t);
    });

    console.log('\n=== NewbuildingSpecifications ===');
    $('[data-name="NewbuildingSpecifications"]').find('li, div > span').each((i, el) => {
        const t = $(el).text().trim().replace(/\s+/g, ' ');
        if (t.length > 2 && t.length < 100 && i < 20) console.log(`  [${i}]:`, t);
    });

    console.log('\n=== NewbuildingFeatures ===');
    $('[data-name="NewbuildingFeatures"]').find('li, span, div').each((i, el) => {
        const t = $(el).text().trim().replace(/\s+/g, ' ');
        if (t.length > 2 && t.length < 80 && i < 20) console.log(`  [${i}]:`, t);
    });

    console.log('\n=== Description ===');
    $('[data-name="Description"]').each((i, el) => {
        console.log($(el).text().trim().substring(0, 500));
    });

    console.log('\n=== ParentNew (JK info) ===');
    $('[data-name="ParentNew"]').find('a, span').each((i, el) => {
        const t = $(el).text().trim();
        if (t.length > 2 && t.length < 80 && i < 10) console.log(`  [${i}]:`, t);
    });

    console.log('\n=== Underground / Metro ===');
    $('[data-name="UndergroundItem"]').each((i, el) => {
        console.log(`  [${i}]:`, $(el).text().trim().replace(/\s+/g, ' '));
    });

    console.log('\n=== Highway ===');
    $('[data-name="HighwayItem"]').each((i, el) => {
        console.log(`  [${i}]:`, $(el).text().trim().replace(/\s+/g, ' '));
    });
}
test().catch(e => console.log('ERROR:', e.message));
