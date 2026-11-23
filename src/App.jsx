import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Coins,
  Globe,
  KeyRound,
  Landmark,
  Newspaper,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

const STORAGE_KEY = 'aurum_gemini_api_key_v1';
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TROY_OUNCE_TO_10G = 3.11034768;

const DEFAULT_SNAPSHOT = {
  goldSpotUsdPerOz: 3576.1,
  goldChangePct24h: 1.2,
  usdInr: 92.9,
  rates: [
    { region: 'US Federal Reserve', rate: '3.88%', bias: 'Hawkish / Hike Risk', impact: 'Bearish near-term via USD & yields' },
    { region: 'RBI (India Repo)', rate: '5.50%', bias: 'Accommodative / Watch', impact: 'Supports domestic safe-haven demand' },
    { region: 'ECB (Eurozone)', rate: '2.50%', bias: 'Data-Dependent', impact: 'Secondary EUR/USD & yield effect' },
    { region: 'BoE (UK)', rate: '4.25%', bias: 'Cautious Hold', impact: 'Moderate GBP & gilt yield spillover' },
  ],
  treasuryFlows: [
    { sovereign: 'Poland (NBP)', action: 'Net Buyer', recentNote: 'Leading sovereign accumulation in recent WGC monthly tally', stance: 'Bullish' },
    { sovereign: 'China (PBoC)', action: 'Net Buyer', recentNote: 'Steady reserve diversification alongside retail bar/coin interest', stance: 'Bullish' },
    { sovereign: 'Kazakhstan & Uzbekistan', action: 'Net Buyer', recentNote: 'Continued official reserve additions', stance: 'Bullish' },
    { sovereign: 'India (RBI)', action: 'Reserve Monitor', recentNote: 'FX & reserve management amid INR movement and seasonal demand', stance: 'Neutral-Bullish' },
  ],
  news: [
    {
      title: 'Gold rebounds from 14-month low ahead of US inflation release',
      source: 'Market Briefing',
      tag: 'Price Action & Macro',
      summary: 'Spot gold steadied after a sharp weekly pullback as traders weighed upcoming US CPI signals against bargain buying in India and China.',
    },
    {
      title: 'Firm US dollar and Fed hike expectations weigh on bullion',
      source: 'Rates & FX Desk',
      tag: 'Interest Rates & DXY',
      summary: 'A stronger dollar and sticky inflation pricing have raised the opportunity cost of non-yielding bullion in the short term.',
    },
    {
      title: 'Central banks and investment flows anchor medium-term floor',
      source: 'World Gold Council Summary',
      tag: 'Central Banks',
      summary: 'Ongoing official-sector buying and macro hedging continue to cushion deeper drawdowns even as high prices curb physical jewellery tonnage.',
    },
  ],
};

