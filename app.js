/* =========================================================
   app.js – toàn bộ logic của website học tiếng Anh

   Các phần trong file (tìm theo tiêu đề "=== n."):
    1. Đọc file nhập (PARSER) – hàm thuần, test được bằng Node
    2. Tiện ích chung: lưu trữ, chuỗi ngày học, sao chép
    3. Dữ liệu: cụm từ, bài nghe, thống kê
    4. Giọng đọc (Web Speech API)
    5. Tệp âm thanh (IndexedDB "eng_audio")
    6. Cụm từ – flashcard hộp Leitner
    7. Luyện nghe – chép chính tả
    8. Nhập dữ liệu
    9. Quản lý bộ dữ liệu, sao lưu
   10. IELTS Speaking và Writing
   11. Tiến độ
   12. Giao diện Sáng / Tối
   13. Chuyển tab và khởi động

   Dữ liệu mẫu nằm ở thư mục data/ (được nạp trước file này):
   SAMPLE_PHRASES, SAMPLE_LISTENING, IELTS_DATA
   ========================================================= */


/* === 1. ĐỌC FILE NHẬP ===================================== */
/*PARSER-START*/

// Chuẩn hóa tên cột: bỏ dấu tiếng Việt, chữ thường, khoảng trắng / gạch ngang thành "_"
// vd: "Cụm từ" -> "cum_tu", "Chủ đề" -> "chu_de"
function strip(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // bỏ dấu
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

// Các tên cột được chấp nhận cho từng trường (đã chuẩn hóa bằng strip).
// Bên trong app dùng tên trường viết tắt:
//   cụm từ:   p = phrase, m = meaning, c = context (dùng khi nào), e = example, t = topic, src = source,
//             img = image (tên ảnh đã tải lên hoặc link)
//   bài nghe: text, tr = translation, audio, s = start, e = end, t = topic, src = source
const ALIAS = {
  phrase: {
    p:   ['p', 'phrase', 'cum_tu', 'english', 'en', 'eng', 'term', 'word', 'front', 'collocation', 'idiom'],
    m:   ['m', 'meaning', 'nghia', 'vietnamese', 'vi', 'vie', 'definition', 'back', 'translation', 'dich'],
    c:   ['c', 'context', 'ngu_canh', 'tinh_huong', 'usage', 'cach_dung', 'dung_khi', 'when'],
    e:   ['e', 'example', 'vi_du', 'sentence', 'cau_vi_du'],
    t:   ['t', 'topic', 'chu_de', 'set', 'deck', 'bo', 'tag', 'tags', 'category'],
    src: ['source', 'nguon', 'attribution', 'credit'],
    img: ['img', 'image', 'hinh', 'hinh_anh', 'anh', 'anh_minh_hoa', 'minh_hoa', 'picture', 'photo'],
  },
  listen: {
    text:  ['text', 'transcript', 'sentence', 'cau', 'english', 'en', 'eng', 'phrase'],
    tr:    ['tr', 'translation', 'dich', 'nghia', 'vietnamese', 'vi', 'vie', 'meaning'],
    audio: ['audio', 'file', 'url', 'audio_url', 'tep', 'mp3'],
    s:     ['s', 'start', 'bat_dau', 'from', 'tu'],
    e:     ['e', 'end', 'ket_thuc', 'to', 'den'],
    t:     ['t', 'topic', 'chu_de', 'set', 'deck', 'bo', 'tag', 'category'],
    src:   ['source', 'nguon', 'attribution', 'credit'],
  },
};

// Thứ tự cột khi dữ liệu không có dòng tên cột.
// Cột mới (c, img) đặt ở cuối để file cũ 5 cột vẫn đọc đúng như trước.
const ORDER = {
  phrase: ['p', 'm', 'e', 't', 'src', 'c', 'img'],
  listen: ['text', 'tr', 'audio', 's', 'e', 't', 'src'],
};

// Tách văn bản dạng bảng (TSV / CSV) thành mảng dòng, mỗi dòng là mảng ô.
// Tự chọn dấu phân cách: Tab nếu dòng đầu có Tab, nếu không thì ";" hoặc ","
// (dấu nào xuất hiện nhiều hơn ở dòng đầu).
// Hỗ trợ ô trong ngoặc kép, vd: "Hello, world" hoặc "He said ""hi""".
function parseDelimited(text) {
  text = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

  const firstLine = text.split('\n').find(line => line.trim()) || '';
  const count = ch => firstLine.split(ch).length - 1;
  let sep = ',';
  if (count('\t') > 0) sep = '\t';
  else if (count(';') > count(',')) sep = ';';

  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } // "" trong ngoặc = một dấu "
        else inQuotes = false;                          // đóng ngoặc
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === '') {
      inQuotes = true;                                  // mở ngoặc ở đầu ô
    } else if (ch === sep) {
      row.push(cell);                                   // hết một ô
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);                                   // hết một dòng
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);

  // Cắt khoảng trắng thừa ở mỗi ô, bỏ dòng trống
  return rows
    .map(r => r.map(c => c.trim()))
    .filter(r => r.some(c => c));
}

// Đổi thời điểm sang số giây.
// "75" -> 75 · "1:15" -> 75 · "1:02:03.5" -> 3723.5 · "" -> null · sai định dạng -> NaN
function toSec(value) {
  const v = String(value == null ? '' : value).trim();
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v);

  const m = v.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:[.,]\d+)?)$/);
  if (!m) return NaN;
  const hours = Number(m[1] || 0);
  const minutes = Number(m[2]);
  const seconds = parseFloat(m[3].replace(',', '.'));
  return hours * 3600 + minutes * 60 + seconds;
}

// Khóa để phát hiện câu nghe bị trùng: cùng câu + cùng file + cùng điểm bắt đầu
function listenKey(text, audio, start) {
  return (text + '|' + audio + '|' + start).toLowerCase();
}

// Đổi một object JSON (tên cột tùy ý) thành object có tên trường chuẩn của app
function mapObj(obj, kind) {
  const aliases = ALIAS[kind];
  const result = {};
  for (const col in obj) {
    const name = strip(col);
    for (const field in aliases) {
      if (result[field] == null && aliases[field].includes(name)) {
        result[field] = obj[col] == null ? '' : String(obj[col]).trim();
      }
    }
  }
  return result;
}

// Đọc văn bản người dùng dán vào (hoặc nội dung file). kind: 'phrase' hoặc 'listen'.
// Trả về object:
//   recs  – mảng bản ghi thô (chưa kiểm tra)
//   how   – cách đã nhận dạng (hiện cho người dùng xem)
//   base  – số thứ tự của bản ghi đầu tiên (để báo lỗi đúng số dòng)
//   unit  – chữ đứng trước số thứ tự: "Dòng" hoặc "Mục" (JSON)
//   fatal – thông báo lỗi nếu không đọc được
function toRecords(text, kind) {
  const t = String(text).trim();
  if (!t) return { recs: [], how: 'empty' };

  // 1) JSON: mảng object, hoặc bản sao lưu {v, phrases, listening}
  if (t[0] === '[' || t[0] === '{') {
    let data;
    try {
      data = JSON.parse(t);
    } catch (err) {
      return { recs: [], how: 'json', fatal: 'JSON không hợp lệ: ' + err.message };
    }
    if (!Array.isArray(data)) {
      data = data[kind === 'phrase' ? 'phrases' : 'listening'] || data.items || [];
    }
    const recs = data.map(o => (typeof o === 'object' && o) ? mapObj(o, kind) : {});
    return { recs, how: 'JSON', base: 1, unit: 'Mục' };
  }

  // 2) Bảng TSV / CSV
  const rows = parseDelimited(t);
  if (!rows.length) return { recs: [], how: 'empty' };

  // Tìm xem dòng đầu có phải là dòng tên cột không
  const aliases = ALIAS[kind];
  const header = rows[0].map(strip);
  const colIndex = {}; // tên trường -> vị trí cột
  header.forEach((name, i) => {
    for (const field in aliases) {
      if (colIndex[field] == null && aliases[field].includes(name)) colIndex[field] = i;
    }
  });

  const mainField = ORDER[kind][0];   // 'p' (cụm từ) hoặc 'text' (bài nghe)
  const secondField = ORDER[kind][1]; // 'm' (nghĩa) hoặc 'tr' (bản dịch)

  // 2a) Có dòng tên cột
  if (colIndex[mainField] != null) {
    const recs = rows.slice(1).map(r => {
      const rec = {};
      for (const field in colIndex) rec[field] = r[colIndex[field]] || '';
      return rec;
    });
    return { recs, how: 'theo tên cột', base: 2 };
  }

  const first = rows[0];

  // 2b) File cặp câu Tatoeba: id ⇥ câu Anh ⇥ id ⇥ câu Việt
  if (first.length >= 4 && /^\d+$/.test(first[0]) && /^\d+$/.test(first[2])) {
    const recs = rows.map(r => ({
      [mainField]: r[1] || '',
      [secondField]: r[3] || '',
      src: 'Tatoeba #' + r[0] + ' (CC BY 2.0 FR)',
    }));
    return { recs, how: 'cặp câu Tatoeba', base: 1 };
  }

  // 2c) File Anki của ManyThings: câu Anh ⇥ câu Việt ⇥ CC-BY…
  if (first.length >= 3 && /^CC-BY/i.test(first[2])) {
    const recs = rows.map(r => ({
      [mainField]: r[0] || '',
      [secondField]: r[1] || '',
      src: r[2] || '',
    }));
    return { recs, how: 'file Anki (ManyThings)', base: 1 };
  }

  // 2d) Không có tên cột: hiểu theo thứ tự cột mặc định (ORDER)
  const recs = rows.map(r => {
    const rec = {};
    ORDER[kind].forEach((field, i) => { rec[field] = r[i] || ''; });
    return rec;
  });
  return { recs, how: 'theo thứ tự cột', base: 1 };
}

// Kiểm tra từng bản ghi. Trả về:
//   ok   – các bản ghi hợp lệ (đã chuẩn hóa)
//   errs – danh sách lỗi kèm số dòng
//   dups – số bản ghi bị trùng (bỏ qua)
// existing: khóa của dữ liệu đã có, để phát hiện trùng
// setName: tên bộ dùng khi bản ghi không có cột topic
function validate(recs, kind, existing, setName, base = 2, unit = 'Dòng') {
  const ok = [];
  const errs = [];
  const seen = new Set(existing);
  let dups = 0;

  recs.forEach((r, i) => {
    const line = unit + ' ' + (i + base);
    const topic = (r.t || '').trim() || setName;
    const source = (r.src || '').trim();

    if (kind === 'phrase') {
      const phrase = (r.p || '').trim();
      const meaning = (r.m || '').trim();
      if (!phrase || !meaning) {
        errs.push(`${line}: thiếu ${!phrase ? 'phrase' : 'meaning'}`);
        return;
      }
      const key = phrase.toLowerCase();
      if (seen.has(key)) { dups++; return; }
      seen.add(key);
      ok.push({
        p: phrase, m: meaning, c: (r.c || '').trim(), e: (r.e || '').trim(), t: topic, src: source,
        img: (r.img || '').trim(),
      });
      return;
    }

    // Bài nghe
    const text = (r.text || '').trim();
    if (!text) {
      errs.push(`${line}: thiếu text`);
      return;
    }
    const start = toSec(r.s);
    const end = toSec(r.e);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      errs.push(`${line}: start/end sai định dạng (dùng 75 hoặc 1:15)`);
      return;
    }
    if (start != null && end != null && end <= start) {
      errs.push(`${line}: end phải lớn hơn start`);
      return;
    }
    const audio = (r.audio || '').trim();
    const key = listenKey(text, audio, start);
    if (seen.has(key)) { dups++; return; }
    seen.add(key);
    ok.push({ text, tr: (r.tr || '').trim(), audio, s: start, e: end, t: topic, src: source });
  });

  return { ok, errs, dups };
}
/*PARSER-END*/


/* === 2. TIỆN ÍCH CHUNG ===================================== */

// Lấy phần tử theo id
const $ = id => document.getElementById(id);

// Đọc / ghi localStorage. Mọi khóa đều có tiền tố "eng_", vd store.get('cards') đọc "eng_cards".
const store = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem('eng_' + key);
      return value ? JSON.parse(value) : fallback;
    } catch (err) {
      return fallback;
    }
  },
  // Trả về false nếu không lưu được (vd bộ nhớ trình duyệt đã đầy)
  set(key, value) {
    try {
      localStorage.setItem('eng_' + key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  },
};

// Đổi ký tự đặc biệt để chèn chữ vào HTML an toàn
function esc(s) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => map[c]);
}

