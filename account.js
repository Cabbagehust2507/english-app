/* =========================================================
   account.js – tài khoản (Supabase): đăng ký, đăng nhập, quên mật khẩu, đăng xuất

   Đồng bộ dữ liệu nằm ở sync.js.
   Dùng:
   - SUPABASE_CONFIG trong config.js
   - thư viện supabase (nạp từ CDN trong index.html)
   - các hàm $, esc của app.js và syncNow, setSyncState… của sync.js
     (file này nạp SAU app.js và sync.js)
   ========================================================= */

let sb = null;          // "client" để nói chuyện với Supabase; null nếu không dùng được
let sbUser = null;      // người đang đăng nhập (null = chưa đăng nhập)
let accountProblem = ''; // vì sao chưa dùng được tài khoản: 'config' | 'library' | ''
let accountView = 'login'; // màn hình đang hiện trong hộp tài khoản
let justLoggedIn = false;  // true = vừa bấm "Đăng nhập" (để báo kết quả đồng bộ đầu tiên)

// Địa chỉ trang hiện tại (bỏ phần #…), dùng làm nơi quay về sau khi bấm link trong email.
// Mở bằng file:// thì không quay về được nên trả về null.
function returnUrl() {
  return /^https?:/.test(location.protocol) ? location.href.split('#')[0] : null;
}

// --- Mở web từ link trong email (xác nhận đăng ký) ---
// Bấm link xác nhận trong email → Supabase chuyển về web với địa chỉ dạng
//   …/index.html#access_token=…&type=signup          (thành công)
//   …/index.html#error=…&error_code=otp_expired&…     (link hết hạn / đã dùng)
// Phải đọc NGAY lúc mở trang, vì Supabase sẽ xóa phần này khỏi địa chỉ.
const EMAIL_LINK_TYPES = ['signup', 'email', 'invite', 'magiclink', 'email_change'];

function readEmailLink() {
  const params = new URLSearchParams(location.hash.slice(1) + '&' + location.search.slice(1));
  if (params.get('error_code') || params.get('error_description')) {
    return { ok: false, code: params.get('error_code') || '' };
  }
  if (params.get('access_token') && EMAIL_LINK_TYPES.includes(params.get('type'))) {
    return { ok: true };
  }
  return null; // không phải mở từ link trong email
}
let emailLink = readEmailLink();

// Dọn địa chỉ cho gọn (bỏ phần mã dài), để ở Trang chủ
function cleanAddress() {
  history.replaceState(null, '', location.pathname + '#trang-chu');
}

// --- Khởi động ---
function setupAccount() {
  const cfg = typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG : null;
  if (!cfg || !cfg.url.trim() || !cfg.key.trim()) {
    accountProblem = 'config';
  } else if (typeof supabase === 'undefined') {
    accountProblem = 'library'; // thường là do đang không có mạng
  } else {
    try {
      sb = supabase.createClient(cfg.url.trim(), cfg.key.trim());
    } catch (err) {
      accountProblem = 'config';
    }
  }
  drawAccountButton();
  if (!sb) return;

  // Link trong email bị lỗi (hết hạn / đã dùng): báo ngay
  if (emailLink && !emailLink.ok) {
    cleanAddress();
    openAccount('linkerror');
    emailLink = null;
  }

  // Supabase báo mỗi khi trạng thái đăng nhập thay đổi
  sb.auth.onAuthStateChange((event, session) => {
    sbUser = session ? session.user : null;
    drawAccountButton();
    // Vừa mở trang (đã đăng nhập từ trước) hoặc vừa đăng nhập: đồng bộ.
    // Dùng setTimeout vì không nên gọi Supabase ngay bên trong hàm này.
    if (sbUser && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) setTimeout(syncAfterLogin, 0);
    if (event === 'SIGNED_OUT') setSyncState('off');
    // Vừa bấm link xác nhận trong email và Supabase đã đăng nhập sẵn: báo thành công
    if (emailLink && emailLink.ok && sbUser) {
      emailLink = null;
      cleanAddress();
      setTimeout(() => openAccount('confirmed'), 0);
      return;
    }
    // Có link xác nhận nhưng Supabase không đăng nhập được bằng nó (mã sai / hết hạn)
    if (emailLink && event === 'INITIAL_SESSION' && !sbUser) {
      emailLink = null;
      cleanAddress();
      setTimeout(() => openAccount('linkerror'), 0);
    }
    if (event === 'PASSWORD_RECOVERY') {
      // Vừa mở link "đặt lại mật khẩu" trong email
      openAccount('newpass');
    } else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      if ($('account').open && accountView !== 'newpass' && accountView !== 'firstsync') {
        accountView = sbUser ? 'me' : 'login';
        drawAccountDialog();
      }
    }
  });
}

