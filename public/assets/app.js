(() => {
"use strict";
const $ = id => document.getElementById(id);
const DEFAULT_API = "https://jav-discovery-engine-api.onrender.com";
const KEYS = {api:"jf4_api_base",saved:"jf4_saved",history:"jf4_history",recent:"jf4_recent",imageCache:"jf43_image_cache"};
const read = (key, fallback=[]) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
const state = {
  apiBase:(localStorage.getItem(KEYS.api)||localStorage.getItem("jde_api_base")||DEFAULT_API).replace(/\/+$/,""),
  tags:[], selected:new Set(), results:[], images:[], seenCodes:new Set(), seenLinks:new Set(),
  baseQuery:"", originalFilters:null, refreshBusy:false, searchBusy:false, refreshRound:0, layout:"visual",
  saved:read(KEYS.saved,read("jde_saved_candidates",[])), history:read(KEYS.history,[]), recent:read(KEYS.recent,[]),
  currentDetail:null, lastPrompt:""
};
const TAG_RULES = [
 {category:"Đồ chơi & vật dụng",aliases:["toy","toys","đồ chơi","玩具"],tags:[["大人のおもちゃ","adult toys"],["玩具プレイ","toy play"],["バイブ","vibrator"],["ローター","rotor"]]},
 {category:"Chủ đề / tâm lý",aliases:["aphrodisiac","媚薬","kích dục"],tags:[["媚薬","aphrodisiac"],["誘惑","seduction"],["興奮","arousal"]]},
 {category:"Cảm giác / diễn biến",aliases:["pleasure","sensitivity","快感","sensitive"],tags:[["性感開発","sensual development"],["感度","sensitivity"],["絶頂","climax"]]},
 {category:"Mood / quan hệ",aliases:["ntr","netorare","cheating","ngoại tình","寝取られ"],tags:[["寝取られ","NTR"],["浮気","cheating"],["不倫","affair"],["背徳","taboo"]]},
 {category:"Nhân vật / bối cảnh",aliases:["mature","older woman","人妻","熟女"],tags:[["人妻","married woman"],["熟女","mature woman"],["年上女性","older woman"]]},
 {category:"Cốt truyện",aliases:["story","plot","drama","psychological","tâm lý"],tags:[["ドラマ","drama"],["ストーリー重視","story-focused"],["心理","psychological"]]}
];
const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
const escapeHtml = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const apiUrl = p => state.apiBase.replace(/\/+$/,"")+p;
function setStatus(msg,error=false){$("status").textContent=msg;$("status").classList.toggle("error",error);}
function setBackend(ok,text){["backendDot","topBackendDot"].forEach(id=>{$(id).className="pulse "+(ok===true?"online":ok===false?"offline":"");});$("backendLabel").textContent=text;$("topBackendText").textContent=text;}
async function requestJson(url,options={},timeout=95000){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
 try{const r=await fetch(url,{...options,signal:c.signal});const d=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d;
 }catch(e){if(e.name==="AbortError")throw new Error("Quá thời gian chờ. Render có thể đang khởi động.");if(e instanceof TypeError)throw new Error("Không kết nối được backend. Kiểm tra URL / mạng / CORS.");throw e;}
 finally{clearTimeout(t);}
}
async function apiSearch(query,mode="web",sort="relevance",start=0){return requestJson(apiUrl("/api/search"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,mode,sort,start})});}
function extractCode(result){
 const text=`${result.title||""} ${result.snippet||""} ${result.link||""}`;
 const m=text.match(/\b[A-Z]{2,8}[-_ ]?\d{2,6}\b/i);
 return m?m[0].toUpperCase().replace(/[ _]/g,"-"):"";
}
function identity(result){const code=extractCode(result);return code?`code:${code}`:`url:${String(result.link||"").toLowerCase().replace(/[?#].*$/,"")}`;}
function addTag(label,category="Từ khóa liên quan"){if(!label||state.tags.some(t=>norm(t.label)===norm(label)))return;state.tags.push({id:"t"+Math.random().toString(36).slice(2),label,category});}
function analyzeTags(){
 const raw=$("brief").value.trim();if(!raw){setStatus("Nhập mô tả trước khi phân tích tag.",true);return;}
 state.tags=[];state.selected.clear();const chunks=raw.split(/[+,;\n]+/).map(x=>x.trim()).filter(Boolean);
 chunks.forEach(x=>addTag(x,"Từ khóa gốc"));
 const n=norm(raw);let matched=0;
 TAG_RULES.forEach(rule=>{if(rule.aliases.some(a=>n.includes(norm(a)))){matched++;rule.tags.forEach(([jp,en])=>{addTag(jp,rule.category);addTag(en,rule.category);});}});
 addTag("AV 作品 品番 女優","Metadata");
 state.tags.forEach(t=>{if(t.category==="Từ khóa gốc"||/[\u3000-\u9FFF]/.test(t.label))state.selected.add(t.id);});
 renderTags();$("tagWorkspace").classList.remove("hidden");
 setStatus(`Đã tạo ${state.tags.length} tag bằng bộ quy tắc cục bộ (${matched} nhóm nhận diện). Đây chưa phải phân tích AI.`);
}
function renderTags(){
 const box=$("tagGroups");box.replaceChildren();[...new Set(state.tags.map(t=>t.category))].forEach(cat=>{
 const section=document.createElement("div");section.className="tag-category";const h=document.createElement("h4");h.textContent=cat;const cloud=document.createElement("div");cloud.className="tag-cloud";
 state.tags.filter(t=>t.category===cat).forEach(t=>{const b=document.createElement("button");b.className="tag"+(state.selected.has(t.id)?" active":"");b.textContent=t.label;b.type="button";b.onclick=()=>{state.selected.has(t.id)?state.selected.delete(t.id):state.selected.add(t.id);renderTags();};cloud.append(b);});
 section.append(h,cloud);box.append(section);
 });
 $("tagCount").textContent=`${state.selected.size} đã chọn`;
}
function persist(key,value){localStorage.setItem(key,JSON.stringify(value));}
function selectedTags(){return state.tags.filter(t=>state.selected.has(t.id)).map(t=>t.label);}
function currentFilters(){return {brief:$("brief").value.trim(),actress:$("actress").value.trim(),maker:$("maker").value.trim(),mood:$("mood").value.trim(),year:$("year").value,priority:$("priority").value,preview:$("previewOnly").checked,tags:selectedTags()};}
function buildQuery(f,extra=[]){
 const p=[f.brief,...f.tags,f.actress,f.maker,f.mood,f.year,...extra];
 const priority={code:"品番 作品名 メーカー 発売日",actress:"女優 出演作品",maker:"メーカー シリーズ 品番",mood:"ジャンル シチュエーション 内容",balanced:"JAV 作品 品番 女優"};
 p.push(priority[f.priority]||priority.balanced);
 if(f.preview)p.push("ジャケット 画像 サンプル");
 return [...new Set(p.map(x=>String(x||"").trim()).filter(Boolean))].join(" ").slice(0,480);
}
function queryLink(query){return "https://www.google.com/search?q="+encodeURIComponent(query);}
function makePrompt(f){return ["Nghiên cứu metadata JAV theo mô tả sau:",`Mô tả: ${f.brief||"Không có"}`,`Tag: ${f.tags.join(", ")||"Không có"}`,`Diễn viên: ${f.actress||"Không giới hạn"}`,`Hãng / mã: ${f.maker||"Không giới hạn"}`,`Mood: ${f.mood||"Không giới hạn"}`,`Năm: ${f.year||"Không giới hạn"}`,"Tìm catalog Nhật và nguồn đáng tin cậy. Không tự tạo mã; phân biệt dữ kiện xác nhận với suy luận."].join("\n");}
function addHistory(query,filters){const item={query,filters,at:new Date().toISOString()};state.history=[item,...state.history.filter(x=>x.query!==query)].slice(0,100);persist(KEYS.history,state.history);renderCounts();}
function saveCandidate(r){
 const key=identity(r);if(state.saved.some(x=>x.identity===key||x.link===r.link))return false;
 state.saved.unshift({...r,identity:key,savedAt:new Date().toISOString()});state.saved=state.saved.slice(0,500);persist(KEYS.saved,state.saved);renderCounts();return true;
}
function renderCounts(){$("historyCount").textContent=state.history.length;$("savedCount").textContent=state.saved.length;$("recentCount").textContent=state.recent.length;}
function cardHtml(r){
 const code=extractCode(r);const gallery=Array.isArray(r.gallery)?r.gallery:[];
 const visual=gallery.length?`<div class="code-gallery"><div class="code-gallery-track">${gallery.map((im,i)=>`<button class="code-gallery-item" type="button" data-card-image="${escapeHtml(r.link||'')}" data-image-index="${i}" aria-label="Mở ảnh ${i+1}"><img src="${escapeHtml(im.thumbnail||im.original)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="${escapeHtml(im.title||code||'Ảnh preview')}" onerror="this.parentElement.remove()"></button>`).join('')}</div><div class="code-gallery-foot"><span>${gallery.length} ảnh · ${escapeHtml(code||'')}</span><span>Vuốt ngang ↔</span></div></div>`:(code?`<div class="card-visual code-gallery-empty"><span>${r.galleryLoaded?"CHƯA TÌM THẤY ẢNH":"ĐANG TÌM ẢNH THEO MÃ"}<br>${escapeHtml(code)}</span></div>`:(r.thumbnail?`<div class="card-visual"><img src="${escapeHtml(r.thumbnail)}" loading="lazy" referrerpolicy="no-referrer" alt="Ảnh từ nguồn" onerror="this.parentElement.innerHTML='<span>PREVIEW KHÔNG KHẢ DỤNG</span>'"></div>`:'<div class="card-visual"><span>CHƯA CÓ ẢNH PREVIEW</span></div>'));
 return `<article class="result-card">${visual}<div class="card-body"><div class="card-topline"><span class="source-label">${escapeHtml(r.source||"Nguồn web")}</span><span class="confidence-label">${code?"Mã phát hiện · chưa xác minh":"Chưa xác định mã"}</span></div><h3 class="movie-card-title">${escapeHtml(r.title||"Không có tiêu đề")}</h3><p class="movie-snippet">${escapeHtml(r.snippet||"Nguồn không cung cấp mô tả.")}</p><div class="movie-meta">${code?`<span class="meta-chip code-chip">${escapeHtml(code)}</span>`:""}<span class="meta-chip">${escapeHtml(r.date||"Năm chưa xác định")}</span><span class="meta-chip">${escapeHtml(r.source||"Nguồn chưa xác định")}</span></div><div class="movie-meta"><span class="meta-chip unknown">Diễn viên: chưa xác định</span><span class="meta-chip unknown">Hãng: chưa xác định</span><span class="meta-chip unknown">Điểm khớp: chưa tính</span></div><div class="card-actions"><a href="${escapeHtml(r.link||"#")}" target="_blank" rel="noopener noreferrer">Mở nguồn ↗</a><button data-detail="${escapeHtml(r.link||"")}">Chi tiết</button><button data-save="${escapeHtml(r.link||"")}">${state.saved.some(x=>x.link===r.link)?"✓ Đã lưu":"+ Lưu ứng viên"}</button><button data-related="${escapeHtml(r.link||"")}">Tìm tương tự</button></div></div></article>`;
}
function renderResults(){
 const box=$("results");box.className=`movie-grid ${state.layout}`;box.innerHTML=state.results.length?state.results.map(cardHtml).join(""):'<div class="empty-state">Chưa có kết quả. Hãy tìm kiếm hoặc thử Smart Refresh.</div>';
 $("resultCount").textContent=`${state.results.length} kết quả trong phiên`;
 $("resultSummary").textContent=`${state.results.length} kết quả nguồn web. Mã phát hiện từ tiêu đề/snippet chưa được xác minh tại catalog.`;
 box.querySelectorAll("[data-detail]").forEach(b=>b.onclick=()=>{const r=state.results.find(x=>x.link===b.dataset.detail);if(r)openDetail(r);});
 box.querySelectorAll("[data-save]").forEach(b=>b.onclick=()=>{const r=state.results.find(x=>x.link===b.dataset.save);if(r&&saveCandidate(r)){b.textContent="✓ Đã lưu";setStatus("Đã lưu ứng viên vào thư viện trên thiết bị.");}else setStatus("Ứng viên này đã được lưu.",true);});
 box.querySelectorAll("[data-related]").forEach(b=>b.onclick=()=>{const r=state.results.find(x=>x.link===b.dataset.related);if(r)refreshFromResult(r);});
 box.querySelectorAll("[data-card-image]").forEach(b=>b.onclick=()=>{const r=state.results.find(x=>x.link===b.dataset.cardImage);const im=r?.gallery?.[Number(b.dataset.imageIndex)];if(im)showLightbox(im);});
}
function renderImages(images){
 state.images=images||[];$("imageCount").textContent=`${state.images.length} ảnh`;const box=$("images");box.replaceChildren();
 state.images.slice(0,18).forEach(item=>{const card=document.createElement("div");card.className="image-card";const btn=document.createElement("button");btn.className="image-open";const img=document.createElement("img");img.src=item.thumbnail||item.original;img.alt=item.title||"Ảnh kết quả";img.loading="lazy";img.referrerPolicy="no-referrer";img.onerror=()=>{card.remove();};btn.append(img);btn.onclick=()=>showLightbox(item);const cap=document.createElement("div");cap.className="image-caption";cap.textContent=item.title||item.source||"Ảnh tham khảo";card.append(btn,cap);box.append(card);});
 if(!box.children.length)box.innerHTML='<div class="empty-state">Chưa có ảnh preview từ nguồn tìm kiếm.</div>';
}
const IMAGE_REJECT_TERMS = [
 "大人のおもちゃ","アダルトグッズ","ラブグッズ","セックスグッズ","性具","玩具","おもちゃ",
 "バイブレーター","バイブ","ローター","ディルド","ペニスバンド","コックリング","ラブドール",
 "adult toy","sex toy","sex toys","vibrator","vibrators","dildo","dildos","love doll","love dolls",
 "adult novelty","adult novelties","sex product","sex products","lingerie store","toy shop"
];
const IMAGE_FILM_TERMS = [
 "dvd","ジャケット","サンプル","サンプル画像","作品","出演","女優","メーカー","品番",
 "screenshot","sample","cover","movie","film","av"
];
function normalizedCode(value){return String(value||"").toUpperCase().replace(/[^A-Z0-9]/g,"");}
function imageText(image){return `${image.title||""} ${image.source||""} ${image.link||""} ${image.original||""}`.toLowerCase();}
function imageCodeConflict(code,image){
 const text=`${image.title||""} ${image.link||""} ${image.original||""}`;
 const found=[...text.matchAll(/\b[A-Z]{2,8}[-_ ]?\d{2,6}\b/gi)].map(m=>normalizedCode(m[0]));
 return found.some(x=>x!==normalizedCode(code));
}
function imageIsRejectedProduct(image){
 const t=imageText(image);
 return IMAGE_REJECT_TERMS.some(term=>t.includes(term.toLowerCase()));
}
function imageRelevanceScore(code,image){
 const title=String(image.title||"").toLowerCase();
 const link=String(image.link||"").toLowerCase();
 const source=String(image.source||"").toLowerCase();
 const c=String(code||"").toLowerCase();
 let score=0;
 if(title.includes(c))score+=45;
 if(link.includes(c))score+=25;
 if(source.includes(c))score+=10;
 if(IMAGE_FILM_TERMS.some(term=>title.includes(term)))score+=15;
 if(/dvd|catalog|catalogue|video|javlibrary|fanza|dmm|javbus|javdatabase/i.test(`${source} ${link}`))score+=10;
 if(imageIsRejectedProduct(image))score-=150;
 return score;
}
function uniqueImages(images,code){
 const seen=new Set();
 return (images||[]).filter(im=>{
  const src=im.thumbnail||im.original;if(!src||imageCodeConflict(code,im)||imageIsRejectedProduct(im))return false;
  const key=String(im.original||src).split("?")[0];if(seen.has(key))return false;seen.add(key);return true;
 }).map(im=>({...im,_relevance:imageRelevanceScore(code,im)}))
   .filter(im=>im._relevance>=0)
   .sort((a,b)=>b._relevance-a._relevance)
   .slice(0,12);
}
function readImageCache(){
 try{return JSON.parse(localStorage.getItem(KEYS.imageCache)||"{}");}catch{return {};}
}
function writeImageCache(code,images){
 const cache=readImageCache(),now=Date.now();
 cache[code]={at:now,images:(images||[]).slice(0,12)};
 const entries=Object.entries(cache).sort((a,b)=>(b[1]?.at||0)-(a[1]?.at||0)).slice(0,120);
 try{localStorage.setItem(KEYS.imageCache,JSON.stringify(Object.fromEntries(entries)));}catch{}
}
function getCachedImages(code){
 const entry=readImageCache()[code];
 if(!entry||!Array.isArray(entry.images)||Date.now()-entry.at>7*24*60*60*1000)return null;
 return entry.images;
}
function imageQueryForCode(code,variant=0){
 const excluded='-おもちゃ -玩具 -バイブ -ローター -ディルド -性具 -アダルトグッズ -"adult toy" -vibrator -dildo -"sex toy"';
 return variant===0
  ? `"${code}" (ジャケット OR サンプル画像 OR DVD OR 作品) ${excluded}`
  : `"${code}" (スチール OR 作品画像 OR sample) ${excluded}`;
}
async function enrichCodeGalleries(results){
 const targets=(results||[]).filter(r=>extractCode(r)&&!r.galleryLoaded);
 if(!targets.length)return;
 let cursor=0;
 async function worker(){
  while(cursor<targets.length){
   const r=targets[cursor++],code=extractCode(r);r.galleryLoaded=true;
   try{
    let imgs=getCachedImages(code);
    if(imgs===null){
     const d=await apiSearch(imageQueryForCode(code,0),"images");
     imgs=uniqueImages(d.images,code);
     // Only spend a second image-search request when the first result set is nearly empty.
     if(imgs.length<2){
      const extra=await apiSearch(imageQueryForCode(code,1),"images");
      imgs=uniqueImages([...imgs,...(extra.images||[])],code);
     }
     writeImageCache(code,imgs);
    }
    r.gallery=imgs;
   }catch(e){r.gallery=[];r.galleryError=e.message;}
   renderResults();
  }
 }
 await Promise.all(Array.from({length:Math.min(3,targets.length)},worker));
}
function addResults(incoming){
 let duplicates=0,added=0;
 for(const r of incoming||[]){const key=identity(r);if(!r.link||state.seenCodes.has(key)){duplicates++;continue;}state.seenCodes.add(key);state.seenLinks.add(r.link);state.results.push(r);added++;}
 renderResults();return {added,duplicates};
}
async function runSearch(){
 if(state.searchBusy)return;const f=currentFilters();if(!f.brief&&!f.tags.length&&!f.actress&&!f.maker&&!f.mood){setStatus("Nhập mô tả, mã phim, diễn viên hoặc hãng trước.",true);return;}
 state.searchBusy=true;$("search").disabled=true;$("resultsPanel").classList.remove("hidden");state.results=[];state.seenCodes.clear();state.seenLinks.clear();state.originalFilters=f;state.refreshRound=0;
 state.baseQuery=buildQuery(f);state.lastPrompt=makePrompt(f);$("refreshStatus").textContent="Sẵn sàng tìm thêm sau lượt đầu.";
 $("results").innerHTML='<div class="empty-state">Đang truy vấn nguồn web...</div>';
 $("images").innerHTML='<div class="empty-state">Ảnh được tìm riêng theo từng mã phim trong kết quả.</div>';
 addHistory(state.baseQuery,f);setStatus("Đang tìm metadata; gallery sẽ được tải riêng theo từng mã phim...");
 try{
  const sort=$("sortMode").value;
  const task=await apiSearch(state.baseQuery,"web",sort).then(value=>({status:"fulfilled",value}),reason=>({status:"rejected",reason}));
  if(task.status==="fulfilled"){
   addResults(task.value.results||[]);
   // Results appear first; image galleries are enriched progressively afterwards.
   await enrichCodeGalleries(state.results);
   setStatus(`Hoàn tất. ${state.results.length} kết quả web; ảnh được lọc và tải theo mã phim. Nguồn web chưa đồng nghĩa metadata đã xác minh.`);
  }else{
   $("results").innerHTML=`<div class="empty-state">Lỗi nguồn web: ${escapeHtml(task.reason.message)}</div>`;
   setStatus(`Tìm kiếm thất bại: ${task.reason.message}`,true);
  }
 }finally{state.searchBusy=false;$("search").disabled=false;}
}
function refreshPlans(strategy,round){
 const f=state.originalFilters||currentFilters();
 const base=state.baseQuery;
 const offset=Math.min(90,round*10);
 const actress=f.actress||f.brief;
 const maker=f.maker||f.brief;
 const mood=f.mood||f.brief;
 const plans={
  expanded:[
   {query:base,start:Math.min(90,(round+1)*10)},
   {query:`${base} 品番 作品名 出演者 JAV DVD title actress studio`,start:offset}
  ],
  source:[
   {query:`${base} site:javlibrary.com`,start:offset},
   {query:`${base} site:av-wiki.net OR site:xxx-av.com`,start:offset}
  ],
  actress:[
   {query:`${base} ${actress} 女優 出演作品 作品一覧 品番`,start:offset},
   {query:`${base} ${actress} JAV actress filmography DVD`,start:offset}
  ],
  maker:[
   {query:`${base} ${maker} メーカー 作品一覧 品番 DVD`,start:offset},
   {query:`${base} ${maker} studio JAV titles catalog`,start:offset}
  ],
  mood:[
   {query:`${base} ${mood} 類似作品 同ジャンル シチュエーション JAV`,start:offset},
   {query:`${base} ${mood} similar JAV themes scenario`,start:offset}
  ]
 };
 return (plans[strategy]||plans.expanded).map(x=>({...x,query:x.query.slice(0,480)}));
}
async function smartRefresh(){
 if(state.refreshBusy||!state.baseQuery)return;
 state.refreshBusy=true;$("refresh").disabled=true;
 const strategy=$("refreshStrategy").value,round=state.refreshRound;
 const plans=refreshPlans(strategy,round);
 $("refreshStatus").textContent=`Đang mở rộng lượt ${round+1}: ${strategy}…`;
 setStatus("Smart Refresh đang lấy các trang kết quả tiếp theo và truy vấn biến thể...");
 try{
  const responses=await Promise.allSettled(plans.map(p=>apiSearch(p.query,"web",$("sortMode").value,p.start)));
  const successful=responses.filter(x=>x.status==="fulfilled");
  if(!successful.length)throw responses[0].reason||new Error("Tất cả truy vấn mở rộng đều thất bại.");
  const before=state.results.length;
  const incoming=successful.flatMap(x=>x.value.results||[]);
  const stats=addResults(incoming);
  if(stats.added)await enrichCodeGalleries(state.results.filter(r=>!r.galleryLoaded));
  state.refreshRound++;
  if(stats.added){
   $("refreshStatus").textContent=`Lượt ${state.refreshRound}: thêm ${stats.added} kết quả mới · bỏ ${stats.duplicates} kết quả trùng · tổng ${state.results.length}.`;
   setStatus(`Smart Refresh đã bổ sung ${stats.added} kết quả mới.`);
  }else{
   $("refreshStatus").textContent=`Lượt ${state.refreshRound}: chưa có kết quả mới · ${stats.duplicates} mục trùng · tổng ${before}. Thử chiến lược khác hoặc lượt tiếp theo.`;
   setStatus("Hai truy vấn mở rộng không trả về kết quả mới khác biệt.",true);
  }
 }catch(e){$("refreshStatus").textContent="Lỗi nguồn tìm kiếm: "+e.message;setStatus("Smart Refresh thất bại: "+e.message,true);}
 finally{state.refreshBusy=false;$("refresh").disabled=false;}
}
async function refreshFromResult(r){
 const code=extractCode(r);const f=state.originalFilters||currentFilters();const query=[`"${r.title||""}"`,code,f.actress,f.maker,"関連作品 類似作品"].filter(Boolean).join(" ");
 $("refreshStrategy").value="expanded";$("refreshStatus").textContent="Tìm tương tự từ kết quả đã chọn…";
 try{const d=await apiSearch(query,"web","relevance");const stats=addResults((d.results||[]).filter(x=>x.link!==r.link));$("refreshStatus").textContent=`Từ kết quả đã chọn: thêm ${stats.added}, trùng ${stats.duplicates}.`;}
 catch(e){$("refreshStatus").textContent="Lỗi tìm tương tự: "+e.message;}
}
async function openDetail(r){
 state.currentDetail=r;state.recent=[{...r,viewedAt:new Date().toISOString()},...state.recent.filter(x=>x.link!==r.link)].slice(0,100);persist(KEYS.recent,state.recent);renderCounts();
 $("detailContent").innerHTML=`<div class="detail-head"><div class="eyebrow">SOURCE DETAIL · UNVERIFIED METADATA</div><h2 id="detailTitle">${escapeHtml(r.title||"Không có tiêu đề")}</h2><p>${escapeHtml(r.source||"Nguồn chưa xác định")} · ${escapeHtml(r.date||"Ngày chưa xác định")}</p></div><div class="detail-layout"><div><div class="detail-cover" style="display:grid;place-items:center;color:#70819b;font-size:12px">Đang tìm ảnh preview…</div><div class="detail-section"><h3>Gallery / screenshots</h3><div class="gallery" id="detailGallery"></div></div></div><div><div class="detail-fields"><div class="detail-field"><small>Mã phát hiện</small><b>${escapeHtml(extractCode(r)||"Chưa xác định")}</b></div><div class="detail-field"><small>Năm</small><b>${escapeHtml(r.date||"Chưa xác định")}</b></div><div class="detail-field"><small>Diễn viên</small><b>Chưa xác định từ nguồn API</b></div><div class="detail-field"><small>Hãng</small><b>Chưa xác định từ nguồn API</b></div><div class="detail-field"><small>Điểm phù hợp</small><b>Chưa có mô hình chấm điểm</b></div><div class="detail-field"><small>Trạng thái</small><b>Nguồn web — cần xác minh</b></div></div><div class="detail-section"><h3>Mô tả nguồn</h3><p class="movie-snippet">${escapeHtml(r.snippet||"Nguồn không cung cấp mô tả.")}</p><a class="btn btn-quiet" href="${escapeHtml(r.link||"#")}" target="_blank" rel="noopener noreferrer">Mở trang nguồn ↗</a></div><div class="detail-section"><h3>Khám phá tiếp</h3><div class="detail-related"><button id="detailSimilar">Tìm phim tương tự</button><button id="detailActor">Ưu tiên diễn viên</button><button id="detailMaker">Ưu tiên hãng</button></div></div></div></div>`;
 $("detailModal").classList.remove("hidden");
 $("detailSimilar").onclick=()=>{closeDetail();refreshFromResult(r);};
 $("detailActor").onclick=()=>{closeDetail();$("refreshStrategy").value="actress";smartRefresh();};
 $("detailMaker").onclick=()=>{closeDetail();$("refreshStrategy").value="maker";smartRefresh();};
 try{let imgs=Array.isArray(r.gallery)?r.gallery:[];if(!r.galleryLoaded&&extractCode(r)){await enrichCodeGalleries([r]);imgs=r.gallery||[];}const gallery=$("detailGallery");gallery.replaceChildren();
  if(imgs.length){const cover=document.createElement("img");cover.className="detail-cover";cover.src=imgs[0].thumbnail||imgs[0].original;cover.alt="Ảnh kết quả tìm kiếm";cover.referrerPolicy="no-referrer";cover.loading="lazy";cover.decoding="async";cover.onerror=()=>{if(imgs[0].original&&cover.src!==imgs[0].original)cover.src=imgs[0].original;else cover.replaceWith(Object.assign(document.createElement("div"),{className:"detail-cover",textContent:"Ảnh nguồn không cho phép hiển thị"}));};$("detailContent").querySelector(".detail-cover").replaceWith(cover);
   imgs.slice(0,8).forEach(im=>{const b=document.createElement("button"),img=document.createElement("img");img.src=im.thumbnail||im.original;img.alt=im.title||"Gallery";img.loading="lazy";img.decoding="async";img.referrerPolicy="no-referrer";img.onerror=()=>b.remove();b.append(img);b.onclick=()=>showLightbox(im);gallery.append(b);});
  }else gallery.innerHTML='<span class="muted">Không có ảnh preview từ nguồn.</span>';
 }catch(e){const g=$("detailGallery");if(g)g.textContent="Không tải được gallery: "+e.message;}
}
function closeDetail(){$("detailModal").classList.add("hidden");}
function showLightbox(item){const img=$("lightboxImage");img.onerror=()=>{if(item.thumbnail&&img.src!==item.thumbnail)img.src=item.thumbnail;};img.src=item.original||item.thumbnail||"";$("lightboxCaption").textContent=item.title||item.source||"";$("lightboxSource").href=item.link||item.original||"#";$("lightbox").classList.remove("hidden");}
function closeLightbox(){$("lightbox").classList.add("hidden");$("lightboxImage").src="";}
function exportCsv(){
 if(!state.saved.length){setStatus("Chưa có ứng viên để xuất CSV.",true);return;}
 const cols=["title","snippet","source","date","link","savedAt","identity"];
 const q=v=>'"'+String(v??"").replace(/"/g,'""').replace(/\r?\n/g," ")+'"';
 const csv="\uFEFF"+[cols.join(","),...state.saved.map(x=>cols.map(k=>q(x[k])).join(","))].join("\r\n");
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="jav-finder-library.csv";a.click();URL.revokeObjectURL(url);
}
function renderLibrary(){
 renderCounts();
 const render=(id,items,type)=>{const box=$(id);box.replaceChildren();if(!items.length){box.innerHTML='<div class="empty-state">Chưa có dữ liệu.</div>';return;}
 items.forEach((item,i)=>{const row=document.createElement("div");row.className="library-item";const main=document.createElement("div");main.className="library-item-main";const b=document.createElement("b");b.textContent=type==="history"?item.query:item.title||"Không có tiêu đề";const sm=document.createElement("small");sm.textContent=type==="history"?new Date(item.at).toLocaleString():(item.source||"Nguồn chưa xác định")+" · "+(item.date||"Ngày chưa xác định");main.append(b,sm);const actions=document.createElement("div");actions.className="library-actions";
 const open=document.createElement("button");open.textContent=type==="history"?"Tìm lại":"Chi tiết";open.onclick=()=>{if(type==="history"){$("brief").value=item.query||((item.filters||{}).brief||"");$("actress").value="";$("maker").value="";$("mood").value="";$("year").value="";navigate("discover");runSearch();}else openDetail(item);};
 actions.append(open);
 if(type!=="history"){const a=document.createElement("a");a.href=item.link||"#";a.target="_blank";a.rel="noopener noreferrer";a.textContent="Mở nguồn";actions.append(a);}
 const del=document.createElement("button");del.textContent="Xóa";del.onclick=()=>{if(type==="history"){state.history.splice(i,1);persist(KEYS.history,state.history);}else if(type==="saved"){state.saved.splice(i,1);persist(KEYS.saved,state.saved);}else{state.recent.splice(i,1);persist(KEYS.recent,state.recent);}renderLibrary();};actions.append(del);row.append(main,actions);box.append(row);});
 };
 render("historyList",state.history,"history");render("savedList",state.saved,"saved");render("recentList",state.recent,"recent");
}
function navigate(view){
 document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${view}`));
 document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 $("pageCrumb").textContent=({discover:"Khám phá",history:"Lịch sử tìm kiếm",saved:"Đã lưu",recent:"Gần đây",settings:"Cài đặt"})[view]||view;
 $("sidebar").classList.remove("open");if(["history","saved","recent"].includes(view))renderLibrary();
}
async function checkBackend(){
 try{const d=await requestJson(apiUrl("/api/health"),{},30000);const ok=!!d.ok&&!!d.providerConfigured;setBackend(ok,ok?"Backend · SerpAPI sẵn sàng": "Backend hoạt động · thiếu SERPAPI_KEY");$("settingsStatus").textContent=ok?"Backend và SerpAPI đã sẵn sàng.":"Backend hoạt động nhưng chưa có SERPAPI_KEY.";return d;}
 catch(e){setBackend(false,"Backend không kết nối");$("settingsStatus").textContent=e.message;throw e;}
}
function resetForm(){["brief","actress","maker","mood","customTag"].forEach(id=>$(id).value="");["year"].forEach(id=>$(id).value="");$("previewOnly").checked=false;$("priority").value="balanced";state.tags=[];state.selected.clear();$("tagWorkspace").classList.add("hidden");setStatus("Đã đặt lại biểu mẫu.");}
function init(){
 $("apiBase").value=state.apiBase;
 document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
 $("topSettings").onclick=()=>navigate("settings");$("mobileMenu").onclick=()=>$("sidebar").classList.toggle("open");
 $("analyze").onclick=analyzeTags;$("addTag").onclick=()=>{const v=$("customTag").value.trim();if(v){addTag(v,"Tag tự thêm");const t=state.tags.find(x=>norm(x.label)===norm(v));state.selected.add(t.id);$("customTag").value="";$("tagWorkspace").classList.remove("hidden");renderTags();}};
 $("search").onclick=runSearch;$("reset").onclick=resetForm;$("refresh").onclick=smartRefresh;
 $("copyPrompt").onclick=async()=>{if(!state.lastPrompt){setStatus("Hãy tìm kiếm trước.",true);return;}try{await navigator.clipboard.writeText(state.lastPrompt);setStatus("Đã copy research prompt.");}catch{setStatus("Không thể truy cập clipboard.",true);}};
 document.querySelectorAll("[data-layout]").forEach(b=>b.onclick=()=>{state.layout=b.dataset.layout;document.querySelectorAll("[data-layout]").forEach(x=>x.classList.toggle("active",x===b));renderResults();});
 $("saveApi").onclick=async()=>{const v=$("apiBase").value.trim().replace(/\/+$/,"");if(!/^https?:\/\//i.test(v)){ $("settingsStatus").textContent="URL phải bắt đầu bằng http:// hoặc https://";return;}state.apiBase=v;localStorage.setItem(KEYS.api,v);try{await checkBackend();}catch{}};
 $("exportCsv").onclick=exportCsv;$("clearHistory").onclick=()=>{if(confirm("Xóa toàn bộ lịch sử tìm kiếm?")){state.history=[];persist(KEYS.history,state.history);renderLibrary();}};
 $("clearRecent").onclick=()=>{if(confirm("Xóa toàn bộ danh sách vừa xem?")){state.recent=[];persist(KEYS.recent,state.recent);renderLibrary();}};
 $("clearAllData").onclick=()=>{if(confirm("Xóa lịch sử, gần đây và danh sách đã lưu trên thiết bị này?")){Object.values(KEYS).forEach(k=>localStorage.removeItem(k));state.saved=[];state.history=[];state.recent=[];renderLibrary();setStatus("Đã xóa dữ liệu Finder trên thiết bị.");}};
 $("closeDetail").onclick=closeDetail;$("detailModal").querySelector("[data-close]").onclick=closeDetail;$("closeLightbox").onclick=closeLightbox;$("lightbox").onclick=e=>{if(e.target===$("lightbox"))closeLightbox();};document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeDetail();closeLightbox();}});
 renderCounts();renderLibrary();checkBackend().catch(()=>{});setStatus("Sẵn sàng. Nhập truy vấn để bắt đầu khám phá.");
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();