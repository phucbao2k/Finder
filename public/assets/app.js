(() => {
  "use strict";

  const DEFAULT_API_BASE = "https://jav-discovery-engine-api.onrender.com";
  const $ = id => document.getElementById(id);

  const state = {
    apiBase: (localStorage.getItem("jde_api_base") || DEFAULT_API_BASE).replace(/\/+$/, ""),
    lastPrompt: "",
    searchBusy: false
  };

  const moodButtons = [...document.querySelectorAll(".chip")];

  function setStatus(message, isError = false) {
    const status = $("status");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("error", Boolean(isError));
  }

  function apiUrl(path) {
    return state.apiBase.replace(/\/+$/, "") + path;
  }

  function selectedMoods() {
    return moodButtons
      .filter(button => button.classList.contains("active"))
      .map(button => button.textContent.trim());
  }

  function buildTerms(text, selected, actress, maker) {
    const source = text.toLowerCase();
    const terms = [];

    const rules = [
      [/ntr|phản bội|ngoại tình|cắm sừng/, ["寝取られ", "浮気", "不倫"]],
      [/quyến rũ|dụ dỗ|cám dỗ/, ["誘惑", "小悪魔"]],
      [/trưởng thành|người vợ|vợ|人妻/, ["人妻", "熟女"]],
      [/diễn xuất tự nhiên|chân thực|diễn xuất/, ["自然な演技", "ドラマ"]],
      [/hài hước|đời thường/, ["コメディ", "日常"]],
      [/tâm lý|cốt truyện|kịch bản/, ["心理", "ストーリー", "ドラマ"]],
      [/giáo viên|cô giáo/, ["教師", "女教師"]],
      [/nữ nhân viên|công sở|văn phòng/, ["OL", "会社員"]],
      [/học sinh|sinh viên/, ["女子大生", "学生"]],
      [/mát xa|massage/, ["マッサージ", "エステ"]]
    ];

    for (const [pattern, words] of rules) {
      if (pattern.test(source)) terms.push(...words);
    }

    if (selected.some(value => /ntr/i.test(value))) {
      terms.push("寝取られ", "浮気");
    }
    if (selected.some(value => /trưởng thành|人妻/i.test(value))) {
      terms.push("人妻", "熟女");
    }
    if (selected.some(value => /tâm lý/i.test(value))) {
      terms.push("心理", "ストーリー");
    }

    if (actress) terms.push(actress);
    if (maker) terms.push(maker);

    if (!terms.length) {
      terms.push("AV", "作品", "女優", "品番");
    }

    return [...new Set(terms)];
  }

  async function requestJson(url, options = {}, timeoutMs = 100000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Máy chủ trả lỗi HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Quá thời gian chờ máy chủ. Render có thể đang khởi động lại; hãy thử lại sau.");
      }

      if (error instanceof TypeError) {
        throw new Error("Không kết nối được backend. Kiểm tra mạng hoặc URL Render.");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function apiSearch(query, mode) {
    return requestJson(
      apiUrl("/api/search"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode })
      },
      100000
    );
  }

  function makeLink(title, query) {
    const anchor = document.createElement("a");
    anchor.className = "query-link";
    anchor.href = "https://www.google.com/search?q=" + encodeURIComponent(query);
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";

    const heading = document.createElement("b");
    heading.textContent = title;

    const detail = document.createElement("span");
    detail.textContent = query;

    anchor.append(heading, detail);
    return anchor;
  }

  function renderResults(results) {
    const box = $("results");
    if (!box) return;

    box.replaceChildren();

    if (!results.length) {
      box.textContent = "Không tìm thấy kết quả web phù hợp. Thử mô tả hoặc từ khóa tiếng Nhật khác.";
      return;
    }

    for (const result of results) {
      const card = document.createElement("article");
      card.className = "card";

      const body = document.createElement("div");
      body.className = "cardbody";

      const heading = document.createElement("h3");
      heading.textContent = result.title || "Không có tiêu đề";

      const paragraph = document.createElement("p");
      paragraph.className = "meta";
      paragraph.textContent = result.snippet || "Nguồn không cung cấp mô tả.";

      const meta = document.createElement("div");
      meta.className = "small";
      meta.textContent = [result.source, result.date].filter(Boolean).join(" · ");

      const link = document.createElement("a");
      link.href = result.link || "#";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Mở nguồn ↗";

      body.append(heading, paragraph, meta, link);
      card.append(body);
      box.append(card);
    }
  }

  function renderImages(images) {
    const box = $("images");
    if (!box) return;

    box.replaceChildren();

    if (!images.length) {
      box.textContent = "Không tìm thấy ảnh phù hợp. Thử từ khóa khác.";
      return;
    }

    for (const item of images) {
      const card = document.createElement("article");
      card.className = "image-card";

      const anchor = document.createElement("a");
      anchor.href = item.original || item.link || item.thumbnail || "#";
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";

      const image = document.createElement("img");
      image.src = item.thumbnail;
      image.alt = item.title || "Search image";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";

      const caption = document.createElement("div");
      caption.textContent = [item.title, item.source].filter(Boolean).join(" · ");

      anchor.append(image);
      card.append(anchor, caption);
      box.append(card);
    }
  }

  function makePrompt({ brief, selected, actress, maker, era, priority }) {
    return [
      "Hãy nghiên cứu metadata phim JAV theo yêu cầu:",
      `Mô tả: ${brief || "Không giới hạn, suy luận từ mood và tiêu chí khác"}`,
      `Mood: ${selected.join(", ") || "Tự mô tả"}`,
      `Diễn viên: ${actress || "không giới hạn"}`,
      `Hãng/mã: ${maker || "không giới hạn"}`,
      `Thời kỳ: ${era || "không giới hạn"}`,
      `Ưu tiên: ${priority || "độ chính xác metadata"}`,
      "",
      "Tìm nhiều nguồn, mở rộng từ khóa tiếng Nhật. Trả bảng:",
      "Mã phim | Tên | Diễn viên | Hãng | Năm | Đặc điểm khớp | Mức xác minh | Nguồn.",
      "Không bịa mã phim. Phân biệt dữ kiện xác nhận và suy luận."
    ].join("\n");
  }

  async function runSearch() {
    if (state.searchBusy) return;

    const brief = $("brief")?.value.trim() || "";
    const actress = $("actress")?.value.trim() || "";
    const maker = $("maker")?.value.trim() || "";
    const era = $("era")?.value || "";
    const priority = $("priority")?.value || "";
    const selected = selectedMoods();

    if (!brief && !actress && !maker && !selected.length) {
      setStatus("Hãy nhập mô tả, diễn viên, hãng hoặc chọn ít nhất một mood.", true);
      return;
    }

    const terms = buildTerms(brief, selected, actress, maker);
    const query = [...terms, brief, era].filter(Boolean).join(" ").trim();

    if (!query) {
      setStatus("Chưa có từ khóa tìm kiếm.", true);
      return;
    }

    const searchButton = $("search");
    state.searchBusy = true;
    if (searchButton) searchButton.disabled = true;

    state.lastPrompt = makePrompt({
      brief, selected, actress, maker, era, priority
    });

    const queryLinks = $("queryLinks");
    if (queryLinks) {
      queryLinks.replaceChildren(
        makeLink("Google · metadata", query + " JAV 品番 女優 メーカー"),
        makeLink("Google Images · cover", query + " DVD ジャケット"),
        makeLink("Google Images · stills", query + " 場面 スチル")
      );
    }

    const panel = $("resultsPanel");
    if (panel) panel.classList.remove("hidden");

    if ($("results")) $("results").textContent = "Đang tìm metadata...";
    if ($("images")) $("images").textContent = "Đang tìm ảnh...";
    setStatus("Đang kết nối backend và tìm metadata + ảnh. Lần đầu có thể mất thêm thời gian nếu Render vừa ngủ.");

    const webQuery = query + " JAV 品番 女優 メーカー";
    const imageQuery = query + " JAV DVD cover scene";

    // Each section renders as soon as its own provider request completes.
    const webTask = apiSearch(webQuery, "web")
      .then(data => {
        const results = data.results || [];
        renderResults(results);
        setStatus(`Đã nhận ${results.length} kết quả metadata. Đang chờ ảnh...`);
        return data;
      })
      .catch(error => {
        if ($("results")) $("results").textContent = "Lỗi tìm metadata: " + error.message;
        throw error;
      });

    const imageTask = apiSearch(imageQuery, "images")
      .then(data => {
        const images = data.images || [];
        renderImages(images);
        return data;
      })
      .catch(error => {
        if ($("images")) $("images").textContent = "Lỗi tìm ảnh: " + error.message;
        throw error;
      });

    const [webOutcome, imageOutcome] = await Promise.allSettled([
      webTask,
      imageTask
    ]);

    if (webOutcome.status === "fulfilled" && imageOutcome.status === "fulfilled") {
      const webCount = (webOutcome.value.results || []).length;
      const imageCount = (imageOutcome.value.images || []).length;
      setStatus(`Hoàn tất: ${webCount} kết quả web · ${imageCount} ảnh. Hãy mở nguồn để kiểm chứng mã phim.`);
    } else if (webOutcome.status === "fulfilled") {
      setStatus("Đã có metadata nhưng phần tìm ảnh lỗi: " + imageOutcome.reason.message, true);
    } else if (imageOutcome.status === "fulfilled") {
      setStatus("Đã có ảnh nhưng phần tìm metadata lỗi: " + webOutcome.reason.message, true);
    } else {
      setStatus(
        "Tìm kiếm thất bại. Metadata: " + webOutcome.reason.message +
        " | Ảnh: " + imageOutcome.reason.message,
        true
      );
    }

    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });

    state.searchBusy = false;
    if (searchButton) searchButton.disabled = false;
  }

  async function checkBackend() {
    setStatus("Đang kiểm tra kết nối backend...");
    try {
      const data = await requestJson(apiUrl("/api/health"), {}, 100000);
      if (data.providerConfigured) {
        setStatus("Backend kết nối thành công · SerpAPI đã cấu hình.");
      } else {
        setStatus("Backend hoạt động nhưng chưa có SERPAPI_KEY trên Render.", true);
      }
    } catch (error) {
      setStatus("Không kết nối được backend: " + error.message, true);
    }
  }

  function initialize() {
    // Select Render by default so GitHub Pages does not call its own /api path.
    const apiInput = $("apiBase");
    if (apiInput) apiInput.value = state.apiBase;

    moodButtons.forEach(button => {
      button.addEventListener("click", () => {
        button.classList.toggle("active");
      });
    });

    $("search")?.addEventListener("click", runSearch);

    $("saveApi")?.addEventListener("click", async () => {
      const value = apiInput?.value.trim().replace(/\/+$/, "");
      if (!value) {
        setStatus("Hãy nhập URL backend Render.", true);
        return;
      }

      state.apiBase = value;
      localStorage.setItem("jde_api_base", state.apiBase);
      await checkBackend();
    });

    $("copyPrompt")?.addEventListener("click", async () => {
      if (!state.lastPrompt) {
        setStatus("Hãy tìm kiếm trước để tạo prompt.", true);
        return;
      }

      try {
        await navigator.clipboard.writeText(state.lastPrompt);
        setStatus("Đã copy prompt nghiên cứu cho ChatGPT.");
      } catch {
        setStatus("Trình duyệt không cho phép copy clipboard.", true);
      }
    });

    $("reset")?.addEventListener("click", () => {
      if ($("brief")) $("brief").value = "";
      if ($("actress")) $("actress").value = "";
      if ($("maker")) $("maker").value = "";
      if ($("era")) $("era").selectedIndex = 0;
      if ($("priority")) $("priority").selectedIndex = 0;

      moodButtons.forEach(button => button.classList.remove("active"));

      $("resultsPanel")?.classList.add("hidden");
      if ($("results")) $("results").replaceChildren();
      if ($("images")) $("images").replaceChildren();

      state.lastPrompt = "";
      setStatus("Đã làm mới biểu mẫu.");
    });

    // Do not force a wake-up request just by opening the page.
    setStatus("Sẵn sàng tìm kiếm. Backend Render đã được cấu hình mặc định.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
