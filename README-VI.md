# JAV Finder 4.2

## Cấu trúc
- `public/`: frontend GitHub Pages (HTML/CSS/Vanilla JS).
- `server/`: Express API chạy trên Render.
- Lịch sử, vừa xem và ứng viên lưu trong `localStorage`.

## Điểm sửa trong 4.2
- Mỗi kết quả có mã phim được tìm Google Images riêng bằng truy vấn chính xác theo mã (`"SAME-202" JAV`); nếu dưới 4 ảnh thì bổ sung truy vấn tiếng Nhật.
- Ảnh của từng mã hiển thị thành dải carousel ngang ngay trên thẻ kết quả; vuốt ngang trên điện thoại, bấm ảnh để mở lightbox.
- Không lấy ảnh từ truy vấn mô tả chung để gán sang các mã phim khác nhau. Ảnh có mã phim khác được loại khi nhận diện được mã trong tiêu đề/đường dẫn.

## Các cải tiến kế thừa 4.1
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
- Tìm kiếm web/ảnh cần `SERPAPI_KEY`; mỗi mã phim phát hiện được sẽ cần ít nhất một truy vấn Google Images riêng; nếu kết quả ít hơn 4 ảnh, app chạy thêm truy vấn bổ sung. Vì vậy phiên tìm kiếm có nhiều mã sẽ tiêu tốn nhiều lượt API hơn. Backend giới hạn 3 lượt tìm ảnh đồng thời và cache truy vấn 10 phút.
- Ảnh lấy từ Google Images theo mã phim, độ chính xác tốt hơn truy vấn chung nhưng Google vẫn có thể trả ảnh sai hoặc ảnh trùng; đây không phải feed ảnh chính thức. Một số website có thể chặn hotlink khiến ảnh không hiển thị.
- Mã phim được trích từ tiêu đề/snippet chỉ là gợi ý, chưa xác minh catalog. Diễn viên/hãng/điểm phù hợp chỉ hiển thị khi nguồn thực sự cung cấp; không tự bịa metadata.
- Phân tích tag dùng bộ quy tắc cục bộ, chưa tích hợp AI.


## JAV Finder 4.3 — Image Pipeline Optimization

- Bỏ lượt Google Images tổng quát không gắn mã phim; ảnh được tìm theo từng mã phát hiện.
- Truy vấn ảnh ưu tiên mã phim chính xác và loại trừ nhóm từ khóa sản phẩm toy/phụ kiện không liên quan.
- Lọc ứng viên theo tiêu đề, nguồn, URL; loại sản phẩm toy rõ ràng và mã phim khác.
- Chấm điểm ảnh theo mức độ khớp mã và tín hiệu DVD/sample/catalog.
- Chỉ gọi truy vấn ảnh bổ sung khi lượt đầu có dưới 2 ảnh hợp lệ.
- Cache ảnh theo mã phim ở trình duyệt tối đa 7 ngày (giới hạn 120 mã); backend cache kết quả Google Images 6 giờ.
- Giữ tối đa 3 mã phim tìm ảnh đồng thời; ảnh trong gallery dùng lazy loading/async decoding.
- Trang chi tiết ưu tiên thumbnail để giảm lỗi hotlink/403 khi hiển thị cover.

Lưu ý: lọc dựa trên metadata văn bản mà Google Images cung cấp; không thể xác định tuyệt đối nội dung hình ảnh chỉ từ URL/title. Một số host vẫn có thể trả 403 cho trình duyệt. Ảnh gốc mở trong lightbox vẫn phụ thuộc quyền truy cập của host.
