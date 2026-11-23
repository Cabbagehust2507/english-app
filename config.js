/* =========================================================
   config.js – thông tin kết nối Supabase (xem docs/huong-dan-supabase.md)

   Dán vào hai dòng bên dưới, lấy ở Supabase → Project Settings → API Keys / Data API:
   - url: "Project URL", dạng https://xxxxxxxx.supabase.co
   - key: khóa CÔNG KHAI – "Publishable key" (bắt đầu bằng sb_publishable_)
          hoặc ở dự án cũ là khóa "anon public" (bắt đầu bằng eyJ…)

   ⚠ KHÔNG BAO GIỜ dán khóa bí mật ("Secret key" / "service_role") vào đây.
   Khóa công khai thì đưa lên mạng vẫn an toàn, vì quy tắc bảo mật trong
   supabase/setup.sql chỉ cho mỗi người đọc dữ liệu của chính mình.

   Để trống cả hai thì web vẫn chạy bình thường, chỉ không có tài khoản.
   ========================================================= */
const SUPABASE_CONFIG = {
  url: 'https://xjrrpdqqmtpyqyedknpf.supabase.co',
  key: 'sb_publishable_qlvr7nXCmH30iOD8lLLryQ_z5B5_snF',
};
