/* =========================================================
   sync.js – đồng bộ dữ liệu học giữa các máy qua Supabase (bước 8b)

   Ý tưởng:
   - Máy là bản chính để học (học được khi không có mạng). Supabase giữ một "bản chung".
   - Mỗi lần đồng bộ: tải bản chung về → GỘP với dữ liệu trên máy → lưu kết quả ở cả hai nơi.
   - Gộp thế nào:
       • thẻ / câu nghe: theo từng mục (id); bản nào sửa sau (trường u lớn hơn) thì giữ
       • mục có dấu "đã xóa" mới hơn lần sửa cuối thì bỏ
       • hai mục khác id nhưng trùng nội dung (vd bộ "Mẫu" tạo riêng trên 2 máy) thì giữ một
       • thống kê: số lượt lấy số lớn hơn (không bao giờ đếm trùng), ngày học thì gộp hết
       • mục tiêu, giọng đọc: lấy bản sửa sau
   - Khi nào đồng bộ: lúc đăng nhập, vài giây sau mỗi thay đổi, khi quay lại tab, khi có mạng lại.

   File này nạp SAU app.js và TRƯỚC account.js. Dùng biến sb, sbUser của account.js
   (chỉ dùng bên trong hàm, lúc đó account.js đã chạy xong).
   Ảnh và âm thanh chưa đồng bộ ở đây (bước 8c).
   ========================================================= */

const SYNC_DELAY_MS = 3000; // chờ 3 giây sau thay đổi cuối rồi mới đồng bộ (gom nhiều thay đổi một lần)

let syncState = 'off';   // 'off' | 'busy' | 'ok' | 'offline' | 'error' | 'waiting'
let syncError = '';      // lỗi gần nhất (hiện trong hộp tài khoản)
let syncTimer = null;
let syncRunning = false;
let syncAgain = false;   // có yêu cầu đồng bộ trong lúc đang đồng bộ -> chạy thêm lần nữa
let firstSyncRemote = null; // dữ liệu tài khoản đang chờ người dùng chọn cách gộp lần đầu


/* ---------- Các hàm gộp (thuần, không đụng tới giao diện) ---------- */

// JSON với khóa xếp theo thứ tự chữ cái, để so sánh hai bản có giống nhau không
// (Supabase lưu jsonb nên thứ tự khóa có thể bị đổi).
function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort()
      .filter(k => value[k] !== undefined)
      .map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

// Gộp hai bảng dấu "đã xóa": giữ thời điểm muộn hơn
function mergeDeleted(a, b) {
  const out = { ...(a || {}) };
  Object.entries(b || {}).forEach(([id, t]) => { out[id] = Math.max(out[id] || 0, t); });
  return out;
}

// Gộp hai danh sách thẻ (hoặc câu nghe).
// keyOf: hàm cho "nội dung" của mục, để phát hiện hai mục khác id nhưng trùng nhau.
// Trả về { list, deleted }.
function mergeLists(listA, listB, delA, delB, keyOf) {
  const del = mergeDeleted(delA, delB);
  const byId = new Map();
  [...(listA || []), ...(listB || [])].forEach(item => {
    if (!item || !item.id) return;
    if ((del[item.id] || 0) >= (item.u || 0)) return; // đã bị xóa sau lần sửa cuối
    const old = byId.get(item.id);
    if (!old || (item.u || 0) > (old.u || 0)) byId.set(item.id, item);
  });

  // Trùng nội dung: giữ mục sửa sau, mục kia ghi dấu đã xóa để máy khác cũng bỏ
  const byKey = new Map();
  const now = Date.now();
  byId.forEach(item => {
    const key = keyOf(item);
    const other = byKey.get(key);
    if (!other) {
      byKey.set(key, item);
      return;
    }
    const keep = (item.u || 0) > (other.u || 0) ? item : other;
    const drop = keep === item ? other : item;
    del[drop.id] = Math.max(del[drop.id] || 0, now, (drop.u || 0) + 1);
    byKey.set(key, keep);
  });

  const kept = new Set(byKey.values());
  return { list: [...byId.values()].filter(x => kept.has(x)), deleted: del };
}

