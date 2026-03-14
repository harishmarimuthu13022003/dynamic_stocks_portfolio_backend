import sys
import requests
from bs4 import BeautifulSoup
import json
import re

def fetch_stock_data(symbol):
    result = {
        "cmp": None,
        "peRatio": "N/A",
        "latestEarnings": "N/A"
    }
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
    }

    # 1. Fetch CMP from Yahoo Finance
    try:
        yahoo_url = f"https://finance.yahoo.com/quote/{symbol}"
        response = requests.get(yahoo_url, headers=headers, timeout=15)
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            print(f"Yahoo Title: {soup.title.text if soup.title else 'No Title'}", file=sys.stderr)
            
            # Try multiple selectors for price (Yahoo changes often)
            # 1. fin-streamer with data-field="regularMarketPrice"
            price_element = soup.find('fin-streamer', {'data-field': 'regularMarketPrice'})
            if price_element:
                price_val = price_element.get('value') or price_element.text.strip()
                if price_val:
                    try:
                        result["cmp"] = float(price_val.replace(',', ''))
                    except: pass
            
            # 2. span with data-test="qsp-price"
            if not result["cmp"]:
                price_span = soup.find('span', {'data-test': 'qsp-price'})
                if price_span:
                    try:
                        result["cmp"] = float(price_span.text.strip().replace(',', ''))
                    except: pass

            # 3. Use regex to find price in a specific pattern if selectors fail
            if not result["cmp"]:
                price_match = re.search(r'"regularMarketPrice":\{"raw":([\d.]+)', response.text)
                if price_match:
                    result["cmp"] = float(price_match.group(1))
        else:
            print(f"Yahoo Request failed for {symbol} with status code {response.status_code}", file=sys.stderr)
            
    except Exception as e:
        print(f"Yahoo Scraping Error for {symbol}: {str(e)}", file=sys.stderr)

    # 2. Fetch P/E and Earnings from Google Finance
    try:
        # Extract base symbol and determine exchange
        ticker_base = symbol.split('.')[0]
        exchange = 'BOM' if symbol.endswith('.BO') else 'NSE'
        google_ticker = f"{ticker_base}:{exchange}"
        
        google_url = f"https://www.google.com/finance/quote/{google_ticker}"
        g_response = requests.get(google_url, headers=headers, timeout=15)
        
        if g_response.status_code == 200:
            g_soup = BeautifulSoup(g_response.content, 'html.parser')
            
            # Look for P/E ratio and Earnings in div structure
            for div in g_soup.find_all('div', string=re.compile(r'P/E ratio|EPS')):
                label = div.text.strip()
                value_div = div.find_next_sibling('div')
                if value_div:
                    val = value_div.text.strip()
                    if 'P/E ratio' in label and val != 'P/E ratio':
                        result["peRatio"] = val
                    elif ('EPS' in label or 'Earnings' in label) and val != label:
                        result["latestEarnings"] = val
            
            # Fallback for Google Finance specific classes
            if result["peRatio"] == "N/A" or result["latestEarnings"] == "N/A":
                items = g_soup.find_all('div', {'class': 'P66Pgc'})
                for item in items:
                    val = item.text.strip()
                    parent = item.parent
                    label_div = parent.find('div', {'class': 'mfs7Fc'})
                    if label_div:
                        label = label_div.text.strip().lower()
                        if 'p/e' in label and result["peRatio"] == "N/A":
                            result["peRatio"] = val
                        if 'eps' in label and result["latestEarnings"] == "N/A":
                            result["latestEarnings"] = val
                            
    except Exception as e:
        print(f"Google Scraping Error for {google_ticker}: {str(e)}", file=sys.stderr)

    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No symbol provided"}))
        sys.exit(1)
        
    symbol = sys.argv[1]
    data = fetch_stock_data(symbol)
    print(json.dumps(data))
