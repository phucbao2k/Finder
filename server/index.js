require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.SERPAPI_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map(x=>x.trim()).filter(Boolean);
app.use(cors({origin(origin,cb){if(!origin||ALLOWED_ORIGINS.includes("*")||ALLOWED_ORIGINS.includes(origin))return cb(null,true);return cb(new Error("Origin not allowed by CORS"));}}));
app.use(express.json({limit:"32kb"}));
app.use(express.static(path.resolve(__dirname,"../public")));
const clean=(v,n=300)=>String(v??"").trim().slice(0,n);
const cache=new Map(),inFlight=new Map(),TTL=10*60*1000,MAX=150;
function getCache(k){const e=cache.get(k);if(!e)return null;if(Date.now()>=e.expiresAt){cache.delete(k);return null;}cache.delete(k);cache.set(k,e);return e.data;}
function setCache(k,data){if(cache.size>=MAX){const first=cache.keys().next().value;if(first)cache.delete(first);}cache.set(k,{data,expiresAt:Date.now()+TTL});}
async function serpSearch(params){
 if(!API_KEY){const e=new Error("Backend chưa có SERPAPI_KEY. Thêm biến này trong Render → Environment.");e.status=503;throw e;}
 const url=new URL("https://serpapi.com/search.json");for(const [k,v] of Object.entries({...params,api_key:API_KEY}))if(v!==undefined&&v!==null&&v!=="")url.searchParams.set(k,String(v));
 const response=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(40000)});
 const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{data={};}
 if(!response.ok||data.error){const e=new Error(`SerpAPI trả lỗi${response.status?` HTTP ${response.status}`:""}: ${clean(data.error||raw,240)}`);e.status=502;throw e;}return data;
}
function normalizeWeb(data){return(data.organic_results||[]).slice(0,20).map(x=>({title:clean(x.title,300),snippet:clean(x.snippet,900),link:x.link||"",displayedLink:clean(x.displayed_link,200),date:clean(x.date,80),source:clean(x.source||x.displayed_link,120),thumbnail:x.thumbnail||""})).filter(x=>x.title&&x.link);}
function normalizeImages(data){return(data.images_results||[]).slice(0,30).map(x=>({title:clean(x.title,300),thumbnail:x.thumbnail||x.original||"",original:x.original||"",source:clean(x.source,120),link:x.link||""})).filter(x=>x.thumbnail);}
app.get("/api/health",(_req,res)=>res.json({ok:true,service:"JAV Finder API",provider:"SerpAPI",providerConfigured:Boolean(API_KEY),version:"4.2.0"}));
app.get("/api/config",(_req,res)=>res.json({providerConfigured:Boolean(API_KEY),provider:"SerpAPI",version:"4.2.0",features:{webSearch:true,imageSearch:true,smartRefresh:"client-orchestrated-query-variants",ai:false}}));
app.post("/api/search",async(req,res)=>{
 const query=clean(req.body?.query,500),mode=req.body?.mode==="images"?"images":"web",sort=req.body?.sort==="newest"&&mode==="web"?"newest":"relevance",start=Math.max(0,Math.min(90,Number.parseInt(req.body?.start,10)||0));
 if(!query)return res.status(400).json({error:"Vui lòng nhập mô tả hoặc từ khóa tìm kiếm."});
 if(!API_KEY)return res.status(503).json({error:"Backend chưa được cấu hình SERPAPI_KEY trên Render."});
 const key=`${mode}:${sort}:${start}:${query.toLocaleLowerCase()}`,cached=getCache(key);if(cached){res.set("X-Cache","HIT");return res.json(cached);}
 if(inFlight.has(key)){try{const d=await inFlight.get(key);res.set("X-Cache","COALESCED");return res.json(d);}catch(e){return res.status(e.status||502).json({error:e.message});}}
 const task=(async()=>{const data=await serpSearch({engine:mode==="images"?"google_images":"google",q:query,google_domain:"google.co.jp",gl:"jp",hl:"ja",safe:"off",...(mode==="web"&&start?{start}:{}),...(sort==="newest"?{tbs:"sbd:1"}:{})});
 const result=mode==="images"?{query,mode,images:normalizeImages(data)}:{query,mode,sort,results:normalizeWeb(data),knowledgeGraph:data.knowledge_graph?{title:clean(data.knowledge_graph.title,200),description:clean(data.knowledge_graph.description,500)}:null};setCache(key,result);return result;})();
 inFlight.set(key,task);try{const d=await task;res.set("X-Cache","MISS");return res.json(d);}catch(e){console.error("Search error:",e.message);return res.status(e.status||500).json({error:e.message||"Không thể thực hiện tìm kiếm."});}finally{inFlight.delete(key);}
});
app.listen(PORT,()=>console.log(`JAV Finder API listening on ${PORT}`));
