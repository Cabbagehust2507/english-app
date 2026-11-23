# Website tự học tiếng Anh

## Mục tiêu
Website cá nhân để mình tự học tiếng Anh, tập trung vào 3 phần:
1. **Cụm từ (collocations, idioms)**: flashcard, ôn tập ngắt quãng (hệ thống hộp Leitner 1–5).
2. **Luyện nghe**: nghe câu rồi chép chính tả, so sánh và đánh dấu từ sai.
3. **Luyện IELTS**: Speaking Part 1/2/3 có đồng hồ như phòng thi; Writing Task 2 có đếm từ và đồng hồ 40 phút.

**Ưu tiên hiện tại:** Cụm từ + Luyện nghe. IELTS để sau: tab IELTS đang ẩn (`SHOW_IELTS = false` trong `app.js`), code và đề vẫn giữ.

**Trang chủ** (`#trang-chu`, trang mặc định) tập trung tạo động lực: lời chào, ô chuỗi ngày (số ngày, 7 chấm tuần này, kỷ lục, mốc tiếp theo), mục tiêu hôm nay (vòng tròn, sửa được), nút đi học, biểu đồ 7 ngày, lịch 12 tuần, "vườn cụm từ" theo 5 mức nhớ, huy hiệu, tổng kết.
- 5 mức nhớ hiển thị: 🌱 Hạt mầm · Mới học → 🌿 Nảy mầm · Đang nhớ → 🪴 Cây non · Khá nhớ → 🌳 Cây lớn · Nhớ chắc → 🌸 Nở hoa · Đã thuộc (trường `box` 1–5).
- Chuỗi ngày: huy hiệu 🔥 ở đầu trang (viền đứt khi hôm nay chưa học), chúc mừng ở mốc 3/7/30/100 ngày. Ngày tính theo giờ trên máy (`dateKey`), không dùng `toISOString`.

## Nguồn dữ liệu: người dùng tự nhập
Nội dung học lấy từ nguồn công khai do mình chọn (Tatoeba, ManyThings, VOA Learning English…) và nhập qua mục **Nhập dữ liệu**. Không tự viết cứng dữ liệu vào code, trừ bộ "Mẫu" và **Kho học liệu** (`data/library.js`).
- Tab **Nhập dữ liệu** (`#nhap-du-lieu`) là màn chọn: 2 nút lớn **📚 Nhập cụm từ** (`#nhap-cum-tu`) và **🎧 Nhập bài nghe** (`#nhap-bai-nghe`), kèm "Dữ liệu của bạn" và gợi ý nguồn. Mỗi màn nhập có hai cách: Thêm từng mục / Nhập từ file (lưu ở `eng_importmode`). Các khung thuộc màn nào được đánh dấu `data-kind="p"` hoặc `"l"`. Tab Cụm từ và Luyện nghe có nút ➕ dẫn thẳng tới màn nhập tương ứng.
- **Kho học liệu** (`#kho-hoc-lieu`, nút 📦 ở màn Nhập dữ liệu): lộ trình (mỗi lộ trình 3 chặng; IELTS Band 6 → 7 và Tiếng Anh công sở; chặng chưa có `groups` hiện "sắp có") + lưới tất cả các bộ có chip lọc. Thêm bộ thì chép mục vào `eng_cards`/`eng_listen` kèm trường `lib` = mã bộ (bỏ qua mục trùng). Chặng xong khi 80% cụm từ đạt 🪴 Cây non trở lên (`LEARNED_BOX`, `STAGE_DONE`). Mỗi chặng chia `groups`; "Học tiếp" chỉ thêm nhóm sau khi nhóm trước nhớ đủ 80%. Lộ trình học gần nhất lưu ở `eng_lib_last`, hiện ở ô "🧭" Trang chủ.

