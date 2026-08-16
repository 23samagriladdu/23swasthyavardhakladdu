require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "CHANGE_THIS_PASSWORD";
const UPI_ID = process.env.UPI_ID || "YOUR-UPI-ID@upi";
const UPI_NAME = process.env.UPI_NAME || "23 Swasthyavardhak Samaan";

const db = new Database(path.join(__dirname, "orders.db"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  pincode TEXT NOT NULL,
  product TEXT NOT NULL,
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  delivery INTEGER NOT NULL,
  total INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  utr TEXT DEFAULT '',
  order_status TEXT NOT NULL DEFAULT 'new'
);
`);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "replace-this-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 8 * 60 * 60 * 1000 }
}));

app.use(express.static(path.join(__dirname, "public")));

const products = [
  { id: "10-dryfruit", name: "10 सामग्री - Only Dryfruits", price: 1600 },
  { id: "23-seeds-dryfruit", name: "23 सामग्री - Seeds & Dryfruits", price: 1300 },
  { id: "30-seeds-dryfruit", name: "30 सामग्री - Seeds & Dryfruits", price: 1600 },
  { id: "10-seeds-dryfruit", name: "10 सामग्री - Seeds & Dryfruits", price: 600 }
];
const DELIVERY = 300;

app.get("/api/config", (req, res) => {
  res.json({ upiId: UPI_ID, upiName: UPI_NAME, delivery: DELIVERY, products });
});

app.post("/api/orders", (req, res) => {
  try {
    const { name, phone, address, pincode, productId, quantity, paymentMethod, utr } = req.body;
    const product = products.find(p => p.id === productId);
    const qty = Number(quantity);

    if (!name || !/^\d{10}$/.test(String(phone)) || !address || !/^\d{6}$/.test(String(pincode)) || !product || !Number.isInteger(qty) || qty < 1 || qty > 50) {
      return res.status(400).json({ error: "कृपया सही ग्राहक और ऑर्डर जानकारी भरें।" });
    }
    const safePayment = paymentMethod === "UPI" ? "UPI" : "COD";
    const productTotal = product.price * qty;
    const total = productTotal + DELIVERY;
    const orderNo = "23L" + Date.now().toString().slice(-9);
    const createdAt = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO orders
      (order_no, created_at, customer_name, phone, address, pincode, product, price, quantity, delivery, total, payment_method, payment_status, utr, order_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(orderNo, createdAt, name.trim(), String(phone), address.trim(), String(pincode),
      product.name, product.price, qty, DELIVERY, total, safePayment,
      safePayment === "UPI" ? "submitted" : "pending", (utr || "").trim(), "new");

    res.json({
      success: true,
      orderNo,
      total,
      paymentStatus: safePayment === "UPI" ? "submitted" : "pending",
      message: safePayment === "UPI"
        ? "ऑर्डर सेव हो गया है। UPI payment के बाद UTR/Reference admin द्वारा verify किया जाएगा।"
        : "ऑर्डर सेव हो गया है।"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ऑर्डर सेव नहीं हो सका।" });
  }
});

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.admin = true;
    return res.json({ success: true });
  }
  res.status(401).json({ error: "गलत username या password" });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get("/api/admin/me", (req, res) => {
  res.json({ loggedIn: !!(req.session && req.session.admin) });
});

app.get("/api/admin/orders", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM orders ORDER BY id DESC").all();
  res.json(rows);
});

app.patch("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { orderStatus, paymentStatus } = req.body;
  const allowedOrder = ["new", "confirmed", "packed", "shipped", "delivered", "cancelled"];
  const allowedPayment = ["pending", "submitted", "paid", "failed", "refunded"];
  if (orderStatus && !allowedOrder.includes(orderStatus)) return res.status(400).json({ error: "Invalid order status" });
  if (paymentStatus && !allowedPayment.includes(paymentStatus)) return res.status(400).json({ error: "Invalid payment status" });

  const row = db.prepare("SELECT * FROM orders WHERE id=?").get(id);
  if (!row) return res.status(404).json({ error: "Order not found" });

  db.prepare(`
    UPDATE orders SET
      order_status = COALESCE(?, order_status),
      payment_status = COALESCE(?, payment_status)
    WHERE id=?
  `).run(orderStatus || null, paymentStatus || null, id);

  res.json({ success: true });
});
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.listen(PORT, () => {
  console.log(`23 Swasthyavardhak Laddu running at http://localhost:${PORT}`);
});
