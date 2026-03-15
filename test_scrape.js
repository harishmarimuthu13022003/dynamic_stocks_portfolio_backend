const axios = require('axios');
const cheerio = require('cheerio');

async function test(symbol="RELIANCE:NSE") {
  const { data } = await axios.get(`https://www.google.com/finance/quote/${symbol}`);
  const $ = cheerio.load(data);
  const result = { peRatio: null, earnings: null };

  $('.gyFHrc').each((i, el) => {
    const title = $(el).find('.mfs7Fc').text().trim().toLowerCase();
    const val = $(el).find('.P6K39c').text().trim();
    
    if (title === 'p/e ratio') result.peRatio = val;
    if (title === 'earnings per share' || title === 'eps') result.earnings = val;
  });
  console.log(result);
}
test();
