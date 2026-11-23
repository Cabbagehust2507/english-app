# Hướng dẫn tạo dự án Supabase (bước 8a)

Mất khoảng 10 phút. Làm một lần là xong.

> Giao diện Supabase thỉnh thoảng đổi tên nút. Nếu không thấy đúng chữ như dưới đây,
> hãy tìm mục có tên gần giống.

---

## 1. Tạo tài khoản Supabase

1. Vào **https://supabase.com** → bấm **Start your project**.
2. Đăng ký bằng GitHub hoặc email. Gói **Free** là đủ, không cần thẻ.

## 2. Tạo dự án

1. Bấm **New project**.
2. Điền:
   - **Project name**: `english-app` (tên nào cũng được)
   - **Database Password**: bấm **Generate a password**, rồi lưu mật khẩu này vào chỗ an toàn.
     Web **không** cần mật khẩu này, nhưng sau này có thể bạn sẽ cần.
   - **Region**: chọn **Southeast Asia (Singapore)** – gần Việt Nam nhất nên nhanh nhất.
3. Bấm **Create new project** và chờ 1–2 phút cho dự án khởi động.

## 3. Chạy file SQL (tạo bảng và quy tắc bảo mật)

1. Thanh menu bên trái → **SQL Editor** → **New query** (hoặc nút **+**).
2. Trên máy, mở file `supabase/setup.sql` (trong thư mục website) bằng Notepad hoặc VS Code.
   Chọn tất cả (**Ctrl+A**), sao chép (**Ctrl+C**).
3. Dán vào ô soạn thảo của Supabase (**Ctrl+V**) → bấm **Run** (hoặc **Ctrl+Enter**).
4. Nếu Supabase hỏi kiểu *"This query has destructive operations"* thì bấm xác nhận chạy
   (do file có lệnh `drop policy if exists` để chạy lại được nhiều lần – không xóa dữ liệu nào).
5. Kết quả đúng: ở dưới hiện một dòng **bang_user_data = 1**, **kho_media = 1**.

## 4. Lấy địa chỉ và khóa công khai

1. Bấm **Project Settings** (biểu tượng bánh răng, cuối menu trái).
2. Mục **API Keys**: sao chép **Publishable key** (bắt đầu bằng `sb_publishable_`).
   - Dự án cũ có thể không có mục này: vào tab **Legacy API keys**, sao chép khóa **anon public** (bắt đầu bằng `eyJ`).
3. Mục **Data API** (hoặc nút **Connect** ở trang chính của dự án): sao chép **Project URL**,
   dạng `https://xxxxxxxx.supabase.co`.

> ⚠ **Không** sao chép **Secret key** hay **service_role**. Khóa đó có toàn quyền với dự án,
> không bao giờ được đưa vào web.

## 5. Dán vào `config.js`

Mở file `config.js` trong thư mục website, dán vào giữa hai dấu nháy, rồi lưu:

```js
const SUPABASE_CONFIG = {
  url: 'https://xxxxxxxx.supabase.co',
  key: 'sb_publishable_xxxxxxxxxxxxxxxx',
};
```

## 6. Tạo tài khoản của bạn trên web

1. Nhấp đúp `index.html` → bấm nút **👤 Đăng nhập** ở đầu trang.
2. Bấm **Chưa có tài khoản? Đăng ký** → nhập email, mật khẩu (ít nhất 8 ký tự) → **Đăng ký**.
3. Mở hộp thư, tìm thư của Supabase → bấm link xác nhận.

   > ⚠️ **Lưu ý:** bấm xong có thể hiện trang lỗi kiểu *"localhost refused to connect"*.
   > Bạn **vẫn đăng ký thành công**, email đã được xác nhận rồi. Cứ đóng trang đó.
   > Lỗi này hết sau khi đưa web lên mạng (`docs/huong-dan-dua-len-mang.md`).
   > Khi đó bấm link sẽ mở lại web, báo **🎉 Xác nhận email thành công** và tự đăng nhập.

   Không thấy thư thì xem trong mục Spam / Quảng cáo.
4. Quay lại web → **Đăng nhập**. Hộp đăng nhập tự đóng, web về Trang chủ, tự đồng bộ
   và báo "☁️ Đã đồng bộ". Nút ở đầu trang đổi thành tên của bạn.

## 7. (Nên làm) Tắt đăng ký tài khoản mới

Web này chỉ mình bạn dùng. Sau khi đã tạo xong tài khoản, nên tắt đăng ký để người lạ
không tạo tài khoản trên dự án của bạn:

**Authentication** → **Sign In / Providers** (có khi nằm trong **Settings**) →
tắt **Allow new users to sign up** → **Save**.

Tài khoản đã có vẫn đăng nhập bình thường.

---

## 8. Đồng bộ giữa các máy (bước 8b)

- Đăng nhập cùng một tài khoản trên máy tính và điện thoại là dữ liệu tự đồng bộ:
  lúc đăng nhập, vài giây sau mỗi lần học, và khi bạn quay lại tab trang web.
- Biểu tượng cạnh nút tài khoản: ☁️ đã đồng bộ · 🔄 đang đồng bộ · 📴 không có mạng
  (học bình thường, có mạng lại sẽ tự đồng bộ) · ⚠️ lỗi (bấm nút tài khoản để xem lý do).
- Lần đầu đăng nhập trên một máy đã có dữ liệu riêng, web sẽ hỏi:
  **Gộp cả hai** (nên chọn) / Dùng dữ liệu trên tài khoản / Dùng dữ liệu máy này.
- Mượn máy người khác: khi đăng xuất, đánh dấu **"Xóa dữ liệu học trên máy này"**.
  Web đồng bộ lần cuối rồi mới xóa, nên không mất gì.
- Hạn chế nhỏ: nếu học **cùng lúc** trên hai máy khi **cả hai đều mất mạng**, số lượt
  của ngày hôm đó có thể bị tính thiếu một ít (không bao giờ bị tính trùng).
  Thẻ, câu nghe và ngày học thì vẫn gộp đầy đủ.

## Cần biết

- **Dự án miễn phí sẽ tạm dừng nếu khoảng 1 tuần không ai dùng.** Khi đó web báo
  "Không kết nối được tới Supabase". Vào supabase.com, mở dự án, bấm **Restore** là xong –
  dữ liệu không mất. Trong lúc đó web vẫn học bình thường bằng dữ liệu trên máy.
- Ảnh minh họa và tệp âm thanh **chưa** được đồng bộ – sẽ làm ở bước 8c.

## Gặp lỗi?

| Web báo | Nguyên nhân thường gặp |
|---|---|
| "Chưa cấu hình tài khoản" | `config.js` còn trống, hoặc chưa lưu file sau khi dán. |
| "Chưa dùng được tài khoản… không tải được thư viện" | Máy đang không có mạng. |
| "Sai email hoặc mật khẩu" | Gõ sai; hoặc chưa đăng ký tài khoản này. |
| "Email chưa được xác nhận" | Chưa bấm link trong thư xác nhận (xem cả Spam). |
| "Không kết nối được tới Supabase" | Mất mạng, URL trong `config.js` sai, hoặc dự án đang tạm dừng. |
| "Có lỗi: Invalid API key" | Dán nhầm khóa, hoặc thiếu ký tự khi sao chép. |
| "Link trong email không dùng được" | Link đã hết hạn hoặc đã bấm trước đó. Nếu đã bấm rồi thì cứ đăng nhập. |