// Đồng bộ ngay khi mở trang / vừa đăng nhập.
// Nếu là lần vừa bấm "Đăng nhập" thì báo kết quả bằng thông báo nổi.
async function syncAfterLogin() {
  const ok = await syncNow();
  if (!justLoggedIn) return;
  justLoggedIn = false;
  if (ok) {
    showToast('☁️ Đã đồng bộ', 'Dữ liệu học trên máy này và tài khoản đã khớp nhau.');
  } else if (syncState === 'error' || syncState === 'offline') {
    showToast('⚠️ Chưa đồng bộ được', syncError || 'Máy đang không có mạng. Có mạng lại web sẽ tự đồng bộ.');
  }
  // syncState === 'waiting': hộp "Gộp dữ liệu" đang hiện để bạn chọn, không cần báo thêm
}

// --- Nút ở đầu trang ---
function drawAccountButton() {
  const btn = $('userbtn');
  let label = 'Đăng nhập';
  if (sbUser) label = sbUser.email.split('@')[0];
  btn.innerHTML = `<span aria-hidden="true">👤</span><span class="tlabel">${esc(label)}</span>`;
  btn.title = sbUser ? 'Tài khoản: ' + sbUser.email : 'Đăng nhập / đăng ký';
  btn.classList.toggle('signed', Boolean(sbUser));
}
$('userbtn').onclick = () => openAccount();

// --- Hộp tài khoản ---
function openAccount(view) {
  if (accountProblem) accountView = 'problem';
  else accountView = view || (sbUser ? 'me' : 'login');
  drawAccountDialog();
  if (!$('account').open) $('account').showModal();
}

function closeAccount() {
  $('account').close();
}

// Vẽ nội dung hộp theo màn hình đang chọn
function drawAccountDialog() {
  const views = {
    problem: viewProblem,
    login: viewLogin,
    signup: viewSignup,
    forgot: viewForgot,
    newpass: viewNewPass,
    me: viewMe,
    firstsync: viewFirstSync,
    confirmed: viewConfirmed,
    linkerror: viewLinkError,
  };
  $('accBody').innerHTML = views[accountView]();
  const first = $('accBody').querySelector('input');
  if (first) first.focus();
}

// Các link nhỏ để chuyển màn hình, vd "Chưa có tài khoản? Đăng ký"
function switchLink(view, text) {
  return `<button type="button" class="link-btn" data-view="${view}">${text}</button>`;
}

function viewProblem() {
  if (accountProblem === 'library') {
    return '<h3>Chưa dùng được tài khoản</h3>' +
      '<p>Không tải được thư viện Supabase. Có thể máy đang không có mạng.</p>' +
      '<p class="warn">Bạn vẫn học bình thường, dữ liệu lưu trên máy này. Có mạng lại thì tải lại trang.</p>';
  }
  return '<h3>Chưa cấu hình tài khoản</h3>' +
    '<p>Để dùng tài khoản, cần tạo dự án Supabase rồi dán địa chỉ và khóa vào file <code>config.js</code>.</p>' +
    '<p>Làm theo hướng dẫn trong file <code>docs/huong-dan-supabase.md</code> (khoảng 10 phút).</p>' +
    '<p class="warn">Trong lúc chưa cấu hình, web vẫn chạy bình thường và lưu dữ liệu trên máy này.</p>';
}

function viewLogin() {
  return '<h3>Đăng nhập</h3>' +
    '<form data-action="login">' +
      '<label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>' +
      '<label class="field"><span>Mật khẩu</span><input name="password" type="password" autocomplete="current-password" required></label>' +
      '<button class="pri" type="submit">Đăng nhập</button>' +
      '<p class="form-msg" aria-live="polite"></p>' +
    '</form>' +
    '<div class="acc-links">' + switchLink('signup', 'Chưa có tài khoản? Đăng ký') + switchLink('forgot', 'Quên mật khẩu?') + '</div>';
}

function viewSignup() {
  return '<h3>Tạo tài khoản</h3>' +
    '<form data-action="signup">' +
      '<label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>' +
      '<label class="field"><span>Mật khẩu (ít nhất 8 ký tự)</span><input name="password" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<label class="field"><span>Nhập lại mật khẩu</span><input name="password2" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<button class="pri" type="submit">Đăng ký</button>' +
      '<p class="form-msg" aria-live="polite"></p>' +
    '</form>' +
    '<div class="acc-links">' + switchLink('login', 'Đã có tài khoản? Đăng nhập') + '</div>';
}

