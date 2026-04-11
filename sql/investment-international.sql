-- ─────────────────────────────────────────────────────────────────────────────
-- INVESTMENT INTERNATIONAL EXPANSION — SQL SEED
-- Run this AFTER investment-extension.sql has been applied.
-- Adds: 3 new categories, 50+ new instruments (international stocks, ETFs,
--       bonds, REITs, private equity, crowdfunding/alternatives)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. NEW CATEGORIES ────────────────────────────────────────────────────────

INSERT INTO investment_instruments (
  id, category, name, symbol, icon, price_usd, change_24h, change_pct_24h,
  market_cap, volume_24h, exchange, min_investment, currency, enabled, description
) VALUES

-- ─── REITs ────────────────────────────────────────────────────────────────────
('VNQ',  'reits', 'Vanguard Real Estate ETF',  'VNQ',  '🏢', 88.50,  0.42,  0.48,  '$30B',  '$0.8B', 'NYSE',    1.00,  'USD', TRUE,
 'Tracks the MSCI US IMI Real Estate 25/50 Index — the broadest US REIT ETF. Exposure to 160+ real estate companies across all property types. Yield: 4.20%.'),

('O',    'reits', 'Realty Income Corp',         'O',    'O',  55.20,  0.28,  0.51,  '$34B',  '$0.4B', 'NYSE',    1.00,  'USD', TRUE,
 'The Monthly Dividend Company — pays dividends every month. Portfolio of 13,250+ properties leased to 1,500+ tenants globally. Yield: 5.80%.'),

('SPG',  'reits', 'Simon Property Group',       'SPG',  'S',  148.30, 0.95,  0.64,  '$45B',  '$0.6B', 'NYSE',    1.00,  'USD', TRUE,
 'Simon Property is the largest mall REIT in the US, owning premium outlet centers and regional malls. Yield: 5.40%.'),

('PLD',  'reits', 'Prologis Inc.',              'PLD',  'P',  115.40, 0.60,  0.52,  '$89B',  '$0.8B', 'NYSE',    1.00,  'USD', TRUE,
 'World''s largest logistics REIT, owning 1.2B+ sq ft of e-commerce warehouses and distribution centers in 19 countries. Yield: 3.10%.'),

('EQIX', 'reits', 'Equinix Inc.',               'EQIX', 'E',  842.30, 5.20,  0.62,  '$78B',  '$0.5B', 'NASDAQ',  1.00,  'USD', TRUE,
 'World''s largest data center REIT with 260+ data centers across 71 metros in 33 countries. Yield: 2.10%.'),

('AMT',  'reits', 'American Tower Corp',        'AMT',  'A',  188.50, 1.10,  0.59,  '$87B',  '$0.6B', 'NYSE',    1.00,  'USD', TRUE,
 'World''s largest cell tower REIT with 222,000+ communication towers across 25 countries. Benefits from 5G rollout. Yield: 3.40%.'),

('PSA',  'reits', 'Public Storage',             'PSA',  'P',  304.20, 1.80,  0.60,  '$53B',  '$0.4B', 'NYSE',    1.00,  'USD', TRUE,
 'Largest self-storage REIT in the US with 3,000+ facilities. Self-storage is a recession-resilient, high-margin sector. Yield: 4.00%.'),

('DLR',  'reits', 'Digital Realty Trust',       'DLR',  'D',  145.80, 0.90,  0.62,  '$43B',  '$0.4B', 'NYSE',    1.00,  'USD', TRUE,
 'Leading data center REIT serving 5,000+ customers including IBM, Oracle, LinkedIn and AT&T across 50 metros worldwide. Yield: 2.80%.'),

('WELL', 'reits', 'Welltower Inc.',             'WELL', 'W',  109.70, 0.48,  0.44,  '$56B',  '$0.5B', 'NYSE',    1.00,  'USD', TRUE,
 'Healthcare REIT owning senior housing, post-acute care facilities and outpatient medical buildings. Benefits from aging demographics. Yield: 2.30%.'),

