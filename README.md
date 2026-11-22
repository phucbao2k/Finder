# JAV Discovery Engine v2.0

Project gồm frontend tĩnh (GitHub Pages) và backend Node.js (Render). GitHub Pages **không chạy backend**.

## Cấu trúc

- `public/index.html` — giao diện
- `public/assets/style.css` — giao diện responsive
- `public/assets/app.js` — gọi API, dựng kết quả web/ảnh
- `server/index.js` — backend Express, proxy search provider
- `render.yaml` — cấu hình deploy Render
- `.env.example` — biến môi trường mẫu

## 1. Chuẩn bị Search API

Backend dùng SerpAPI để truy vấn Google Search và Google Images. Tạo tài khoản/API key tại https://serpapi.com/ rồi lấy `SERPAPI_KEY`.

Không đưa API key vào HTML, JavaScript frontend hoặc GitHub.

## 2. Deploy backend lên Render

1. Đẩy toàn bộ project này lên một GitHub repository.
2. Vào https://render.com/ → New → Blueprint.
3. Chọn repository vừa tạo. Render đọc `render.yaml`.
4. Khi được hỏi biến môi trường, nhập `SERPAPI_KEY` bằng API key của bạn.
5. Deploy. Sao chép URL backend, ví dụ `https://jav-discovery-engine-api.onrender.com`.

Có thể deploy thủ công bằng Web Service:
- Root Directory: để trống
- Build Command: `npm install`
- Start Command: `npm start`
- Environment: `SERPAPI_KEY` = API key; `ALLOWED_ORIGINS` = `*`

## 3. Deploy frontend lên GitHub Pages

Project đã có workflow `.github/workflows/pages.yml` để deploy thư mục `public/` tự động.

1. Đẩy toàn bộ project lên repository GitHub (nhánh `main`).
2. Vào repository → Settings → Pages.
3. Ở mục Build and deployment, chọn **Source: GitHub Actions**.
4. Workflow sẽ chạy khi push lên `main`. Chờ workflow `Deploy frontend to GitHub Pages` hoàn tất.
5. Mở URL Pages được GitHub hiển thị.

## 4. Kết nối

1. Mở website GitHub Pages.
2. Ở phần “Kết nối backend”, dán URL Render.
3. Bấm “Kiểm tra & lưu kết nối”.
4. Nhập mô tả rồi bấm “Tìm kiếm metadata + hình ảnh”.

## API endpoints

- `GET /api/health` — health check
- `GET /api/config` — trạng thái cấu hình provider
- `POST /api/search` — body JSON: `{ "query": "search terms", "mode": "web" }`
- `POST /api/search` — body JSON: `{ "query": "search terms", "mode": "images" }`

## Ghi chú / giới hạn

- Search provider tính phí/giới hạn lượt theo gói tài khoản. Kiểm tra giá và hạn mức SerpAPI trước khi sử dụng.
- Gói Render miễn phí có thể sleep khi không hoạt động; lần gọi đầu có thể chậm.
- Kết quả ảnh chỉ là ảnh tìm được từ công cụ tìm kiếm. Độ khớp ảnh với phim cần kiểm chứng thủ công.
- Phiên bản này chưa scrape FANZA/DMM trực tiếp và không tự khẳng định mã phim, diễn viên hay hãng khi nguồn không xác nhận.
- Không dùng API key trong frontend. Chỉ cấu hình ở biến môi trường backend.