function viewForgot() {
  const note = returnUrl()
    ? ''
    : '<p class="warn">Lưu ý: bạn đang mở web bằng file trên máy, nên link trong email chưa đưa bạn về đúng trang được. ' +
      'Tính năng này dùng tốt sau khi đưa web lên mạng (bước 8d).</p>';
  return '<h3>Quên mật khẩu</h3>' +
    '<p>Nhập email của bạn, Supabase sẽ gửi link để đặt mật khẩu mới.</p>' + note +
    '<form data-action="forgot">' +
      '<label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>' +
      '<button class="pri" type="submit">Gửi email</button>' +
      '<p class="form-msg" aria-live="polite"></p>' +
    '</form>' +
    '<div class="acc-links">' + switchLink('login', '← Quay lại đăng nhập') + '</div>';
}

function viewNewPass() {
  return '<h3>Đặt mật khẩu mới</h3>' +
    '<form data-action="newpass">' +
      '<label class="field"><span>Mật khẩu mới (ít nhất 8 ký tự)</span><input name="password" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<label class="field"><span>Nhập lại mật khẩu mới</span><input name="password2" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<button class="pri" type="submit">Lưu mật khẩu</button>' +
      '<p class="form-msg" aria-live="polite"></p>' +
    '</form>' +
    (sbUser ? '<div class="acc-links">' + switchLink('me', '← Quay lại') + '</div>' : '');
}

function viewMe() {
  return '<h3>Tài khoản</h3>' +
    `<p>Đang đăng nhập: <b>${esc(sbUser.email)}</b></p>` +
    `<p class="acc-sync" id="accSync">${syncStatusHtml()}</p>` +
    '<p class="warn">Cụm từ, bài nghe, tiến độ và mục tiêu được đồng bộ giữa các máy. ' +
    'Ảnh và tệp âm thanh chưa được đồng bộ (bước 8c).</p>' +
    '<div class="row mt">' +
      '<button type="button" class="pri" data-action-btn="sync">🔄 Đồng bộ ngay</button>' +
      '<button type="button" data-view="newpass">Đổi mật khẩu</button>' +
    '</div>' +
    '<div class="acc-logout">' +
      '<label class="check"><input type="checkbox" id="accWipe"> ' +
        'Xóa dữ liệu học trên máy này khi đăng xuất (dùng khi mượn máy người khác)</label>' +
      '<button type="button" class="again" data-action-btn="logout">Đăng xuất</button>' +
    '</div>' +
    '<p class="form-msg" aria-live="polite"></p>';
}

// Mở web từ link xác nhận trong email: thành công
function viewConfirmed() {
  return '<div class="acc-done">' +
      '<div class="acc-done-icon" aria-hidden="true">🎉</div>' +
      '<h3>Xác nhận email thành công!</h3>' +
      `<p>Tài khoản <b>${esc(sbUser.email)}</b> đã sẵn sàng và bạn đã được đăng nhập.</p>` +
      '<p class="warn">Dữ liệu học trên máy này sẽ tự đồng bộ lên tài khoản.</p>' +
      '<button type="button" class="pri" data-action-btn="close">Bắt đầu học →</button>' +
    '</div>';
}

// Mở web từ link trong email nhưng link không dùng được
function viewLinkError() {
  return '<h3>Link trong email không dùng được</h3>' +
    '<p>Link này đã <b>hết hạn</b> hoặc <b>đã được bấm trước đó</b>.</p>' +
    '<p class="msg-block alert"><span class="alert-icon" aria-hidden="true">⚠️</span>' +
      '<span>Nếu bạn đã từng bấm link này rồi thì email <b>đã được xác nhận</b>. ' +
      'Cứ đăng nhập bình thường.</span></p>' +
    '<div class="row mt"><button type="button" class="pri" data-view="login">Đăng nhập</button></div>' +
    '<p class="warn">Đăng nhập báo "Email chưa được xác nhận"? Hãy đăng ký lại bằng email đó để nhận link mới.</p>';
}

