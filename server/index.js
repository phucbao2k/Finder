require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.SERPAPI_KEY;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map(value => value.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (
      !origin ||
      ALLOWED_ORIGINS.includes("*") ||
      ALLOWED_ORIGINS.includes(origin)
    ) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed by CORS"));
  }
}));

app.use(express.json({ limit: "32kb" }));

// Resolve public relative to this file, not the process working directory.
const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir));

function clean(value, maxLength = 300) {
  return String(value ?? "").trim().slice(0, maxLength);
}

// Small in-memory cache. It is cleared when the Render service restarts.
const cache = new Map();
const inFlight = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ITEMS = 150;

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  // Refresh insertion order so recently used entries are retained.
  cache.delete(key);
  cache.set(key, entry);
  return entry.data;
}

function setCache(key, data) {
  if (cache.size >= MAX_CACHE_ITEMS) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }

  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

async function serpSearch(params) {
  if (!API_KEY) {
    const error = new Error(
      "Backend chưa có SERPAPI_KEY. Hãy thêm biến này trong Render → Environment."
    );
    error.status = 503;
    throw error;
  }

  const url = new URL("https://serpapi.com/search.json");

  for (const [key, value] of Object.entries({
    ...params,
    api_key: API_KEY
  })) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(40000)
  });

  const raw = await response.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    data = {};
  }

  if (!response.ok || data.error) {
    const detail = clean(data.error || raw || `HTTP ${response.status}`, 240);
    const error = new Error(
      `SerpAPI trả lỗi${response.status ? ` HTTP ${response.status}` : ""}: ${detail}`
    );
    error.status = 502;
    throw error;
  }

  return data;
}

function normalizeWebResults(data) {
  return (data.organic_results || [])
    .slice(0, 20)
    .map(item => ({
      title: clean(item.title, 300),
      snippet: clean(item.snippet, 900),
      link: item.link || "",
      displayedLink: clean(item.displayed_link, 200),
      date: clean(item.date, 80),
      source: clean(item.source || item.displayed_link, 120)
    }))
    .filter(item => item.title && item.link);
}

function normalizeImages(data) {
  return (data.images_results || [])
    .slice(0, 30)
    .map(item => ({
      title: clean(item.title, 300),
      thumbnail: item.thumbnail || item.original || "",
      original: item.original || "",
      source: clean(item.source, 120),
      link: item.link || ""
    }))
    .filter(item => item.thumbnail);
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "JAV Discovery Engine API",
    provider: "SerpAPI",
    providerConfigured: Boolean(API_KEY)
  });
});

app.get("/api/config", (_req, res) => {
  res.json({
    providerConfigured: Boolean(API_KEY),
    provider: "SerpAPI",
    version: "3.0.0"
  });
});

app.post("/api/search", async (req, res) => {
  const query = clean(req.body?.query, 500);
  const mode = req.body?.mode === "images" ? "images" : "web";
  const sort = req.body?.sort === "newest" && mode === "web" ? "newest" : "relevance";

  if (!query) {
    return res.status(400).json({
      error: "Vui lòng nhập mô tả hoặc từ khóa tìm kiếm."
    });
  }

  if (!API_KEY) {
    return res.status(503).json({
      error: "Backend chưa được cấu hình SERPAPI_KEY trên Render."
    });
  }

  const cacheKey = `${mode}:${sort}:${query.toLocaleLowerCase()}`;
  const cached = getCache(cacheKey);

  if (cached) {
    res.set("X-Cache", "HIT");
    return res.json(cached);
  }

  // Coalesce identical simultaneous requests into one SerpAPI request.
  if (inFlight.has(cacheKey)) {
    try {
      const result = await inFlight.get(cacheKey);
      res.set("X-Cache", "COALESCED");
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 502).json({ error: error.message });
    }
  }

  const task = (async () => {
    const data = await serpSearch({
      engine: mode === "images" ? "google_images" : "google",
      q: query,
      google_domain: "google.co.jp",
      gl: "jp",
      hl: "ja",
      safe: "off",
      ...(sort === "newest" ? { tbs: "sbd:1" } : {})
    });

    let result;

    if (mode === "images") {
      result = {
        query,
        mode,
        images: normalizeImages(data)
      };
    } else {
      result = {
        query,
        mode,
        sort,
        results: normalizeWebResults(data),
        knowledgeGraph: data.knowledge_graph
          ? {
              title: clean(data.knowledge_graph.title, 200),
              description: clean(data.knowledge_graph.description, 500)
            }
          : null
      };
    }

    setCache(cacheKey, result);
    return result;
  })();

  inFlight.set(cacheKey, task);

  try {
    const result = await task;
    res.set("X-Cache", "MISS");
    return res.json(result);
  } catch (error) {
    console.error("Search error:", error.message);
    return res.status(error.status || 500).json({
      error: error.message || "Không thể thực hiện tìm kiếm."
    });
  } finally {
    inFlight.delete(cacheKey);
  }
});


app.listen(PORT, () => {
  console.log(`JAV Discovery Engine listening on port ${PORT}`);
});
