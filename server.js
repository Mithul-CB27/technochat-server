const express = require("express");
const cors    = require("cors");
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_KEY      = process.env.SUPABASE_KEY;

// ── Proxy: Anthropic API ──────────────────────────────────────────────────────
app.post("/api/claude", async (req, res) => {
  try {
    const payload = {
      model:      "claude-sonnet-4-20250514",
      max_tokens: req.body.max_tokens || 1000,
      system:     req.body.system,
      messages:   req.body.messages,
    };
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (data.error) console.error("[Claude error]", data.error);
    res.json(data);
  } catch (err) {
    console.error("[Claude]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Proxy: Supabase SQL execution ─────────────────────────────────────────────
app.post("/api/query", async (req, res) => {
  try {
    const { sql } = req.body;
    console.log("[SQL]", sql?.slice(0, 120));

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    const text = await response.text();
    console.log("[Supabase raw]", text.slice(0, 200));

    if (!response.ok) {
      return res.status(response.status).json({ error: text });
    }

    let data;
    try { data = JSON.parse(text); } catch { data = []; }

    // exec_sql returns JSON array directly
    res.json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("[Query]", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n✓ Proxy server running at http://localhost:${PORT}`);
  console.log(`  Anthropic API key: ${ANTHROPIC_API_KEY ? "found ✓" : "MISSING ✗"}`);
  console.log(`  Supabase URL:      ${SUPABASE_URL      ? "found ✓" : "MISSING ✗"}`);
  console.log(`  Supabase Key:      ${SUPABASE_KEY      ? "found ✓" : "MISSING ✗"}\n`);
});
