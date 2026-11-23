# JAV Finder 4.1

## Cấu trúc
- `public/`: frontend GitHub Pages (HTML/CSS/Vanilla JS).
- `server/`: Express API chạy trên Render.
- Lịch sử, vừa xem và ứng viên lưu trong `localStorage`.

## Điểm sửa trong 4.1
- Ảnh Google Images được ghép vào thẻ kết quả ngay ở màn hình tìm kiếm; các kết quả có mã phim còn được truy vấn ảnh theo mã để tăng khả năng tìm đúng cover. Ảnh vẫn là ảnh tham khảo từ nguồn ngoài, không được xem là xác minh.
- Smart Refresh chạy hai truy vấn biến thể mỗi lượt, hỗ trợ phân trang Google (`start=10, 20, ...`) thay vì chỉ nối thêm tag vào cùng một truy vấn. Kết quả cũ được giữ và kết quả trùng được loại bỏ.
- Giữ luồng tìm kiếm, thư viện lưu, lịch sử, danh sách vừa xem, chi tiết và lightbox.

## Deploy Render
1. Tạo Web Service từ repository.
2. Runtime Node, Build `npm install`, Start `npm start`.
3. Environment: `SERPAPI_KEY` = API key SerpAPI; `ALLOWED_ORIGINS` có thể để `*` hoặc khai báo origin GitHub Pages.
4. Deploy và kiểm tra `/api/health`.

## Deploy GitHub Pages
Workflow `.github/workflows/pages.yml` tự deploy thư mục `public/` khi push lên `main`. Trong GitHub: Settings → Pages → Build and deployment → Source: GitHub Actions.

## Kết nối
Mặc định frontend dùng `https://jav-discovery-engine-api.onrender.com`. Nếu URL Render khác, vào Cài đặt và lưu URL backend.

## Giới hạn cần biết
- Tìm kiếm web/ảnh cần `SERPAPI_KEY`; mỗi lần Smart Refresh thực hiện hai truy vấn nên tiêu tốn lượt API.
- Ảnh lấy từ Google Images, có thể không đúng phim hoặc bị website nguồn chặn hotlink. Không có cách bảo đảm mọi kết quả đều có preview.
- Mã phim được trích từ tiêu đề/snippet chỉ là gợi ý, chưa xác minh catalog. Diễn viên/hãng/điểm phù hợp chỉ hiển thị khi nguồn thực sự cung cấp; không tự bịa metadata.
- Phân tích tag dùng bộ quy tắc cục bộ, chưa tích hợp AI.