// Tạo mã id ngẫu nhiên cho mỗi thẻ / câu
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Chọn ngẫu nhiên một phần tử trong mảng
function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Đổi một ngày thành chuỗi "2026-11-23", tính theo giờ trên máy
// (không dùng toISOString vì nó tính theo giờ UTC: ở Việt Nam ngày mới sẽ bắt đầu lúc 7 giờ sáng)
function dateKey(d) {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

// Ngày hôm nay dạng "2026-11-23"
function today() {
  return dateKey(new Date());
}

// Ngày cách hôm nay n ngày (n âm = quá khứ)
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Sao chép chữ vào bộ nhớ tạm. Nếu trình duyệt chặn thì hiện chữ trong ô để tự Ctrl+C.
async function copyText(text, msgEl, box) {
  try {
    await navigator.clipboard.writeText(text);
    msgEl.textContent = 'Đã sao chép.';
  } catch (err) {
    if (box) {
      box.hidden = false;
      box.value = text;
      box.select();
    }
    msgEl.textContent = 'Không sao chép tự động được. Hãy chọn nội dung trong ô rồi nhấn Ctrl+C.';
  }
}

// Bấm hai lần mới làm (dùng cho nút Xóa). Lần đầu đổi nút thành đỏ, trả về false.
function confirmTwice(button, askText) {
  if (button.dataset.armed === '1') return true;
  button.dataset.armed = '1';
  button.textContent = askText;
  button.classList.add('red');
  return false;
}


/* === 3. DỮ LIỆU ============================================ */

const DAY = 24 * 60 * 60 * 1000; // số mili-giây trong một ngày
const ALL = '__all__';           // giá trị "Tất cả" trong ô chọn bộ

// Mẫu để bấm "Sao chép mẫu" / "Dán mẫu vào ô" ở mục Nhập dữ liệu (cách nhau bằng Tab)
const P_TEMPLATE =
  'phrase\tmeaning\tcontext\texample\ttopic\tsource\n' +
  'make a decision\tđưa ra quyết định\tKhi phải chọn giữa nhiều phương án, nhất là việc quan trọng\tIt took me a week to make a decision.\tCông việc\tTự soạn\n' +
  'pay attention to\tchú ý đến\tKhi nhắc ai đó tập trung lắng nghe hoặc quan sát\tPlease pay attention to the instructions.\tHọc tập\tTự soạn\n';
const L_TEMPLATE =
  'text\ttranslation\taudio\tstart\tend\ttopic\tsource\n' +
  'I usually walk to work.\tTôi thường đi bộ đi làm.\t\t\t\tHằng ngày\tTự soạn\n' +
  'Welcome to the program.\tChào mừng đến với chương trình.\tbai1.mp3\t0:05\t0:09\tPodcast\tVOA Learning English\n';

// Cụm từ: { id, t: bộ, p: cụm từ, m: nghĩa, c: dùng khi nào, e: ví dụ, src: nguồn,
//           img: ảnh minh họa (tên ảnh trong kho eng_images hoặc link), box: mức nhớ 1–5, due: lúc cần ôn }
let cards = store.get('cards', null);
if (!cards) {
  cards = SAMPLE_PHRASES.map(x => ({
    id: uid(), t: 'Mẫu', p: x.phrase, m: x.meaning, c: x.context || '', e: x.example || '',
    src: '', box: 1, due: 0,
  }));
} else {
  // Thẻ "Mẫu" tạo từ trước khi có cột context: bổ sung context từ data/phrases.js.
  // Chỉ thêm vào chỗ còn trống, không sửa gì khác.
  cards.forEach(card => {
    if (card.t !== 'Mẫu' || card.c) return;
    const sample = SAMPLE_PHRASES.find(x => x.phrase === card.p);
    if (sample && sample.context) card.c = sample.context;
  });
}

// Bài nghe: { id, text, tr: bản dịch, audio: tên file/link, s: giây bắt đầu, e: giây kết thúc, t: bộ, src }
let listen = store.get('listen', null);
if (!listen) {
  listen = SAMPLE_LISTENING.map(x => ({
    id: uid(), text: x.text, tr: '', audio: '', s: null, e: null, t: 'Mẫu', src: '',
  }));
}

// Thống kê:
//   reviews / listen / listenOk / speak – tổng số lượt ôn thẻ, chép chính tả, đúng 100%, luyện nói
//   days – các ngày có học, vd ["2026-11-22", "2026-11-23"]
//   log  – số lượt mỗi ngày, vd { "2026-11-23": { cards: 12, listen: 5 } } (bắt đầu ghi từ Bước 7)
function emptyStats() {
  return { reviews: 0, listen: 0, listenOk: 0, speak: 0, days: [], log: {} };
}
let stats = store.get('stats', emptyStats());
if (!stats.log) stats.log = {}; // dữ liệu cũ chưa có log
// (stats.resetAt = lúc bấm "Đặt lại tiến độ" gần nhất, để máy khác cũng đặt lại theo)

// Cộng một lượt học hôm nay. kind: 'cards' (ôn thẻ) hoặc 'listen' (chép chính tả)
function logToday(kind) {
  const d = today();
  if (!stats.log[d]) stats.log[d] = { cards: 0, listen: 0 };
  stats.log[d][kind]++;
}

// Mục tiêu mỗi ngày, lưu ở khóa eng_goals
let goals = store.get('goals', { cards: 20, listen: 10 });

// Lưu cả ba khóa. Trả về false nếu cụm từ hoặc bài nghe không lưu được.
function save() {
  stampChanges();
  const okCards = store.set('cards', cards);
  const okListen = store.set('listen', listen);
  store.set('stats', stats);
  // Báo cho sync.js biết dữ liệu vừa đổi (nếu đang đăng nhập thì vài giây sau sẽ đồng bộ)
  if (typeof onDataSaved === 'function') onDataSaved();
  return okCards && okListen;
}

// --- Ghi dấu thay đổi (để đồng bộ giữa các máy, xem sync.js) ---
// Mỗi thẻ / câu nghe có trường u = thời điểm sửa gần nhất (mili-giây).
// Mục bị xóa được ghi vào eng_deleted = { cards: { id: lúc xóa }, listen: {...} }
// để máy khác biết mà xóa theo.
let deleted = store.get('deleted', { cards: {}, listen: {} });

// Nội dung từng mục ở lần lưu trước (không tính u), để biết mục nào vừa bị sửa
let savedShape = { cards: new Map(), listen: new Map() };

function shapeOf(item) {
  const { u, ...rest } = item; // bỏ trường u ra khi so sánh
  return JSON.stringify(rest);
}

// Ghi nhớ trạng thái hiện tại là "đã lưu" (gọi khi mở trang và sau khi nhận dữ liệu đồng bộ)
function rememberSaved() {
  savedShape = {
    cards: new Map(cards.map(c => [c.id, shapeOf(c)])),
    listen: new Map(listen.map(x => [x.id, shapeOf(x)])),
  };
}
rememberSaved(); // lúc mở trang: dữ liệu vừa đọc từ máy coi như "đã lưu"

// So với lần lưu trước: mục nào khác thì ghi u = bây giờ, mục nào biến mất thì ghi dấu đã xóa
function stampChanges() {
  const now = Date.now();
  let removed = false;
  [['cards', cards], ['listen', listen]].forEach(([kind, list]) => {
    const before = savedShape[kind];
    const after = new Map();
    list.forEach(item => {
      const shape = shapeOf(item);
      if (before.get(item.id) !== shape) item.u = now;
      after.set(item.id, shape);
    });
    before.forEach((shape, id) => {
      if (!after.has(id)) {
        deleted[kind][id] = now;
        removed = true;
      }
    });
    savedShape[kind] = after;
  });
  if (removed) store.set('deleted', deleted);
}

// Ghi nhận hôm nay có học. Nếu đây là ngày đầu tiên của hôm nay và chuỗi vừa chạm mốc thì chúc mừng.
function markDay() {
  const d = today();
  if (!stats.days.includes(d)) {
    stats.days.push(d);
    save();
    celebrateStreak();
  }
  showStreak();
}

// Chuỗi hiện tại: số ngày học liên tiếp tính đến hôm nay
// (hoặc đến hôm qua nếu hôm nay chưa học – chuỗi vẫn còn, chỉ chưa được nối thêm)
function currentStreak() {
  const days = new Set(stats.days);
  let d = new Date();
  if (!days.has(today())) d = addDays(d, -1);
  let n = 0;
  while (days.has(dateKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// Kỷ lục: chuỗi dài nhất từ trước tới nay
function bestStreak() {
  const sorted = [...new Set(stats.days)].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  sorted.forEach(key => {
    const isNext = prev && dateKey(addDays(new Date(prev + 'T12:00'), 1)) === key;
    run = isNext ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  });
  return best;
}

function studiedToday() {
  return stats.days.includes(today());
}

// Huy hiệu 🔥 ở đầu trang. Hôm nay chưa học thì nhạt màu và nhắc giữ chuỗi.
function showStreak() {
  const n = currentStreak();
  const el = $('streak');
  el.textContent = `🔥 ${n} ngày`;
  el.classList.toggle('cold', !studiedToday());
  el.title = studiedToday()
    ? `Bạn đã học ${n} ngày liên tiếp`
    : (n ? `Hôm nay chưa học – học ngay để giữ chuỗi ${n} ngày!` : 'Học hôm nay để bắt đầu chuỗi ngày');
}

// Mốc chuỗi ngày được chúc mừng
const STREAK_MILESTONES = [3, 7, 30, 100];

// Hiện lời chúc khi chuỗi vừa chạm mốc. Mỗi mốc chỉ chúc một lần cho mỗi chuỗi
// (khóa eng_celebrated lưu "mốc@ngày bắt đầu chuỗi").
function celebrateStreak() {
  const n = currentStreak();
  if (!STREAK_MILESTONES.includes(n)) return;
  const startKey = dateKey(addDays(new Date(), -(n - 1)));
  const key = n + '@' + startKey;
  const done = store.get('celebrated', []);
  if (done.includes(key)) return;
  done.push(key);
  store.set('celebrated', done);

  const words = {
    3: 'Khởi đầu tuyệt vời! Thói quen đang hình thành.',
    7: 'Trọn một tuần không nghỉ. Bạn thật bền bỉ!',
    30: 'Một tháng kiên trì – tiếng Anh đang thành thói quen của bạn.',
    100: '100 ngày! Đây là thành tích rất đáng tự hào.',
  };
  showToast(`🎉 Chuỗi ${n} ngày!`, words[n]);
}

// Thông báo nổi ở cuối màn hình, tự ẩn sau 7 giây
let toastTimer = null;
function showToast(title, text) {
  const el = $('toast');
  el.innerHTML = `<b>${esc(title)}</b><span>${esc(text)}</span>` +
                 '<button type="button" aria-label="Đóng">×</button>';
  el.hidden = false;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
  el.querySelector('button').onclick = () => { el.hidden = true; };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 7000);
}

// Đếm số mục trong từng bộ: trả về [[tên bộ, số lượng], ...]
function setsOf(list) {
  const counts = new Map();
  list.forEach(x => counts.set(x.t, (counts.get(x.t) || 0) + 1));
  return [...counts];
}

// Đổ danh sách bộ vào ô chọn, giữ lựa chọn cũ nếu còn
function fillSelect(select, list) {
  const old = select.value;
  select.innerHTML =
    `<option value="${ALL}">Tất cả (${list.length})</option>` +
    setsOf(list).map(([name, n]) => `<option value="${esc(name)}">${esc(name)} (${n})</option>`).join('');
  if ([...select.options].some(o => o.value === old)) select.value = old;
}


/* === 4. GIỌNG ĐỌC ========================================== */

// Web tự chọn giọng tiếng Anh tốt nhất mà máy có (không cho chọn Anh-Anh / Anh-Mỹ nữa,
// vì nhiều máy chỉ cài sẵn một giọng).
let voice = null;          // giọng sẽ dùng để đọc
let voicesLoaded = false;  // danh sách giọng của máy đã nạp xong chưa

// Thứ tự ưu tiên: giọng tiếng Anh "Natural"/"Online"/"Google" (nghe tự nhiên hơn)
// → giọng en-GB → giọng en-US → giọng tiếng Anh bất kỳ.
function pickVoice() {
  try {
    const voices = speechSynthesis.getVoices();
    voicesLoaded = voices.length > 0;
    const english = voices.filter(v => /^en/i.test(v.lang));
    // Một số máy ghi "en_GB" thay vì "en-GB"
    const isLang = (v, code) => v.lang.replace('_', '-').toLowerCase() === code;
    voice = english.find(v => /natural|online|google/i.test(v.name)) ||
            english.find(v => isLang(v, 'en-gb')) ||
            english.find(v => isLang(v, 'en-us')) ||
            english[0] || null;
  } catch (err) { /* trình duyệt không hỗ trợ */ }
  showVoiceNote();
}
try {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice; // danh sách giọng có thể nạp chậm
} catch (err) { /* bỏ qua */ }

// Ghi thông báo về giọng đọc vào mọi ô có class "speech-msg"
function setSpeechMsg(text) {
  document.querySelectorAll('.speech-msg').forEach(el => { el.textContent = text; });
}

// Chỉ báo khi máy không có giọng tiếng Anh nào (chỉ báo khi danh sách giọng đã nạp xong)
function showVoiceNote() {
  if (voicesLoaded && !voice) {
    setSpeechMsg('Máy này chưa có giọng đọc tiếng Anh. Bạn có thể cài thêm trong phần ' +
                 'cài đặt ngôn ngữ của máy (Windows: Cài đặt → Thời gian và ngôn ngữ → Giọng nói).');
  } else {
    setSpeechMsg('');
  }
}

// Xóa lựa chọn giọng cũ (bản trước có nút Anh-Anh / Anh-Mỹ) cho gọn
try {
  localStorage.removeItem('eng_accent');
  localStorage.removeItem('eng_accent_u');
} catch (err) { /* bỏ qua */ }

// Đọc một câu. rate: tốc độ (1 = bình thường, 0.65 = chậm).
// el (không bắt buộc): phần tử được gắn class "speaking" trong lúc máy đang đọc,
// để CSS làm nó nhấp nháy.
function say(text, rate = 1, el = null) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice ? voice.lang : 'en-GB';
    if (voice) u.voice = voice;
    u.rate = rate;
    if (el) {
      u.onstart = () => el.classList.add('speaking');
      u.onend = () => el.classList.remove('speaking');
      u.onerror = () => el.classList.remove('speaking');
    }
    speechSynthesis.speak(u);
    showVoiceNote();
  } catch (err) {
    setSpeechMsg('Trình duyệt này chưa hỗ trợ giọng đọc tự động. Hãy thử Chrome hoặc Edge.');
  }
}


/* === 5. TỆP ÂM THANH VÀ ẢNH (IndexedDB) ===================== */
// Tệp lớn nên không để trong localStorage mà lưu trong IndexedDB:
//   "eng_audio"  – tệp âm thanh cho bài nghe (vd "bai1.mp3")
//   "eng_images" – ảnh minh họa cho thẻ cụm từ (vd "apple.jpg")
// Mỗi database có một kho "files", khóa là tên file.

// Tạo bộ hàm đọc / ghi cho một database
function fileStore(dbName) {
  let dbPromise = null;
  const urlCache = {}; // tên file -> đường dẫn tạm để phát / hiển thị

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        try {
          const req = indexedDB.open(dbName, 1);
          req.onupgradeneeded = () => req.result.createObjectStore('files');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        } catch (err) {
          reject(err);
        }
      });
    }
    return dbPromise;
  }

  // Chạy một thao tác trên kho "files". mode: 'readonly' hoặc 'readwrite'
  async function run(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', mode);
      const request = action(tx.objectStore('files'));
      tx.oncomplete = () => resolve(request && request.result);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Bỏ đường dẫn tạm cũ (khi file bị thay hoặc bị xóa)
  function forget(name) {
    if (urlCache[name]) {
      URL.revokeObjectURL(urlCache[name]);
      delete urlCache[name];
    }
  }

  return {
    // Danh sách tên file
    async keys() {
      return (await run('readonly', s => s.getAllKeys())) || [];
    },
    // Lưu (hoặc thay) một file
    async put(name, blob) {
      await run('readwrite', s => s.put(blob, name));
      forget(name);
    },
    async remove(name) {
      await run('readwrite', s => s.delete(name));
      forget(name);
    },
    // Đường dẫn để dùng cho <audio> / <img>: link web dùng luôn, tên file thì lấy từ kho.
    // Trả về null nếu chưa có file này.
    async url(name) {
      if (/^(https?:|blob:|data:)/i.test(name)) return name;
      if (urlCache[name]) return urlCache[name];
      const file = await run('readonly', s => s.get(name));
      if (!file) return null;
      urlCache[name] = URL.createObjectURL(file);
      return urlCache[name];
    },
  };
}