**Cụm từ**: cột `phrase`*, `meaning`*, `context` (dùng khi nào), `example`, `topic`, `source`, `image`.
- `image` là tên ảnh đã tải lên (lưu trong IndexedDB `eng_images`, ảnh lớn tự thu nhỏ về cạnh 800px) hoặc link http(s). Có thể thêm ảnh trực tiếp trên mặt sau thẻ.
**Bài nghe**: cột `text`*, `translation`, `audio`, `start`, `end`, `topic`, `source`.
- `audio` là tên file đã tải lên (lưu trong IndexedDB `eng_audio`) hoặc link http(s). Để trống thì dùng giọng đọc tự động.
- `start`/`end` nhận giây (`75`) hoặc `m:ss` / `h:mm:ss` (`1:15`, `1:02:03.5`).
- Nhận dữ liệu: TSV dán từ Google Sheets/Excel, CSV (dấu `,` hoặc `;`, có ngoặc kép), JSON (mảng object hoặc bản sao lưu `{v,phrases,listening}`).
- Tên cột không phân biệt hoa/thường, có dấu hay không dấu (vd `Cụm từ`, `nghia`, `chu_de`).
- Tự nhận ra file cặp câu Tatoeba (`id⇥câu Anh⇥id⇥câu Việt`) và file Anki của ManyThings (`Anh⇥Việt⇥CC-BY…`).
- Luôn có bước **Xem trước**: đếm dòng hợp lệ / lỗi / trùng, báo lỗi theo số dòng, cảnh báo file âm thanh chưa tải lên. Có hai chế độ: Thêm vào dữ liệu hiện có, hoặc Thay toàn bộ.
- Giữ cột `source` để ghi công tác giả. Câu chữ Tatoeba theo giấy phép CC BY 2.0 FR, còn file ghi âm thì mỗi người đóng góp tự chọn giấy phép.

## Người dùng
- Chỉ mình mình dùng, là người Việt, mục tiêu IELTS.
- Giao diện bằng tiếng Việt, nội dung học bằng tiếng Anh, nghĩa giải thích bằng tiếng Việt.

## Công nghệ
- HTML, CSS, JavaScript thuần, không framework, không cần build.
- Phát âm và đọc câu dùng Web Speech API (`speechSynthesis`). Không có nút chọn giọng (nhiều máy chỉ có một giọng): `pickVoice()` tự chọn giọng tiếng Anh tốt nhất máy có (Natural/Online/Google → en-GB → en-US → bất kỳ), chỉ báo khi máy không có giọng tiếng Anh nào.
- Lưu cụm từ, bài nghe, tiến độ bằng `localStorage` (khóa `eng_cards`, `eng_listen`, `eng_stats`). `eng_stats.log` ghi số lượt theo ngày (`{ "2026-11-23": { cards, listen } }`); mục tiêu ở `eng_goals`, mốc đã chúc mừng ở `eng_celebrated`. Tệp âm thanh (`eng_audio`) và ảnh (`eng_images`) lưu trong IndexedDB.
- **Tài khoản (Supabase)**: đăng nhập email + mật khẩu (`account.js`); đăng nhập xong hộp tự đóng, về Trang chủ, thông báo nổi báo kết quả đồng bộ, thư viện `@supabase/supabase-js` nạp từ CDN (ghim phiên bản). Máy vẫn là bản chính để học (học được khi không có mạng); Supabase chỉ để đồng bộ. Không cấu hình (`config.js` trống) hoặc không có mạng thì web vẫn chạy như cũ.
  - `config.js` chỉ chứa Project URL và khóa **công khai** (publishable/anon). Không bao giờ đưa khóa bí mật (secret/service_role) vào code.
  - `supabase/setup.sql`: bảng `user_data` (mỗi người một dòng, cột `data` jsonb), bảo mật theo dòng (RLS), kho tệp riêng tư `media` (thư mục theo mã người dùng). Hướng dẫn: `docs/huong-dan-supabase.md`.
  - **Đồng bộ** (`sync.js`): cả gói dữ liệu học nằm trong `user_data.data`. Gộp theo từng mục: thẻ/câu có trường `u` (lúc sửa, do `stampChanges()` trong `save()` tự ghi), mục xóa ghi vào `eng_deleted`; thống kê lấy số lớn hơn, ngày học gộp hết, "Đặt lại tiến độ" lan sang máy khác qua `stats.resetAt`. Ghi lên chỉ khi `updated_at` chưa đổi (tránh ghi đè máy khác), lỗi thì thử lại. Lần đầu một máy đồng bộ mà cả hai bên có dữ liệu thì hỏi: Gộp / Dùng tài khoản / Dùng máy này.
  - **Link trong email**: `readEmailLink()` đọc `#access_token…&type=signup` / `#error_code=…` ngay khi mở trang (trước khi Supabase xóa), hiện màn "🎉 Xác nhận email thành công" hoặc "Link không dùng được". Chỉ chạy được khi web có địa chỉ http(s) và địa chỉ đó nằm trong Site URL / Redirect URLs của Supabase.
  - **Đưa lên mạng**: GitHub Pages (kho công khai `english-app`, tải file lên qua trình duyệt). Hướng dẫn: `docs/huong-dan-dua-len-mang.md`.
  - Lộ trình: 8a đăng nhập (xong) → 8b đồng bộ dữ liệu học (xong) → 8d đưa web lên mạng (code + hướng dẫn xong, chờ mình làm theo) → 8c đồng bộ ảnh/âm thanh.
