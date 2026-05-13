/* ─────────────────────────────────────────
   Pillar — Dashboard App Logic
───────────────────────────────────────── */

let accountData = null;
let balanceVisible = true;
let spendChart = null;

const SPEND_COLORS = {
  transport: '#f9c74f', food: '#f3722c', travel: '#b5838d',
  health: '#4cc9f0', clothes: '#f72585', salary: '#ffd6a5', investments: '#90e0ef'
};

// ── Boot ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setGreeting();
  await loadAccount();
  setupToggleBalance();
  setupSideNav();
});

async function loadAccount() {
  try {
    const res = await fetch('/api/account');
    accountData = await res.json();
    renderAll();
  } catch (e) {
    showToast('Failed to load account data.', 'error');
  }
}

function renderAll() {
  if (!accountData) return;
  updateBalanceDisplay();
  renderCards();
  renderTransactions();
  renderInvestments();
  renderSpendingChart();
}

// ── Greeting ────────────────────────────────────────────────────
function setGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById('greeting');
  if (!el) return;
  if (h < 12) el.textContent = 'Good morning!';
  else if (h < 18) el.textContent = 'Good afternoon!';
  else el.textContent = 'Good evening!';
}

// ── Balance display ─────────────────────────────────────────────
function updateBalanceDisplay() {
  const el = document.getElementById('balanceDisplay');
  if (!el || !accountData) return;
  if (balanceVisible) {
    const formatted = '$' + accountData.balance.toLocaleString('en-US', { minimumFractionDigits: 2 });
    el.textContent = formatted;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

function setupToggleBalance() {
  const btn = document.getElementById('toggleBalance');
  if (!btn) return;
  btn.addEventListener('click', () => {
    balanceVisible = !balanceVisible;
    updateBalanceDisplay();
  });
}

// ── Cards ───────────────────────────────────────────────────────
function renderCards() {
  const wrap = document.getElementById('cardsScroll');
  if (!wrap || !accountData) return;
  wrap.innerHTML = '';
  accountData.cards.forEach((c, i) => {
    const cls = i === 0 ? 'dash-card-green' : 'dash-card-blue';
    const bal = '$' + c.balance.toLocaleString('en-US', { minimumFractionDigits: 2 });
    const frozen = c.frozen ? `<span class="frozen-badge">Frozen</span>` : '';
    wrap.innerHTML += `
      <div class="dash-card ${cls}" onclick="openModal('freeze')">
        <div class="dash-card-top">
          <span class="card-label">${c.type}</span>
          ${frozen}
        </div>
        <div class="card-bal">${bal}</div>
        <div class="card-footer">
          <span class="card-last4">•••• ${c.last4}</span>
          ${c.network === 'mastercard' ? mcLogo() : visaLogo()}
        </div>
      </div>`;
  });
}

function mcLogo() {
  return `<div style="display:flex;margin-left:auto">
    <div style="width:18px;height:18px;border-radius:50%;background:rgba(235,0,27,0.85);"></div>
    <div style="width:18px;height:18px;border-radius:50%;background:rgba(255,130,0,0.75);margin-left:-7px;"></div>
  </div>`;
}
function visaLogo() {
  return `<svg width="34" height="12" viewBox="0 0 50 16"><text x="0" y="13" font-size="14" fill="white" font-family="serif" font-weight="bold">VISA</text></svg>`;
}

// ── Transactions ────────────────────────────────────────────────
function renderTransactions() {
  const list = document.getElementById('txnList');
  if (!list || !accountData) return;
  list.innerHTML = accountData.transactions.map(t => {
    const neg = t.amount < 0;
    const amt = (neg ? '-$' : '+$') + Math.abs(t.amount).toFixed(2);
    return `
      <div class="txn-item">
        <div class="txn-logo">${t.logo}</div>
        <div>
          <div class="txn-name">${t.name}</div>
          <div class="txn-date">${t.date}</div>
        </div>
        <div class="txn-right">
          <div class="txn-amount ${neg ? 'neg' : 'pos'}">${amt}</div>
          <div class="txn-card4">•••• ${t.card}</div>
        </div>
      </div>`;
  }).join('');
}

// ── Investments ─────────────────────────────────────────────────
function renderInvestments() {
  const list = document.getElementById('investList');
  if (!list || !accountData) return;
  list.innerHTML = accountData.investments.map(inv => {
    const up = inv.change >= 0;
    return `
      <div class="invest-item">
        <div class="invest-left">
          <div class="invest-logo">${inv.ticker.slice(0,2)}</div>
          <div>
            <div class="invest-name">${inv.name}</div>
            <div class="invest-ticker">${inv.ticker}</div>
          </div>
        </div>
        <div class="invest-right">
          <div class="invest-val">$${inv.value.toFixed(2)}</div>
          <div class="invest-change ${up ? 'change-up' : 'change-down'}">${up ? '+' : ''}${inv.change}%</div>
        </div>
      </div>`;
  }).join('');
}

// ── Spending Donut ──────────────────────────────────────────────
function renderSpendingChart() {
  const ctx = document.getElementById('spendChart');
  const legend = document.getElementById('spendLegend');
  if (!ctx || !accountData) return;

  const s = accountData.spending;
  const labels = Object.keys(s);
  const values = labels.map(k => s[k]);
  const colors = labels.map(k => SPEND_COLORS[k] || '#888');
  const total = values.reduce((a, b) => a + b, 0);

  document.getElementById('donutTotal').textContent =
    '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2 });

  legend.innerHTML = labels.map((k, i) =>
    `<div class="legend-item">
      <span class="legend-dot" style="background:${colors[i]}"></span>
      <span>${k.charAt(0).toUpperCase() + k.slice(1)}</span>
    </div>`
  ).join('');

  if (spendChart) spendChart.destroy();
  spendChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#1a1a1c', hoverOffset: 6 }] },
    options: {
      cutout: '70%',
      plugins: { legend: { display: false }, tooltip: {
        callbacks: {
          label: (i) => ` $${i.parsed.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        }
      }},
      animation: { animateRotate: true, duration: 900 }
    }
  });
}

// ── Side nav (highlight only) ───────────────────────────────────
function setupSideNav() {
  document.querySelectorAll('.side-link').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.side-link').forEach(x => x.classList.remove('active'));
      a.classList.add('active');
    });
  });
}

// ══════════════════════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════════════════════
const overlay  = document.getElementById('modalOverlay');
const modalBox = document.getElementById('modalBox');
const modalTitle = document.getElementById('modalTitle');
const modalBody  = document.getElementById('modalBody');

function openModal(type) {
  const config = {
    send:    { title: 'Send Money',    fn: buildSendForm },
    receive: { title: 'Receive Money', fn: buildReceiveForm },
    topup:   { title: 'Top Up Card',   fn: buildTopupForm },
    freeze:  { title: 'Freeze / Unfreeze Card', fn: buildFreezeForm }
  };
  const c = config[type];
  if (!c) return;
  modalTitle.textContent = c.title;
  modalBody.innerHTML = '';
  c.fn();
  overlay.classList.add('open');
}

function closeModal() {
  overlay.classList.remove('open');
}

// ── SEND ────────────────────────────────────────────────────────
function buildSendForm() {
  modalBody.innerHTML = `
    <div class="m-form">
      <div>
        <label class="m-label">Recipient name or account</label>
        <input class="m-input" id="mSendTo" placeholder="e.g. Jane Doe" />
      </div>
      <div>
        <label class="m-label">Amount (USD)</label>
        <input class="m-input" id="mSendAmt" type="number" min="0.01" step="0.01" placeholder="0.00" />
      </div>
      <div>
        <label class="m-label">Note (optional)</label>
        <input class="m-input" id="mSendNote" placeholder="What's this for?" />
      </div>
      <button class="m-btn" id="mSendBtn" onclick="doSend()">Send</button>
    </div>`;
}

async function doSend() {
  const btn = document.getElementById('mSendBtn');
  const recipient = document.getElementById('mSendTo').value.trim();
  const amount    = document.getElementById('mSendAmt').value;
  const note      = document.getElementById('mSendNote').value.trim();

  if (!recipient || !amount) return showToast('Fill in all required fields.', 'error');
  btn.disabled = true; btn.textContent = 'Sending…';

  try {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, amount: parseFloat(amount), note })
    });
    const data = await res.json();
    if (data.success) {
      accountData.balance = data.newBalance;
      updateBalanceDisplay();
      renderTransactions(); // will refresh after next load
      closeModal();
      showToast(data.message, 'success');
      await loadAccount();
    } else {
      showToast(data.message, 'error');
      btn.disabled = false; btn.textContent = 'Send';
    }
  } catch {
    showToast('Network error. Try again.', 'error');
    btn.disabled = false; btn.textContent = 'Send';
  }
}

// ── RECEIVE ─────────────────────────────────────────────────────
function buildReceiveForm() {
  modalBody.innerHTML = `
    <div class="m-form">
      <div>
        <label class="m-label">Sender name or account</label>
        <input class="m-input" id="mRcvFrom" placeholder="e.g. John Smith" />
      </div>
      <div>
        <label class="m-label">Amount (USD)</label>
        <input class="m-input" id="mRcvAmt" type="number" min="0.01" step="0.01" placeholder="0.00" />
      </div>
      <button class="m-btn" id="mRcvBtn" onclick="doReceive()">Confirm Receive</button>
    </div>`;
}

async function doReceive() {
  const btn = document.getElementById('mRcvBtn');
  const sender = document.getElementById('mRcvFrom').value.trim();
  const amount = document.getElementById('mRcvAmt').value;

  if (!sender || !amount) return showToast('Fill in all fields.', 'error');
  btn.disabled = true; btn.textContent = 'Processing…';

  try {
    const res = await fetch('/api/receive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender, amount: parseFloat(amount) })
    });
    const data = await res.json();
    if (data.success) {
      closeModal();
      showToast(data.message, 'success');
      await loadAccount();
    } else {
      showToast(data.message, 'error');
      btn.disabled = false; btn.textContent = 'Confirm Receive';
    }
  } catch {
    showToast('Network error.', 'error');
    btn.disabled = false; btn.textContent = 'Confirm Receive';
  }
}

// ── TOP UP ──────────────────────────────────────────────────────
function buildTopupForm() {
  if (!accountData) return;
  const opts = accountData.cards.map(c => `<option value="${c.id}">•••• ${c.last4}</option>`).join('');
  modalBody.innerHTML = `
    <div class="m-form">
      <div>
        <label class="m-label">Select card</label>
        <select class="m-select m-input" id="mTopCard">${opts}</select>
      </div>
      <div>
        <label class="m-label">Amount (USD)</label>
        <input class="m-input" id="mTopAmt" type="number" min="1" step="0.01" placeholder="0.00" />
      </div>
      <div>
        <label class="m-label">Payment method</label>
        <select class="m-select m-input" id="mTopMethod">
          <option>Bank Transfer</option>
          <option>MPESA</option>
          <option>Debit Card</option>
          <option>Crypto</option>
        </select>
      </div>
      <button class="m-btn" id="mTopBtn" onclick="doTopup()">Top Up</button>
    </div>`;
}

async function doTopup() {
  const btn    = document.getElementById('mTopBtn');
  const cardId = document.getElementById('mTopCard').value;
  const amount = document.getElementById('mTopAmt').value;
  const method = document.getElementById('mTopMethod').value;

  if (!amount) return showToast('Enter an amount.', 'error');
  btn.disabled = true; btn.textContent = 'Processing…';

  try {
    const res = await fetch('/api/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: parseInt(cardId), amount: parseFloat(amount), method })
    });
    const data = await res.json();
    if (data.success) {
      closeModal();
      showToast(data.message, 'success');
      await loadAccount();
    } else {
      showToast(data.message, 'error');
      btn.disabled = false; btn.textContent = 'Top Up';
    }
  } catch {
    showToast('Network error.', 'error');
    btn.disabled = false; btn.textContent = 'Top Up';
  }
}

// ── FREEZE ──────────────────────────────────────────────────────
let selectedFreezeCard = null;

function buildFreezeForm() {
  if (!accountData) return;
  selectedFreezeCard = accountData.cards[0]?.id || null;
  const cardHtml = accountData.cards.map(c => `
    <div class="freeze-option${c.id === selectedFreezeCard ? ' selected' : ''}"
         id="freezeOpt${c.id}" onclick="selectFreezeCard(${c.id})">
      <div class="freeze-info">
        <span class="freeze-num">•••• ${c.last4}</span>
        <span class="freeze-status">${c.frozen ? '🔴 Frozen' : '🟢 Active'}</span>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c.frozen ? '#ff6b6b' : '#4cd9a0'}" stroke-width="1.5">
        ${c.frozen
          ? '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
          : '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'}
      </svg>
    </div>`).join('');

  modalBody.innerHTML = `
    <div class="m-form">
      <div class="freeze-card-list">${cardHtml}</div>
      <button class="m-btn" id="mFreezeBtn" onclick="doFreeze()">
        ${accountData.cards.find(c => c.id === selectedFreezeCard)?.frozen ? 'Unfreeze Card' : 'Freeze Card'}
      </button>
    </div>`;
}

function selectFreezeCard(id) {
  selectedFreezeCard = id;
  document.querySelectorAll('.freeze-option').forEach(el => el.classList.remove('selected'));
  document.getElementById('freezeOpt' + id)?.classList.add('selected');
  const card = accountData.cards.find(c => c.id === id);
  const btn  = document.getElementById('mFreezeBtn');
  if (btn && card) btn.textContent = card.frozen ? 'Unfreeze Card' : 'Freeze Card';
}

async function doFreeze() {
  const btn = document.getElementById('mFreezeBtn');
  if (!selectedFreezeCard) return showToast('Select a card.', 'error');
  btn.disabled = true; btn.textContent = 'Processing…';

  try {
    const res = await fetch('/api/freeze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: selectedFreezeCard })
    });
    const data = await res.json();
    if (data.success) {
      closeModal();
      showToast(data.message, 'success');
      await loadAccount();
    } else {
      showToast(data.message, 'error');
      btn.disabled = false;
    }
  } catch {
    showToast('Network error.', 'error');
    btn.disabled = false;
  }
}

// ── Toast ────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3500);
}