const audioStore = fileStore('eng_audio');
const imageStore = fileStore('eng_images');

// Tên file hay link web?
function isLink(name) {
  return /^https?:/i.test(name);
}

// --- Âm thanh ---

let audioNames = []; // tên các tệp âm thanh đã tải lên

async function loadAudioList() {
  try {
    audioNames = await audioStore.keys();
  } catch (err) {
    audioNames = [];
  }
  drawAudioList();
}

function drawAudioList() {
  fillAudioPicker(); // ô chọn âm thanh trong form "Thêm câu nghe"
  if (!audioNames.length) {
    $('alist').innerHTML = '<li class="warn">Chưa có tệp âm thanh nào.</li>';
    return;
  }
  $('alist').innerHTML = audioNames.map(name => {
    const used = listen.filter(x => x.audio === name).length;
    return `<li><span>🎧 ${esc(name)} <span class="warn">· ${used} câu dùng</span></span>` +
           `<button data-del-audio="${esc(name)}">Xóa</button></li>`;
  }).join('');
}

// Tải tệp âm thanh lên
$('afile').onchange = async e => {
  const files = [...e.target.files];
  let saved = 0;
  for (const f of files) {
    try {
      await audioStore.put(f.name, f);
      saved++;
    } catch (err) {
      $('lout').innerHTML = '<p class="errs">Không lưu được ' + esc(f.name) + ' (bộ nhớ trình duyệt có thể đã đầy).</p>';
    }
  }
  e.target.value = '';
  await loadAudioList();
  if (saved) $('lout').innerHTML = `<p class="chip ok">Đã lưu ${saved} tệp âm thanh</p>`;
};

// Xóa tệp âm thanh (bấm hai lần)
$('alist').onclick = async e => {
  const name = e.target.dataset.delAudio;
  if (name == null) return;
  if (!confirmTwice(e.target, 'Bấm lần nữa')) return;
  try { await audioStore.remove(name); } catch (err) { /* bỏ qua */ }
  loadAudioList();
};

function audioUrl(name) {
  return audioStore.url(name);
}

// --- Ảnh minh họa ---

let imageNames = []; // tên các ảnh đã tải lên

const IMAGE_MAX_SIDE = 800;         // cạnh dài nhất sau khi thu nhỏ (điểm ảnh)
const IMAGE_KEEP_BYTES = 300 * 1024; // ảnh đã nhỏ hơn 300 KB và không quá to thì giữ nguyên

// Thu nhỏ ảnh để đỡ tốn bộ nhớ trình duyệt. Trả về ảnh mới (JPEG), hoặc chính ảnh cũ nếu đã đủ nhỏ.
async function shrinkImage(file) {
  if (file.type === 'image/gif') return file; // giữ nguyên ảnh động
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    return file; // trình duyệt không đọc được thì cứ lưu nguyên
  }
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= IMAGE_KEEP_BYTES) return file;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white'; // JPEG không có nền trong suốt, nên tô nền trắng trước
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', 0.85));
}

// Thu nhỏ rồi lưu ảnh vào kho với tên name
async function saveImage(name, file) {
  await imageStore.put(name, await shrinkImage(file));
}

async function loadImageList() {
  try {
    imageNames = await imageStore.keys();
  } catch (err) {
    imageNames = [];
  }
  drawImageList();
}

function drawImageList() {
  // Ảnh do nút "Thêm ảnh" trên thẻ tạo ra (tên "card-…") thì không liệt kê, cho gọn
  const names = imageNames.filter(n => !n.startsWith('card-'));
  if (!names.length) {
    $('ilist').innerHTML = '<li class="warn">Chưa có ảnh nào được tải lên ở đây.</li>';
    return;
  }
  $('ilist').innerHTML = names.map(name => {
    const used = cards.filter(c => c.img === name).length;
    return `<li><span>🖼 ${esc(name)} <span class="warn">· ${used} thẻ dùng</span></span>` +
           `<button data-del-image="${esc(name)}">Xóa</button></li>`;
  }).join('');
}

// Tải nhiều ảnh lên một lần (dùng cùng cột image trong file nhập)
$('ifile').onchange = async e => {
  const files = [...e.target.files];
  let saved = 0;
  for (const f of files) {
    try {
      await saveImage(f.name, f);
      saved++;
    } catch (err) {
      $('pout').innerHTML = '<p class="errs">Không lưu được ' + esc(f.name) + ' (bộ nhớ trình duyệt có thể đã đầy).</p>';
    }
  }
  e.target.value = '';
  await loadImageList();
  if (saved) {
    $('pout').innerHTML = `<p class="chip ok">Đã lưu ${saved} ảnh</p>`;
    drawCard(); // thẻ đang mở có thể đang chờ ảnh này
  }
};

// Xóa ảnh (bấm hai lần)
$('ilist').onclick = async e => {
  const name = e.target.dataset.delImage;
  if (name == null) return;
  if (!confirmTwice(e.target, 'Bấm lần nữa')) return;
  try { await imageStore.remove(name); } catch (err) { /* bỏ qua */ }
  loadImageList();
  drawCard();
};


/* === 6. CỤM TỪ – FLASHCARD LEITNER ========================= */
// Mỗi thẻ ở một trong 5 mức (hộp Leitner), lưu trong trường box = 1..5.
// Thẻ mới ở mức 1. "Nhớ rồi" -> lên một mức, "Chưa nhớ" -> về mức 1.
// Mức càng cao thì càng lâu mới phải ôn lại.

// Số ngày chờ trước khi ôn lại, theo mức (vị trí 0 không dùng)
const INTERVAL_DAYS = [0, 0, 1, 3, 7, 16];

// Tên hiển thị của 5 mức: cụm từ "lớn dần" như một cái cây (vị trí 0 không dùng)
const LEVELS = [
  null,
  { icon: '🌱', name: 'Hạt mầm', sub: 'Mới học' },
  { icon: '🌿', name: 'Nảy mầm', sub: 'Đang nhớ' },
  { icon: '🪴', name: 'Cây non', sub: 'Khá nhớ' },
  { icon: '🌳', name: 'Cây lớn', sub: 'Nhớ chắc' },
  { icon: '🌸', name: 'Nở hoa',  sub: 'Đã thuộc' },
];

// Tên ngắn, vd levelName(3) -> "🪴 Cây non"
function levelName(box) {
  return LEVELS[box].icon + ' ' + LEVELS[box].name;
}
// Tên đầy đủ, vd levelLabel(3) -> "🪴 Cây non · Khá nhớ"
function levelLabel(box) {
  return levelName(box) + ' · ' + LEVELS[box].sub;
}
// Khi nào ôn lại nếu thẻ đang ở mức này, vd "Ôn lại sau 3 ngày"
function levelWhen(box) {
  return box === 1 ? 'Ôn lại ngay' : `Ôn lại sau ${INTERVAL_DAYS[box]} ngày`;
}

let current = null;   // thẻ đang hiện
let flipped = false;  // đã lật xem nghĩa chưa
let extra = false;    // đang "Ôn thêm" sau khi hết thẻ đến hạn
let rating = false;   // đang chạy hiệu ứng chấm thẻ (chặn bấm liên tục)
let rateMsgTimer = null;

// Thời gian chờ hiệu ứng chấm thẻ chạy xong rồi mới hiện thẻ kế tiếp (mili-giây)
const RATE_ANIM_MS = 650;

// Các thẻ thuộc bộ đang chọn
function cardPool() {
  const topic = $('topic').value;
  return cards.filter(c => topic === ALL || !topic || c.t === topic);
}

function nextCard() {
  const now = Date.now();
  const all = cardPool();
  let due = all.filter(c => c.due <= now);

  if (!all.length) $('due').textContent = 'Bộ này chưa có cụm từ';
  else if (due.length) $('due').textContent = `Còn ${due.length} thẻ cần ôn hôm nay`;
  else $('due').textContent = 'Bạn đã ôn hết thẻ hôm nay';

  // Ôn thêm: lấy các thẻ ở hộp thấp nhất, sắp đến hạn nhất
  if (!due.length && extra) {
    due = all.slice().sort((a, b) => a.box - b.box || a.due - b.due);
  }

  // Chọn ngẫu nhiên trong 4 thẻ đầu để thứ tự không lặp lại y hệt
  current = due.length ? due[Math.floor(Math.random() * Math.min(due.length, 4))] : null;
  flipped = false;
  drawCard('appear');
  drawBoxes();
}