// Gộp thống kê
function mergeStats(a, b) {
  a = a || {};
  b = b || {};
  // Một bên vừa "Đặt lại tiến độ": lấy bên đặt lại sau làm gốc, chỉ thêm những ngày học
  // của bên kia từ ngày đặt lại trở về sau (học trước lúc đặt lại thì bỏ, đúng ý "đặt lại").
  if ((a.resetAt || 0) !== (b.resetAt || 0)) {
    const base = (a.resetAt || 0) > (b.resetAt || 0) ? a : b;
    const other = base === a ? b : a;
    const fromDay = dateKey(new Date(base.resetAt));
    const keepLog = {};
    Object.entries(other.log || {}).forEach(([day, v]) => { if (day >= fromDay) keepLog[day] = v; });
    const trimmed = {
      days: (other.days || []).filter(day => day >= fromDay),
      log: keepLog,
      resetAt: base.resetAt,
    };
    return mergeStats(base, trimmed); // hai bên giờ cùng resetAt -> gộp bình thường
  }

  const log = {};
  [a.log || {}, b.log || {}].forEach(src => {
    Object.entries(src).forEach(([day, v]) => {
      const cur = log[day] || { cards: 0, listen: 0 };
      log[day] = { cards: Math.max(cur.cards, v.cards || 0), listen: Math.max(cur.listen, v.listen || 0) };
    });
  });
  const out = {
    reviews: Math.max(a.reviews || 0, b.reviews || 0),
    listen: Math.max(a.listen || 0, b.listen || 0),
    listenOk: Math.max(a.listenOk || 0, b.listenOk || 0),
    speak: Math.max(a.speak || 0, b.speak || 0),
    days: [...new Set([...(a.days || []), ...(b.days || [])])].sort(),
    log,
  };
  if (a.resetAt) out.resetAt = a.resetAt;
  return out;
}

// Lấy bản có thời điểm sửa (u) muộn hơn
function newer(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (b.u || 0) > (a.u || 0) ? b : a;
}

// Gộp hai "gói dữ liệu" (của máy và của tài khoản)
function mergePayload(a, b) {
  a = a || {};
  b = b || {};
  const delA = a.deleted || {};
  const delB = b.deleted || {};
  const cardsM = mergeLists(a.cards, b.cards, delA.cards, delB.cards,
    c => (c.t + '|' + c.p).toLowerCase());
  const listenM = mergeLists(a.listen, b.listen, delA.listen, delB.listen,
    x => (x.t + '|' + x.text + '|' + x.audio + '|' + x.s).toLowerCase());
  return {
    v: 2,
    cards: cardsM.list,
    listen: listenM.list,
    deleted: { cards: cardsM.deleted, listen: listenM.deleted },
    stats: mergeStats(a.stats, b.stats),
    goals: newer(a.goals, b.goals),
    celebrated: [...new Set([...(a.celebrated || []), ...(b.celebrated || [])])],
  };
}


/* ---------- Đọc / ghi dữ liệu trên máy ---------- */

// Gói toàn bộ dữ liệu học trên máy
function localPayload() {
  stampChanges(); // chắc chắn mọi thay đổi đều đã có dấu thời gian
  return {
    v: 2,
    cards,
    listen,
    deleted,
    stats,
    goals: { cards: goals.cards, listen: goals.listen, u: store.get('goals_u', 0) },
    celebrated: store.get('celebrated', []),
  };
}

// Dữ liệu trên máy có gì "của riêng" không (khác bộ Mẫu chưa học)?
function localHasOwnData() {
  return stats.days.length > 0 ||
    cards.some(c => c.t !== 'Mẫu') ||
    listen.some(x => x.t !== 'Mẫu');
}

