const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const csrfProtection = csrf({ cookie: true });
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// In-memory mock state
let account = {
  name: 'Alex T.',
  balance: 10524.15,
  cards: [
    { id: 1, type: 'Debit Card', last4: '4568', balance: 4556.15, network: 'mastercard' },
    { id: 2, type: 'Visa Card', last4: '0958', balance: 5968.00, network: 'visa' },
    { id: 1, type: 'Debit Card', last4: '4568', balance: 4556.15, network: 'mastercard' }
  ],
  transactions: [
    { id: 1, name: 'Starbucks Coffee', date: 'Apr 24, 5:27 PM', amount: -14.99, card: '4568', logo: 'SB' },
    { id: 2, name: 'DKNY',            date: 'Apr 20, 2:14 PM', amount: -40.00, card: '4568', logo: 'DK' },
    { id: 3, name: 'DIOR',            date: 'Apr 06, 5:12 PM', amount: -268.00, card: '4568', logo: 'Di' },
    { id: 4, name: 'Salary Deposit',  date: 'Apr 01, 9:00 AM', amount: 3200.00, card: '4568', logo: 'SA' },
  ],
  investments: [
    { name: 'Apple',    ticker: 'AAPL', value: 129.89, change: 3.5 },
    { name: 'Tesla',    ticker: 'TSLA', value: 210.93, change: -1.2 },
    { name: 'Microsoft',ticker: 'MSFT', value: 415.40, change: 0.8 },
  ],
  spending: {
    transport: 420, food: 1340, travel: 580,
    health: 210, clothes: 860, salary: 3200, investments: 1073
  }
};

// ── GET account summary ──────────────────────────────────────────
app.get('/api/account', (req, res) => {
  res.json({
    name: account.name,
    balance: account.balance,
    cards: account.cards,
    transactions: account.transactions.slice(0, 5),
    investments: account.investments,
    spending: account.spending
  });
});

// ── POST /api/send ───────────────────────────────────────────────
app.post('/api/send', csrfProtection, (req, res) => {
  const { recipient, amount, note } = req.body;
  if (!recipient || !amount || isNaN(amount) || Number(amount) <= 0)
    return res.status(400).json({ success: false, message: 'Invalid recipient or amount.' });

  const amt = parseFloat(amount);
  if (amt > account.balance)
    return res.status(400).json({ success: false, message: 'Insufficient balance.' });

  account.balance = parseFloat((account.balance - amt).toFixed(2));
  account.transactions.unshift({
    id: Date.now(), name: `Sent to ${recipient}`,
    date: new Date().toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }),
    amount: -amt, card: '4568', logo: 'SE'
  });
  res.json({ success: true, message: `$${amt.toFixed(2)} sent to ${recipient}.`, newBalance: account.balance });
});

// ── POST /api/receive ────────────────────────────────────────────
app.post('/api/receive', csrfProtection, (req, res) => {
  const { sender, amount } = req.body;
  if (!sender || !amount || isNaN(amount) || Number(amount) <= 0)
    return res.status(400).json({ success: false, message: 'Invalid sender or amount.' });

  const amt = parseFloat(amount);
  account.balance = parseFloat((account.balance + amt).toFixed(2));
  account.transactions.unshift({
    id: Date.now(), name: `Received from ${sender}`,
    date: new Date().toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }),
    amount: amt, card: '4568', logo: 'RE'
  });
  res.json({ success: true, message: `$${amt.toFixed(2)} received from ${sender}.`, newBalance: account.balance });
});

// ── POST /api/topup ──────────────────────────────────────────────
app.post('/api/topup', csrfProtection, (req, res) => {
  const { cardId, amount, method } = req.body;
  if (!amount || isNaN(amount) || Number(amount) <= 0)
    return res.status(400).json({ success: false, message: 'Invalid amount.' });

  const amt = parseFloat(amount);
  const card = account.cards.find(c => c.id === parseInt(cardId));
  if (!card) return res.status(404).json({ success: false, message: 'Card not found.' });

  card.balance = parseFloat((card.balance + amt).toFixed(2));
  account.balance = parseFloat((account.balance + amt).toFixed(2));
  res.json({ success: true, message: `Card ••••${card.last4} topped up with $${amt.toFixed(2)} via ${method}.`, newBalance: account.balance, cardBalance: card.balance });
});

// ── POST /api/freeze ─────────────────────────────────────────────
app.post('/api/freeze', csrfProtection, (req, res) => {
  const { cardId } = req.body;
  const card = account.cards.find(c => c.id === parseInt(cardId));
  if (!card) return res.status(404).json({ success: false, message: 'Card not found.' });

  card.frozen = !card.frozen;
  res.json({ success: true, frozen: card.frozen, message: `Card ••••${card.last4} has been ${card.frozen ? 'frozen' : 'unfrozen'}.` });
});

// ── Serve pages ──────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

app.listen(PORT, () => console.log(`Pillar running at http://localhost:${PORT}`));