-- ─── PRIVATE EQUITY ───────────────────────────────────────────────────────────
('BX',   'private_eq', 'Blackstone Inc.',            'BX',   'B',  136.80, 2.10, 1.56, '$168B', '$1.5B', 'NYSE',   1.00, 'USD', TRUE,
 'World''s largest alternative asset manager with $1T+ AUM across private equity, real estate, credit and hedge fund strategies.'),

('KKR',  'private_eq', 'KKR & Co.',                 'KKR',  'K',  105.40, 1.60, 1.54, '$93B',  '$0.9B', 'NYSE',   1.00, 'USD', TRUE,
 'Leading global investment firm managing PE, infrastructure, real estate and credit with $553B+ AUM. Pioneer of leveraged buyout strategy.'),

('APO',  'private_eq', 'Apollo Global Management',  'APO',  'A',  118.20, 1.80, 1.55, '$71B',  '$0.7B', 'NYSE',   1.00, 'USD', TRUE,
 'High-growth alternative asset manager focused on credit, equity and real assets with $671B AUM. Strong track record in distressed investing.'),

('CG',   'private_eq', 'Carlyle Group',             'CG',   'C',   48.70, 0.65, 1.35, '$17B',  '$0.2B', 'NASDAQ', 1.00, 'USD', TRUE,
 'Global investment firm with $426B AUM across private equity, real assets and global credit. Known for defence and aerospace sector expertise.'),

('BAM',  'private_eq', 'Brookfield Asset Mgmt',     'BAM',  'B',   47.20, 0.38, 0.81, '$76B',  '$0.4B', 'NYSE',   1.00, 'USD', TRUE,
 'Canadian alternative asset manager with $920B+ AUM across real estate, infrastructure, renewable power and private equity.'),

('ARES', 'private_eq', 'Ares Management Corp',      'ARES', 'A',  148.40, 2.20, 1.51, '$51B',  '$0.3B', 'NYSE',   1.00, 'USD', TRUE,
 'Alternative asset manager specialising in credit-first strategies with $428B AUM. One of the world''s largest direct lending platforms.'),

('BN',   'private_eq', 'Brookfield Corp',           'BN',   'B',   52.30, 0.45, 0.87, '$83B',  '$0.3B', 'NYSE',   1.00, 'USD', TRUE,
 'Parent of Brookfield AM — a diversified operator of real assets including renewable energy, infrastructure, real estate and insurance.'),

-- ─── CROWDFUNDING / ALTERNATIVES ──────────────────────────────────────────────
('CF_REALESTATE',   'alternatives', 'Fundrise Real Estate',     'CFRE',   '🏠', 10.00, 0.05, 0.50, NULL, NULL, 'Fundrise',    10.00,  'USD', TRUE,
 'Leading real estate crowdfunding platform. Invest in diversified portfolios of private real estate projects — commercial, residential and industrial — with as little as $10. Yield: 8.40%.'),

('CF_STARTUPS',     'alternatives', 'Republic Startup Fund',    'CFST',   '🚀', 50.00, 0.00, 0.00, NULL, NULL, 'Republic',    50.00,  'USD', TRUE,
 'Invest in early-stage startups through equity crowdfunding. Diversified exposure to pre-IPO technology, biotech and consumer companies. SEC Reg CF compliant.'),

('CF_ART',          'alternatives', 'Masterworks Art Fund',     'CFART',  '🎨', 20.00, 0.10, 0.50, NULL, NULL, 'Masterworks', 20.00,  'USD', TRUE,
 'Masterworks securitises blue-chip contemporary art by Banksy, Basquiat, KAWS and Koons. Historical art index returned 14.6% annualized.'),

('CF_COLLECTIBLES', 'alternatives', 'Rally Collectibles Fund',  'CFRLY',  '🏆', 25.00, 0.08, 0.32, NULL, NULL, 'Rally',       25.00,  'USD', TRUE,
 'Invest in fractional shares of rare collectibles — sports cards, vintage cars, watches, sneakers and memorabilia. SEC-qualified asset-backed shares.'),

