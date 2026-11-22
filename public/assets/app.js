const $ = id => document.getElementById(id);
let apiBase = localStorage.getItem("jde_api_base") || "";
let lastPrompt = "";
let saved = [];
const moodButtons = [...document.querySelectorAll(".chip")];
moodButtons.forEach(b => b.addEventListener("click", () => b.classList.toggle("active")));
const moods = () => moodButtons.filter(b => b.classList.contains("active")).map(b => b.textContent);
function apiUrl(path){return (apiBase || "").replace(/\/+$/,"") + path}
function buildTerms(text, selected, actress, maker){
 const t=text.toLowerCase(), out=[];
 const rules=[[/ntr|phản bội|ngoại tình/,"寝取られ","浮気","不倫"],[/quyến rũ|dụ dỗ|cám dỗ/,"誘惑","小悪魔"],[/trưởng thành|người vợ|vợ/,"人妻","熟女"],[/diễn xuất tự nhiên|chân thực/,"自然な演技","ドラマ"],[/hài hước|đời thường/,"コメディ","日常"],[/tâm lý|cốt truyện/,"心理","ストーリー","ドラマ"]];
 rules.forEach(([re,...w])=>{if(re.test(t))out.push(...w)});
 if(selected.some(x=>x.includes("Tâm lý")))out.push("心理","ストーリー");
 if(selected.some(x=>x.includes("NTR")))out.push("寝取られ","浮気");
 if(selected.some(x=>x.includes("Trưởng thành")))out.push("人妻","熟女");
 if(!out.length)out.push("作品","女優","レビュー","あらすじ");
 if(actress)out.push(actress);if(maker)out.push(maker);
 return [...new Set(out)];
}
async function apiSearch(query,mode){
 const response=await fetch(apiUrl("/api/search"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,mode})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||`API error ${response.status}`);
 return data;
}
function setStatus(message,isError=false){$("status").textContent=message;$("status").classList.toggle("error",isError)}
function makeLink(title,q){const a=document.createElement("a");a.className="query-link";a.href="https://www.google.com/search?q="+encodeURIComponent(q);a.target="_blank";a.rel="noopener";const b=document.createElement("b");b.textContent=title;const s=document.createElement("span");s.textContent=q;a.append(b,s);return a}
$("search").onclick=async()=>{
 const brief=$("brief").value.trim(),actress=$("actress").value.trim(),maker=$("maker").value.trim(),era=$("era").value,priority=$("priority").value,selected=moods();
 const terms=buildTerms(brief,selected,actress,maker),query=[...terms,brief,era].filter(Boolean).join(" ");
 if(!query.trim()){setStatus("Hãy nhập mô tả hoặc chọn mood trước.",true);return}
 $("search").disabled=true;setStatus("Đang tìm metadata và ảnh…");
 $("queryLinks").replaceChildren(makeLink("Google · tìm metadata",query+" 品番 女優 メーカー"),makeLink("Google Images · ảnh bìa",query+" DVD cover"),makeLink("Google Images · highlight",query+" 場面 スチル"));
 lastPrompt=`Hãy nghiên cứu metadata phim JAV theo yêu cầu:\nMô tả: ${brief}\nMood: ${selected.join(", ")||"Tự mô tả"}\nDiễn viên: ${actress||"không giới hạn"}\nHãng/mã: ${maker||"không giới hạn"}\nThời kỳ: ${era||"không giới hạn"}\nƯu tiên: ${priority}\nTìm nhiều nguồn, mở rộng từ khóa tiếng Nhật. Trả bảng Mã phim | Tên | Diễn viên | Hãng | Năm | Đặc điểm khớp | Mức xác minh | Nguồn. Không bịa mã, phân biệt dữ kiện xác nhận và suy luận.`;
 try{
  const [web,images]=await Promise.all([apiSearch(query+" JAV 品番 女優 メーカー", "web"),apiSearch(query+" JAV DVD cover scene", "images")]);
  renderResults(web.results||[]);renderImages(images.images||[]);
  $("resultsPanel").classList.remove("hidden");$("resultsPanel").scrollIntoView({behavior:"smooth"});
  setStatus(`Hoàn tất: ${(web.results||[]).length} kết quả web · ${(images.images||[]).length} ảnh. Kiểm tra nguồn trước khi xác nhận mã phim.`);
 }catch(e){setStatus(e.message+" Hãy kiểm tra URL backend và API key trên Render.",true)}
 finally{$("search").disabled=false}
};
function renderResults(results){
 const box=$("results");box.replaceChildren();
 if(!results.length){box.textContent="Không có kết quả web phù hợp.";return}
 results.forEach(r=>{
  const card=document.createElement("article");card.className="card";const body=document.createElement("div");body.className="cardbody";
  const h=document.createElement("h3");h.textContent=r.title;const p=document.createElement("p");p.textContent=r.snippet||"Không có mô tả";p.className="meta";
  const meta=document.createElement("div");meta.className="small";meta.textContent=[r.source,r.date].filter(Boolean).join(" · ");
  const a=document.createElement("a");a.href=r.link;a.target="_blank";a.rel="noopener";a.textContent="Mở nguồn ↗";
  body.append(h,p,meta,a);card.append(body);box.append(card);
 });
}
function renderImages(images){
 const box=$("images");box.replaceChildren();
 if(!images.length){box.textContent="Không tìm thấy ảnh.";return}
 images.forEach(im=>{
  const card=document.createElement("article");card.className="image-card";const a=document.createElement("a");a.href=im.link||im.original||"#";a.target="_blank";a.rel="noopener";
  const img=document.createElement("img");img.src=im.thumbnail;img.alt=im.title||"Search image";img.loading="lazy";img.referrerPolicy="no-referrer";
  const cap=document.createElement("div");cap.textContent=[im.title,im.source].filter(Boolean).join(" · ");a.append(img);card.append(a,cap);box.append(card);
 });
}
$("copyPrompt").onclick=async()=>{try{await navigator.clipboard.writeText(lastPrompt);setStatus("Đã copy prompt cho ChatGPT.")}catch{setStatus("Clipboard bị chặn bởi trình duyệt.",true)}};
$("saveApi").onclick=async()=>{apiBase=$("apiBase").value.trim().replace(/\/+$/,"");localStorage.setItem("jde_api_base",apiBase);try{const r=await fetch(apiUrl("/api/health"));if(!r.ok)throw Error("Không kết nối được backend");const d=await r.json();setStatus(d.providerConfigured?"Backend kết nối OK · API provider đã cấu hình.":"Backend hoạt động nhưng thiếu SERPAPI_KEY trên Render.",!d.providerConfigured)}catch(e){setStatus("Không kết nối được backend: "+e.message,true)}};
$("apiBase").value=apiBase;
$("reset").onclick=()=>{$("brief").value=$("actress").value=$("maker").value="";$("era").selectedIndex=$("priority").selectedIndex=0;moodButtons.forEach(b=>b.classList.remove("active"));$("resultsPanel").classList.add("hidden");setStatus("Đã làm mới.")};
