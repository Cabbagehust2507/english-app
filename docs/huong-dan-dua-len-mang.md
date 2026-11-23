# Hướng dẫn đưa web lên mạng bằng GitHub Pages (bước 8d)

Mất khoảng 15 phút. Xong thì bạn có một địa chỉ dạng
`https://TEN-CUA-BAN.github.io/english-app/` để mở trên máy tính và điện thoại.
Bấm link xác nhận trong email cũng sẽ quay về đúng trang này và báo **thành công**.

> Giao diện GitHub / Supabase thỉnh thoảng đổi tên nút. Nếu không thấy đúng chữ như dưới đây,
> hãy tìm mục có tên gần giống.

---

## 0. Trước khi bắt đầu: đưa dữ liệu học lên tài khoản

Web trên mạng là **một "chỗ" mới** trong trình duyệt. Nó không đọc được dữ liệu của bản bạn
vẫn mở bằng cách nhấp đúp `index.html`. Dữ liệu sẽ được chuyển sang qua tài khoản:

1. Nhấp đúp `index.html` như mọi khi → đăng nhập.
2. Đợi biểu tượng cạnh nút 👤 hiện **☁️** (đã đồng bộ).
3. (Cho chắc) Vào **Nhập dữ liệu** → **Sao chép bản sao lưu** → dán vào một file Notepad và lưu lại.

> ⚠️ **Ảnh minh họa và tệp âm thanh bạn đã tải lên chưa được đồng bộ** (sẽ làm ở bước 8c).
> Trên web mới bạn cần tải lại chúng, nên hãy giữ các file gốc.

## 1. Tạo tài khoản GitHub

1. Vào **https://github.com/signup** và đăng ký (miễn phí).
2. Tên người dùng (username) sẽ nằm trong địa chỉ web, vd `lan-hoc-anh` → `lan-hoc-anh.github.io`.

## 2. Tạo kho chứa code (repository)

1. Đăng nhập GitHub → bấm dấu **+** ở góc trên bên phải → **New repository**.
2. Điền:
   - **Repository name**: `english-app`
   - Chọn **Public** (gói miễn phí chỉ đưa lên mạng được kho công khai).
   - Các ô khác để nguyên.
3. Bấm **Create repository**.

> Kho **công khai** nghĩa là ai cũng xem được *code*. Như vậy là an toàn:
> - `config.js` chỉ chứa khóa **công khai** của Supabase.
> - Dữ liệu học của bạn **không** nằm trong thư mục này mà nằm trong trình duyệt và trong Supabase.
>   Nó được bảo vệ bằng mật khẩu tài khoản.

## 3. Tải các file lên

1. Ở trang kho vừa tạo, bấm link **uploading an existing file**.
2. Mở thư mục `english-app` trên máy bằng File Explorer → **Ctrl+A** để chọn tất cả file và thư mục
   *bên trong* nó (`index.html`, `app.js`, `data`, `docs`…).
3. Kéo tất cả thả vào ô trên trang GitHub. Chờ thanh tải chạy xong.
4. Kéo xuống dưới → bấm **Commit changes**.
5. Kiểm tra: trang kho phải liệt kê `index.html`, `app.js`, `config.js`, thư mục `data`…
   (**không** phải chỉ một thư mục `english-app` chứa mọi thứ bên trong).

## 4. Bật GitHub Pages

1. Trong kho → tab **Settings** → menu trái **Pages**.
2. Mục **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`, thư mục `/ (root)` → **Save**.
3. Chờ 1–2 phút rồi tải lại trang Settings → Pages. Ở trên cùng sẽ hiện
   **"Your site is live at https://TEN-CUA-BAN.github.io/english-app/"**.
4. Sao chép địa chỉ này. Bạn sẽ cần nó ở bước sau.

## 5. Báo cho Supabase biết địa chỉ mới

Bước này giúp link trong email quay về đúng web của bạn (hết lỗi "localhost refused to connect").

1. Vào **supabase.com** → mở dự án → menu trái **Authentication** → **URL Configuration**.
2. **Site URL**: xóa `http://localhost:3000`, dán địa chỉ của bạn, vd
   `https://TEN-CUA-BAN.github.io/english-app/` → **Save**.
3. **Redirect URLs** → **Add URL** → dán địa chỉ đó và thêm `**` vào cuối, vd
   `https://TEN-CUA-BAN.github.io/english-app/**` → **Save URLs**.

## 6. Dùng web trên mạng

1. Mở địa chỉ của bạn → bấm **👤 Đăng nhập**.
   Dữ liệu học trên tài khoản sẽ tự tải về.
2. Lưu địa chỉ vào **dấu trang** (bookmark).
3. Trên điện thoại:
   - Mở địa chỉ bằng Chrome/Safari → đăng nhập.
   - Mở menu → **Thêm vào màn hình chính** (Add to Home screen). Web sẽ có biểu tượng như một ứng dụng.

Từ giờ nên dùng bản trên mạng. Bản nhấp đúp `index.html` vẫn dùng được và vẫn đồng bộ chung
tài khoản.

## 7. Thử link xác nhận / quên mật khẩu (không bắt buộc)

- **Quên mật khẩu**:
  1. Đăng xuất → **Đăng nhập** → **Quên mật khẩu?** → nhập email.
  2. Bấm link trong thư: web mở lại và hiện ô **Đặt mật khẩu mới**.
- **Xác nhận đăng ký**: chỉ thử được khi đang **bật** đăng ký tài khoản mới (xem mục 7 trong
  `huong-dan-supabase.md`). Đăng ký bằng một email khác của bạn → bấm link trong thư.
  Web mở lại và hiện **🎉 Xác nhận email thành công!** Thử xong nhớ tắt lại đăng ký.

---

## Khi sửa code: cập nhật bản trên mạng

1. Vào kho trên GitHub → **Add file** → **Upload files**.
2. Kéo thả các file vừa sửa vào (file trùng tên sẽ được thay).
   File nằm trong thư mục con (vd `data/phrases.js`) thì kéo **cả thư mục** `data`.
3. Bấm **Commit changes**. Chờ 1–2 phút, mở web và bấm **Ctrl+F5** để tải bản mới.

## Gặp lỗi?

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Mở địa chỉ thấy "404 – There isn't a GitHub Pages site here" | Vừa bật Pages, chờ thêm vài phút. Hoặc `index.html` nằm trong thư mục con: xem lại bước 3.5. |
| Trang hiện chữ nhưng không có màu, không bấm được gì | Thiếu file `style.css` / `app.js` hoặc thư mục `data`: tải lên lại. |
| Bấm link trong email vẫn ra `localhost:3000` | Chưa lưu **Site URL** ở bước 5. Hoặc thư được gửi *trước khi* đổi Site URL: đăng ký lại hoặc gửi lại thư. |
| Web báo "Link trong email không dùng được" | Link đã hết hạn hoặc đã bấm trước đó. Nếu đã bấm rồi thì cứ đăng nhập. |
| Sửa code xong mà web không đổi | Chờ 1–2 phút rồi **Ctrl+F5**. |
| Web trên mạng không có dữ liệu cũ | Chưa đăng nhập. Hoặc bản cũ chưa đồng bộ lên tài khoản: xem bước 0. |