('CF_INFRA',        'alternatives', 'Yieldstreet Alt Income',   'CFYLD',  '⚡',  15.00, 0.07, 0.47, NULL, NULL, 'Yieldstreet', 15.00,  'USD', TRUE,
 'Alternative income investments in marine finance, legal finance, infrastructure and real estate — historically uncorrelated to markets. Yield: 9.50%.'),

('CF_FARMLAND',     'alternatives', 'AcreTrader Farmland',      'CFFRM',  '🌱', 30.00, 0.12, 0.40, NULL, NULL, 'AcreTrader',  30.00,  'USD', TRUE,
 'Own shares in high-quality US farmland — the world''s scarcest asset. Farmland has returned ~11% annually with very low volatility. Yield: 7.00%.'),

('CF_LENDING',      'alternatives', 'P2P Lending Portfolio',    'CFP2P',  '🤝',  5.00, 0.02, 0.40, NULL, NULL, 'Platform',     5.00,  'USD', TRUE,
 'Diversified exposure to consumer and SME loans across global P2P lending platforms. Monthly interest income paid to investors. Yield: 10.5%.')

ON CONFLICT (id) DO UPDATE SET
  price_usd      = EXCLUDED.price_usd,
  change_24h     = EXCLUDED.change_24h,
  change_pct_24h = EXCLUDED.change_pct_24h,
  description    = EXCLUDED.description,
  enabled        = EXCLUDED.enabled;

-- ─── 2. INTERNATIONAL STOCKS ──────────────────────────────────────────────────