// Lần đầu đồng bộ máy này mà cả máy lẫn tài khoản đều có dữ liệu: hỏi cách gộp
function viewFirstSync() {
  const remote = (firstSyncRemote && firstSyncRemote.data) || {};
  const rc = (remote.cards || []).length;
  const rl = (remote.listen || []).length;
  return '<h3>Gộp dữ liệu</h3>' +
    '<p>Tài khoản và máy này đều đã có dữ liệu học. Bạn muốn làm thế nào?</p>' +
    `<p class="warn">Trên tài khoản: ${rc} cụm từ, ${rl} câu nghe · Trên máy này: ${cards.length} cụm từ, ${listen.length} câu nghe</p>` +
    '<div class="choice-list">' +
      '<button type="button" class="pri" data-sync="both"><b>Gộp cả hai</b><small>Giữ hết, mục trùng chỉ giữ một (nên chọn)</small></button>' +
      '<button type="button" data-sync="remote"><b>Dùng dữ liệu trên tài khoản</b><small>Bỏ dữ liệu đang có trên máy này</small></button>' +
      '<button type="button" data-sync="local"><b>Dùng dữ liệu máy này</b><small>Thay dữ liệu trên tài khoản bằng máy này</small></button>' +
    '</div>';
}

// --- Bấm nút / gửi form trong hộp ---
$('accBody').addEventListener('click', e => {
  const link = e.target.closest('[data-view]');
  if (link) {
    accountView = link.dataset.view;
    drawAccountDialog();
    return;
  }
  const choice = e.target.closest('[data-sync]');
  if (choice) {
    resolveFirstSync(choice.dataset.sync);
    return;
  }
  const btn = e.target.closest('[data-action-btn]');
  if (btn && btn.dataset.actionBtn === 'logout') logout(btn);
  if (btn && btn.dataset.actionBtn === 'sync') syncNow();
  if (btn && btn.dataset.actionBtn === 'close') closeAccount();
});

$('accBody').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const action = form.dataset.action;
  const button = form.querySelector('button[type="submit"]');
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = 'Đang xử lý…';
  try {
    await ACTIONS[action](form);
  } finally {
    // form có thể đã bị thay (vd đăng nhập xong chuyển màn hình), nên kiểm tra trước
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = oldText;
    }
  }
});

function accMsg(form, text, kind) {
  const el = form.querySelector('.form-msg');
  el.className = 'form-msg ' + (kind || '');
  el.textContent = text;
}

const ACTIONS = {
  async login(form) {
    // Bật cờ TRƯỚC khi gọi Supabase, vì sự kiện "đã đăng nhập" có thể đến sớm hơn kết quả
    justLoggedIn = true;
    const { error } = await sb.auth.signInWithPassword({
      email: form.elements.email.value.trim(),
      password: form.elements.password.value,
    });
    if (error) {
      justLoggedIn = false;
      accMsg(form, authError(error), 'bad');
      return;
    }
    // Thành công: đóng hộp, về Trang chủ. Việc đồng bộ do onAuthStateChange lo (syncAfterLogin).
    closeAccount();
    location.hash = 'trang-chu';
    showToast('✓ Đã đăng nhập', 'Đang đồng bộ dữ liệu học…');
  },

  async signup(form) {
    const password = form.elements.password.value;
    if (password !== form.elements.password2.value) {
      accMsg(form, 'Hai mật khẩu chưa giống nhau.', 'bad');
      return;
    }
    const options = returnUrl() ? { emailRedirectTo: returnUrl() } : {};
    const { data, error } = await sb.auth.signUp({
      email: form.elements.email.value.trim(),
      password,
      options,
    });
    if (error) {
      accMsg(form, authError(error), 'bad');
      return;
    }
    if (!data.session) {
      // Supabase đang bật "xác nhận email": phải bấm link trong thư trước khi đăng nhập
      // Hai khối tách riêng: báo thành công + khung cảnh báo ⚠️ cho dễ thấy
      const msg = form.querySelector('.form-msg');
      msg.className = 'form-msg';
      if (returnUrl()) {
        // Web đang chạy trên mạng: bấm link sẽ mở lại đúng trang này và báo thành công
        msg.innerHTML =
          '<span class="msg-block ok">✓ Đã tạo tài khoản. Hãy mở email Supabase vừa gửi và bấm link xác nhận.</span>' +
          '<span class="msg-block">Web sẽ tự mở lại, báo "Xác nhận email thành công" và đăng nhập luôn cho bạn.</span>';
        return;
      }
      // Mở bằng file trên máy: link trong email không quay về đây được nên có thể báo lỗi
      msg.innerHTML =
        '<span class="msg-block ok">✓ Đã tạo tài khoản. Hãy mở email Supabase vừa gửi, ' +
          'bấm link xác nhận, rồi quay lại đây đăng nhập.</span>' +
        '<span class="msg-block alert"><span class="alert-icon" aria-hidden="true">⚠️</span>' +
          '<span><b>Lưu ý:</b> bấm link xong mà thấy trang báo lỗi (vd "localhost refused to connect") ' +
          'thì <b>vẫn đăng ký thành công</b>. Cứ đóng trang đó và quay lại đây đăng nhập.</span></span>';
    }
  },

  async forgot(form) {
    const options = returnUrl() ? { redirectTo: returnUrl() } : {};
    const { error } = await sb.auth.resetPasswordForEmail(form.elements.email.value.trim(), options);
    if (error) accMsg(form, authError(error), 'bad');
    else accMsg(form, '✓ Đã gửi. Hãy mở email và bấm link để đặt mật khẩu mới.', 'ok');
  },

  async newpass(form) {
    const password = form.elements.password.value;
    if (password !== form.elements.password2.value) {
      accMsg(form, 'Hai mật khẩu chưa giống nhau.', 'bad');
      return;
    }
    const { error } = await sb.auth.updateUser({ password });
    if (error) accMsg(form, authError(error), 'bad');
    else accMsg(form, '✓ Đã đổi mật khẩu.', 'ok');
  },
};