// Vẽ thẻ. anim = hiệu ứng muốn chạy: 'appear' (thẻ mới hiện) hoặc 'turn' (lật thẻ)
function drawCard(anim) {
  const el = $('card');
  // Xóa hiệu ứng cũ, rồi chạy lại hiệu ứng mới
  el.classList.remove('appear', 'turn', 'rate-good', 'rate-again');
  void el.offsetWidth; // mẹo: buộc trình duyệt "quên" hiệu ứng cũ để chạy lại được
  if (anim) el.classList.add(anim);
  el.classList.toggle('is-back', Boolean(current && flipped)); // mặt sau đổi màu nền

  ['say', 'again', 'good'].forEach(id => { $(id).disabled = !current; });
  $('sayex').disabled = !(current && current.e); // thẻ không có câu ví dụ thì khóa nút

  if (!current) {
    if (cardPool().length) {
      el.innerHTML =
        '<div class="phrase small">Xong rồi! 🎉</div>' +
        '<div class="ex">Quay lại vào ngày mai, hoặc</div>' +
        '<div class="mt"><button class="pri" id="more">Ôn thêm</button></div>';
      $('more').onclick = e => {
        e.stopPropagation(); // không để cú bấm lật thẻ
        extra = true;
        nextCard();
      };
    } else {
      el.innerHTML =
        '<div class="phrase small">Chưa có cụm từ</div>' +
        '<div class="ex">Vào mục Nhập dữ liệu để thêm bộ cụm từ của bạn.</div>' +
        '<div class="mt"><a class="link" href="#nhap-cum-tu">➕ Thêm cụm từ →</a></div>';
    }
    return;
  }

  let html = `<span class="side">${flipped ? 'Mặt sau' : 'Mặt trước'}</span>` +
             `<div class="tags"><span class="tag">${esc(current.t)}</span>` +
             `<span class="tag level">${levelLabel(current.box)}</span></div>` +
             // .spk là biểu tượng loa, chỉ hiện khi máy đang đọc
             `<div class="phrase" id="cardPhrase">${esc(current.p)} <span class="spk" aria-hidden="true">🔊</span></div>`;
  if (flipped) {
    // Ảnh minh họa: tạo khung trước, ảnh được nạp sau (xem loadCardImage)
    if (current.img) {
      html += `<div class="card-img" id="cardImgBox"><img id="cardImg" alt="Ảnh minh họa cho ${esc(current.p)}"></div>`;
    }
    html += `<div class="mean">${esc(current.m)}</div>`;
    if (current.c) html += `<div class="ctx"><b>Dùng khi:</b> ${esc(current.c)}</div>`;
    if (current.e) {
      // Câu ví dụ kèm nút loa nhỏ để nghe riêng câu này
      html += `<div class="ex" id="cardEx">${esc(current.e)} ` +
              `<button type="button" class="ex-say" id="exSay" aria-label="Nghe câu ví dụ">🔊</button></div>`;
    }
    if (current.src) html += `<div class="src">Nguồn: ${esc(current.src)}</div>`;
    // Nút thêm / đổi / gỡ ảnh cho thẻ này
    html += '<div class="img-tools">' +
      (current.img
        ? '<button type="button" data-img="pick">🖼 Đổi ảnh</button><button type="button" data-img="remove">Gỡ ảnh</button>'
        : '<button type="button" data-img="pick">🖼 Thêm ảnh minh họa</button>') +
      '</div>';
  } else {
    html += '<div class="hint">Nhấn vào thẻ để xem nghĩa</div>';
  }
  el.innerHTML = html;
  if (flipped && current.img) loadCardImage(current);
}

// Nạp ảnh của thẻ vào khung. Ảnh nằm trong IndexedDB nên phải chờ một chút.
async function loadCardImage(card) {
  let url = null;
  try { url = await imageStore.url(card.img); } catch (err) { url = null; }
  const img = $('cardImg');
  if (!img || current !== card) return; // trong lúc chờ, người dùng đã chuyển thẻ
  const missing = () => {
    $('cardImgBox').innerHTML =
      `<span class="warn">Chưa có ảnh "${esc(card.img)}". Hãy tải ảnh này lên ở mục Nhập dữ liệu, hoặc bấm "Đổi ảnh".</span>`;
  };
  if (!url) { missing(); return; }
  img.onerror = missing; // link web hỏng
  img.src = url;
}

// Chọn ảnh từ máy cho thẻ đang mở. Ảnh được lưu với tên "card-<id thẻ>.jpg".
$('cardImgFile').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !current) return;
  const card = current;
  const name = 'card-' + card.id + (file.type === 'image/gif' ? '.gif' : '.jpg');
  try {
    await saveImage(name, file);
  } catch (err) {
    $('ratemsg').innerHTML = '<span class="again">Không lưu được ảnh (bộ nhớ trình duyệt có thể đã đầy).</span>';
    return;
  }
  // Thay ảnh cũ do nút này tạo (nếu khác tên, vd .gif -> .jpg) để không bị bỏ rơi trong kho
  if (card.img && card.img !== name && card.img.startsWith('card-')) {
    try { await imageStore.remove(card.img); } catch (err) { /* bỏ qua */ }
  }
  card.img = name;
  save();
  loadImageList();
  if (current === card) drawCard();
};

// Gỡ ảnh khỏi thẻ đang mở (bấm hai lần). Ảnh do nút "Thêm ảnh" tạo thì xóa luôn khỏi kho;
// ảnh tải lên hàng loạt thì giữ lại vì thẻ khác có thể đang dùng.
async function removeCardImage(button) {
  if (!current || !current.img) return;
  if (!confirmTwice(button, 'Bấm lần nữa để gỡ')) return;
  const old = current.img;
  current.img = '';
  save();
  if (old.startsWith('card-')) {
    try { await imageStore.remove(old); } catch (err) { /* bỏ qua */ }
  }
  loadImageList();
  drawCard();
}

// 5 ô đếm số thẻ ở từng mức. Rê chuột vào ô để xem khi nào ôn lại.
function drawBoxes() {
  const all = cardPool();
  $('boxes').innerHTML = [1, 2, 3, 4, 5].map(box => {
    const n = all.filter(c => c.box === box).length;
    const lv = LEVELS[box];
    return `<div title="${levelWhen(box)}">` +
           `<span class="lv-icon" aria-hidden="true">${lv.icon}</span>` +
           `<b>${n}</b>` +
           `<span class="lv-name">${lv.name}</span>` +
           `<small>${lv.sub}</small></div>`;
  }).join('');
}

// Chấm thẻ: remembered = true ("Nhớ rồi") hoặc false ("Chưa nhớ").
// Lưu kết quả ngay, chạy hiệu ứng, rồi mới chuyển sang thẻ kế tiếp.
function rate(remembered) {
  if (!current || rating) return;
  rating = true;

  const oldBox = current.box;
  let message;
  if (remembered) {
    current.box = Math.min(5, current.box + 1);
    const days = Math.max(1, INTERVAL_DAYS[current.box]);
    current.due = Date.now() + days * DAY;
    message = current.box === oldBox
      ? `✓ Nhớ rồi! Vẫn ${levelName(current.box)} · ôn lại sau ${days} ngày`
      : `✓ Nhớ rồi! ${levelName(oldBox)} → ${levelName(current.box)} · ôn lại sau ${days} ngày`;
  } else {
    current.box = 1;
    current.due = Date.now() + 60 * 1000; // gặp lại sau 1 phút
    message = `↺ Chưa nhớ · về ${levelName(1)}, ôn lại sau 1 phút`;
  }
  stats.reviews++;
  logToday('cards');
  save();
  markDay();

  showRateFeedback(remembered, message);
  setTimeout(() => {
    rating = false;
    nextCard();
  }, RATE_ANIM_MS);
}

// Hiệu ứng sau khi chấm: viền + chuyển động trên thẻ, nút được bấm nảy lên, dòng thông báo
function showRateFeedback(remembered, message) {
  const kind = remembered ? 'good' : 'again';
  const card = $('card');
  const button = $(kind);

  card.classList.remove('appear', 'turn');
  card.classList.add('rate-' + kind);

  button.classList.remove('picked');
  void button.offsetWidth;
  button.classList.add('picked');
  setTimeout(() => button.classList.remove('picked'), RATE_ANIM_MS);

  // Dòng thông báo tự ẩn sau 3 giây
  $('ratemsg').innerHTML = `<span class="${kind}">${esc(message)}</span>`;
  clearTimeout(rateMsgTimer);
  rateMsgTimer = setTimeout(() => { $('ratemsg').innerHTML = ''; }, 3000);
}

$('card').onclick = () => {
  if (!current || rating) return;
  flipped = !flipped;
  drawCard('turn');
  if (flipped) say(current.p, 1, $('cardPhrase'));
};
// Phím Space / Enter cũng lật được thẻ
$('card').onkeydown = e => {
  if (e.target !== $('card')) return;
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    $('card').click();
  }
};
// Nghe cụm từ / nghe câu ví dụ
$('say').onclick = () => { if (current) say(current.p, 1, $('say')); };
$('sayex').onclick = () => { if (current && current.e) say(current.e, 1, $('sayex')); };
// Các nút nằm trong thẻ (loa câu ví dụ, thêm/đổi/gỡ ảnh) và chính ảnh:
// bấm vào thì làm việc của nút, KHÔNG lật thẻ.
$('card').addEventListener('click', e => {
  const exSay = e.target.closest('#exSay');
  const imgBtn = e.target.closest('[data-img]');
  const inImage = e.target.closest('#cardImgBox');
  if (!exSay && !imgBtn && !inImage) return;
  e.stopImmediatePropagation();
  if (exSay && current && current.e) say(current.e, 1, $('cardEx'));
  if (imgBtn && imgBtn.dataset.img === 'pick') $('cardImgFile').click();
  if (imgBtn && imgBtn.dataset.img === 'remove') removeCardImage(imgBtn);
}, true);
$('again').onclick = () => rate(false);
$('good').onclick = () => rate(true);
$('topic').onchange = () => { extra = false; nextCard(); };


/* === 7. LUYỆN NGHE – CHÉP CHÍNH TẢ ========================= */

// Vị trí câu đang nghe của từng bộ: { tên bộ: số thứ tự }
let listenPos = store.get('lpos', {});

function listenPool() {
  const topic = $('lset').value;
  return listen.filter(x => topic === ALL || !topic || x.t === topic);
}
function listenSetKey() {
  return $('lset').value || ALL;
}
function listenIndex() {
  return (listenPos[listenSetKey()] || 0) % listenPool().length;
}
// Câu đang nghe (null nếu bộ trống)
function listenItem() {
  const all = listenPool();
  return all.length ? all[listenIndex()] : null;
}

// Đổi số giây thành "m:ss", vd 65 -> "1:05", 65.5 -> "1:05.5"
function fmtTime(sec) {
  sec = Math.round(sec * 10) / 10;
  const hasDecimal = sec % 1 !== 0;
  const minutes = Math.floor(sec / 60);
  const rest = (sec % 60).toFixed(hasDecimal ? 1 : 0);
  return minutes + ':' + String(rest).padStart(hasDecimal ? 4 : 2, '0');
}

function showListen() {
  const all = listenPool();
  const item = listenItem();
  $('lin').value = '';
  $('ldiff').innerHTML = '';
  ['lplay', 'lslow', 'lcheck', 'lshow', 'lnext', 'lprev'].forEach(id => { $(id).disabled = !item; });

  if (!item) {
    $('lnum').textContent = '';
    $('lmeta').innerHTML = 'Bộ này chưa có câu nào. <a class="link" href="#nhap-bai-nghe">➕ Thêm câu nghe</a>';
    return;
  }

  $('lnum').textContent = `Câu ${listenIndex() + 1} / ${all.length}`;

  // Dòng thông tin: file âm thanh (và đoạn cắt) hoặc giọng tự động, kèm nguồn
  let meta;
  if (item.audio) {
    meta = '🎧 ' + esc(item.audio);
    if (item.s != null) meta += ` · ${fmtTime(item.s)}–${item.e != null ? fmtTime(item.e) : 'hết'}`;
  } else {
    meta = 'Giọng đọc tự động';
  }
  if (item.src) meta += ' · Nguồn: ' + esc(item.src);
  $('lmeta').innerHTML = meta;
}

// Phát âm thanh: dùng file nếu có, không thì giọng đọc tự động
const player = $('player');
let stopAt = null; // giây cần dừng (khi chỉ nghe một đoạn trong file dài)