- Phần đọc file (`toRecords`, `validate`, `toSec`) nằm giữa hai comment `/*PARSER-START*/` và `/*PARSER-END*/`, là hàm thuần nên có thể test bằng Node.
- Dùng tốt trên điện thoại (responsive).

## Giao diện (theme)
- Hai chế độ, có nút chuyển Sáng/Tối ở đầu trang, lưu lựa chọn trong localStorage (khóa `eng_theme`).
- **Sáng – "Bình minh"**: nền kem đào #FFF6EE, đầu trang cam mơ #F4A261, chữ nâu đậm #3A2618, điểm nhấn #B5541C, nút "Nhớ rồi" xanh ngọc #2F8F83.
- **Tối – "Hoàng hôn"**: nền nâu cà phê #241A14, thẻ #33261D, chữ kem #F6E8DC, điểm nhấn cam hổ phách #F0A56B, xanh lá dịu #9CCFA8.
- Font: Be Vietnam Pro. Màu đặt trong biến CSS (`--bg`, `--ink`, `--acc`, `--btn`…) bằng `light-dark()`; luôn dùng biến, không viết mã màu trực tiếp.
- Chữ trên nền cam dùng màu nâu đậm (không dùng chữ trắng) để đủ độ tương phản.

## Cấu trúc thư mục
- `index.html`: giao diện
- `style.css`: giao diện, màu sắc
- `app.js`: logic
- `sync.js`: đồng bộ (nạp sau `app.js`); `account.js`: tài khoản (nạp cuối); `config.js`: thông tin kết nối Supabase
- `supabase/setup.sql`: tạo bảng, quy tắc bảo mật, kho tệp; `docs/`: hướng dẫn
- `data/phrases.js`, `data/listening.js`, `data/ielts.js`, `data/library.js`: bộ "Mẫu", đề IELTS và Kho học liệu, khai báo biến `SAMPLE_PHRASES`, `SAMPLE_LISTENING`, `IELTS_DATA`, `LIBRARY`. Dùng `.js` thay vì `.json` để nhấp đúp mở `index.html` vẫn chạy (trình duyệt chặn đọc `.json` khi mở bằng `file://`). Nạp trước `app.js`.

## Quy tắc khi viết code
- Mình mới học lập trình: viết code đơn giản, dễ đọc, có comment tiếng Việt.
- Mỗi lần chỉ làm một tính năng. Lên kế hoạch trước và chờ mình duyệt.
- Sau khi sửa, giải thích ngắn gọn đã thay đổi gì và hướng dẫn cách mình tự kiểm tra.
- Không xóa dữ liệu học hay tiến độ của mình nếu mình chưa đồng ý.
