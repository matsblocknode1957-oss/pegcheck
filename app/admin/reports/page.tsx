"use client";

import { useState, useEffect, useCallback } from "react";

interface ReportSend {
  email: string;
  report_date: string;
  type: string;
  created_at: string;
}

export default function ReportsAdminPage() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<Record<string, unknown> | null>(null);
  const [customEmail, setCustomEmail] = useState("");
  const [sendingCustom, setSendingCustom] = useState(false);
  const [sentCustom, setSentCustom] = useState(false);
  const [recentSends, setRecentSends] = useState<ReportSend[]>([]);
  const [loadingSends, setLoadingSends] = useState(true);

  const fetchRecentSends = useCallback(async () => {
    try {
      const res = await fetch("/api/reports/weekly");
      const data = await res.json();
      setRecentSends(data.sends ?? []);
    } catch {
      // silently ignore
    } finally {
      setLoadingSends(false);
    }
  }, []);

  useEffect(() => { fetchRecentSends(); }, [fetchRecentSends]);

  async function sendReport(to: string, setLoading: (v: boolean) => void, onDone: () => void) {
    setLoading(true);
    setError(null);
    setLastResponse(null);
    try {
      const res = await fetch("/api/reports/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, type: "manual" }),
      });
      const data = await res.json();
      setLastResponse(data);
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      onDone();
      fetchRecentSends();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9", fontFamily: "monospace", padding: "48px 24px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px", color: "#f8fafc" }}>
          Weekly Report Admin
        </h1>
        <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "40px" }}>
          Send the weekly stablecoin risk report email.
        </p>

        {/* Test send */}
        <section style={{ background: "#1e293b", borderRadius: "10px", padding: "24px", marginBottom: "20px", border: "1px solid #334155" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0", marginBottom: "12px" }}>Test Report</h2>
          <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "16px" }}>
            Sends to <span style={{ color: "#94a3b8" }}>matsblocknode1957@gmail.com</span>
          </p>
          <button
            disabled={sending}
            onClick={() =>
              sendReport("matsblocknode1957@gmail.com", setSending, () => setSent("matsblocknode1957@gmail.com"))
            }
            style={{
              background: sending ? "#334155" : "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "10px 20px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: sending ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {sending ? "Sending…" : "Send Test Report"}
          </button>
          {sent && (
            <p style={{ marginTop: "12px", fontSize: "13px", color: "#4ade80" }}>
              Report sent to {sent}
            </p>
          )}
        </section>

        {/* Custom address */}
        <section style={{ background: "#1e293b", borderRadius: "10px", padding: "24px", marginBottom: "20px", border: "1px solid #334155" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0", marginBottom: "12px" }}>Send to Address</h2>
          <input
            type="email"
            placeholder="email@example.com"
            value={customEmail}
            onChange={(e) => { setCustomEmail(e.target.value); setSentCustom(false); }}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "6px",
              padding: "10px 12px",
              fontSize: "13px",
              color: "#f1f5f9",
              marginBottom: "12px",
              outline: "none",
            }}
          />
          <button
            disabled={sendingCustom || !customEmail}
            onClick={() =>
              sendReport(customEmail, setSendingCustom, () => setSentCustom(true))
            }
            style={{
              background: sendingCustom || !customEmail ? "#334155" : "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "10px 20px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: sendingCustom || !customEmail ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {sendingCustom ? "Sending…" : "Send Report"}
          </button>
          {sentCustom && (
            <p style={{ marginTop: "12px", fontSize: "13px", color: "#4ade80" }}>
              Report sent to {customEmail}
            </p>
          )}
        </section>

        {error && (
          <p style={{ fontSize: "13px", color: "#f87171", marginTop: "8px", marginBottom: "16px" }}>
            Error: {error}
          </p>
        )}

        {lastResponse && (
          <section style={{ background: "#1e293b", borderRadius: "10px", padding: "16px", marginBottom: "20px", border: "1px solid #334155" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px" }}>API Response</div>
            <pre style={{ margin: 0, fontSize: "11px", color: "#94a3b8", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {JSON.stringify(lastResponse, null, 2)}
            </pre>
          </section>
        )}

        {/* Recent Sends */}
        <section style={{ background: "#1e293b", borderRadius: "10px", padding: "24px", border: "1px solid #334155" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0", margin: 0 }}>Recent Sends</h2>
            <button
              onClick={fetchRecentSends}
              style={{ fontSize: "11px", color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Refresh
            </button>
          </div>

          {loadingSends ? (
            <p style={{ fontSize: "12px", color: "#4b5563", margin: 0 }}>Loading…</p>
          ) : recentSends.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#4b5563", margin: 0 }}>No sends recorded yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Email", "Report Date", "Type", "Sent At"].map(h => (
                    <th key={h} style={{ textAlign: "left", fontSize: "10px", fontWeight: 700, color: "#4b5563", letterSpacing: "1px", textTransform: "uppercase", paddingBottom: "8px", borderBottom: "1px solid #334155" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentSends.map((s, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={{ padding: "8px 0", fontSize: "12px", color: "#cbd5e1", paddingRight: "12px" }}>{s.email}</td>
                    <td style={{ padding: "8px 0", fontSize: "12px", color: "#94a3b8", paddingRight: "12px", fontVariantNumeric: "tabular-nums" }}>{s.report_date}</td>
                    <td style={{ padding: "8px 0", paddingRight: "12px" }}>
                      <span style={{
                        fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px",
                        background: s.type === "automated" ? "#1e3a5f" : "#1e293b",
                        color: s.type === "automated" ? "#60a5fa" : "#94a3b8",
                        border: `1px solid ${s.type === "automated" ? "rgba(96,165,250,.3)" : "#334155"}`,
                      }}>
                        {s.type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "8px 0", fontSize: "11px", color: "#4b5563", fontVariantNumeric: "tabular-nums" }}>
                      {new Date(s.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