INSERT INTO investment_instruments (
  id, category, name, symbol, icon, price_usd, change_24h, change_pct_24h,
  market_cap, volume_24h, exchange, min_investment, currency, enabled, description
) VALUES
-- UK
('HSBA',  'stocks', 'HSBC Holdings',           'HSBA',  'H',  55.90,  0.42,  0.76, '$145B',  '$1.8B', 'NYSE',   1.00, 'USD', TRUE, 'One of the world''s largest banking organisations, with operations in 64 countries. Headquartered in London, core markets in Asia.'),
('SHEL',  'stocks', 'Shell plc',               'SHEL',  'S',  67.30,  0.95,  1.43, '$223B',  '$1.5B', 'NYSE',   1.00, 'USD', TRUE, 'Global energy company active in oil, gas, LNG, biofuels, hydrogen and electricity businesses in 70+ countries.'),
('BP',    'stocks', 'BP plc',                  'BP',    'B',  33.40,  0.28,  0.84, '$94B',   '$0.8B', 'NYSE',   1.00, 'USD', TRUE, 'Major integrated energy company transitioning towards lower carbon energy including wind, solar and EV charging.'),
('AZN',   'stocks', 'AstraZeneca',             'AZN',   'A',  80.20, -0.35, -0.44, '$253B',  '$0.9B', 'NASDAQ', 1.00, 'USD', TRUE, 'Global biopharmaceutical company focused on oncology, cardiovascular, renal, metabolic and respiratory diseases.'),
('UL',    'stocks', 'Unilever plc',            'UL',    'U',  52.10,  0.18,  0.35, '$131B',  '$0.5B', 'NYSE',   1.00, 'USD', TRUE, 'Global consumer goods company with brands across beauty, personal care, home care, food and refreshment.'),
-- Europe
('ASML',  'stocks', 'ASML Holding',            'ASML',  'A',  895.40, 8.60,  0.97, '$352B',  '$1.2B', 'NASDAQ', 1.00, 'USD', TRUE, 'World''s sole producer of EUV lithography machines used in advanced semiconductor manufacturing. Critical enabler for AI chip production.'),
('SAP',   'stocks', 'SAP SE',                  'SAP',   'S',  185.30, 2.15,  1.17, '$228B',  '$0.7B', 'NYSE',   1.00, 'USD', TRUE, 'World''s largest enterprise software company, providing ERP, CRM and cloud solutions to 400,000+ customers globally.'),
('LVMUY', 'stocks', 'LVMH Moët Hennessy',      'LVMUY', 'L',  73.40,  0.48,  0.66, '$365B',  '$0.4B', 'OTC',    1.00, 'USD', TRUE, 'World''s largest luxury goods conglomerate, owning 75+ prestigious brands including Louis Vuitton, Dior and Hennessy.'),
('SIEGY', 'stocks', 'Siemens AG',              'SIEGY', 'S',  87.20,  0.90,  1.04, '$94B',   '$0.3B', 'OTC',    1.00, 'USD', TRUE, 'Global technology powerhouse in automation, digitalization, electrification and healthcare equipment.'),
('NSRGY', 'stocks', 'Nestlé S.A.',             'NSRGY', 'N',  84.50, -0.25, -0.30, '$237B',  '$0.4B', 'OTC',    1.00, 'USD', TRUE, 'World''s largest food and beverage company with brands like Nescafé, KitKat, Maggi and Purina sold in 188 countries.'),
('TTE',   'stocks', 'TotalEnergies SE',        'TTE',   'T',  62.10,  0.65,  1.06, '$157B',  '$0.6B', 'NYSE',   1.00, 'USD', TRUE, 'French integrated energy company producing and marketing oil, natural gas, renewables and electricity in 130+ countries.'),
-- Japan
('TM',    'stocks', 'Toyota Motor Corp.',      'TM',    'T',  188.50, 1.80,  0.96, '$261B',  '$0.5B', 'NYSE',   1.00, 'USD', TRUE, 'World''s largest automobile manufacturer, pioneering hybrid technology and expanding rapidly into hydrogen fuel cell vehicles.'),
('SONY',  'stocks', 'Sony Group Corp.',        'SONY',  'S',  82.40,  0.95,  1.17, '$104B',  '$0.4B', 'NYSE',   1.00, 'USD', TRUE, 'Global technology and entertainment company active in gaming (PlayStation), music, movies and consumer electronics.'),
('HMC',   'stocks', 'Honda Motor Co.',         'HMC',   'H',  29.30,  0.22,  0.76, '$48B',   '$0.2B', 'NYSE',   1.00, 'USD', TRUE, 'Leading Japanese manufacturer of automobiles, motorcycles and power equipment with growing focus on hydrogen vehicles.'),
('SFTBY', 'stocks', 'SoftBank Group',          'SFTBY', 'S',  23.80, -0.40, -1.65, '$43B',   '$0.2B', 'OTC',    1.00, 'USD', TRUE, 'Japanese multinational conglomerate and investment company. Home to the Vision Fund — world''s largest tech VC fund.'),
-- China / HK
('BABA',  'stocks', 'Alibaba Group',           'BABA',  'A',  78.40,  1.20,  1.55, '$184B',  '$2.1B', 'NYSE',   1.00, 'USD', TRUE, 'China''s largest e-commerce and cloud computing company, operating Taobao, Tmall, Aliyun and Ant Group.'),
('TCEHY', 'stocks', 'Tencent Holdings',        'TCEHY', 'T',  44.80,  0.55,  1.24, '$409B',  '$0.9B', 'OTC',    1.00, 'USD', TRUE, 'China''s biggest technology company — operating WeChat, QQ, gaming (Honor of Kings), music, payments and cloud services.'),
('JD',    'stocks', 'JD.com Inc.',             'JD',    'J',  28.90,  0.40,  1.40, '$45B',   '$0.6B', 'NASDAQ', 1.00, 'USD', TRUE, 'China''s largest direct-sales online retailer, known for same-day delivery infrastructure and quality-assurance model.'),
('PDD',   'stocks', 'PDD Holdings',            'PDD',   'P',  105.30, 2.80,  2.73, '$147B',  '$1.4B', 'NASDAQ', 1.00, 'USD', TRUE, 'PDD Holdings operates Pinduoduo and Temu — China''s fastest-growing e-commerce platform and expanding international marketplace.'),
-- India
('INFY',  'stocks', 'Infosys Ltd.',            'INFY',  'I',  18.50,  0.15,  0.82, '$77B',   '$0.3B', 'NYSE',   1.00, 'USD', TRUE, 'Global IT services and consulting company with 300,000+ employees. Leading provider of digital, cloud and AI transformation services.'),
('HDB',   'stocks', 'HDFC Bank',               'HDB',   'H',  64.20,  0.35,  0.55, '$176B',  '$0.4B', 'NYSE',   1.00, 'USD', TRUE, 'India''s largest private sector bank by assets, known for strong asset quality and digital banking across 8,300+ branches.'),
('WIT',   'stocks', 'Wipro Ltd.',              'WIT',   'W',   5.80,  0.04,  0.69, '$30B',   '$0.1B', 'NYSE',   1.00, 'USD', TRUE, 'Leading Indian IT services company offering cloud, digital, engineering and consulting services to enterprises globally.'),
-- Canada
('SHOP',  'stocks', 'Shopify Inc.',            'SHOP',  'S',  70.40,  1.05,  1.51, '$88B',   '$0.9B', 'NYSE',   1.00, 'USD', TRUE, 'Leading global commerce platform helping businesses sell online and in-person. Powers 2M+ merchants in 175 countries.'),
('RY',    'stocks', 'Royal Bank of Canada',    'RY',    'R',  121.30, 0.65,  0.54, '$172B',  '$0.4B', 'NYSE',   1.00, 'USD', TRUE, 'Canada''s largest bank by market cap, providing personal, commercial, corporate and investment banking services globally.'),
('BNS',   'stocks', 'Bank of Nova Scotia',     'BNS',   'B',  43.20,  0.30,  0.70, '$52B',   '$0.2B', 'NYSE',   1.00, 'USD', TRUE, 'Canada''s third-largest bank with significant focus on Latin America and the Caribbean as a key growth market.'),
-- Australia
('BHP',   'stocks', 'BHP Group',               'BHP',   'B',  46.80,  0.55,  1.19, '$236B',  '$0.8B', 'NYSE',   1.00, 'USD', TRUE, 'World''s largest diversified mining company, producing iron ore, copper, coal and nickel — critical inputs for EVs.'),
('RIO',   'stocks', 'Rio Tinto',               'RIO',   'R',  65.20,  0.70,  1.08, '$105B',  '$0.5B', 'NYSE',   1.00, 'USD', TRUE, 'Major diversified miner focused on iron ore, aluminium, copper and lithium. Strong position in green metals for energy transition.'),
-- South Korea
('SSNLF', 'stocks', 'Samsung Electronics',     'SSNLF', 'S',  55.20,  0.80,  1.47, '$329B',  '$0.5B', 'OTC',    1.00, 'USD', TRUE, 'World''s largest chipmaker and consumer electronics manufacturer, producing memory, displays, smartphones and home appliances.'),
-- Brazil
('VALE',  'stocks', 'Vale S.A.',               'VALE',  'V',  11.80,  0.18,  1.55, '$54B',   '$0.7B', 'NYSE',   1.00, 'USD', TRUE, 'World''s largest producer of iron ore and nickel, headquartered in Brazil. Key beneficiary of global infrastructure and EV demand.'),
('ITUB',  'stocks', 'Itaú Unibanco',           'ITUB',  'I',   7.20,  0.08,  1.12, '$71B',   '$0.3B', 'NYSE',   1.00, 'USD', TRUE, 'Latin America''s largest financial institution by market cap, serving 60M+ clients across banking, insurance and asset management.')