// Ghi một gói dữ liệu vào máy (thay cho dữ liệu hiện có) rồi vẽ lại giao diện
function applyPayload(p) {
  cards = p.cards || [];
  listen = p.listen || [];
  deleted = { cards: {}, listen: {}, ...(p.deleted || {}) };
  stats = p.stats || emptyStats();
  if (!stats.log) stats.log = {};
  if (!stats.days) stats.days = [];
  if (p.goals) {
    goals = { cards: p.goals.cards, listen: p.goals.listen };
    store.set('goals', goals);
    store.set('goals_u', p.goals.u || 0);
  }
  store.set('celebrated', p.celebrated || []);
  store.set('cards', cards);
  store.set('listen', listen);
  store.set('stats', stats);
  store.set('deleted', deleted);
  rememberSaved(); // dữ liệu vừa nhận không tính là "vừa sửa"
  refreshAll();
  showStreak();
}


/* ---------- Nói chuyện với Supabase ---------- */

async function fetchRemote() {
  const { data, error } = await sb.from('user_data')
    .select('data, updated_at')
    .eq('user_id', sbUser.id)
    .maybeSingle();
  if (error) throw error;
  return data; // null nếu tài khoản chưa có dữ liệu
}

// Ghi gói dữ liệu lên tài khoản. Chỉ ghi đè nếu bản trên tài khoản vẫn là bản mình vừa đọc
// (oldStamp); nếu máy khác vừa ghi chen vào thì trả về false để đồng bộ lại.
async function pushRemote(payload, oldStamp) {
  const stamp = new Date().toISOString();
  if (oldStamp == null) {
    const { error } = await sb.from('user_data')
      .insert({ user_id: sbUser.id, data: payload, updated_at: stamp });
    if (error && error.code === '23505') return false; // dòng vừa được máy khác tạo
    if (error) throw error;
    return true;
  }
  const { data, error } = await sb.from('user_data')
    .update({ data: payload, updated_at: stamp })
    .eq('user_id', sbUser.id)
    .eq('updated_at', oldStamp)
    .select('updated_at');
  if (error) throw error;
  return data.length > 0;
}


/* ---------- Đồng bộ ---------- */

// Gọi từ app.js mỗi khi dữ liệu thay đổi
function onDataSaved() {
  if (!sb || !sbUser) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, SYNC_DELAY_MS);
}

// Đồng bộ ngay. mode: 'merge' (bình thường), 'remote' (lấy bản tài khoản), 'local' (lấy bản máy này)
async function syncNow(mode = 'merge') {
  if (!sb || !sbUser) return false;
  if (syncRunning) {
    syncAgain = true;
    return false;
  }
  if (!navigator.onLine) {
    setSyncState('offline');
    return false;
  }
  clearTimeout(syncTimer);
  syncRunning = true;
  setSyncState('busy');
  let ok = false;
  try {
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      const remote = await fetchRemote();
      const remoteData = remote ? remote.data : null;
      const remoteHasData = remoteData && Array.isArray(remoteData.cards);

      // Lần đầu máy này đồng bộ với tài khoản này: nếu cả hai bên đều có dữ liệu thì hỏi
      const firstTime = store.get('sync_user', null) !== sbUser.id;
      if (firstTime && mode === 'merge' && remoteHasData && localHasOwnData()) {
        firstSyncRemote = remote;
        setSyncState('waiting');
        openAccount('firstsync');
        return false;
      }

      let result;
      if (mode === 'local' || !remoteHasData) {
        result = localPayload();
        // "Dùng dữ liệu máy này": mục chỉ có trên tài khoản thì ghi dấu đã xóa để máy khác bỏ theo
        if (mode === 'local' && remoteHasData) {
          const now = Date.now();
          const mine = new Set([...cards, ...listen].map(x => x.id));
          (remoteData.cards || []).forEach(c => { if (!mine.has(c.id)) deleted.cards[c.id] = now; });
          (remoteData.listen || []).forEach(x => { if (!mine.has(x.id)) deleted.listen[x.id] = now; });
          store.set('deleted', deleted);
          result = localPayload();
        }
      } else if (mode === 'remote' || (firstTime && !localHasOwnData())) {
        // Máy chỉ có bộ Mẫu chưa học: lấy luôn dữ liệu tài khoản, khỏi gộp
        result = remoteData;
      } else {
        result = mergePayload(localPayload(), remoteData);
      }

      // Cập nhật máy nếu khác
      if (stableStringify(result) !== stableStringify(localPayload())) applyPayload(result);
      // Cập nhật tài khoản nếu khác
      if (!remoteHasData || stableStringify(result) !== stableStringify(remoteData)) {
        ok = await pushRemote(result, remote ? remote.updated_at : null);
      } else {
        ok = true;
      }
      mode = 'merge'; // nếu phải thử lại thì gộp bình thường
    }
    if (!ok) throw new Error('Máy khác đang ghi cùng lúc, sẽ thử lại sau.');
    store.set('sync_user', sbUser.id);
    store.set('sync_at', Date.now());
    syncError = '';
    setSyncState('ok');
  } catch (err) {
    syncError = syncErrorText(err);
    setSyncState(navigator.onLine ? 'error' : 'offline');
  } finally {
    syncRunning = false;
  }
  if (syncAgain) {
    syncAgain = false;
    onDataSaved();
  }
  return ok;
}

