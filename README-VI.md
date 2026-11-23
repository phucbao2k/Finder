# JAV Finder 4.0

## Cấu trúc
- `public/`: frontend GitHub Pages (HTML/CSS/Vanilla JS).
- `server/`: Express API chạy trên Render.
- Không dùng database; lịch sử, vừa xem và ứng viên lưu trong `localStorage`.

## Deploy Render
1. Tạo Web Service từ repository.
2. Runtime Node, Build `npm install`, Start `npm start`.
3. Environment: `SERPAPI_KEY` = API key SerpAPI; `ALLOWED_ORIGINS` có thể để `*` hoặc khai báo origin GitHub Pages.
4. Deploy và kiểm tra `/api/health`.

## Deploy GitHub Pages
Workflow `.github/workflows/pages.yml` tự deploy thư mục `public/` khi push lên `main`.
Trong GitHub: Settings → Pages → Build and deployment → Source: GitHub Actions.

## Kết nối
Mặc định frontend dùng `https://jav-discovery-engine-api.onrender.com`. Nếu URL Render khác, vào Cài đặt và lưu URL backend.

## Giới hạn trung thực
- Tìm kiếm web/ảnh cần `SERPAPI_KEY`.
- Smart Refresh gọi lại API bằng truy vấn biến thể, giữ kết quả cũ và chống trùng theo mã nhận diện trích từ tiêu đề/snippet hoặc URL. Mã trích xuất chỉ là gợi ý, không phải xác minh catalog.
- Google organic results không đảm bảo là trang phim. Các trường diễn viên/hãng/điểm phù hợp chưa được API hiện tại cung cấp nên giao diện ghi rõ chưa xác định.
- Gallery lấy từ Google Images; ảnh có thể không đúng phim hoặc không tải được.
- Phân tích tag dùng bộ quy tắc cục bộ, chưa tích hợp AI.
- Không có dữ liệu demo giả. Backend lỗi thì hiển thị trạng thái lỗi.