ON CONFLICT (id) DO UPDATE SET
  price_usd      = EXCLUDED.price_usd,
  change_24h     = EXCLUDED.change_24h,
  change_pct_24h = EXCLUDED.change_pct_24h,
  description    = EXCLUDED.description,
  enabled        = EXCLUDED.enabled;

-- ─── 3. INTERNATIONAL ETFs ────────────────────────────────────────────────────

INSERT INTO investment_instruments (
  id, category, name, symbol, icon, price_usd, change_24h, change_pct_24h,
  market_cap, volume_24h, exchange, min_investment, currency, enabled, description
) VALUES
('EWJ',   'etfs', 'iShares MSCI Japan',       'EWJ',   '🇯🇵', 68.20,  0.55, 0.81, '$18B',  '$0.5B', 'NYSE',   1.00, 'USD', TRUE, 'Tracks the MSCI Japan Index — exposure to large and mid-cap Japanese equities including Toyota, Sony and Fast Retailing.'),
('EWG',   'etfs', 'iShares MSCI Germany',     'EWG',   '🇩🇪', 31.45,  0.28, 0.90, '$4.3B', '$0.2B', 'NYSE',   1.00, 'USD', TRUE, 'Tracks the MSCI Germany Index — exposure to SAP, Siemens, Allianz, BASF and BMW listed on the Frankfurt DAX.'),
('EWU',   'etfs', 'iShares MSCI UK',          'EWU',   '🇬🇧', 37.80,  0.18, 0.48, '$2.8B', '$0.1B', 'NYSE',   1.00, 'USD', TRUE, 'Tracks the MSCI United Kingdom Index — exposure to AstraZeneca, HSBC, Shell, Unilever and other FTSE 100 giants.'),
('FXI',   'etfs', 'iShares China Large-Cap',  'FXI',   '🇨🇳', 28.95,  0.42, 1.47, '$6.1B', '$0.4B', 'NYSE',   1.00, 'USD', TRUE, 'Tracks the FTSE China 50 Index — top 50 Chinese companies on Hong Kong Stock Exchange including Tencent and Alibaba.'),
('EWZ',   'etfs', 'iShares MSCI Brazil',      'EWZ',   '🇧🇷', 32.10,  0.35, 1.10, '$5.8B', '$0.3B', 'NYSE',   1.00, 'USD', TRUE, 'Tracks the MSCI Brazil 25/50 Index — exposure to Petrobras, Vale, Itaú Unibanco and other Brazilian blue chips.'),
('VEA',   'etfs', 'Vanguard Dev. Markets',    'VEA',   'V',   51.20,  0.28, 0.55, '$132B', '$1.8B', 'NYSE',   1.00, 'USD', TRUE, 'Tracks the FTSE Developed All Cap ex US Index — broad exposure to developed markets in Europe, Asia-Pacific and Canada.'),
('VXUS',  'etfs', 'Vanguard Total Intl',      'VXUS',  'V',   62.40,  0.22, 0.35, '$66B',  '$0.9B', 'NASDAQ', 1.00, 'USD', TRUE, 'Tracks total international stock market (developed + emerging) excluding the US. 8,000+ holdings for maximum global diversification.'),
('ACWI',  'etfs', 'iShares MSCI ACWI',        'ACWI',  'A',   105.80, 0.48, 0.46, '$22B',  '$0.4B', 'NASDAQ', 1.00, 'USD', TRUE, 'Tracks the MSCI All Country World Index — covering large and mid-cap stocks across 23 developed and 24 emerging markets.'),
('VGK',   'etfs', 'Vanguard FTSE Europe',     'VGK',   'V',   68.90,  0.30, 0.44, '$17B',  '$0.3B', 'NYSE',   1.00, 'USD', TRUE, 'Tracks the FTSE Developed Europe All Cap Index — broad European equity exposure across UK, France, Germany and Switzerland.'),
('EEM',   'etfs', 'iShares MSCI Emerging',    'EEM',   'E',   42.80,  0.25, 0.59, '$22B',  '$1.5B', 'NYSE',   1.00, 'USD', TRUE, 'Provides exposure to large and mid-cap equities from emerging market countries including China, India, Brazil and South Korea.'),
('INDA',  'etfs', 'iShares MSCI India',       'INDA',  '🇮🇳', 56.70,  0.65, 1.16, '$9.4B', '$0.3B', 'NYSE',   1.00, 'USD', TRUE, 'Tracks the MSCI India Index — exposure to Reliance, Infosys, HDFC Bank, TCS and other leading Indian equities.'),
('EWC',   'etfs', 'iShares MSCI Canada',      'EWC',   '🇨🇦', 42.10,  0.38, 0.91, '$2.8B', '$0.1B', 'NYSE',   1.00, 'USD', TRUE, 'Tracks the MSCI Canada Custom Capped Index — exposure to Royal Bank, Shopify, TD Bank, Enbridge and other Canadian leaders.'),
('EWA',   'etfs', 'iShares MSCI Australia',   'EWA',   '🇦🇺', 25.30,  0.20, 0.80, '$1.8B', '$0.1B', 'NYSE',   1.00, 'USD', TRUE, 'Tracks the MSCI Australia Index — exposure to BHP, CBA, CSL, ANZ, NAB and other S&P/ASX 200 constituents.')

