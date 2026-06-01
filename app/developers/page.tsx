"use client";

import { useState, useEffect } from "react";

type Tier = "starter" | "pro" | "enterprise";

export default function DevelopersPage() {
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("success=true")) {
      setShowSuccess(true);
      window.history.replaceState({}, "", "/developers");
    }
  }, []);

  async function handleCheckout(tier: Tier) {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/api-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, tier }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Failed to start checkout. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Failed to start checkout. Please try again.");
      setLoading(false);
    }
  }

  function selectTier(tier: Tier) {
    setSelectedTier(tier);
    setError("");
  }

  function cancelTier() {
    setSelectedTier(null);
    setError("");
  }

  function CheckoutForm({ tier }: { tier: Tier }) {
    return (
      <div className="space-y-2 mt-1">
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          className="w-full bg-[#0d1117] border border-gray-600 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && handleCheckout(tier)}
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => handleCheckout(tier)}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition text-sm"
          >
            {loading ? "Redirecting..." : "Continue to checkout →"}
          </button>
          <button
            onClick={cancelTier}
            className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition text-sm"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0d1117] text-white px-4 py-10 max-w-2xl mx-auto">

      {showSuccess && (
        <div className="mb-6 bg-green-900/40 border border-green-700 rounded-2xl p-5 text-center">
          <p className="text-green-300 font-semibold text-sm">Payment successful!</p>
          <p className="text-gray-400 text-sm mt-1">Your API key is being generated and will arrive in your inbox shortly.</p>
        </div>
      )}

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-3">PegCheck API</h1>
        <a
          href="https://chain.link"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mb-4 px-3 py-1.5 rounded-full text-xs font-semibold text-white no-underline"
          style={{ background: "#375BD2" }}
        >
          <span style={{ fontSize: "11px" }}>⬡</span>
          Powered by Chainlink
        </a>
        <p className="text-gray-400 text-base leading-relaxed">
          The most reliable stablecoin depeg monitoring API available.
          Median-of-medians pricing across 1,500+ data points.
          Built for wallets, exchanges, and DeFi applications.
        </p>
      </div>

      {/* What you get */}
      <div className="bg-[#161b22] rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">What you get</h2>
        <ul className="space-y-3 text-gray-300 text-sm">
          <li className="flex items-start gap-3">
            <span className="text-green-400 mt-0.5">✓</span>
            Real-time prices across 19 stablecoins
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-400 mt-0.5">✓</span>
            Median-of-medians pricing — 1,500+ data points, one reliable number
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-400 mt-0.5">✓</span>
            Instant depeg status — stable, warning, or depegged
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-400 mt-0.5">✓</span>
            Full price history with depeg event flagging
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-400 mt-0.5">✓</span>
            Webhook alerts — get notified the instant a depeg occurs
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-400 mt-0.5">✓</span>
            Simple REST API — integrate in minutes
          </li>
        </ul>
      </div>

      {/* Quick example */}
      <div className="bg-[#161b22] rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Simple to integrate</h2>
        <div className="bg-[#0d1117] rounded-xl p-4 text-sm font-mono text-gray-300 overflow-x-auto">
          <p className="text-gray-500 mb-2">// Get all stablecoin prices</p>
          <p><span className="text-blue-400">fetch</span>(<span className="text-green-400">&quot;https://pegcheck.uk/api/v1/coins&quot;</span>, {"{"}</p>
          <p className="pl-4">headers: {"{"} <span className="text-yellow-400">Authorization</span>: <span className="text-green-400">&quot;Bearer YOUR_KEY&quot;</span> {"}"}</p>
          <p>{"}"})</p>
        </div>
      </div>

      {/* npm SDK */}
      <div className="bg-[#161b22] rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-semibold">npm SDK</h2>
          <div className="flex items-center gap-3 text-xs">
            <a href="https://www.npmjs.com/package/pegcheck-js" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition">
              <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor"><path d="M0 0h18v18H0zm2 2v14h7V5h5v11h2V2H2z"/></svg>
              npmjs.com
            </a>
            <a href="https://github.com/matsblocknode1957-oss/pegcheck-js" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-gray-400 hover:text-gray-300 transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.1.82-.26.82-.58v-2.03c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02.01 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.65.25 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>
              GitHub
            </a>
          </div>
        </div>
        <div className="bg-[#0d1117] rounded-xl px-4 py-3 text-sm font-mono mb-4 flex items-center gap-3">
          <span className="text-gray-500 select-none">$</span>
          <span className="text-green-400">npm install pegcheck-js</span>
        </div>
        <div className="bg-[#0d1117] rounded-xl p-4 text-sm font-mono text-gray-300 overflow-x-auto">
          <p className="text-gray-500 mb-2">// Get all stablecoin prices with the SDK</p>
          <p><span className="text-blue-400">const</span> PegCheck = <span className="text-yellow-400">require</span>(<span className="text-green-400">&apos;pegcheck-js&apos;</span>)</p>
          <p><span className="text-blue-400">const</span> client = <span className="text-blue-400">new</span> <span className="text-yellow-400">PegCheck</span>(<span className="text-green-400">&apos;your-api-key&apos;</span>)</p>
          <p><span className="text-blue-400">const</span> prices = <span className="text-blue-400">await</span> client.<span className="text-yellow-400">getAllPrices</span>()</p>
        </div>
      </div>

      {/* Pricing */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">Pricing</h2>
        <div className="space-y-4">

          {/* Starter */}
          <div className="bg-[#161b22] rounded-2xl p-6">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-white">Starter</h3>
                <p className="text-gray-400 text-sm">Perfect for small projects</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold">£99</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
            </div>
            <ul className="text-gray-300 text-sm space-y-2 mb-5">
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 10,000 API calls/month</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> All 19 stablecoins</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Price history</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Email support</li>
            </ul>
            {selectedTier === "starter" ? (
              <CheckoutForm tier="starter" />
            ) : (
              <button
                onClick={() => selectTier("starter")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
              >
                Start Free Trial
              </button>
            )}
          </div>

          {/* Pro */}
          <div className="bg-[#161b22] rounded-2xl p-6 border border-blue-500">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-white">Pro <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full ml-1">Popular</span></h3>
                <p className="text-gray-400 text-sm">For growing applications</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold">£249</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
            </div>
            <ul className="text-gray-300 text-sm space-y-2 mb-5">
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 100,000 API calls/month</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> All 19 stablecoins</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Price history</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Webhook alerts</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Priority support</li>
            </ul>
            {selectedTier === "pro" ? (
              <CheckoutForm tier="pro" />
            ) : (
              <button
                onClick={() => selectTier("pro")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
              >
                Start Free Trial
              </button>
            )}
          </div>

          {/* Enterprise */}
          <div className="bg-[#161b22] rounded-2xl p-6">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-white">Enterprise</h3>
                <p className="text-gray-400 text-sm">For serious infrastructure</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold">£499</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
            </div>
            <ul className="text-gray-300 text-sm space-y-2 mb-5">
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Unlimited API calls</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Webhook alerts</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 99.9% SLA</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Custom coins</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Dedicated support</li>
            </ul>
            {selectedTier === "enterprise" ? (
              <CheckoutForm tier="enterprise" />
            ) : (
              <button
                onClick={() => selectTier("enterprise")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
              >
                Start Free Trial
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Free trial note */}
      <div className="bg-[#161b22] rounded-2xl p-6 mb-6 text-center">
        <p className="text-gray-300 text-sm">
          🎉 <span className="text-white font-semibold">30 day free trial</span> on all plans. No credit card required.
        </p>
      </div>

      {/* Dashboard link */}
      <div className="bg-[#161b22] rounded-2xl p-5 mb-6 flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-semibold">Already have an API key?</p>
          <p className="text-gray-400 text-xs mt-0.5">View usage stats and copy your key.</p>
        </div>
        <a href="/dashboard" className="shrink-0 bg-[#0d1117] border border-gray-700 hover:border-blue-500 text-blue-400 text-sm font-semibold px-4 py-2 rounded-xl transition whitespace-nowrap">
          View dashboard →
        </a>
      </div>

      {/* Docs link */}
      <div className="text-center">
        <p className="text-gray-400 text-sm mb-2">Want to see the full API documentation?</p>
        <a href="/developers/docs" className="text-blue-400 underline text-sm">View API Docs →</a>
      </div>

    </main>
  );
}