player.ontimeupdate = () => {
  if (stopAt != null && player.currentTime >= stopAt) {
    player.pause();
    stopAt = null;
  }
};
player.onerror = () => {
  $('tts').textContent = 'Không phát được âm thanh. Nếu dùng link web: link chỉ phát được khi bạn mở file index.html trên máy (bản xem trên Claude chặn link ngoài). Tệp bạn tải lên thì phát được ở cả hai nơi.';
};

// Phát câu đang luyện
function playItem(slow) {
  const item = listenItem();
  if (item) playEntry(item, slow, $('tts'));
}

// Phát một câu nghe bất kỳ (dùng cả cho nút "Nghe thử" ở form Thêm câu nghe).
// msgEl: nơi hiện thông báo lỗi
async function playEntry(item, slow, msgEl) {
  msgEl.textContent = '';

  if (!item.audio) {
    say(item.text, slow ? 0.65 : 0.95);
    return;
  }

  try { speechSynthesis.cancel(); } catch (err) { /* bỏ qua */ }

  let url;
  try { url = await audioUrl(item.audio); } catch (err) { url = null; }
  if (!url) {
    msgEl.textContent = `Chưa có tệp "${item.audio}". Hãy tải tệp này lên ở mục Nhập dữ liệu (đúng tên file).`;
    return;
  }

  if (player.src !== url) player.src = url;
  player.playbackRate = slow ? 0.75 : 1;

  const start = () => {
    player.currentTime = item.s || 0;
    stopAt = item.e;
    player.play().catch(() => {
      msgEl.textContent = 'Trình duyệt chặn phát âm thanh. Hãy bấm Nghe lần nữa.';
    });
  };
  if (player.readyState >= 1) start();
  else player.addEventListener('loadedmetadata', start, { once: true });
}

// Tách câu thành mảng từ: chữ thường, bỏ dấu câu. "Hello, I'm Tom!" -> ["hello", "i'm", "tom"]
function words(s) {
  return s.toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// So sánh câu bạn gõ (typed) với đáp án (answer) bằng thuật toán "dãy con chung dài nhất".
// Trả về mảng [loại, từ]: 'g' = đúng, 'b' = gõ sai/thừa, 'm' = bị thiếu
function compareWords(typed, answer) {
  const n = typed.length;
  const m = answer.length;
  // lcs[i][j] = số từ khớp nhiều nhất giữa typed[i..] và answer[j..]
  const lcs = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = typed[i] === answer[j]
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && typed[i] === answer[j]) {
      out.push(['g', typed[i]]); i++; j++;
    } else if (j < m && (i >= n || lcs[i][j + 1] >= lcs[i + 1][j])) {
      out.push(['m', answer[j]]); j++;
    } else {
      out.push(['b', typed[i]]); i++;
    }
  }
  return out;
}

// Chuyển câu: step = 1 (tiếp) hoặc -1 (trước). Chế độ ngẫu nhiên thì "tiếp" là nhảy bất kỳ.
function moveListen(step) {
  const all = listenPool();
  if (!all.length) return;
  const key = listenSetKey();
  if ($('lorder').value === 'rand' && step > 0) {
    listenPos[key] = Math.floor(Math.random() * all.length);
  } else {
    listenPos[key] = ((listenPos[key] || 0) + step + all.length) % all.length;
  }
  store.set('lpos', listenPos);
  showListen();
}

function checkListen() {
  const item = listenItem();
  if (!item) return;
  const answer = words(item.text);
  const typed = words($('lin').value);
  if (!typed.length) {
    $('ldiff').textContent = 'Hãy gõ câu bạn nghe được trước nhé.';
    return;
  }

  const result = compareWords(typed, answer);
  const correct = result.filter(x => x[0] === 'g').length;
  const percent = Math.round(correct / Math.max(answer.length, 1) * 100);

  stats.listen++;
  logToday('listen');
  if (percent === 100) stats.listenOk++;
  save();
  markDay();

  $('ldiff').innerHTML =
    `<b>${percent}% đúng.</b> ` +
    (percent === 100 ? 'Tuyệt vời!' : 'Đỏ gạch là từ bạn gõ sai hoặc thừa, đỏ đậm là từ bị thiếu.') +
    '<br>' +
    result.map(([type, word]) => `<span class="${type}">${esc(word)}</span>`).join(' ') +
    (item.tr ? `<div class="ex mt-s">${esc(item.tr)}</div>` : '');
}

$('lplay').onclick = () => playItem(false);
$('lslow').onclick = () => playItem(true);
$('lcheck').onclick = checkListen;
$('lshow').onclick = () => {
  const item = listenItem();
  if (!item) return;
  $('ldiff').innerHTML = '<b>Đáp án:</b> ' + esc(item.text) +
    (item.tr ? `<div class="ex">${esc(item.tr)}</div>` : '');
};
$('lnext').onclick = () => moveListen(1);
$('lprev').onclick = () => moveListen(-1);
$('lset').onchange = showListen;
// Enter = kiểm tra, Shift+Enter = xuống dòng
$('lin').onkeydown = e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    checkListen();
  }
};


/* === 8. NHẬP DỮ LIỆU ====================================== */
// Hai khung nhập (cụm từ và bài nghe) dùng chung một hàm bindImport.
// Bước 1 "Xem trước": đọc + kiểm tra, cất kết quả vào pending.
// Bước 2 "Nhập": lưu những dòng hợp lệ.

const pending = { phrase: null, listen: null };

// Cột hiện trong bảng xem trước: [tên trường, tiêu đề]
const PREVIEW_COLS = {
  phrase: [['p', 'Cụm từ'], ['m', 'Nghĩa'], ['c', 'Dùng khi'], ['e', 'Ví dụ'], ['img', 'Ảnh'], ['t', 'Bộ'], ['src', 'Nguồn']],
  listen: [['text', 'Câu'], ['tr', 'Nghĩa'], ['audio', 'Âm thanh'], ['s', 'Từ'], ['e', 'Đến'], ['t', 'Bộ']],
};