// Các khóa dữ liệu học trên máy (xóa khi đăng xuất có chọn "Xóa dữ liệu học trên máy này").
// Giữ lại cài đặt riêng của máy như giao diện Sáng/Tối.
const LOCAL_DATA_KEYS = [
  'cards', 'listen', 'stats', 'deleted', 'goals', 'goals_u', 'celebrated',
  'lpos', 'wi', 'sync_user', 'sync_at',
];

async function logout(button) {
  const wipe = $('accWipe') && $('accWipe').checked;
  button.disabled = true;

  if (wipe) {
    // Đồng bộ lần cuối trước khi xóa, để không mất gì
    accMsg($('accBody'), 'Đang đồng bộ lần cuối…', '');
    const ok = await syncNow();
    if (!ok) {
      button.disabled = false;
      accMsg($('accBody'),
        'Chưa đồng bộ được nên chưa xóa dữ liệu trên máy (để tránh mất dữ liệu). Kiểm tra mạng rồi thử lại.', 'bad');
      return;
    }
  }

  const { error } = await sb.auth.signOut();
  button.disabled = false;
  if (error) {
    accMsg($('accBody'), authError(error), 'bad');
    return;
  }
  closeAccount();

  if (wipe) {
    LOCAL_DATA_KEYS.forEach(k => localStorage.removeItem('eng_' + k));
    // Bài nháp Writing: eng_draft0, eng_draft1, ...
    Object.keys(localStorage).filter(k => k.startsWith('eng_draft')).forEach(k => localStorage.removeItem(k));
    location.reload(); // mở lại trang với dữ liệu trống (bộ Mẫu)
  }
}

// Đổi lỗi của Supabase (tiếng Anh) thành câu dễ hiểu
function authError(error) {
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  if (code === 'invalid_credentials' || msg.includes('invalid login')) return 'Sai email hoặc mật khẩu.';
  if (code === 'email_not_confirmed' || msg.includes('not confirmed')) {
    return 'Email chưa được xác nhận. Hãy mở thư Supabase đã gửi và bấm link xác nhận.';
  }
  if (code === 'user_already_exists' || msg.includes('already registered')) return 'Email này đã có tài khoản. Hãy đăng nhập.';
  if (code === 'weak_password' || msg.includes('password should')) return 'Mật khẩu quá yếu. Hãy dùng ít nhất 8 ký tự, có cả chữ và số.';
  if (code === 'same_password') return 'Mật khẩu mới phải khác mật khẩu cũ.';
  if (code === 'signup_disabled' || msg.includes('signups not allowed')) return 'Dự án đã tắt đăng ký tài khoản mới.';
  if (code === 'email_address_invalid' || msg.includes('invalid format')) return 'Email không hợp lệ.';
  if (code.includes('rate_limit') || msg.includes('rate limit') || msg.includes('security purposes')) {
    return 'Bạn thao tác hơi nhanh. Chờ một lát rồi thử lại nhé.';
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Không kết nối được tới Supabase. Kiểm tra mạng, hoặc dự án Supabase có đang tạm dừng không.';
  }
  return 'Có lỗi: ' + error.message;
}

$('accClose').onclick = closeAccount;
// Bấm ra ngoài hộp (vùng tối) thì đóng
$('account').addEventListener('click', e => {
  if (e.target === $('account')) closeAccount();
});

setupAccount();