// Người dùng chọn cách gộp lần đầu
function resolveFirstSync(mode) {
  firstSyncRemote = null;
  closeAccount();
  syncNow(mode);
}

function syncErrorText(err) {
  const msg = String((err && err.message) || err).toLowerCase();
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Không kết nối được tới Supabase (mất mạng, hoặc dự án đang tạm dừng).';
  }
  if (msg.includes('user_data') && (msg.includes('does not exist') || msg.includes('schema cache'))) {
    return 'Chưa có bảng user_data. Hãy chạy file supabase/setup.sql trong SQL Editor.';
  }
  if (msg.includes('row-level security') || msg.includes('permission denied')) {
    return 'Supabase từ chối quyền ghi. Hãy chạy lại file supabase/setup.sql.';
  }
  return (err && err.message) || String(err);
}


/* ---------- Trạng thái đồng bộ (hiện trên nút tài khoản) ---------- */

const SYNC_ICONS = { off: '', busy: '🔄', ok: '☁️', offline: '📴', error: '⚠️', waiting: '❔' };
const SYNC_TEXT = {
  off: '',
  busy: 'Đang đồng bộ…',
  ok: 'Đã đồng bộ',
  offline: 'Ngoại tuyến – sẽ đồng bộ khi có mạng',
  error: 'Đồng bộ bị lỗi',
  waiting: 'Đang chờ bạn chọn cách gộp dữ liệu',
};

function setSyncState(state) {
  syncState = state;
  const badge = $('syncbadge');
  badge.textContent = SYNC_ICONS[state];
  badge.title = SYNC_TEXT[state];
  badge.hidden = state === 'off';
  badge.classList.toggle('spin', state === 'busy');
  // Hộp tài khoản đang mở ở màn hình "Tài khoản" thì cập nhật dòng trạng thái
  const line = document.getElementById('accSync');
  if (line) line.innerHTML = syncStatusHtml();
}

// Dòng trạng thái trong hộp tài khoản
function syncStatusHtml() {
  const at = store.get('sync_at', 0);
  const when = at ? new Date(at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'chưa';
  let html = `${SYNC_ICONS[syncState] || ''} <b>${SYNC_TEXT[syncState] || ''}</b> · Lần cuối: ${when}`;
  if (syncState === 'error' && syncError) html += `<br><span class="warn danger">${esc(syncError)}</span>`;
  return html;
}

// Quay lại tab, hoặc có mạng lại -> đồng bộ
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') syncNow();
});
addEventListener('online', () => syncNow());
addEventListener('offline', () => { if (sbUser) setSyncState('offline'); });
