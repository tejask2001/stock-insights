// Universe of tracked stocks. NSE symbols use ".NS", BSE use ".BO" for Yahoo.
// Pick liquid, widely-tracked large caps so the free data feed works well.
export const WATCHLIST = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries', exchange: 'NSE', sector: 'Energy' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services', exchange: 'NSE', sector: 'IT' },
  { symbol: 'INFY.NS', name: 'Infosys', exchange: 'NSE', sector: 'IT' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', exchange: 'NSE', sector: 'Banking' },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', exchange: 'NSE', sector: 'Banking' },
  { symbol: 'SBIN.NS', name: 'State Bank of India', exchange: 'NSE', sector: 'Banking' },
  { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', exchange: 'NSE', sector: 'Auto' },
  { symbol: 'M&M.NS', name: 'Mahindra & Mahindra', exchange: 'NSE', sector: 'Auto' },
  { symbol: 'ASIANPAINT.NS', name: 'Asian Paints', exchange: 'NSE', sector: 'Consumer' },
  { symbol: 'ITC.NS', name: 'ITC Ltd', exchange: 'NSE', sector: 'Consumer' },
  { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever', exchange: 'NSE', sector: 'Consumer' },
  { symbol: 'LT.NS', name: 'Larsen & Toubro', exchange: 'NSE', sector: 'Infra' },
  { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance', exchange: 'NSE', sector: 'Finance' },
  { symbol: 'SUNPHARMA.NS', name: 'Sun Pharma', exchange: 'NSE', sector: 'Pharma' },
  { symbol: 'DRREDDY.NS', name: "Dr Reddy's Labs", exchange: 'NSE', sector: 'Pharma' },
  { symbol: 'TATASTEEL.NS', name: 'Tata Steel', exchange: 'NSE', sector: 'Metals' },
  { symbol: 'JSWSTEEL.NS', name: 'JSW Steel', exchange: 'NSE', sector: 'Metals' },
  { symbol: 'COALINDIA.NS', name: 'Coal India', exchange: 'NSE', sector: 'Energy' },
  { symbol: 'NTPC.NS', name: 'NTPC', exchange: 'NSE', sector: 'Utilities' },
  { symbol: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank', exchange: 'NSE', sector: 'Banking' },
  // Index trackers for market overview
  { symbol: '^NSEI', name: 'Nifty 50', exchange: 'NSE', sector: 'Index', index: true },
  { symbol: '^BSESN', name: 'Sensex', exchange: 'BSE', sector: 'Index', index: true },
];