function formatCountdown(msRemaining) {
  const safe = Math.max(0, msRemaining);
  const totalSec = Math.floor(safe / 1000);
  const hrs = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const secs = String(totalSec % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

export default function App() {
  const [tab, setTab] = useState('overview');
  const [goldUsd, setGoldUsd] = useState(DEFAULT_SNAPSHOT.goldSpotUsdPerOz);
  const [usdInr, setUsdInr] = useState(DEFAULT_SNAPSHOT.usdInr);
  const [lastSynced, setLastSynced] = useState(() => new Date().toISOString());
  const [nextRefreshAt, setNextRefreshAt] = useState(() => Date.now() + REFRESH_INTERVAL_MS);
  const [countdown, setCountdown] = useState(() => formatCountdown(REFRESH_INTERVAL_MS));
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Using calibrated baseline + live USD/INR feed');

  // Optional user-supplied Gemini API key (stored only in browser localStorage)
  const [apiKeyInput, setApiKeyInput] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [aiPrompt, setAiPrompt] = useState(
    'Summarize the short-term vs medium-term outlook for gold in USD and INR based on Fed rate expectations, USD/INR, and central bank buying.'
  );
  const [aiOutput, setAiOutput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // Buyer / seller position helper inputs
  const [grams, setGrams] = useState(10);
  const [purity, setPurity] = useState('24K');

  const purityFactor = purity === '24K' ? 1 : purity === '22K' ? 22 / 24 : 18 / 24;

  const derived = useMemo(() => {
    const raw24kPer10gInr = (goldUsd * usdInr) / TROY_OUNCE_TO_10G;
    const purityPer10gInr = raw24kPer10gInr * purityFactor;
    const indicativeWithDutyAndGst10g = purityPer10gInr * 1.06 * 1.03;
    const positionInr = (indicativeWithDutyAndGst10g / 10) * grams;
    const positionUsd = ((goldUsd / 31.1034768) * purityFactor) * grams;
    return {
      raw24kPer10gInr,
      purityPer10gInr,
      indicativeWithDutyAndGst10g,
      positionInr,
      positionUsd,
    };
  }, [goldUsd, usdInr, purityFactor, grams]);

  async function refreshMarketData() {
    setIsSyncing(true);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const data = await res.json();
        const liveInr = data?.rates?.INR;
        if (typeof liveInr === 'number' && liveInr > 50 && liveInr < 150) {
          setUsdInr(Number(liveInr.toFixed(2)));
          setSyncStatus('Live USD/INR synced from open.er-api.com');
        } else {
          setSyncStatus('FX response received without INR rate; kept current USD/INR');
        }
      } else {
        setSyncStatus('FX endpoint unavailable; kept current USD/INR');
      }
    } catch {
      setSyncStatus('Offline or blocked FX request; kept current USD/INR');
    } finally {
      const now = Date.now();
      setLastSynced(new Date(now).toISOString());
      setNextRefreshAt(now + REFRESH_INTERVAL_MS);
      setIsSyncing(false);
    }
  }

  useEffect(() => {
    refreshMarketData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const rem = nextRefreshAt - Date.now();
      if (rem <= 0) {
        refreshMarketData();
      } else {
        setCountdown(formatCountdown(rem));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [nextRefreshAt]);

  function saveApiKey() {
    try {
      const trimmed = apiKeyInput.trim();
      if (trimmed) {
        localStorage.setItem(STORAGE_KEY, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      setAiError('');
    } catch {
      setAiError('Could not access browser localStorage.');
    }
  }

  async function runGeminiBrief() {
    const key = apiKeyInput.trim();
    if (!key) {
      setAiError('Enter your Gemini API key above to generate a live AI synthesis.');
      return;
    }
    setAiLoading(true);
    setAiError('');
    try {
      const contextText = [
        `Spot Gold (USD/oz): $${goldUsd.toFixed(2)}`,
        `USD/INR: ${usdInr.toFixed(2)}`,
        `Indicative 24K base (10g before taxes/premiums): ₹${Math.round(derived.raw24kPer10gInr).toLocaleString('en-IN')}`,
        `Key rates: ${DEFAULT_SNAPSHOT.rates.map((r) => `${r.region} ${r.rate} (${r.bias})`).join('; ')}`,
        `Central banks: ${DEFAULT_SNAPSHOT.treasuryFlows.map((t) => `${t.sovereign}: ${t.action}`).join('; ')}`,
      ].join('\n');

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are AURUM AI, a market analyst assisting gold buyers and sellers.\nMarket Context:\n${contextText}\n\nUser Question: ${aiPrompt}\n\nProvide a concise, structured response covering: 1) Recent Trend (Increase/Drop drivers), 2) Future Price Expectation & Key Scenarios, 3) Practical Buy/Sell Considerations (non-financial-advice disclaimer included).`,
                  },
                ],
              },
            ],
          }),
        }
      );

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error?.message || `Gemini API error (${response.status})`);
      }

      const text =
        json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n').trim() ||
        'No response text returned.';
      setAiOutput(text);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to call Gemini API.');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                AURUM AI <span className="text-amber-400">Gold Intelligence</span>
              </h1>
              <p className="text-xs text-slate-400">
                USD &amp; INR Gold Tracker • Interest Rates • Sovereign Flows • Expectation Summary
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-slate-300">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span>Auto-Refresh in {countdown}</span>
            </div>
            <button
              type="button"
              onClick={refreshMarketData}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* Top KPI Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Gold Spot (XAU / USD)</span>
              <span className="inline-flex items-center gap-0.5 text-emerald-400">
                <ArrowUpRight className="h-3.5 w-3.5" />+{DEFAULT_SNAPSHOT.goldChangePct24h}%
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">${goldUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-xs text-slate-400">/ oz</span>
            </div>
            <label className="mt-3 block text-[11px] text-slate-400">
              Adjust Spot USD/oz:
              <input
                type="number"
                step="1"
                value={goldUsd}
                onChange={(e) => setGoldUsd(Math.max(100, Number(e.target.value) || 0))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>USD / INR Rate</span>
              <Globe className="h-4 w-4 text-sky-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">₹{usdInr.toFixed(2)}</span>
              <span className="text-xs text-slate-400">/ 1 USD</span>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">{syncStatus}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>India 24K Base (10g)</span>
              <Coins className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-400">
              ₹{Math.round(derived.raw24kPer10gInr).toLocaleString('en-IN')}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Indicative w/ duty &amp; GST: ₹{Math.round(derived.indicativeWithDutyAndGst10g).toLocaleString('en-IN')} / 10g
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Last Synced</span>
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-sm font-semibold text-white">
              {new Date(lastSynced).toLocaleString()}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Refreshes automatically every 24 hours while open.
            </p>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          {[
            { id: 'overview', label: 'Trend & Expectation Summary', icon: TrendingUp },
            { id: 'rates', label: 'Interest Rates & Central Banks', icon: Landmark },
            { id: 'calculator', label: 'Buyer / Seller Calculator', icon: Coins },
            { id: 'ai', label: 'Gemini AI Agent', icon: Sparkles },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                tab === id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Trend & Expectation Summary */}
        {tab === 'overview' && (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
              <h2 className="text-base font-semibold text-white">Recent Price Trend: Pullback vs. Rebound</h2>
              <ul className="space-y-2.5 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <ArrowDownRight className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                  <span>
                    <strong className="text-white">Downward Pressure:</strong> Firm US dollar strength and market expectations around Federal Reserve rate policy have weighed on short-term bullion momentum.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>
                    <strong className="text-white">Rebound &amp; Cushion:</strong> Dip-buying interest in major physical hubs like India and China, paired with ongoing central bank reserve accumulation, has helped stabilize rebounds off recent lows.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Globe className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span>
                    <strong className="text-white">INR Effect for Buyers in India:</strong> Movements in USD/INR amplify or soften local rupee gold prices even when international USD spot moves modestly.
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
              <h2 className="text-base font-semibold text-white">Future Price Expectation &amp; Decision Guide</h2>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="font-semibold text-amber-400">Near-Term (Days to Weeks)</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    Likely choppy and rate-sensitive around major inflation and central bank releases. A stronger US dollar or hawkish rate pricing caps upside; softer inflation or dollar pullbacks spark relief bounces.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="font-semibold text-emerald-400">Medium-Term (Months)</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    Central bank diversification, geopolitical uncertainty, and hedging demand remain structural supports, while elevated prices continue to temper high-carat jewellery tonnage.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <p className="font-semibold text-sky-400">Practical Buyer / Seller Checklist</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    <strong>Buyers:</strong> Scale in tranches rather than going all-in on a single volatile day, and compare making charges/spreads. <strong>Sellers:</strong> Watch resistance zones, INR moves, and buyback spreads before exiting core hedges.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2 text-base font-semibold text-white">
                <Newspaper className="h-4 w-4 text-amber-400" />
                <span>Key Gold Market Themes &amp; News</span>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {DEFAULT_SNAPSHOT.news.map((item) => (
                  <article key={item.title} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <span className="inline-block rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                      {item.tag}
                    </span>
                    <h3 className="mt-2 text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{item.summary}</p>
                    <p className="mt-2 text-[11px] text-slate-500">{item.source}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Tab 2: Interest Rates & Central Banks */}
        {tab === 'rates' && (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-base font-semibold text-white">Policy Interest Rates Across Major Economies</h2>
              <p className="mt-1 text-xs text-slate-400">
                Higher policy rates and bond yields raise the opportunity cost of holding non-yielding gold.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 pr-3">Central Bank</th>
                      <th className="py-2 pr-3">Rate</th>
                      <th className="py-2 pr-3">Stance</th>
                      <th className="py-2">Gold Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-slate-200">
                    {DEFAULT_SNAPSHOT.rates.map((r) => (
                      <tr key={r.region}>
                        <td className="py-2.5 pr-3 font-medium text-white">{r.region}</td>
                        <td className="py-2.5 pr-3 font-semibold text-amber-400">{r.rate}</td>
                        <td className="py-2.5 pr-3">{r.bias}</td>
                        <td className="py-2.5 text-slate-400">{r.impact}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-base font-semibold text-white">Country Treasury / Central Bank Gold Activity</h2>
              <p className="mt-1 text-xs text-slate-400">
                Sovereign reserve buying and selling shape long-term supply-demand balance.
              </p>
              <div className="mt-4 space-y-3">
                {DEFAULT_SNAPSHOT.treasuryFlows.map((t) => (
                  <div key={t.sovereign} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{t.sovereign}</span>
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                        {t.action}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-300">{t.recentNote}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Tab 3: Buyer / Seller Calculator */}
        {tab === 'calculator' && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
            <h2 className="text-base font-semibold text-white">Indicative Buyer / Seller Value Estimator</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-slate-300">
                Weight (Grams)
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={grams}
                  onChange={(e) => setGrams(Math.max(0.1, Number(e.target.value) || 0))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-xs text-slate-300">
                Karat Purity
                <select
                  value={purity}
                  onChange={(e) => setPurity(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  <option value="24K">24K (99.9%)</option>
                  <option value="22K">22K (91.6%)</option>
                  <option value="18K">18K (75.0%)</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs text-slate-400">Estimated Value in INR ({grams}g, {purity})</p>
                <p className="mt-1 text-2xl font-bold text-amber-400">
                  ₹{Math.round(derived.positionInr).toLocaleString('en-IN')}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Includes indicative duty/GST factor; dealer making charges &amp; buyback spreads vary.
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs text-slate-400">Estimated Metal Value in USD ({grams}g, {purity})</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  ${derived.positionUsd.toFixed(2)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Calculated from spot USD/oz and selected purity ratio.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Tab 4: Gemini AI Agent */}
        {tab === 'ai' && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
            <div className="flex items-center gap-2 text-base font-semibold text-white">
              <KeyRound className="h-4 w-4 text-amber-400" />
              <span>Gemini API Connection (Stored Locally in Your Browser)</span>
            </div>
            <p className="text-xs text-slate-400">
              Never hardcode API keys in source code before pushing to GitHub. Paste your key below—it is saved only in your browser&apos;s <code className="text-slate-200">localStorage</code>.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="password"
                placeholder="Paste Gemini API key (e.g., AIza...)"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                onClick={saveApiKey}
                className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Save Key Locally
              </button>
            </div>

            <label className="block text-xs text-slate-300">
              Question or Scenario for AURUM AI
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white"
              />
            </label>

            <button
              type="button"
              onClick={runGeminiBrief}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              <span>{aiLoading ? 'Generating Analysis...' : 'Generate AI Summary'}</span>
            </button>

            {aiError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200">
                {aiError}
              </div>
            )}

            {aiOutput && (
              <div className="whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-relaxed text-slate-200">
                {aiOutput}
              </div>
            )}
          </section>
        )}

        {/* Disclaimer */}
        <footer className="flex items-start gap-2.5 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 text-xs text-slate-400">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p>
            <strong>Informational &amp; Educational Use Only:</strong> Gold prices, FX rates, interest rates, and central bank figures change continuously, and local bullion quotes vary by dealer, city, purity, taxes, and spreads. This tool does not provide personalized investment, tax, or trading advice.
          </p>
        </footer>
      </main>
    </div>
  );
}