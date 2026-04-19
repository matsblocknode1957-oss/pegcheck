export default function DevelopersPage() {
  return (
    <main className="min-h-screen bg-[#0d1117] text-white px-4 py-10 max-w-2xl mx-auto">

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">PegCheck API</h1>
        <p className="text-gray-400 text-base leading-relaxed">
          The most reliable stablecoin depeg monitoring API available. 
          Median-of-medians pricing across 1,000+ data points. 
          Built for wallets, exchanges, and DeFi applications.
        </p>
      </div>

      {/* What you get */}
      <div className="bg-[#161b22] rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">What you get</h2>
        <ul className="space-y-3 text-gray-300 text-sm">
          <li className="flex items-start gap-3">
            <span className="text-green-400 mt-0.5">✓</span>
            Real-time prices across 8 major stablecoins
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-400 mt-0.5">✓</span>
            Median-of-medians pricing — 1,000+ data points, one reliable number
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
          <p><span className="text-blue-400">fetch</span>(<span className="text-green-400">"https://pegcheck.uk/api/v1/coins"</span>, {"{"}</p>
          <p className="pl-4">headers: {"{"} <span className="text-yellow-400">Authorization</span>: <span className="text-green-400">"Bearer YOUR_KEY"</span> {"}"}</p>
          <p>{"}"})</p>
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
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> All 8 stablecoins</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Price history</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Email support</li>
            </ul>
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition">
              Start Free Trial
            </button>
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
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> All 8 stablecoins</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Price history</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Webhook alerts</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Priority support</li>
            </ul>
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition">
              Start Free Trial
            </button>
          </div>

          {/* Enterprise */}
          <div className="bg-[#161b22] rounded-2xl p-6">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-white">Enterprise</h3>
                <p className="text-gray-400 text-sm">For serious infrastructure</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold">£499+</span>
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
            <button className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition">
              Contact Us
            </button>
          </div>
        </div>
      </div>

      {/* Free trial note */}
      <div className="bg-[#161b22] rounded-2xl p-6 mb-6 text-center">
        <p className="text-gray-300 text-sm">
          🎉 <span className="text-white font-semibold">30 day free trial</span> on all plans. No credit card required.
        </p>
      </div>

      {/* Docs link */}
      <div className="text-center">
        <p className="text-gray-400 text-sm mb-2">Want to see the full API documentation?</p>
        <a href="/developers/docs" className="text-blue-400 underline text-sm">View API Docs →</a>
      </div>

    </main>
  );
}