function bindImport(kind, ids) {
  const box = $(ids.text);
  const out = $(ids.out);
  const goBtn = $(ids.go);
  const setInput = $(ids.set);
  const template = kind === 'phrase' ? P_TEMPLATE : L_TEMPLATE;
  const word = kind === 'phrase' ? 'cụm từ' : 'câu';

  // Sửa dữ liệu thì phải bấm Xem trước lại
  const reset = () => {
    pending[kind] = null;
    goBtn.disabled = true;
    goBtn.textContent = 'Nhập';
  };
  box.oninput = reset;
  setInput.oninput = reset;

  // Chọn file: đọc nội dung vào ô rồi tự Xem trước
  $(ids.file).onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      box.value = await f.text();
      if (!setInput.value) setInput.value = f.name.replace(/\.[^.]+$/, ''); // tên file làm tên bộ
      reset();
      preview();
    } catch (err) {
      out.innerHTML = '<p class="errs">Không đọc được file.</p>';
    }
    e.target.value = '';
  };

  $(ids.copy).onclick = () => copyText(template, out, box);
  $(ids.fill).onclick = () => {
    box.value = template;
    reset();
    out.innerHTML = '<p class="warn">Đã dán mẫu. Bấm "Xem trước" để thử.</p>';
  };

  function preview() {
    const mode = document.querySelector(`input[name=${ids.mode}]:checked`).value; // 'add' | 'replace'
    const setName = setInput.value.trim() || 'Bộ của tôi';

    const parsed = toRecords(box.value, kind);
    if (parsed.fatal) {
      out.innerHTML = `<p class="errs">${esc(parsed.fatal)}</p>`;
      reset();
      return;
    }
    if (!parsed.recs.length) {
      out.innerHTML = '<p class="warn">Chưa có dữ liệu. Hãy dán bảng hoặc chọn file.</p>';
      reset();
      return;
    }

    // Khóa của dữ liệu đang có (chế độ Thay toàn bộ thì không cần so trùng)
    let existing = [];
    if (mode !== 'replace') {
      existing = kind === 'phrase'
        ? cards.map(c => c.p.toLowerCase())
        : listen.map(x => listenKey(x.text, x.audio, x.s));
    }

    const checked = validate(parsed.recs, kind, existing, setName, parsed.base, parsed.unit);
    pending[kind] = { items: checked.ok, mode };

    // Tệp âm thanh được nhắc tới nhưng chưa tải lên
    // Tệp âm thanh / ảnh được nhắc tới nhưng chưa tải lên
    const fileField = kind === 'phrase' ? 'img' : 'audio';
    const uploaded = kind === 'phrase' ? imageNames : audioNames;
    const missing = [...new Set(
      checked.ok
        .filter(x => x[fileField] && !isLink(x[fileField]) && !uploaded.includes(x[fileField]))
        .map(x => x[fileField])
    )];

    out.innerHTML =
      previewSummary(checked, parsed.how) +
      previewTable(checked.ok, PREVIEW_COLS[kind]) +
      (missing.length
        ? `<p class="warn">⚠ Chưa tải lên tệp: ${missing.map(esc).join(', ')}. Bạn vẫn nhập được, rồi tải các tệp này lên sau.</p>`
        : '') +
      (checked.errs.length
        ? `<ul class="errs">${checked.errs.slice(0, 30).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
        : '') +
      (mode === 'replace' && checked.ok.length
        ? `<p class="warn danger">Chế độ thay toàn bộ: dữ liệu ${kind === 'phrase' ? 'cụm từ' : 'bài nghe'} hiện có và tiến độ ôn của nó sẽ bị xóa.</p>`
        : '');

    goBtn.disabled = !checked.ok.length;
    goBtn.textContent = checked.ok.length ? `Nhập ${checked.ok.length} ${word}` : 'Nhập';
  }
  $(ids.prev).onclick = preview;

  goBtn.onclick = () => {
    const job = pending[kind];
    if (!job || !job.items.length) return;

    const backup = kind === 'phrase' ? cards : listen;
    // Cụm từ mới bắt đầu ở hộp 1, đến hạn ngay
    const items = job.items.map(x => kind === 'phrase'
      ? { id: uid(), ...x, box: 1, due: 0 }
      : { id: uid(), ...x });

    if (kind === 'phrase') cards = job.mode === 'replace' ? items : cards.concat(items);
    else listen = job.mode === 'replace' ? items : listen.concat(items);

    // Không lưu được thì trả lại dữ liệu cũ
    if (!save()) {
      if (kind === 'phrase') cards = backup;
      else listen = backup;
      save();
      out.innerHTML = '<p class="errs">Bộ nhớ trình duyệt đã đầy, chưa nhập được. Hãy xóa bớt bộ cũ hoặc chia file nhỏ hơn.</p>';
      return;
    }

    const touchedSets = [...new Set(items.map(x => x.t))];
    out.innerHTML =
      `<p class="chip ok">Đã nhập ${items.length} ${word} vào: ${touchedSets.map(esc).join(', ')}</p> ` +
      `<a class="link" href="#${kind === 'phrase' ? 'cum-tu' : 'luyen-nghe'}">Học ngay →</a>`;
    box.value = '';
    reset();
    refreshAll();

    // Nhập đúng một bộ thì chọn sẵn bộ đó
    if (touchedSets.length === 1) {
      if (kind === 'phrase') { $('topic').value = touchedSets[0]; nextCard(); }
      else { $('lset').value = touchedSets[0]; showListen(); }
    }
  };
}

// Dòng tóm tắt: số dòng hợp lệ / lỗi / trùng, cách nhận dạng
function previewSummary(checked, how) {
  return '<div class="sum">' +
    `<span class="chip ok">${checked.ok.length} dòng hợp lệ</span>` +
    (checked.errs.length ? `<span class="chip bad">${checked.errs.length} dòng lỗi (bỏ qua)</span>` : '') +
    (checked.dups ? `<span class="chip">${checked.dups} dòng trùng (bỏ qua)</span>` : '') +
    `<span class="chip">Nhận dạng: ${esc(how)}</span>` +
    '</div>';
}

// Bảng xem trước 8 dòng đầu
function previewTable(rows, cols) {
  if (!rows.length) return '';
  const show = v => v == null ? '' : typeof v === 'number' ? fmtTime(v) : v;
  const head = cols.map(([, title]) => `<th>${title}</th>`).join('');
  const body = rows.slice(0, 8).map(r =>
    '<tr>' + cols.map(([field]) => {
      const v = esc(show(r[field]));
      return `<td title="${v}">${v}</td>`;
    }).join('') + '</tr>'
  ).join('');
  const more = rows.length > 8 ? `<p class="warn">… và ${rows.length - 8} dòng nữa.</p>` : '';
  return `<div class="tbl"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${more}`;
}

bindImport('phrase', {
  text: 'pin', out: 'pout', go: 'pgo', set: 'pset', file: 'pfile',
  copy: 'pcopy', fill: 'pfill', prev: 'pprev', mode: 'pmode',
});
bindImport('listen', {
  text: 'lpin', out: 'lout', go: 'lgo', set: 'lsetname', file: 'lfile',
  copy: 'lcopy', fill: 'lfill', prev: 'lpv', mode: 'lmode',
});


/* === 8b. THÊM TỪNG MỤC (form) ============================== */
// Mục Nhập dữ liệu có hai cách: "Thêm từng mục" (form bên dưới) và "Nhập từ file" (phần 8).
// Lựa chọn lưu ở khóa eng_importmode.

let importMode = store.get('importmode', 'single');

function showImportMode() {
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.mode === importMode));
  });
  $('impSingle').hidden = importMode !== 'single';
  $('impFile').hidden = importMode !== 'file';
}
document.querySelectorAll('[data-mode]').forEach(btn => {
  btn.onclick = () => {
    importMode = btn.dataset.mode;
    store.set('importmode', importMode);
    showImportMode();
  };
});

// --- Màn chọn / màn nhập cụm từ / màn nhập bài nghe ---
// kind: '' = màn chọn (2 nút lớn), 'p' = nhập cụm từ, 'l' = nhập bài nghe
const IMPORT_TITLES = { p: '📚 Nhập cụm từ', l: '🎧 Nhập bài nghe' };
let importKind = '';

function showImportScreen(kind) {
  const changed = kind !== importKind;
  importKind = kind;
  $('impHub').hidden = kind !== '';
  $('impData').hidden = kind !== '';
  $('impScreen').hidden = kind === '';
  if (kind) {
    $('impTitle').textContent = IMPORT_TITLES[kind];
    // Chỉ hiện các khung cùng loại (form + khung nhập file)
    document.querySelectorAll('#impScreen [data-kind]').forEach(el => {
      el.hidden = el.dataset.kind !== kind;
    });
  } else {
    drawImportCounts();
  }
  if (changed) window.scrollTo(0, 0); // sang màn khác thì lên đầu trang
}

// Dòng nhỏ dưới 2 nút lớn, vd "8 cụm từ · 2 bộ"
function drawImportCounts() {
  const text = (n, unit, list) => n ? `Đang có ${n} ${unit} · ${setsOf(list).length} bộ` : `Chưa có ${unit} nào`;
  $('impCountP').textContent = text(cards.length, 'cụm từ', cards);
  $('impCountL').textContent = text(listen.length, 'câu nghe', listen);
}

// --- Ô chọn bộ (dùng chung cho hai form) ---

const NEW_SET = '__new__'; // giá trị của lựa chọn "＋ Tạo bộ mới…"

// Đổ danh sách bộ vào ô chọn của form, giữ lựa chọn cũ nếu còn
function fillSetPicker(form, list) {
  const pick = form.elements.setPick;
  const old = pick.value;
  const names = setsOf(list).map(([name]) => name);
  pick.innerHTML =
    names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('') +
    `<option value="${NEW_SET}">＋ Tạo bộ mới…</option>`;
  if ([...pick.options].some(o => o.value === old)) pick.value = old;
  else if (!names.length) pick.value = NEW_SET;
  form.elements.setNew.hidden = pick.value !== NEW_SET;
}

// Tên bộ người dùng đã chọn (hoặc vừa gõ)
function chosenSet(form) {
  const pick = form.elements.setPick;
  return pick.value === NEW_SET ? form.elements.setNew.value.trim() : pick.value;
}

// Sau khi lưu: chọn sẵn bộ vừa dùng cho lần thêm tiếp theo
function keepSet(form, name) {
  form.elements.setPick.value = name;
  form.elements.setNew.value = '';
  form.elements.setNew.hidden = true;
}

['fP', 'fL'].forEach(id => {
  const form = $(id);
  form.elements.setPick.onchange = () => {
    const isNew = form.elements.setPick.value === NEW_SET;
    form.elements.setNew.hidden = !isNew;
    if (isNew) form.elements.setNew.focus();
  };
});

// Dòng thông báo dưới form. kind: 'ok' (xanh) hoặc 'bad' (đỏ)
function formMsg(form, html, kind) {
  const el = form.querySelector('.form-msg');
  el.className = 'form-msg ' + (kind || '');
  el.innerHTML = html;
}

// Vẽ lại các ô chọn khi dữ liệu thay đổi (gọi trong refreshAll)
function fillForms() {
  fillSetPicker($('fP'), cards);
  fillSetPicker($('fL'), listen);
  fillAudioPicker();
}

// --- Form thêm cụm từ ---

// Ảnh đã chọn: hiện ảnh thu nhỏ để xem trước
let formImageUrl = null;
function showFormImage() {
  const file = $('fP').elements.img.files[0];
  if (formImageUrl) URL.revokeObjectURL(formImageUrl);
  formImageUrl = file ? URL.createObjectURL(file) : null;
  $('fPthumb').hidden = !file;
  $('fPthumb').querySelector('img').src = formImageUrl || '';
}
$('fP').elements.img.onchange = showFormImage;
$('fPimgClear').onclick = () => {
  $('fP').elements.img.value = '';
  showFormImage();
};

// Lưu cụm từ. then = 'more' (thêm tiếp) hoặc 'learn' (chuyển sang học ngay)
async function savePhraseForm(then) {
  const form = $('fP');
  const el = form.elements;
  const setName = chosenSet(form);
  if (!setName) {
    formMsg(form, 'Hãy gõ tên cho bộ mới.', 'bad');
    el.setNew.focus();
    return;
  }

  // Dùng chung hàm validate với phần nhập file để kiểm tra giống nhau
  const rec = { p: el.p.value, m: el.m.value, c: el.c.value, e: el.e.value, t: setName, src: el.src.value };
  const checked = validate([rec], 'phrase', cards.map(c => c.p.toLowerCase()), setName, 1, 'Mục');
  if (!rec.p.trim()) { formMsg(form, 'Hãy nhập cụm từ tiếng Anh.', 'bad'); el.p.focus(); return; }
  if (!rec.m.trim()) { formMsg(form, 'Hãy nhập nghĩa tiếng Việt.', 'bad'); el.m.focus(); return; }
  if (checked.dups) {
    formMsg(form, `"${esc(rec.p.trim())}" đã có trong dữ liệu của bạn.`, 'bad');
    el.p.focus();
    return;
  }

  const card = { id: uid(), ...checked.ok[0], box: 1, due: 0 };

  // Ảnh (nếu có): lưu với tên "card-<id>.jpg" giống nút "Thêm ảnh" trên thẻ
  const imgFile = el.img.files[0];
  let imgWarn = '';
  if (imgFile) {
    const name = 'card-' + card.id + (imgFile.type === 'image/gif' ? '.gif' : '.jpg');
    try {
      await saveImage(name, imgFile);
      card.img = name;
    } catch (err) {
      imgWarn = ' (Không lưu được ảnh – bộ nhớ trình duyệt có thể đã đầy.)';
    }
  }

  cards.push(card);
  if (!save()) {
    cards.pop();
    formMsg(form, 'Bộ nhớ trình duyệt đã đầy, chưa lưu được. Hãy xóa bớt bộ cũ.', 'bad');
    return;
  }
  refreshAll();
  loadImageList();

  // Xóa các ô để thêm mục tiếp theo; giữ lại bộ và nguồn
  ['p', 'm', 'c', 'e'].forEach(n => { el[n].value = ''; });
  el.img.value = '';
  showFormImage();
  keepSet(form, setName);

  if (then === 'learn') {
    // Mở tab Cụm từ, chọn đúng bộ và hiện ngay thẻ vừa thêm
    formMsg(form, '');
    $('topic').value = setName;
    extra = false;
    nextCard();
    current = card;
    drawCard('appear');
    location.hash = '#cum-tu';
    return;
  }
  formMsg(form,
    `✓ Đã thêm "${esc(card.p)}" vào bộ ${esc(setName)}.${imgWarn} <a class="link" href="#cum-tu">Học ngay →</a>`,
    imgWarn ? 'bad' : 'ok');
  el.p.focus();
}

// Enter trong ô nhập = "Lưu & thêm tiếp"
$('fP').onsubmit = e => {
  e.preventDefault();
  savePhraseForm('more');
};
$('fP').querySelector('[data-then="learn"]').onclick = () => savePhraseForm('learn');

// --- Form thêm câu nghe ---

// Ô chọn âm thanh: các tệp đã tải lên, hoặc để trống (giọng đọc tự động)
function fillAudioPicker() {
  const select = $('fL').elements.audio;
  const old = select.value;
  select.innerHTML =
    '<option value="">Không có – dùng giọng đọc tự động</option>' +
    audioNames.map(n => `<option value="${esc(n)}">🎧 ${esc(n)}</option>`).join('');
  if ([...select.options].some(o => o.value === old)) select.value = old;
  showAudioRange();
}

// Chỉ hiện ô Bắt đầu / Kết thúc khi có chọn tệp âm thanh
function showAudioRange() {
  $('fLrange').hidden = !$('fL').elements.audio.value;
}
$('fL').elements.audio.onchange = showAudioRange;

// Tải tệp âm thanh mới ngay trong form, rồi chọn luôn tệp đó
$('fL').elements.audioFile.onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    await audioStore.put(file.name, file);
  } catch (err) {
    formMsg($('fL'), 'Không lưu được tệp âm thanh (bộ nhớ trình duyệt có thể đã đầy).', 'bad');
    return;
  }
  await loadAudioList(); // vẽ lại danh sách, gồm cả ô chọn trong form
  $('fL').elements.audio.value = file.name;
  showAudioRange();
  formMsg($('fL'), `Đã tải lên ${esc(file.name)}. Nhập thời điểm bắt đầu / kết thúc nếu chỉ cần một đoạn.`, 'ok');
};

// Đọc và kiểm tra form câu nghe. existing: khóa các câu đã có (để báo trùng)
function readListenForm(existing) {
  const form = $('fL');
  const el = form.elements;
  const setName = chosenSet(form);
  const hasAudio = Boolean(el.audio.value);
  const rec = {
    text: el.text.value, tr: el.tr.value, audio: el.audio.value,
    s: hasAudio ? el.s.value : '', e: hasAudio ? el.e.value : '',
    t: setName, src: el.src.value,
  };
  const checked = validate([rec], 'listen', existing, setName || 'Bộ của tôi', 1, 'Câu');
  // Đổi lỗi kỹ thuật thành câu dễ hiểu
  let error = '';
  if (!rec.text.trim()) error = 'Hãy nhập câu tiếng Anh.';
  else if (checked.errs.length) {
    error = checked.errs[0]
      .replace(/^Câu 1: /, '')
      .replace('end phải lớn hơn start', 'Thời điểm kết thúc phải sau thời điểm bắt đầu')
      .replace('start/end sai định dạng', 'Thời điểm bắt đầu / kết thúc sai định dạng') + '.';
  }
  return { form, el, setName, checked, error };
}

// "▶ Nghe thử": phát đúng đoạn đã nhập, chưa lưu gì
$('fL').querySelector('[data-then="try"]').onclick = () => {
  const { form, checked, error } = readListenForm([]);
  if (error) { formMsg(form, esc(error), 'bad'); return; }
  formMsg(form, '');
  playEntry(checked.ok[0], false, form.querySelector('.form-msg'));
};

async function saveListenForm(then) {
  const { form, el, setName, checked, error } =
    readListenForm(listen.map(x => listenKey(x.text, x.audio, x.s)));
  if (!setName) { formMsg(form, 'Hãy gõ tên cho bộ mới.', 'bad'); el.setNew.focus(); return; }
  if (error) { formMsg(form, esc(error), 'bad'); el.text.focus(); return; }
  if (checked.dups) { formMsg(form, 'Câu này đã có trong dữ liệu của bạn.', 'bad'); el.text.focus(); return; }

  const item = { id: uid(), ...checked.ok[0] };
  listen.push(item);
  if (!save()) {
    listen.pop();
    formMsg(form, 'Bộ nhớ trình duyệt đã đầy, chưa lưu được. Hãy xóa bớt bộ cũ.', 'bad');
    return;
  }
  refreshAll();

  // Xóa ô câu, nghĩa, thời điểm; giữ lại tệp âm thanh, bộ và nguồn
  // (thường thêm liên tiếp nhiều câu từ cùng một file)
  ['text', 'tr', 's', 'e'].forEach(n => { el[n].value = ''; });
  keepSet(form, setName);

  if (then === 'learn') {
    // Mở tab Luyện nghe, chọn đúng bộ và nhảy tới câu vừa thêm
    formMsg(form, '');
    $('lset').value = setName;
    const pool = listenPool();
    listenPos[setName] = pool.indexOf(item);
    store.set('lpos', listenPos);
    showListen();
    location.hash = '#luyen-nghe';
    return;
  }
  formMsg(form,
    `✓ Đã thêm câu vào bộ ${esc(setName)}. <a class="link" href="#luyen-nghe">Luyện ngay →</a>`, 'ok');
  el.text.focus();
}

$('fL').onsubmit = e => {
  e.preventDefault();
  saveListenForm('more');
};
$('fL').querySelector('[data-then="learn"]').onclick = () => saveListenForm('learn');
// Trong ô câu tiếng Anh: Enter = lưu, Shift+Enter = xuống dòng
$('fL').elements.text.onkeydown = e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    saveListenForm('more');
  }
};


/* === 9. QUẢN LÝ BỘ DỮ LIỆU, SAO LƯU ======================== */

function drawSets() {
  const listHtml = (list, kind) => {
    const sets = setsOf(list);
    if (!sets.length) return '<li class="warn">Chưa có bộ nào.</li>';
    const unit = kind === 'p' ? ' cụm từ' : ' câu';
    return sets.map(([name, n]) =>
      `<li><span>${esc(name)} <span class="warn">· ${n}${unit}</span></span>` +
      `<button data-del="${kind}" data-set="${esc(name)}">Xóa</button></li>`
    ).join('');
  };
  $('psets').innerHTML = listHtml(cards, 'p');
  $('lsets').innerHTML = listHtml(listen, 'l');
}

// Xóa một bộ (bấm hai lần)
$('nhap-du-lieu').addEventListener('click', e => {
  const btn = e.target.closest('button[data-del]');
  if (!btn) return;
  if (!confirmTwice(btn, 'Bấm lần nữa để xóa')) return;
  const name = btn.dataset.set;
  if (btn.dataset.del === 'p') cards = cards.filter(c => c.t !== name);
  else listen = listen.filter(x => x.t !== name);
  save();
  refreshAll();
});

// Sao lưu: chép toàn bộ cụm từ (kèm tiến độ) và bài nghe thành JSON
$('bcopy').onclick = async () => {
  const data = JSON.stringify({ v: 1, phrases: cards, listening: listen });
  await copyText(data, $('bmsg'), $('bbox'));
  $('bmsg').textContent += ' Bản sao lưu gồm cụm từ, tiến độ ôn và bài nghe (không gồm tệp âm thanh và ảnh).';
};

// Khôi phục: bấm lần 1 hiện ô để dán, bấm lần 2 thì khôi phục
$('brest').onclick = () => {
  const bx = $('bbox');
  if (bx.hidden || !bx.value.trim()) {
    bx.hidden = false;
    bx.value = '';
    bx.placeholder = 'Dán bản sao lưu vào đây rồi bấm "Khôi phục" lần nữa';
    bx.focus();
    $('bmsg').textContent = '';
    return;
  }
  try {
    const data = JSON.parse(bx.value);
    if (!Array.isArray(data.phrases) || !Array.isArray(data.listening)) throw new Error('sai cấu trúc');

    cards = data.phrases
      .filter(c => c && c.p && c.m)
      .map(c => ({
        id: c.id || uid(), t: c.t || 'Bộ của tôi', p: c.p, m: c.m, c: c.c || '', e: c.e || '',
        src: c.src || '', img: c.img || '', box: c.box || 1, due: c.due || 0,
      }));
    listen = data.listening
      .filter(x => x && x.text)
      .map(x => ({
        id: x.id || uid(), text: x.text, tr: x.tr || '', audio: x.audio || '',
        s: x.s ?? null, e: x.e ?? null, t: x.t || 'Bộ của tôi', src: x.src || '',
      }));

    save();
    refreshAll();
    bx.value = '';
    bx.hidden = true;
    $('bmsg').textContent = `Đã khôi phục ${cards.length} cụm từ và ${listen.length} câu nghe.`;
  } catch (err) {
    $('bmsg').textContent = 'Bản sao lưu không hợp lệ.';
  }
};


/* === 10. IELTS ============================================= */

// Đổi số giây thành "m:ss" cho đồng hồ, vd 90 -> "1:30"
function fmtClock(sec) {
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

// --- Speaking ---
let speakQ = { question: '', points: [] }; // câu hỏi đang hiện
let speakTimer = null;

function newSpeakQuestion() {
  clearInterval(speakTimer);
  speakTimer = null;
  $('sstart').textContent = 'Bắt đầu';

  const part = $('spart').value;
  const item = randomItem(IELTS_DATA.speaking[part]);
  // Part 1, 3 là chữ; Part 2 là object { question, points }
  speakQ = typeof item === 'string' ? { question: item, points: [] } : item;

  let html = esc(speakQ.question);
  if (speakQ.points.length) {
    html += '<ul><li>You should say: ' + speakQ.points.map(esc).join('</li><li>') + '</li></ul>';
  }
  $('sq').innerHTML = html;
  $('stime').textContent = part === '1' ? '0:30' : '1:00';
  $('sphase').textContent = 'Bấm "Bắt đầu" để tính giờ.';
}

// Đếm ngược sec giây, hiện label, hết giờ thì gọi then()
function countdown(sec, label, then) {
  let left = sec;
  $('stime').textContent = fmtClock(left);
  $('sphase').textContent = label;
  speakTimer = setInterval(() => {
    left--;
    $('stime').textContent = fmtClock(Math.max(left, 0));
    if (left <= 0) {
      clearInterval(speakTimer);
      speakTimer = null;
      then();
    }
  }, 1000);
}

$('sstart').onclick = () => {
  // Đang chạy thì bấm để dừng
  if (speakTimer) {
    clearInterval(speakTimer);
    speakTimer = null;
    $('sstart').textContent = 'Bắt đầu';
    $('sphase').textContent = 'Đã dừng.';
    return;
  }

  $('sstart').textContent = 'Dừng';
  stats.speak++;
  save();
  markDay();

  const done = () => {
    $('sphase').textContent = 'Hết giờ! Thử lại hoặc chọn câu khác.';
    $('sstart').textContent = 'Bắt đầu';
  };
  const part = $('spart').value;
  if (part === '1') countdown(30, 'Trả lời 2–3 câu (30 giây)', done);
  else if (part === '2') countdown(60, 'Chuẩn bị: ghi chú ý chính (1 phút)', () => countdown(120, 'Nói liên tục (tối đa 2 phút)', done));
  else countdown(60, 'Trả lời và giải thích (1 phút)', done);
};
$('snew').onclick = newSpeakQuestion;
$('spart').onchange = newSpeakQuestion;
$('ssay').onclick = () => say(speakQ.question);

// --- Writing Task 2 ---
let writeIndex = store.get('wi', 0); // đề đang làm
let writeTimer = null;

// Bài nháp lưu theo từng đề: khóa eng_draft0, eng_draft1, ...
function draftKey() {
  return 'draft' + (writeIndex % IELTS_DATA.writing.length);
}

function showWriting() {
  $('wq').textContent = IELTS_DATA.writing[writeIndex % IELTS_DATA.writing.length];
  $('wtext').value = store.get(draftKey(), '');
  countWords();
}

function countWords() {
  const n = ($('wtext').value.match(/[A-Za-z0-9'’-]+/g) || []).length;
  $('wc').textContent = n;
  $('wc').style.color = n >= 250 ? 'var(--ok)' : ''; // đủ 250 từ thì chuyển xanh
}

$('wtext').oninput = () => {
  countWords();
  store.set(draftKey(), $('wtext').value);
};
$('wnew').onclick = () => {
  writeIndex++;
  store.set('wi', writeIndex);
  showWriting();
};
$('wstart').onclick = () => {
  if (writeTimer) {
    clearInterval(writeTimer);
    writeTimer = null;
    $('wstart').textContent = 'Bắt đầu 40 phút';
    return;
  }
  let left = 40 * 60;
  $('wstart').textContent = 'Dừng';
  markDay();
  writeTimer = setInterval(() => {
    left--;
    $('wtime').textContent = fmtClock(left);
    if (left <= 0) {
      clearInterval(writeTimer);
      writeTimer = null;
      $('wtime').textContent = 'Hết giờ';
      $('wstart').textContent = 'Bắt đầu 40 phút';
    }
  }, 1000);
};

$('bank').innerHTML = IELTS_DATA.usefulPhrases.map(p => `<li>${esc(p)}</li>`).join('');


/* === 11. TRANG CHỦ ========================================= */
// Trang mở ra đầu tiên: lời chào, chuỗi ngày, mục tiêu hôm nay, biểu đồ 7 ngày,
// lịch 12 tuần, "vườn" cụm từ theo mức nhớ, huy hiệu và tổng kết.

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']; // theo getDay(): 0 = Chủ nhật

// Số lượt của một ngày: { cards, listen }
function dayTotals(key) {
  const entry = stats.log[key];
  return { cards: entry ? entry.cards : 0, listen: entry ? entry.listen : 0 };
}

// Thứ Hai của tuần chứa ngày d
function mondayOf(d) {
  return addDays(d, -((d.getDay() + 6) % 7));
}

// "23/11"
function shortDate(d) {
  return d.getDate() + '/' + (d.getMonth() + 1);
}

function dueCount() {
  const now = Date.now();
  return cards.filter(c => c.due <= now).length;
}

function drawHome() {
  drawHello();
  drawStreakCard();
  drawGoals();
  drawHomeActions();
  drawWeekChart();
  drawHeatmap();
  drawGarden();
  drawBadges();
  drawTotals();
}

// --- Lời chào và câu động viên ---
function drawHello() {
  const hour = new Date().getHours();
  const part = hour < 11 ? 'buổi sáng' : hour < 13 ? 'buổi trưa' : hour < 18 ? 'buổi chiều' : 'buổi tối';
  $('hHello').textContent = `Chào ${part}! 👋`;

  const dateText = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric',
  });
  $('hDate').textContent = dateText.charAt(0).toUpperCase() + dateText.slice(1);

  const t = dayTotals(today());
  const goalDone = t.cards >= goals.cards && t.listen >= goals.listen;
  const streak = currentStreak();
  const due = dueCount();
  let line;
  if (goalDone) line = '🌟 Bạn đã hoàn thành mục tiêu hôm nay. Tuyệt vời!';
  else if (!studiedToday() && streak > 0) line = `🔥 Học một chút hôm nay để giữ chuỗi ${streak} ngày nhé!`;
  else if (due) line = `Bạn có ${due} thẻ đang chờ ôn. Bắt đầu thôi!`;
  else line = 'Hôm nay không còn thẻ đến hạn – thử luyện nghe vài câu nhé!';
  $('hLine').textContent = line;
}

// --- Ô chuỗi ngày: số to, 7 chấm của tuần này, kỷ lục, mốc tiếp theo ---
function drawStreakCard() {
  const n = currentStreak();
  const best = Math.max(bestStreak(), n);
  const days = new Set(stats.days);
  const todayKey = today();
  const monday = mondayOf(new Date());

  const dots = [0, 1, 2, 3, 4, 5, 6].map(i => {
    const d = addDays(monday, i);
    const key = dateKey(d);
    const cls = [
      days.has(key) ? 'on' : '',
      key === todayKey ? 'today' : '',
      key > todayKey ? 'future' : '',
    ].join(' ');
    return `<div class="dot ${cls}" title="${WEEKDAYS[d.getDay()]} ${shortDate(d)}${days.has(key) ? ': có học' : ''}">` +
           `<i>${days.has(key) ? '✓' : ''}</i><span>${WEEKDAYS[d.getDay()]}</span></div>`;
  }).join('');

  const next = STREAK_MILESTONES.find(m => m > n);
  const nextText = next ? `Còn ${next - n} ngày nữa tới mốc ${next} ngày` : 'Bạn đã vượt mọi mốc!';

  $('hStreak').innerHTML =
    `<div class="streak-big">` +
      `<span class="flame${studiedToday() ? '' : ' cold'}" aria-hidden="true">🔥</span>` +
      `<div><b>${n}</b><span>ngày liên tiếp</span></div>` +
    `</div>` +
    `<div class="week-dots" aria-label="Các ngày đã học trong tuần này">${dots}</div>` +
    `<p class="streak-note">🏆 Kỷ lục: <b>${best} ngày</b> · ${nextText}</p>`;
}

// --- Mục tiêu hôm nay: hai vòng tròn tiến độ ---
function ring(value, goal, label, colorVar) {
  const R = 34;
  const length = 2 * Math.PI * R;
  const pct = Math.min(1, value / goal);
  const done = value >= goal;
  return `<div class="ring${done ? ' done' : ''}">` +
    `<svg viewBox="0 0 80 80" aria-hidden="true">` +
      `<circle class="track" cx="40" cy="40" r="${R}"/>` +
      `<circle class="fill" cx="40" cy="40" r="${R}" ` +
        `style="stroke: var(${colorVar}); stroke-dasharray: ${length}; stroke-dashoffset: ${length * (1 - pct)}"/>` +
    `</svg>` +
    `<div class="ring-num"><b>${value}</b><span>/ ${goal}</span></div>` +
    `<div class="ring-label">${done ? '✓ ' : ''}${label}</div>` +
  `</div>`;
}

function drawGoals() {
  const t = dayTotals(today());
  $('hRings').innerHTML =
    ring(t.cards, goals.cards, 'Ôn thẻ', '--btn') +
    ring(t.listen, goals.listen, 'Chép chính tả', '--good');
}

// Sửa mục tiêu
$('goalEdit').onclick = () => {
  const form = $('goalForm');
  form.hidden = !form.hidden;
  form.elements.cards.value = goals.cards;
  form.elements.listen.value = goals.listen;
  if (!form.hidden) form.elements.cards.focus();
};
$('goalForm').onsubmit = e => {
  e.preventDefault();
  const form = $('goalForm');
  // Giới hạn 1–500 cho hợp lý
  const clamp = v => Math.min(500, Math.max(1, Math.round(Number(v)) || 1));
  goals = { cards: clamp(form.elements.cards.value), listen: clamp(form.elements.listen.value) };
  store.set('goals', goals);
  store.set('goals_u', Date.now()); // thời điểm sửa, dùng khi đồng bộ
  if (typeof onDataSaved === 'function') onDataSaved();
  form.hidden = true;
  drawHome();
};

// --- Nút lớn: đi học ngay ---
function drawHomeActions() {
  const due = dueCount();
  $('hActions').innerHTML =
    `<a class="big-btn pri" href="#cum-tu">🃏 ${due ? `Ôn ${due} thẻ đến hạn` : 'Ôn cụm từ'} →</a>` +
    `<a class="big-btn good" href="#luyen-nghe">🎧 Luyện nghe →</a>` +
    `<a class="big-btn" href="#nhap-cum-tu">✏️ Thêm cụm từ</a>`;
}

// --- Biểu đồ cột 7 ngày gần nhất ---
function drawWeekChart() {
  const todayKey = today();
  const data = [-6, -5, -4, -3, -2, -1, 0].map(i => {
    const d = addDays(new Date(), i);
    const key = dateKey(d);
    return { d, key, ...dayTotals(key), studied: stats.days.includes(key) };
  });
  const max = Math.max(1, ...data.map(x => Math.max(x.cards, x.listen)));

  $('hWeek').innerHTML = data.map(x => {
    const label = x.key === todayKey ? 'Nay' : WEEKDAYS[x.d.getDay()];
    const total = x.cards + x.listen;
    // Ngày có học nhưng trước khi bắt đầu ghi số lượt: hiện dấu ✓
    const top = total ? total : (x.studied ? '✓' : '');
    return `<div class="wc-day${x.key === todayKey ? ' today' : ''}" ` +
             `title="${WEEKDAYS[x.d.getDay()]} ${shortDate(x.d)}: ${x.cards} thẻ, ${x.listen} câu nghe">` +
           `<span class="wc-num">${top}</span>` +
           `<div class="wc-bars">` +
             `<i class="c" style="height: ${x.cards / max * 100}%"></i>` +
             `<i class="l" style="height: ${x.listen / max * 100}%"></i>` +
           `</div>` +
           `<span class="wc-label">${label}</span></div>`;
  }).join('');
}

// --- Lịch 12 tuần: mỗi ô là một ngày, càng học nhiều màu càng đậm ---
function heatLevel(key) {
  const t = dayTotals(key);
  const total = t.cards + t.listen;
  if (!total) return stats.days.includes(key) ? 1 : 0; // ngày cũ chỉ biết "có học"
  if (total < 10) return 1;
  if (total < 25) return 2;
  if (total < 50) return 3;
  return 4;
}

function drawHeatmap() {
  const WEEKS = 12;
  const todayKey = today();
  const start = addDays(mondayOf(new Date()), -7 * (WEEKS - 1));
  let cells = '';
  let studied = 0;
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = addDays(start, i);
    const key = dateKey(d);
    if (key > todayKey) {
      cells += '<i class="future"></i>';
      continue;
    }
    const level = heatLevel(key);
    if (level) studied++;
    const t = dayTotals(key);
    cells += `<i class="h${level}${key === todayKey ? ' today' : ''}" ` +
             `title="${WEEKDAYS[d.getDay()]} ${shortDate(d)}: ${t.cards} thẻ, ${t.listen} câu nghe"></i>`;
  }
  $('hHeat').innerHTML = cells;
  $('hHeatNote').textContent = `Đã học ${studied} ngày trong 12 tuần qua`;
}

// --- Vườn cụm từ: thanh xếp chồng theo 5 mức nhớ ---
function drawGarden() {
  const total = cards.length;
  const counts = [1, 2, 3, 4, 5].map(box => cards.filter(c => c.box === box).length);
  $('hGarden').innerHTML = total
    ? counts.map((n, i) => n
        ? `<i class="lv${i + 1}" style="width: ${n / total * 100}%" title="${levelLabel(i + 1)}: ${n}"></i>`
        : '').join('')
    : '<span class="warn">Chưa có cụm từ nào.</span>';
  $('hGardenLegend').innerHTML = counts.map((n, i) =>
    `<span><i class="lv${i + 1}"></i>${LEVELS[i + 1].icon} ${LEVELS[i + 1].name} <b>${n}</b></span>`
  ).join('');
  const bloomed = counts[4];
  $('hGardenNote').textContent = total
    ? `${bloomed} / ${total} cụm từ đã nở hoa (${Math.round(bloomed / total * 100)}%)`
    : '';
}

// --- Huy hiệu ---
// value: hàm tính giá trị hiện tại; goal: cần đạt bao nhiêu
const BADGES = [
  { icon: '🔥', name: 'Khởi động',         desc: 'Chuỗi 3 ngày',          goal: 3,   value: () => bestStreak() },
  { icon: '📅', name: 'Một tuần bền bỉ',   desc: 'Chuỗi 7 ngày',          goal: 7,   value: () => bestStreak() },
  { icon: '🏆', name: 'Một tháng kiên trì', desc: 'Chuỗi 30 ngày',        goal: 30,  value: () => bestStreak() },
  { icon: '👑', name: 'Trăm ngày',         desc: 'Chuỗi 100 ngày',        goal: 100, value: () => bestStreak() },
  { icon: '🌸', name: 'Bông hoa đầu tiên', desc: '1 cụm từ nở hoa',       goal: 1,   value: () => cards.filter(c => c.box === 5).length },
  { icon: '💐', name: 'Bó hoa',            desc: '25 cụm từ nở hoa',      goal: 25,  value: () => cards.filter(c => c.box === 5).length },
  { icon: '🃏', name: 'Chăm ôn',           desc: 'Ôn 100 lượt thẻ',       goal: 100, value: () => stats.reviews },
  { icon: '🎧', name: 'Đôi tai tinh',      desc: '10 câu chép đúng 100%', goal: 10,  value: () => stats.listenOk },
];

function drawBadges() {
  $('hBadges').innerHTML = BADGES.map(b => {
    const v = Math.min(b.value(), b.goal);
    const got = v >= b.goal;
    return `<div class="badge${got ? ' got' : ''}" title="${b.desc}${got ? ' – đã đạt!' : ''}">` +
           `<span class="b-icon" aria-hidden="true">${b.icon}</span>` +
           `<b>${b.name}</b><small>${b.desc}</small>` +
           (got ? '<span class="b-state">✓ Đã đạt</span>'
                : `<span class="b-state">${v} / ${b.goal}</span>`) +
           '</div>';
  }).join('');
}

// --- Tổng kết ---
function drawTotals() {
  const item = (label, value) => `<div><b>${value}</b><span>${label}</span></div>`;
  $('hTotals').innerHTML =
    item('Cụm từ', cards.length) +
    item('Câu nghe', listen.length) +
    item('Lượt ôn thẻ', stats.reviews) +
    item('Lượt chép chính tả', stats.listen) +
    item('Chép đúng 100%', stats.listenOk) +
    item('Ngày đã học', stats.days.length);
}

// Đặt lại tiến độ (bấm hai lần): mọi thẻ về Hạt mầm, xóa thống kê và lịch sử, giữ nguyên dữ liệu học
let resetArmed = false;
$('reset').onclick = () => {
  if (!resetArmed) {
    resetArmed = true;
    $('rmsg').textContent = 'Bấm lần nữa để xác nhận. Lịch sử học và chuỗi ngày cũng sẽ bị xóa.';
    $('reset').classList.add('red');
    return;
  }
  resetArmed = false;
  $('reset').classList.remove('red');
  cards.forEach(c => { c.box = 1; c.due = 0; });
  stats = emptyStats();
  stats.resetAt = Date.now(); // để khi đồng bộ, máy khác cũng đặt lại theo
  save();
  nextCard();
  drawHome();
  showStreak();
  $('rmsg').textContent = 'Đã đặt lại tiến độ.';
};

// Vẽ lại mọi thứ sau khi dữ liệu thay đổi
function refreshAll() {
  fillSelect($('topic'), cards);
  fillSelect($('lset'), listen);
  nextCard();
  showListen();
  drawSets();
  drawAudioList();
  drawImageList();
  fillForms();
  drawHome();
  drawImportCounts();
}


/* === 12. GIAO DIỆN SÁNG / TỐI ============================== */
// Sáng = "Bình minh", Tối = "Hoàng hôn". Lựa chọn lưu ở khóa eng_theme.

const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

// Đang ở chế độ tối không? (đã chọn bằng nút, hoặc theo cài đặt máy)
function isDark() {
  const chosen = document.documentElement.dataset.theme;
  if (chosen) return chosen === 'dark';
  try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (err) { return false; }
}

// Nút hiện chế độ sẽ chuyển sang
function drawThemeButton() {
  const dark = isDark();
  // Chữ đặt trong <span class="tlabel"> để màn hình hẹp có thể ẩn đi, chỉ còn biểu tượng
  $('theme').innerHTML = dark ? ICON_SUN + '<span class="tlabel">Sáng</span>' : ICON_MOON + '<span class="tlabel">Tối</span>';
  $('theme').setAttribute('aria-label', dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
}

const savedTheme = store.get('theme', null);
if (savedTheme) document.documentElement.dataset.theme = savedTheme;

$('theme').onclick = () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store.set('theme', next);
  drawThemeButton();
};
try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawThemeButton);
} catch (err) { /* bỏ qua */ }


/* === 13. CHUYỂN TAB VÀ KHỞI ĐỘNG ============================ */
// Mỗi tab ứng với một phần sau dấu # trên địa chỉ, vd index.html#luyen-nghe

// IELTS tạm ẩn. Đổi thành true để bật lại tab IELTS (code và đề vẫn còn nguyên).
const SHOW_IELTS = false;

const VIEWS = ['trang-chu', 'cum-tu', 'luyen-nghe', 'nhap-du-lieu'];
if (SHOW_IELTS) VIEWS.push('ielts');
document.querySelector('nav a[href="#ielts"]').hidden = !SHOW_IELTS;

// Hai màn con của tab Nhập dữ liệu: địa chỉ → loại dữ liệu ('p' cụm từ, 'l' bài nghe)
const IMPORT_SCREENS = { 'nhap-cum-tu': 'p', 'nhap-bai-nghe': 'l' };

function route() {
  const hash = location.hash.slice(1);
  let view = VIEWS.includes(hash) ? hash : 'trang-chu'; // địa chỉ lạ (vd #tien-do cũ) -> Trang chủ
  if (IMPORT_SCREENS[hash]) view = 'nhap-du-lieu';       // màn con vẫn thuộc tab Nhập dữ liệu
  document.querySelectorAll('main > section').forEach(s => s.classList.toggle('on', s.id === view));
  document.querySelectorAll('nav a').forEach(a => {
    a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + view);
  });
  if (view === 'trang-chu') drawHome();
  if (view === 'nhap-du-lieu') {
    showImportScreen(IMPORT_SCREENS[hash] || '');
    drawSets();
  }
}
addEventListener('hashchange', route);

drawThemeButton();
showImportMode();
refreshAll();
loadAudioList();
loadImageList();
newSpeakQuestion();
showWriting();
showStreak();
route();
