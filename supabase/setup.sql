-- =========================================================
-- setup.sql – chuẩn bị dự án Supabase cho website học tiếng Anh
-- Cách dùng: Supabase → SQL Editor → New query → dán toàn bộ file này → Run.
-- Chạy lại nhiều lần cũng không sao (các lệnh đều kiểm tra trước khi tạo).
-- =========================================================


-- ---------- 1. Bảng lưu dữ liệu học ----------
-- Mỗi người dùng có đúng MỘT dòng. Cột data chứa toàn bộ cụm từ, bài nghe,
-- tiến độ, cài đặt… dưới dạng JSON (giống bản sao lưu trong web).
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Cho phép người đã đăng nhập đọc/ghi bảng qua API (quy tắc bên dưới còn giới hạn tiếp)
grant select, insert, update, delete on public.user_data to authenticated;

-- Bật bảo mật theo dòng: mặc định KHÔNG ai đọc/ghi được, trừ khi có quy tắc cho phép
alter table public.user_data enable row level security;

-- Quy tắc: mỗi người chỉ đọc / thêm / sửa / xóa được dòng của chính mình
drop policy if exists "user_data: doc cua minh" on public.user_data;
create policy "user_data: doc cua minh" on public.user_data
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_data: them cua minh" on public.user_data;
create policy "user_data: them cua minh" on public.user_data
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_data: sua cua minh" on public.user_data;
create policy "user_data: sua cua minh" on public.user_data
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_data: xoa cua minh" on public.user_data;
create policy "user_data: xoa cua minh" on public.user_data
  for delete to authenticated
  using ((select auth.uid()) = user_id);


-- ---------- 2. Kho tệp ảnh và âm thanh (dùng ở bước 8c) ----------
-- Kho "media" ở chế độ riêng tư (public = false): không ai xem được qua link công khai.
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- Tệp được cất theo thư mục mang mã người dùng, vd: <mã người dùng>/images/apple.jpg
-- Quy tắc: mỗi người chỉ làm việc được với thư mục của chính mình.
drop policy if exists "media: xem cua minh" on storage.objects;
create policy "media: xem cua minh" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "media: tai len cua minh" on storage.objects;
create policy "media: tai len cua minh" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "media: sua cua minh" on storage.objects;
create policy "media: sua cua minh" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "media: xoa cua minh" on storage.objects;
create policy "media: xoa cua minh" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- ---------- 3. Kiểm tra ----------
-- Nếu chạy thành công, dòng dưới sẽ hiện kết quả: bang_user_data = 1, kho_media = 1
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'user_data') as bang_user_data,
  (select count(*) from storage.buckets where id = 'media') as kho_media;