ON CONFLICT (id) DO UPDATE SET
  price_usd      = EXCLUDED.price_usd,
  change_24h     = EXCLUDED.change_24h,
  change_pct_24h = EXCLUDED.change_pct_24h,
  description    = EXCLUDED.description,
  enabled        = EXCLUDED.enabled;

-- ─── 4. INTERNATIONAL BONDS ───────────────────────────────────────────────────

INSERT INTO investment_instruments (
  id, category, name, symbol, icon, price_usd, change_24h, change_pct_24h,
  market_cap, volume_24h, exchange, min_investment, currency, enabled, description
) VALUES
('JGB10Y', 'bonds', 'Japan 10Y Gov Bond',   'JGB10Y', '¥',  98.40, -0.05, -0.05, NULL, NULL, 'Japan MOF',        100.00, 'JPY', TRUE, 'Japanese government bond — world''s largest bond market by sovereign issuance. Yield: 0.87%. BoJ controls yields through YCC policy.'),
('OAT10Y', 'bonds', 'France 10Y OAT',      'OAT10Y', '€',  95.80,  0.02,  0.02, NULL, NULL, 'Agence France',    100.00, 'EUR', TRUE, 'French government bond (Obligation Assimilable du Trésor). Yield: 3.15%. Core Euro-area sovereign with slight spread over German Bund.'),
('BTP10Y', 'bonds', 'Italy 10Y BTP',       'BTP10Y', '€',  91.20, -0.12, -0.13, NULL, NULL, 'Italy MEF',        100.00, 'EUR', TRUE, 'Italian government bond — highest yielding major Euro-area sovereign. Yield: 4.10%. Spread over Bund reflects Italy''s high debt-to-GDP.'),
('CANGOV', 'bonds', 'Canada 10Y Gov Bond', 'CANGOV', 'C$', 97.10,  0.04,  0.04, NULL, NULL, 'Govt of Canada',   100.00, 'CAD', TRUE, 'Canadian federal government bond rated AAA. Yield: 3.68%. Small yield spread over US Treasuries, influenced by Bank of Canada policy.'),
('AUSGOV', 'bonds', 'Australia 10Y Bond',  'AUSGOV', 'A$', 96.50,  0.06,  0.06, NULL, NULL, 'AOFM',             100.00, 'AUD', TRUE, 'Australian Commonwealth Government Security rated AAA. Yield: 4.35%. Backed by Australia''s resource-rich economy.')

ON CONFLICT (id) DO UPDATE SET
  price_usd      = EXCLUDED.price_usd,
  change_24h     = EXCLUDED.change_24h,
  change_pct_24h = EXCLUDED.change_pct_24h,
  description    = EXCLUDED.description,
  enabled        = EXCLUDED.enabled;

-- ─── Summary ──────────────────────────────────────────────────────────────────
-- Total new instruments: 9 REITs + 7 PE + 7 Alt + 29 Intl Stocks + 13 Intl ETFs + 5 Intl Bonds = 70
-- New categories added: reits, private_eq, alternatives
-- ─────────────────────────────────────────────────────────────────────────────
