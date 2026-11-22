(() => {
  "use strict";

  const DEFAULT_API_BASE = "https://jav-discovery-engine-api.onrender.com";
  const $ = id => document.getElementById(id);
  const state = {
    apiBase: (localStorage.getItem("jde_api_base") || DEFAULT_API_BASE).replace(/\/+$/, ""),
    lastPrompt: "",
    searchBusy: false,
    tags: [],
    selected: new Set(),
    saved: loadSaved()
  };

  // Từ điển mở rộng theo nhóm. Có thể bổ sung alias/tag mà không cần sửa backend.
  const TAG_RULES = [
    {category:"Đồ chơi & vật dụng", aliases:["toy","toys","sex toy","adult toy","adult toys","đồ chơi","đồ chơi người lớn","玩具"], tags:[
      ["大人のおもちゃ","adult toys"],["玩具プレイ","toy play"],["玩具責め","toy stimulation"],["バイブ","vibrator"],["ローター","rotor"],["電マ","electric massager"],["おもちゃ使用","toy use"]
    ]},
    {category:"Chủ đề / chất kích thích", aliases:["aphrodisiac","aphrodisiacs","媚薬","thuốc kích dục","kích dục"], tags:[
      ["媚薬","aphrodisiac"],["媚薬プレイ","aphrodisiac play"],["媚薬効果","aphrodisiac effect"],["誘惑","seduction"],["興奮","arousal"],["快感","pleasure"]
    ]},
    {category:"Cảm giác & diễn biến", aliases:["pleasure","sensation","sensitive","sensitivity","快感","性感"], tags:[
      ["性感開発","sensual development"],["性感帯","erogenous zones"],["感度","sensitivity"],["絶頂","climax"],["オーガズム","orgasm"]
    ]},
    {category:"Mood / quan hệ", aliases:["ntr","netorare","cheating","affair","ngoại tình","phản bội","寝取られ"], tags:[
      ["寝取られ","NTR"],["浮気","cheating"],["不倫","affair"],["背徳","taboo / transgression"]
    ]},
    {category:"Quyến rũ / tâm lý", aliases:["seduction","誘惑","dụ dỗ","quyến rũ","tease","誘惑的"], tags:[
      ["誘惑","seduction"],["小悪魔","teasing / femme-fatale trope"],["心理戦","psychological tension"],["駆け引き","flirting / mind games"]
    ]},
    {category:"Bối cảnh / nhân vật", aliases:["mature","older woman","人妻","熟女","trưởng thành","người vợ"], tags:[
      ["人妻","married woman"],["熟女","mature woman"],["年上女性","older woman"]
    ]},
    {category:"Cốt truyện / phong cách", aliases:["story","plot","drama","psychological","tâm lý","cốt truyện","natural acting","diễn xuất tự nhiên"], tags:[
      ["ドラマ","drama"],["ストーリー重視","story-focused"],["心理","psychological"],["自然な演技","natural acting"]
    ]}
  ];

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem("jde_saved_candidates") || "[]"); }
    catch { return []; }
  }
  function persistSaved() {
    localStorage.setItem("jde_saved_candidates", JSON.stringify(state.saved));
    updateSavedCount();
  }
  function setStatus(message, isError = false) {
    const el = $("status");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("error", Boolean(isError));
  }
  function apiUrl(path) { return state.apiBase.replace(/\/+$/, "") + path; }
  function normalize(s) { return String(s || "").toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }
  function splitInput(value) {
    return value.split(/[+,;\n]+/).map(s => s.trim()).filter(Boolean);
  }
  function addTag(label, category, source = "related") {
    const key = normalize(label);
    if (!key || state.tags.some(t => normalize(t.label) === key)) return;
    state.tags.push({id: "tag-" + Math.random().toString(36).slice(2,10), label, category, source});
  }

  function analyzeTags() {
    const raw = $("brief").value.trim();
    if (!raw) {
      setStatus("Hãy nhập ý tưởng hoặc từ khóa trước khi phân tích.", true);
      $("brief").focus();
      return;
    }
    state.tags = [];
    state.selected.clear();
    const pieces = splitInput(raw);
    pieces.forEach(piece => addTag(piece, "Từ khóa gốc", "core"));

    const normalized = normalize(raw);
    const matched = [];
    for (const rule of TAG_RULES) {
      if (rule.aliases.some(alias => normalized.includes(normalize(alias)))) {
        matched.push(rule);
        rule.tags.forEach(([jp, en]) => addTag(jp, rule.category));
        // Giữ một số từ khóa tiếng Anh làm truy vấn bổ trợ.
        rule.tags.slice(0, 2).forEach(([, en]) => addTag(en, rule.category));
      }
    }

    // Giữ nguyên cụm gốc; với cụm chưa nhận diện được, tạo tag tìm kiếm trực tiếp.
    if (!matched.length) {
      pieces.forEach(piece => addTag(piece, "Từ khóa liên quan"));
      addTag("AV 作品 女優 品番", "Từ khóa metadata");
    } else {
      addTag("AV 作品 品番 女優", "Từ khóa metadata");
    }

    // Chọn mặc định từ khóa gốc và tag Nhật, để người dùng có thể bỏ bớt trước khi search.
    state.tags.forEach(tag => {
      if (tag.source === "core" || /[\u3000-\u9FFF\uF900-\uFAFF]/.test(tag.label)) state.selected.add(tag.id);
    });

    renderTags();
    $("tagWorkspace").classList.remove("hidden");
    setStatus(`Đã phân tích ${pieces.length} cụm gốc và đề xuất ${state.tags.length} tag. Đây là mở rộng theo từ điển/quy tắc; hãy duyệt lại trước khi tìm.`);
    $("tagWorkspace").scrollIntoView({behavior:"smooth", block:"nearest"});
  }

  function renderTags() {
    const groups = $("tagGroups");
    groups.replaceChildren();
    const categories = [...new Set(state.tags.map(t => t.category))];
    categories.forEach(category => {
      const section = document.createElement("section");
      section.className = "tag-category";
      const heading = document.createElement("h4");
      heading.textContent = category;
      const cloud = document.createElement("div");
      cloud.className = "tag-cloud";
      state.tags.filter(t => t.category === category).forEach(tag => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tag" + (state.selected.has(tag.id) ? " active" : "");
        button.textContent = tag.label;
        button.title = state.selected.has(tag.id) ? "Bấm để bỏ chọn" : "Bấm để chọn";
        button.addEventListener("click", () => {
          if (state.selected.has(tag.id)) state.selected.delete(tag.id);
          else state.selected.add(tag.id);
          renderTags();
        });
        cloud.append(button);
      });
      section.append(heading, cloud);
      groups.append(section);
    });

    const selectedBox = $("selectedTags");
    selectedBox.replaceChildren();
    const chosen = state.tags.filter(t => state.selected.has(t.id));
    if (!chosen.length) {
      const empty = document.createElement("span");
      empty.className = "muted";
      empty.textContent = "Chưa chọn tag nào.";
      selectedBox.append(empty);
    } else {
      chosen.forEach(tag => {
        const chip = document.createElement("span");
        chip.className = "tag selected-tag";
        chip.textContent = tag.label;
        selectedBox.append(chip);
      });
    }
    $("tagCount").textContent = `${chosen.length} đã chọn`;
  }

  function addCustomTag() {
    const input = $("customTag");
    const value = input.value.trim();
    if (!value) return;
    addTag(value, "Tag tự thêm", "custom");
    const added = state.tags.find(t => normalize(t.label) === normalize(value));
    if (added) state.selected.add(added.id);
    input.value = "";
    $("tagWorkspace").classList.remove("hidden");
    renderTags();
  }

  async function requestJson(url, options = {}, timeoutMs = 100000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {...options, signal: controller.signal});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Máy chủ trả lỗi HTTP ${response.status}`);
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Quá thời gian chờ. Render có thể đang khởi động lại; hãy thử lại.");
      if (error instanceof TypeError) throw new Error("Không kết nối được backend. Kiểm tra mạng hoặc URL Render.");
      throw error;
    } finally { clearTimeout(timeout); }
  }
  async function apiSearch(query, mode) {
    return requestJson(apiUrl("/api/search"), {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({query, mode})
    });
  }

  function makeLink(title, query) {
    const a = document.createElement("a");
    a.className = "query-link";
    a.href = "https://www.google.com/search?q=" + encodeURIComponent(query);
    a.target = "_blank"; a.rel = "noopener noreferrer";
    const b = document.createElement("b"); b.textContent = title;
    const span = document.createElement("span"); span.textContent = query;
    a.append(b, span); return a;
  }
  function makeCandidate(result) {
    return {
      title: result.title || "Không có tiêu đề",
      snippet: result.snippet || "",
      link: result.link || "",
      source: result.source || "",
      date: result.date || "",
      savedAt: new Date().toISOString()
    };
  }
  function isSaved(link) { return state.saved.some(item => item.link === link); }

  function renderResults(results) {
    const box = $("results");
    box.replaceChildren();
    if (!results.length) { box.textContent = "Không tìm thấy kết quả web phù hợp. Hãy thử bỏ bớt tag hoặc thay cụm từ."; return; }
    results.forEach(result => {
      const card = document.createElement("article"); card.className = "result-card";
      const title = document.createElement("h3"); title.textContent = result.title || "Không có tiêu đề";
      const desc = document.createElement("p"); desc.textContent = result.snippet || "Nguồn không cung cấp mô tả.";
      const meta = document.createElement("div"); meta.className = "result-meta";
      meta.textContent = [result.source, result.date, result.displayedLink].filter(Boolean).join(" · ");
      const actions = document.createElement("div"); actions.className = "card-actions";
      const link = document.createElement("a"); link.href = result.link || "#"; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "Mở nguồn ↗";
      const save = document.createElement("button"); save.className = "save-candidate"; save.type = "button";
      const updateSaveLabel = () => { save.textContent = isSaved(result.link) ? "✓ Đã lưu" : "+ Lưu ứng viên"; save.disabled = isSaved(result.link); };
      updateSaveLabel();
      save.addEventListener("click", () => {
        if (!result.link || isSaved(result.link)) return;
        state.saved.unshift(makeCandidate(result));
        persistSaved(); renderSaved(); updateSaveLabel();
        setStatus("Đã lưu ứng viên vào bộ nhớ trình duyệt.");
      });
      actions.append(link, save); card.append(title, desc, meta, actions); box.append(card);
    });
  }

  function renderImages(images) {
    const box = $("images"); box.replaceChildren();
    if (!images.length) { box.textContent = "Không tìm thấy ảnh phù hợp. Thử cụm tìm kiếm khác."; return; }
    images.forEach(item => {
      const card = document.createElement("article"); card.className = "image-card";
      const open = document.createElement("button"); open.className = "image-open"; open.type = "button";
      const img = document.createElement("img"); img.src = item.thumbnail || item.original; img.alt = item.title || "Search image";
      img.loading = "lazy"; img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => { img.alt = "Ảnh không tải được từ nguồn"; img.style.opacity = ".25"; });
      open.append(img);
      open.addEventListener("click", () => showLightbox(item));
      const caption = document.createElement("div"); caption.className = "image-caption";
      caption.textContent = [item.title, item.source].filter(Boolean).join(" · ") || "Ảnh tìm kiếm";
      card.append(open, caption); box.append(card);
    });
  }

  function showLightbox(item) {
    $("lightboxImage").src = item.original || item.thumbnail || "";
    $("lightboxCaption").textContent = [item.title, item.source].filter(Boolean).join(" · ");
    const source = $("lightboxSource"); source.href = item.link || item.original || item.thumbnail || "#";
    $("lightbox").classList.remove("hidden");
  }
  function hideLightbox() { $("lightbox").classList.add("hidden"); $("lightboxImage").src = ""; }

  function renderSaved() {
    const box = $("savedResults"); box.replaceChildren();
    if (!state.saved.length) { box.textContent = "Chưa có ứng viên nào được lưu."; updateSavedCount(); return; }
    state.saved.forEach((item, index) => {
      const card = document.createElement("article"); card.className = "result-card";
      const title = document.createElement("h3"); title.textContent = item.title;
      const desc = document.createElement("p"); desc.textContent = item.snippet || "";
      const meta = document.createElement("div"); meta.className = "result-meta"; meta.textContent = [item.source, item.date].filter(Boolean).join(" · ");
      const actions = document.createElement("div"); actions.className = "card-actions";
      const link = document.createElement("a"); link.href = item.link; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "Mở nguồn ↗";
      const remove = document.createElement("button"); remove.className = "save-candidate"; remove.textContent = "Xóa khỏi danh sách";
      remove.addEventListener("click", () => { state.saved.splice(index,1); persistSaved(); renderSaved(); });
      actions.append(link, remove); card.append(title, desc, meta, actions); box.append(card);
    });
    updateSavedCount();
  }
  function updateSavedCount() {
    $("savedTabCount").textContent = String(state.saved.length);
  }
  function exportCsv() {
    if (!state.saved.length) { setStatus("Chưa có ứng viên để xuất CSV.", true); return; }
    const columns = ["title","snippet","source","date","link","savedAt"];
    const quote = value => '"' + String(value ?? "").replace(/"/g,'""').replace(/\r?\n/g," ") + '"';
    const csv = "\uFEFF" + [columns.join(","), ...state.saved.map(item => columns.map(key => quote(item[key])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
    const a = document.createElement("a"); a.href = url; a.download = "jav-discovery-candidates.csv"; a.click();
    URL.revokeObjectURL(url); setStatus("Đã xuất CSV ứng viên.");
  }

  function selectedLabels() { return state.tags.filter(t => state.selected.has(t.id)).map(t => t.label); }
  function makePrompt({brief, tags, actress, maker, era, priority}) {
    return [
      "Hãy nghiên cứu metadata phim JAV theo yêu cầu sau.",
      `Ý tưởng gốc: ${brief || "Không giới hạn"}`,
      `Tag đã chọn: ${tags.join(", ") || "Không có tag"}`,
      `Diễn viên: ${actress || "không giới hạn"}`,
      `Hãng / series / mã phim: ${maker || "không giới hạn"}`,
      `Thời kỳ: ${era || "không giới hạn"}`,
      `Ưu tiên: ${priority || "độ chính xác metadata"}`,
      "",
      "Mở rộng truy vấn tiếng Nhật, tìm nhiều nguồn catalog và cơ sở dữ liệu.",
      "Trả bảng: Mã phim | Tên phim | Diễn viên | Hãng | Năm | Đặc điểm phù hợp | Mức xác minh | Nguồn.",
      "Không tự tạo mã phim. Phân biệt dữ kiện xác nhận và suy luận."
    ].join("\n");
  }

  async function runSearch() {
    if (state.searchBusy) return;
    const brief = $("brief").value.trim();
    const tags = selectedLabels();
    const actress = $("actress").value.trim();
    const maker = $("maker").value.trim();
    const era = $("era").value;
    const priority = $("priority").value;
    if (!brief && !tags.length && !actress && !maker) {
      setStatus("Nhập ý tưởng, chọn tag hoặc điền diễn viên / hãng trước khi tìm.", true); return;
    }
    const japaneseTags = tags.filter(t => /[\u3000-\u9FFF\uF900-\uFAFF]/.test(t));
    const queryParts = [...new Set([...japaneseTags, ...tags, actress, maker, brief, era])].filter(Boolean);
    const query = queryParts.join(" ").slice(0, 420);
    const webQuery = `${query} JAV 品番 女優 メーカー`;
    const imageQuery = `${query} JAV DVD ジャケット 場面`;
    state.lastPrompt = makePrompt({brief, tags, actress, maker, era, priority});
    $("queryLinks").replaceChildren(
      makeLink("Google · metadata", webQuery),
      makeLink("Google Images · cover / stills", imageQuery)
    );
    $("resultsPanel").classList.remove("hidden");
    switchTab("metadata");
    $("results").textContent = "Đang tìm metadata...";
    $("images").textContent = "Đang tìm ảnh...";
    state.searchBusy = true; $("search").disabled = true;
    setStatus("Đang tìm metadata và hình ảnh song song. Lần đầu có thể chậm nếu Render vừa khởi động.");
    const webTask = apiSearch(webQuery,"web").then(data => { renderResults(data.results || []); return data; }).catch(error => { $("results").textContent = "Lỗi metadata: " + error.message; throw error; });
    const imageTask = apiSearch(imageQuery,"images").then(data => { renderImages(data.images || []); return data; }).catch(error => { $("images").textContent = "Lỗi hình ảnh: " + error.message; throw error; });
    const [w,i] = await Promise.allSettled([webTask,imageTask]);
    if (w.status === "fulfilled" && i.status === "fulfilled") {
      setStatus(`Hoàn tất: ${(w.value.results||[]).length} kết quả web · ${(i.value.images||[]).length} ảnh. Hãy kiểm tra mã phim tại nguồn.`);
    } else if (w.status === "fulfilled") setStatus("Đã có metadata nhưng tìm ảnh lỗi: " + i.reason.message, true);
    else if (i.status === "fulfilled") setStatus("Đã có ảnh nhưng tìm metadata lỗi: " + w.reason.message, true);
    else setStatus("Tìm kiếm thất bại. Metadata: " + w.reason.message + " | Ảnh: " + i.reason.message, true);
    state.searchBusy = false; $("search").disabled = false;
    $("resultsPanel").scrollIntoView({behavior:"smooth",block:"start"});
  }

  function switchTab(name) {
    document.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === name));
    $("metadataView").classList.toggle("hidden", name !== "metadata");
    $("imagesView").classList.toggle("hidden", name !== "images");
    $("savedView").classList.toggle("hidden", name !== "saved");
    if (name === "saved") renderSaved();
  }

  async function checkBackend() {
    setStatus("Đang kiểm tra backend...");
    try {
      const data = await requestJson(apiUrl("/api/health"), {}, 100000);
      setStatus(data.providerConfigured ? "Backend hoạt động · SerpAPI đã cấu hình." : "Backend hoạt động nhưng thiếu SERPAPI_KEY trên Render.", !data.providerConfigured);
    } catch (error) { setStatus("Không kết nối được backend: " + error.message, true); }
  }

  function resetForm() {
    ["brief","actress","maker","customTag"].forEach(id => { if ($(id)) $(id).value = ""; });
    $("era").selectedIndex = 0; $("priority").selectedIndex = 0;
    state.tags = []; state.selected.clear(); state.lastPrompt = "";
    $("tagWorkspace").classList.add("hidden"); $("resultsPanel").classList.add("hidden");
    $("results").replaceChildren(); $("images").replaceChildren(); $("queryLinks").replaceChildren();
    setStatus("Đã làm mới biểu mẫu.");
  }

  function initialize() {
    $("apiBase").value = state.apiBase;
    $("analyze").addEventListener("click", analyzeTags);
    $("brief").addEventListener("keydown", event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") analyzeTags(); });
    $("addTag").addEventListener("click", addCustomTag);
    $("customTag").addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); addCustomTag(); } });
    $("search").addEventListener("click", runSearch);
    $("reset").addEventListener("click", resetForm);
    $("saveApi").addEventListener("click", async () => {
      const value = $("apiBase").value.trim().replace(/\/+$/,"");
      if (!/^https?:\/\//i.test(value)) { setStatus("URL backend phải bắt đầu bằng https:// hoặc http://", true); return; }
      state.apiBase = value; localStorage.setItem("jde_api_base", value); await checkBackend();
    });
    $("copyPrompt").addEventListener("click", async () => {
      if (!state.lastPrompt) { setStatus("Hãy tìm kiếm trước để tạo prompt.", true); return; }
      try { await navigator.clipboard.writeText(state.lastPrompt); setStatus("Đã copy prompt nghiên cứu."); }
      catch { setStatus("Trình duyệt không cho phép copy clipboard.", true); }
    });
    document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
    $("exportCsv").addEventListener("click", exportCsv);
    $("closeLightbox").addEventListener("click", hideLightbox);
    $("lightbox").addEventListener("click", event => { if (event.target === $("lightbox")) hideLightbox(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape") hideLightbox(); });
    renderSaved();
    setStatus("Sẵn sàng. Nhập ý tưởng rồi bấm “Phân tích & mở rộng tag”.");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, {once:true});
  else initialize();
})();