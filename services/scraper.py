import sys
import requests
from bs4 import BeautifulSoup
import json
import re

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def fetch_stock_data(symbol): 
    result = {
        "cmp": None,
        "peRatio": "N/A",
        "latestEarnings": "N/A"
    }
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }

    # 1. Fetch CMP from Yahoo Finance
    try:
        yahoo_url = f"https://finance.yahoo.com/quote/{symbol}"
        response = requests.get(yahoo_url, headers=headers, timeout=15, verify=False)
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Verify symbol presence to avoid redirected search results
            title = soup.title.text if soup.title else ""
            symbol_parts = symbol.split('.')
            base_symbol = symbol_parts[0]
            
            if base_symbol.lower() in title.lower():
                # Extract Price
                price_span = soup.find('span', class_=re.compile(r'yf-.*base'))
                if not price_span:
                    price_span = soup.select_one('span.base.yf-7ua2fk')
                
                if price_span:
                    try:
                        result["cmp"] = float(price_span.text.strip().replace(',', ''))
                    except: pass
                
                if not result["cmp"]:
                    streamer = soup.find('fin-streamer', {'data-symbol': symbol, 'data-field': 'regularMarketPrice'})
                    if streamer:
                        val = streamer.get('value') or streamer.text.strip()
                        try:
                            result["cmp"] = float(val.replace(',', ''))
                        except: pass
    except Exception as e:
        print(f"Yahoo Scrape Error for {symbol}: {str(e)}", file=sys.stderr)

    # 2. Fetch from Google Finance (Fallback for Price + Stats)
    try:
        ticker_base = symbol.split('.')[0]
        exchange = 'BOM' if symbol.endswith('.BO') else 'NSE'
        google_ticker = f"{ticker_base}:{exchange}"
        
        google_url = f"https://www.google.com/finance/quote/{google_ticker}"
        g_response = requests.get(google_url, headers=headers, timeout=15, verify=False)
        
        if g_response.status_code == 200:
            g_soup = BeautifulSoup(g_response.content, 'html.parser')
            
            # Google Price
            if not result["cmp"]:
                # Try data-last-price attribute first
                price_div = g_soup.find('div', {'data-last-price': True})
                if price_div:
                    result["cmp"] = float(price_div['data-last-price'])
                
                if not result["cmp"]:
                    # Fallback classes (common for Google Finance)
                    for cls in ['YMlS3', 'fx1vbd', 'YMlS7e', 'I67F9c', 'kf1YGe']:
                        p_div = g_soup.select_one(f'div.{cls}')
                        if p_div:
                            try:
                                p_text = p_div.text.strip().replace('₹', '').replace(',', '').replace('$', '')
                                result["cmp"] = float(p_text)
                                break
                            except: pass

            # Google Stats (PE, EPS)
            # Find elements where text matches labels
            for div in g_soup.find_all('div', class_=re.compile(r'mfs7Fc|gyFHrc')):
                label = div.text.strip().lower()
                # The value is usually in a sibling div or a specific class nearby
                val_div = div.find_next_sibling('div', class_=re.compile(r'P66Pgc|P6K39c'))
                if val_div:
                    val = val_div.text.strip()
                    if 'p/e ratio' in label and result["peRatio"] == "N/A":
                        result["peRatio"] = val
                    elif ('eps' in label or 'earnings' in label) and result["latestEarnings"] == "N/A":
                        result["latestEarnings"] = val
    except Exception as e:
        print(f"Google Scrape Error for {google_ticker}: {str(e)}", file=sys.stderr)

    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No symbol provided"}))
        sys.exit(1)
        
    symbol = sys.argv[1]
    data = fetch_stock_data(symbol)
    print(json.dumps(data))
