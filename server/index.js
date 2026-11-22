require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.SERPAPI_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map(x => x.trim());

app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "32kb" }));
app.use(express.static("public"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "JAV Discovery Engine API", providerConfigured: Boolean(API_KEY) });
});

function clean(value, max = 300) {
  return String(value || "").trim().slice(0, max);
}

async function serpSearch(params) {
  if (!API_KEY) {
    const error = new Error("Backend chưa được cấu hình SERPAPI_KEY.");
    error.status = 503;
    throw error;
  }
  const url = new URL("https://serpapi.com/search.json");
  for (const [key, value] of Object.entries({ ...params, api_key: API_KEY })) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  }
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Search provider trả lỗi HTTP ${response.status}: ${body.slice(0, 240)}`);
    error.status = 502;
    throw error;
  }
  return response.json();
}

app.post("/api/search", async (req, res) => {
  try {
    const query = clean(req.body?.query, 500);
    const mode = req.body?.mode === "images" ? "images" : "web";
    if (!query) return res.status(400).json({ error: "Vui lòng nhập nội dung tìm kiếm." });

    const data = await serpSearch({
      engine: mode === "images" ? "google_images" : "google",
      q: query,
      google_domain: "google.com",
      gl: "vn",
      hl: "vi",
      safe: "active"
    });

    if (mode === "images") {
      const images = (data.images_results || []).slice(0, 30).map(item => ({
        title: clean(item.title, 300),
        thumbnail: item.thumbnail || item.original || "",
        original: item.original || "",
        source: item.source || "",
        link: item.link || ""
      })).filter(item => item.thumbnail);
      return res.json({ query, mode, images });
    }

    const results = (data.organic_results || []).slice(0, 20).map(item => ({
      title: clean(item.title, 300),
      snippet: clean(item.snippet, 900),
      link: item.link || "",
      displayedLink: clean(item.displayed_link, 200),
      date: clean(item.date, 80),
      source: clean(item.source, 120)
    })).filter(item => item.title && item.link);

    res.json({ query, mode, results, knowledgeGraph: data.knowledge_graph ? {
      title: clean(data.knowledge_graph.title, 200),
      description: clean(data.knowledge_graph.description, 500)
    } : null });
  } catch (error) {
    console.error("Search error:", error.message);
    res.status(error.status || 500).json({ error: error.message || "Không thể thực hiện tìm kiếm." });
  }
});

app.get("/api/config", (_req, res) => {
  res.json({ providerConfigured: Boolean(API_KEY), provider: "SerpAPI", version: "2.0.0" });
});

app.listen(PORT, () => console.log(`JAV Discovery Engine API listening on ${PORT}`));
