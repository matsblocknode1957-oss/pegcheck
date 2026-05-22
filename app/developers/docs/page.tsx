export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[#0d1117] text-white px-4 py-10 max-w-2xl mx-auto">

      {/* Header */}
      <div className="mb-10">
        <a href="/developers" className="text-blue-400 text-sm hover:underline">← Back to API</a>
        <h1 className="text-3xl font-bold mt-4 mb-2">API Reference</h1>
        <p className="text-gray-400 text-base leading-relaxed">
          All endpoints are REST, return JSON, and require an API key.
          Base URL: <span className="font-mono text-gray-300">https://pegcheck.uk</span>
        </p>
      </div>

      {/* Authentication */}
      <div className="bg-[#161b22] rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">Authentication</h2>
        <p className="text-gray-400 text-sm mb-4">
          Pass your API key as a Bearer token in the <span className="font-mono text-gray-300">Authorization</span> header on every request.
        </p>
        <CodeBlock lines={[
          { color: "gray", text: "// Every request needs this header" },
          { color: "white", text: 'Authorization: Bearer YOUR_API_KEY' },
        ]} />
        <div className="mt-4 space-y-2 text-sm text-gray-400">
          <p>Missing or invalid keys return <span className="font-mono text-red-400">401 Unauthorized</span>.</p>
        </div>
      </div>

      {/* Stablecoins */}
      <div className="bg-[#161b22] rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">Supported stablecoins</h2>
        <p className="text-gray-400 text-sm mb-4">Use these slugs in any endpoint that accepts a <span className="font-mono text-gray-300">[slug]</span> parameter.</p>
        <div className="grid grid-cols-2 gap-2">
          {["usdt", "usdc", "usds", "ethena", "pyusd", "fdusd", "rlusd", "tusd", "frax", "gho", "crvusd", "lusd", "usdp", "usdd", "mkusd", "eurc", "dola", "alusd", "bold"].map((slug) => (
            <div key={slug} className="bg-[#0d1117] rounded-lg px-3 py-2 font-mono text-sm text-blue-400">{slug}</div>
          ))}
        </div>
      </div>

      {/* Endpoint 1 */}
      <EndpointSection
        method="GET"
        path="/api/v1/coins"
        title="List all coins"
        description="Returns the latest price, deviation, and depeg status for all 8 stablecoins."
        request={[
          { color: "blue", text: "fetch" },
          { color: "white", text: '("https://pegcheck.uk/api/v1/coins", {' },
          { color: "white", text: '  headers: {' },
          { color: "yellow", text: '    Authorization', after: ': "Bearer YOUR_API_KEY"' },
          { color: "white", text: "  }" },
          { color: "white", text: "})" },
        ]}
        response={`{
  "coins": [
    {
      "slug": "usdt",
      "price": 0.9998,
      "deviation": -0.02,
      "status": "stable",
      "updated_at": "2024-01-15T10:30:00Z"
    },
    {
      "slug": "usdc",
      "price": 1.0001,
      "deviation": 0.01,
      "status": "stable",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 8
}`}
      />

      {/* Endpoint 2 */}
      <EndpointSection
        method="GET"
        path="/api/v1/coins/[slug]"
        title="Get single coin"
        description="Returns the latest price and status for one stablecoin."
        request={[
          { color: "blue", text: "fetch" },
          { color: "white", text: '("https://pegcheck.uk/api/v1/coins/usdc", {' },
          { color: "white", text: '  headers: {' },
          { color: "yellow", text: '    Authorization', after: ': "Bearer YOUR_API_KEY"' },
          { color: "white", text: "  }" },
          { color: "white", text: "})" },
        ]}
        response={`{
  "slug": "usdc",
  "price": 1.0001,
  "deviation": 0.01,
  "status": "stable",
  "updated_at": "2024-01-15T10:30:00Z"
}`}
        fields={[
          { name: "price", type: "number", desc: "Current USD price" },
          { name: "deviation", type: "number", desc: "Percentage deviation from $1.00 (negative = below peg)" },
          { name: "status", type: "string", desc: '"stable" | "warning" (≥1%) | "depegged" (≥3%)' },
        ]}
      />

      {/* Endpoint 3 */}
      <EndpointSection
        method="GET"
        path="/api/v1/coins/[slug]/history"
        title="Price history"
        description="Returns up to 100 price snapshots for a coin. Filter by date range with optional query parameters."
        params={[
          { name: "from", required: false, desc: "ISO 8601 start date — e.g. 2024-01-01T00:00:00Z" },
          { name: "to", required: false, desc: "ISO 8601 end date" },
          { name: "interval", required: false, desc: 'Label for the range (default: "24h") — informational only, does not affect filtering' },
        ]}
        request={[
          { color: "blue", text: "fetch" },
          { color: "white", text: '("https://pegcheck.uk/api/v1/coins/usdt/history' },
          { color: "green", text: "  ?from=2024-01-01T00:00:00Z&to=2024-01-02T00:00:00Z" },
          { color: "white", text: '", {' },
          { color: "white", text: '  headers: {' },
          { color: "yellow", text: '    Authorization', after: ': "Bearer YOUR_API_KEY"' },
          { color: "white", text: "  }" },
          { color: "white", text: "})" },
        ]}
        response={`{
  "slug": "usdt",
  "interval": "24h",
  "history": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "price": 0.9998,
      "deviation": -0.02,
      "status": "stable"
    },
    {
      "timestamp": "2024-01-15T09:30:00Z",
      "price": 0.9701,
      "deviation": -2.99,
      "status": "warning"
    }
  ],
  "depeg_events": [],
  "total": 2
}`}
      />

      {/* Endpoint 4 */}
      <EndpointSection
        method="GET"
        path="/api/v1/alerts/status"
        title="Active alerts"
        description="Returns all coins currently off-peg by 1% or more. Empty array means everything is stable."
        request={[
          { color: "blue", text: "fetch" },
          { color: "white", text: '("https://pegcheck.uk/api/v1/alerts/status", {' },
          { color: "white", text: '  headers: {' },
          { color: "yellow", text: '    Authorization', after: ': "Bearer YOUR_API_KEY"' },
          { color: "white", text: "  }" },
          { color: "white", text: "})" },
        ]}
        response={`{
  "alerts": [
    {
      "coin": "USDT",
      "price": 0.9650,
      "deviation": -3.5,
      "severity": "depegged",
      "triggered_at": "2024-01-15T10:30:00Z"
    }
  ],
  "all_stable": false
}`}
        fields={[
          { name: "severity", type: "string", desc: '"warning" (≥1%) | "depegged" (≥3%)' },
          { name: "all_stable", type: "boolean", desc: "True when alerts array is empty — safe to use as a health check" },
        ]}
      />

      {/* Endpoint 5 */}
      <EndpointSection
        method="POST"
        path="/api/v1/webhooks/register"
        title="Register a webhook"
        description="PegCheck will POST to your URL whenever a coin crosses the threshold you specify."
        request={[
          { color: "blue", text: "fetch" },
          { color: "white", text: '("https://pegcheck.uk/api/v1/webhooks/register", {' },
          { color: "white", text: '  method: "POST",' },
          { color: "white", text: '  headers: {' },
          { color: "yellow", text: '    Authorization', after: ': "Bearer YOUR_API_KEY",' },
          { color: "yellow", text: '    "Content-Type"', after: ': "application/json"' },
          { color: "white", text: '  },' },
          { color: "white", text: '  body: JSON.stringify({' },
          { color: "white", text: '    url: "https://your-app.com/webhook",' },
          { color: "white", text: '    threshold: 1.5,' },
          { color: "white", text: '    coins: ["usdt", "usdc"],' },
          { color: "white", text: '    api_key: "YOUR_API_KEY"' },
          { color: "white", text: '  })' },
          { color: "white", text: "})" },
        ]}
        response={`{
  "message": "Webhook registered successfully",
  "webhook": {
    "id": 42,
    "url": "https://your-app.com/webhook",
    "threshold": 1.5,
    "coins": "usdt,usdc",
    "api_key": "YOUR_API_KEY"
  }
}`}
        bodyFields={[
          { name: "url", required: true, type: "string", desc: "HTTPS URL to receive POST notifications" },
          { name: "threshold", required: false, type: "number", desc: "Deviation % that triggers a call (default: 1.0)" },
          { name: "coins", required: false, type: "string[]", desc: 'Array of slugs to watch (omit for "all")' },
          { name: "api_key", required: true, type: "string", desc: "Your API key — used to identify the webhook owner" },
        ]}
      />

      {/* Error codes */}
      <div className="bg-[#161b22] rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Error codes</h2>
        <div className="space-y-3 text-sm">
          {[
            { code: "401", label: "Unauthorized", desc: "Missing or invalid API key" },
            { code: "400", label: "Bad Request", desc: "Missing required field or invalid parameter" },
            { code: "404", label: "Not Found", desc: "Slug not recognised or no data available" },
            { code: "500", label: "Server Error", desc: "Something went wrong on our end — try again" },
          ].map(({ code, label, desc }) => (
            <div key={code} className="flex gap-4 items-start">
              <span className="font-mono text-red-400 w-8 shrink-0">{code}</span>
              <span className="text-white w-28 shrink-0">{label}</span>
              <span className="text-gray-400">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Back link */}
      <div className="text-center">
        <a href="/developers" className="text-blue-400 underline text-sm">← Back to pricing</a>
      </div>

    </main>
  );
}

/* ─── Sub-components ─────────────────────────────────── */

type CodeLine = {
  color: "gray" | "white" | "blue" | "green" | "yellow";
  text: string;
  after?: string;
};

function CodeBlock({ lines }: { lines: CodeLine[] }) {
  const colorMap: Record<CodeLine["color"], string> = {
    gray: "text-gray-500",
    white: "text-gray-300",
    blue: "text-blue-400",
    green: "text-green-400",
    yellow: "text-yellow-400",
  };
  return (
    <div className="bg-[#0d1117] rounded-xl p-4 text-sm font-mono overflow-x-auto">
      {lines.map((line, i) => (
        <p key={i} className={colorMap[line.color]}>
          {line.text}
          {line.after && <span className="text-gray-300">{line.after}</span>}
        </p>
      ))}
    </div>
  );
}

function ResponseBlock({ json }: { json: string }) {
  return (
    <div className="bg-[#0d1117] rounded-xl p-4 text-sm font-mono text-gray-300 overflow-x-auto whitespace-pre">
      {json}
    </div>
  );
}

type Field = { name: string; type: string; desc: string };
type Param = { name: string; required: boolean; desc: string };
type BodyField = { name: string; required: boolean; type: string; desc: string };

function EndpointSection({
  method,
  path,
  title,
  description,
  params,
  request,
  response,
  fields,
  bodyFields,
}: {
  method: "GET" | "POST";
  path: string;
  title: string;
  description: string;
  params?: Param[];
  request: CodeLine[];
  response: string;
  fields?: Field[];
  bodyFields?: BodyField[];
}) {
  const methodColor = method === "GET" ? "text-green-400" : "text-blue-400";
  return (
    <div className="bg-[#161b22] rounded-2xl p-6 mb-6">
      <div className="flex items-center gap-3 mb-1">
        <span className={`font-mono text-sm font-bold ${methodColor}`}>{method}</span>
        <span className="font-mono text-gray-300 text-sm">{path}</span>
      </div>
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      <p className="text-gray-400 text-sm mb-4">{description}</p>

      {params && params.length > 0 && (
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Query parameters</p>
          <div className="space-y-2">
            {params.map((p) => (
              <div key={p.name} className="flex gap-3 text-sm">
                <span className="font-mono text-yellow-400 w-20 shrink-0">{p.name}</span>
                <span className={`shrink-0 text-xs mt-0.5 ${p.required ? "text-red-400" : "text-gray-500"}`}>
                  {p.required ? "required" : "optional"}
                </span>
                <span className="text-gray-400">{p.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {bodyFields && bodyFields.length > 0 && (
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Request body</p>
          <div className="space-y-2">
            {bodyFields.map((f) => (
              <div key={f.name} className="flex gap-3 text-sm">
                <span className="font-mono text-yellow-400 w-24 shrink-0">{f.name}</span>
                <span className="font-mono text-blue-300 text-xs mt-0.5 w-16 shrink-0">{f.type}</span>
                <span className={`shrink-0 text-xs mt-0.5 w-14 ${f.required ? "text-red-400" : "text-gray-500"}`}>
                  {f.required ? "required" : "optional"}
                </span>
                <span className="text-gray-400">{f.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Request</p>
      <CodeBlock lines={request} />

      <p className="text-xs uppercase tracking-wider text-gray-500 mt-4 mb-2">Response</p>
      <ResponseBlock json={response} />

      {fields && fields.length > 0 && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Response fields</p>
          <div className="space-y-2">
            {fields.map((f) => (
              <div key={f.name} className="flex gap-3 text-sm">
                <span className="font-mono text-blue-400 w-24 shrink-0">{f.name}</span>
                <span className="font-mono text-gray-500 text-xs mt-0.5 w-14 shrink-0">{f.type}</span>
                <span className="text-gray-400">{f.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
