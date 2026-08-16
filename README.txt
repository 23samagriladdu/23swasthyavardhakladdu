# 23 स्वास्थ्यवर्धक सामान — Full Online Store

इस version में:
- Online order form
- UPI payment intent + QR
- Cash on Delivery option
- Order confirmation + Order Number
- Customer orders SQLite database
- Admin login
- Admin order dashboard
- Payment status: pending/submitted/paid/failed/refunded
- Order status: new/confirmed/packed/shipped/delivered/cancelled
- WhatsApp order confirmation
- Mobile responsive design

## 1. Install
Node.js 18+ install करें, फिर project folder में:
npm install

## 2. Settings
`.env.example` की copy बनाकर `.env` नाम रखें और:
ADMIN_USERNAME=अपना admin username
ADMIN_PASSWORD=अपना strong password
UPI_ID=आपकी UPI ID (उदाहरण: businessname@upi)
UPI_NAME=23 Swasthyavardhak Samaan
PORT=3000

जरूरी: अपनी असली UPI ID जरूर डालें। अभी placeholder है।

## 3. Run
npm start

फिर browser में:
http://localhost:3000

Admin:
http://localhost:3000/admin

## Payment note
यह version UPI Intent/QR से payment शुरू करता है और customer से UTR/reference number लेता है। Payment का वास्तविक बैंक verification admin panel से किया जाएगा।

अगर automatic payment verification, refunds, webhooks और payment gateway settlement चाहिए, तो Razorpay/PayU जैसे gateway account और API credentials अलग से जोड़ने होंगे।

## Database
`orders.db` अपने-आप बनता है। इसमें customer orders और statuses रहते हैं। Production में नियमित backup रखें।

## Hosting
यह Node.js app है, इसलिए ऐसी hosting चाहिए जो Node.js server चलाए। Static hosting (सिर्फ GitHub Pages) पर backend/database वाला version नहीं चलेगा।
