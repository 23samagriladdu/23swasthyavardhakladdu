require("dotenv").config();

const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

/* =========================================================
   ENVIRONMENT VARIABLES
========================================================= */

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME || "admin";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "CHANGE_THIS_PASSWORD";

const SESSION_SECRET =
  process.env.SESSION_SECRET || "change-this-session-secret";

const UPI_ID =
  process.env.UPI_ID || "ramesh3maurya@okaxis";

const UPI_NAME =
  process.env.UPI_NAME || "23 स्वास्थ्यवर्धक सामान";

const ORDER_EMAIL =
  process.env.ORDER_EMAIL || "customer@example.com";

/* =========================================================
   SHIPROCKET
========================================================= */

const SHIPROCKET_EMAIL =
  process.env.SHIPROCKET_EMAIL || "";

const SHIPROCKET_PASSWORD =
  process.env.SHIPROCKET_PASSWORD || "";

const SHIPROCKET_PICKUP_LOCATION =
  process.env.SHIPROCKET_PICKUP_LOCATION || "Home";

/* =========================================================
   RAZORPAY
========================================================= */

const RAZORPAY_KEY_ID =
  process.env.RAZORPAY_KEY_ID || "";

const RAZORPAY_KEY_SECRET =
  process.env.RAZORPAY_KEY_SECRET || "";

/* =========================================================
   DATABASE
========================================================= */

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL environment variable is missing"
  );

  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: isProduction
    ? { rejectUnauthorized: false }
    : false,
});

/* =========================================================
   EXPRESS
========================================================= */

app.set("trust proxy", 1);

app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

/* =========================================================
   SESSION
========================================================= */

app.use(
  session({
    store: new pgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),

    secret: SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,

      secure: isProduction,

      sameSite: "lax",

      maxAge:
        1000 *
        60 *
        60 *
        24 *
        7,
    },
  })
);

/* =========================================================
   STATIC FILES
   index.html / admin.html / images / style.css
   root folder से serve होंगे
========================================================= */

app.use(express.static(__dirname));

/* =========================================================
   PRODUCTS
========================================================= */

const PRODUCTS = [
  {
    id: "10-dryfruits",
    name: "10 सामग्री - Only Dryfruits",
    price: 1600,
    weight: 1,
    type: "kg",
    image: "laddu-main.png",
  },

  {
    id: "23-seeds-dryfruits",
    name: "23 सामग्री - Seeds & Dryfruits",
    price: 1300,
    weight: 1,
    type: "kg",
    image: "laddu-main.png",
  },

  {
    id: "30-seeds-dryfruits",
    name: "30 सामग्री - Seeds & Dryfruits",
    price: 1600,
    weight: 1,
    type: "kg",
    image: "laddu-main.png",
  },

  {
    id: "10-seeds-dryfruits",
    name: "10 सामग्री - Seeds & Dryfruits",
    price: 600,
    weight: 1,
    type: "kg",
    image: "laddu-main.png",
  },

  {
    id: "besan-laddu",
    name: "बेसन लड्डू — 1 किलो",
    price: 600,
    weight: 1,
    type: "kg",
    image: "besan.jpeg",
  },

  {
    id: "dry-fruit-laddu",
    name:
      "23 सीड्स-ड्राई फ्रूट्स (0.5 किलो) + 10 ड्राई फ्रूट्स (0.5 किलो) — मिक्स लड्डू 1 किलो",
    price: 1550,
    weight: 1,
    type: "kg",
    image: "dry_fruit.jpeg",
  },

  {
    id: "mix-laddu-2",
    name:
      "बेसन 0.4 + 23 Seeds-Dryfruit 0.3 + 10 Dryfruit 0.3 kg",
    price: 1110,
    weight: 1,
    type: "kg",
    image: "mix_ladd-2.jpeg",
  },

  {
    id: "mix-laddu",
    name:
      "बेसन 0.5 + 23 Seeds-Dryfruit 0.4 + 10 Dryfruit 0.2 kg",
    price: 1010,
    weight: 1,
    type: "kg",
    image: "mix_laddu-.jpeg",
  },

  {
    id: "mix-laddu-3",
    name:
      "बेसन 0.5 + 23 Seeds-Dryfruit 0.5 kg",
    price: 1050,
    weight: 1,
    type: "kg",
    image: "mix_laddu-3.jpeg",
  },

  {
    id: "mix-laddu-4",
    name:
      "बेसन 0.7 + 23 Seeds-Dryfruit 0.3 kg",
    price: 810,
    weight: 1,
    type: "kg",
    image: "mix_laddu-4.jpeg",
  },

  {
    id: "mix-laddu-5",
    name:
      "बेसन 0.5 + 10 Dryfruit 0.5 kg",
    price: 1100,
    weight: 1,
    type: "kg",
    image: "mix_laddu-5.jpeg",
  },
];

/* =========================================================
   PRODUCT HELPER
========================================================= */

function getProduct(productId) {
  return PRODUCTS.find(
    (product) => product.id === productId
  );
}

/* =========================================================
   DELIVERY CHARGE

   1 kg तक = ₹100
   2 kg तक = ₹200
   ...
   9 kg तक = ₹900
   9 kg से ऊपर = ₹1000
========================================================= */

function getDeliveryCharge(quantity) {
  const kg = Number(quantity);

  if (!Number.isFinite(kg) || kg <= 0) {
    return 0;
  }

  if (kg <= 1) return 100;
  if (kg <= 2) return 200;
  if (kg <= 3) return 300;
  if (kg <= 4) return 400;
  if (kg <= 5) return 500;
  if (kg <= 6) return 600;
  if (kg <= 7) return 700;
  if (kg <= 8) return 800;
  if (kg <= 9) return 900;

  return 1000;
}

/* =========================================================
   HELPERS
========================================================= */

function clean(value, max = 500) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function cleanPhone(value) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(-10);
}

function validPincode(value) {
  return /^\d{6}$/.test(
    String(value ?? "").trim()
  );
}

function validQuantity(value) {
  const quantity = Number(value);

  return (
    Number.isFinite(quantity) &&
    quantity >= 0.5 &&
    quantity <= 10 &&
    Number.isInteger(quantity * 2)
  );
}

function money(value) {
  return Number(
    Number(value).toFixed(2)
  );
}

function generateOrderNo() {
  const timestamp =
    Date.now().toString().slice(-8);

  const random =
    Math.floor(
      100 + Math.random() * 900
    );

  return `23L${timestamp}${random}`;
}

/* =========================================================
   ADMIN AUTH
========================================================= */

function requireAdmin(req, res, next) {
  if (
    req.session &&
    req.session.isAdmin === true
  ) {
    return next();
  }

  return res
    .status(401)
    .json({
      error: "Admin login required",
    });
}

/* =========================================================
   RAZORPAY HELPERS
========================================================= */

function razorpayAuth() {
  return (
    "Basic " +
    Buffer.from(
      `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
    ).toString("base64")
  );
}

async function razorpayRequest(
  url,
  options = {}
) {
  if (
    !RAZORPAY_KEY_ID ||
    !RAZORPAY_KEY_SECRET
  ) {
    throw new Error(
      "Razorpay keys are not configured on the server."
    );
  }

  const response = await fetch(url, {
    ...options,

    headers: {
      Authorization: razorpayAuth(),

      "Content-Type":
        "application/json",

      ...(options.headers || {}),
    },
  });

  const text =
    await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      raw: text,
    };
  }

  if (!response.ok) {
    const message =
      data?.error?.description ||
      data?.message ||
      "Razorpay request failed";

    throw new Error(message);
  }

  return data;
}

/* =========================================================
   CREATE RAZORPAY ORDER
========================================================= */

async function createRazorpayOrder(
  amountPaise,
  receipt
) {
  return razorpayRequest(
    "https://api.razorpay.com/v1/orders",
    {
      method: "POST",

      body: JSON.stringify({
        amount: amountPaise,

        currency: "INR",

        receipt,

        payment_capture: 1,
      }),
    }
  );
}

/* =========================================================
   GET RAZORPAY ORDER
========================================================= */

async function getRazorpayOrder(
  orderId
) {
  return razorpayRequest(
    `https://api.razorpay.com/v1/orders/${encodeURIComponent(
      orderId
    )}`,
    {
      method: "GET",
    }
  );
}

/* =========================================================
   GET RAZORPAY PAYMENT
========================================================= */

async function getRazorpayPayment(
  paymentId
) {
  return razorpayRequest(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(
      paymentId
    )}`,
    {
      method: "GET",
    }
  );
}

/* =========================================================
   VERIFY RAZORPAY SIGNATURE
========================================================= */

function verifyRazorpaySignature(
  orderId,
  paymentId,
  signature
) {
  const expected =
    crypto
      .createHmac(
        "sha256",
        RAZORPAY_KEY_SECRET
      )
      .update(
        `${orderId}|${paymentId}`
      )
      .digest("hex");

  const a =
    Buffer.from(
      expected,
      "utf8"
    );

  const b =
    Buffer.from(
      String(signature || ""),
      "utf8"
    );

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
}

/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,

      order_no TEXT UNIQUE NOT NULL,

      created_at
        TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

      name TEXT NOT NULL,

      phone TEXT NOT NULL,

      address TEXT NOT NULL,

      pincode TEXT NOT NULL,

      city TEXT NOT NULL,

      state TEXT NOT NULL,

      product_id TEXT NOT NULL,

      product_name TEXT NOT NULL,

      quantity NUMERIC(10,2) NOT NULL,

      product_price NUMERIC(10,2) NOT NULL,

      delivery NUMERIC(10,2) NOT NULL,

      total NUMERIC(10,2) NOT NULL,

      payment_method TEXT NOT NULL
        DEFAULT 'UPI',

      payment_status TEXT NOT NULL
        DEFAULT 'pending',

      utr TEXT,

      razorpay_order_id TEXT,

      razorpay_payment_id TEXT,

      awb TEXT,

      shiprocket_status TEXT,

      order_status TEXT NOT NULL
        DEFAULT 'confirmed',

      cancellation_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,

      name TEXT NOT NULL,

      rating INTEGER NOT NULL
        CHECK (rating BETWEEN 1 AND 5),

      text TEXT NOT NULL,

      status TEXT NOT NULL
        DEFAULT 'pending',

      created_at
        TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payment_intents (
      id SERIAL PRIMARY KEY,

      razorpay_order_id
        TEXT UNIQUE NOT NULL,

      name TEXT NOT NULL,

      phone TEXT NOT NULL,

      address TEXT NOT NULL,

      pincode TEXT NOT NULL,

      city TEXT NOT NULL,

      state TEXT NOT NULL,

      product_id TEXT NOT NULL,

      product_name TEXT NOT NULL,

      quantity NUMERIC(10,2) NOT NULL,

      product_price NUMERIC(10,2) NOT NULL,

      delivery NUMERIC(10,2) NOT NULL,

      total NUMERIC(10,2) NOT NULL,

      status TEXT NOT NULL
        DEFAULT 'created',

      razorpay_payment_id TEXT,

      created_at
        TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
    );

    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;

    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;

    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS order_status TEXT
      NOT NULL DEFAULT 'confirmed';

    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS awb TEXT;

    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS shiprocket_status TEXT;

    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS utr TEXT;

    CREATE INDEX IF NOT EXISTS
      idx_orders_phone
      ON orders(phone);

    CREATE INDEX IF NOT EXISTS
      idx_orders_order_no
      ON orders(order_no);

    CREATE INDEX IF NOT EXISTS
      idx_reviews_status
      ON reviews(status);

    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_orders_razorpay_payment_id
      ON orders(razorpay_payment_id)
      WHERE razorpay_payment_id IS NOT NULL;
  `);

  console.log(
    "PostgreSQL tables ready"
  );
}

/* =========================================================
   WEBSITE ROUTES
========================================================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "index.html"
    )
  );
});

app.get("/admin", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "admin.html"
    )
  );
});

app.get("/admin.html", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "admin.html"
    )
  );
});

/* =========================================================
   CONFIG
========================================================= */

app.get(
  "/api/config",
  (req, res) => {
    res.json({
      upiId: UPI_ID,

      upiName: UPI_NAME,

      products: PRODUCTS,

      deliveryRules:
        "1kg तक ₹100, 2kg तक ₹200 ... 9kg तक ₹900, 9kg से ऊपर ₹1000",

      razorpayEnabled:
        Boolean(
          RAZORPAY_KEY_ID &&
          RAZORPAY_KEY_SECRET
        ),
    });
  }
);

/* =========================================================
   PUBLIC REVIEWS
========================================================= */

app.get(
  "/api/reviews",
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            id,
            name,
            rating,
            text,
            created_at
          FROM reviews
          WHERE status = 'approved'
          ORDER BY created_at DESC
          LIMIT 50
        `);

      res.json(result.rows);
    } catch (error) {
      console.error(
        "reviews",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Reviews load नहीं हो पाए",
        });
    }
  }
);

/* =========================================================
   CREATE REVIEW
========================================================= */

app.post(
  "/api/reviews",
  async (req, res) => {
    try {
      const name =
        clean(
          req.body.name,
          80
        );

      const text =
        clean(
          req.body.text,
          1000
        );

      const rating =
        Number(
          req.body.rating
        );

      if (
        !name ||
        !text ||
        !Number.isInteger(
          rating
        ) ||
        rating < 1 ||
        rating > 5
      ) {
        return res
          .status(400)
          .json({
            error:
              "Name, rating और review सही भरें",
          });
      }

      const result =
        await pool.query(
          `
          INSERT INTO reviews
          (name, rating, text, status)
          VALUES
          ($1,$2,$3,'pending')
          RETURNING id
          `,
          [
            name,
            rating,
            text,
          ]
        );

      res.json({
        ok: true,

        id:
          result.rows[0].id,

        message:
          "Review भेज दिया गया है। Admin approval के बाद दिखाई देगा।",
      });
    } catch (error) {
      console.error(
        "review create",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Review save नहीं हो पाया",
        });
    }
  }
);

/* =========================================================
   CREATE RAZORPAY PAYMENT ORDER

   यहां अभी सिर्फ payment order बनता है।
   PostgreSQL में customer order अभी नहीं बनता।
========================================================= */

app.post(
  "/api/payment/create-order",
  async (req, res) => {
    try {
      if (
        !RAZORPAY_KEY_ID ||
        !RAZORPAY_KEY_SECRET
      ) {
        return res
          .status(500)
          .json({
            error:
              "Razorpay अभी configured नहीं है। Render Environment में RAZORPAY_KEY_ID और RAZORPAY_KEY_SECRET डालें।",
          });
      }

      const name =
        clean(
          req.body.name,
          100
        );

      const phone =
        cleanPhone(
          req.body.phone
        );

      const address =
        clean(
          req.body.address,
          500
        );

      const city =
        clean(
          req.body.city,
          100
        );

      const state =
        clean(
          req.body.state,
          100
        );

      const pincode =
        clean(
          req.body.pincode,
          6
        );

      const productId =
        clean(
          req.body.productId,
          100
        );

      const quantity =
        Number(
          req.body.quantity
        );

      const product =
        getProduct(productId);

      if (
        !name ||
        !/^\d{10}$/.test(phone) ||
        !address ||
        !city ||
        !state ||
        !validPincode(
          pincode
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "कृपया नाम, 10-digit mobile, पूरा address, city, state और 6-digit pincode सही भरें।",
          });
      }

      if (!product) {
        return res
          .status(400)
          .json({
            error:
              "Invalid product",
          });
      }

      if (
        !validQuantity(
          quantity
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Quantity 0.5 से 10 kg तक, 0.5 kg के step में होनी चाहिए।",
          });
      }

      const productAmount =
        money(
          product.price *
            quantity
        );

      const delivery =
        money(
          getDeliveryCharge(
            quantity
          )
        );

      const total =
        money(
          productAmount +
            delivery
        );

      const amountPaise =
        Math.round(
          total * 100
        );

      const receipt =
        `23-${Date.now()}-${Math.floor(
          Math.random() * 10000
        )}`.slice(0, 40);

      const rpOrder =
        await createRazorpayOrder(
          amountPaise,
          receipt
        );

      await pool.query(
        `
        INSERT INTO payment_intents
        (
          razorpay_order_id,
          name,
          phone,
          address,
          pincode,
          city,
          state,
          product_id,
          product_name,
          quantity,
          product_price,
          delivery,
          total,
          status
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,$10,$11,$12,$13,'created'
        )
        `,
        [
          rpOrder.id,
          name,
          phone,
          address,
          pincode,
          city,
          state,
          product.id,
          product.name,
          quantity,
          product.price,
          delivery,
          total,
        ]
      );

      res.json({
        ok: true,

        keyId:
          RAZORPAY_KEY_ID,

        razorpayOrderId:
          rpOrder.id,

        amount:
          rpOrder.amount,

        currency:
          "INR",

        total,

        productName:
          product.name,
      });
    } catch (error) {
      console.error(
        "Razorpay create order",
        error
      );

      res
        .status(500)
        .json({
          error:
            error.message ||
            "Payment order create नहीं हो पाया",
        });
    }
  }
);

/* =========================================================
   CREATE FINAL ORDER

   IMPORTANT:
   यहां Razorpay payment को server पर verify किया जाता है।

   बिना:
   - signature
   - payment id
   - captured status
   - exact amount

   order INSERT नहीं होगा।
========================================================= */

app.post(
  "/api/orders",
  async (req, res) => {
    const razorpayOrderId =
      clean(
        req.body.razorpay_order_id,
        100
      );

    const razorpayPaymentId =
      clean(
        req.body.razorpay_payment_id,
        100
      );

    const razorpaySignature =
      clean(
        req.body.razorpay_signature,
        200
      );

    if (
      !razorpayOrderId ||
      !razorpayPaymentId ||
      !razorpaySignature
    ) {
      return res
        .status(400)
        .json({
          error:
            "Verified Razorpay payment के बिना order create नहीं हो सकता।",
        });
    }

    let client = null;

    try {
      if (
        !RAZORPAY_KEY_ID ||
        !RAZORPAY_KEY_SECRET
      ) {
        return res
          .status(500)
          .json({
            error:
              "Razorpay server configuration missing",
          });
      }

      /* -----------------------------------------
         PAYMENT INTENT FIND
      ----------------------------------------- */

      const intentResult =
        await pool.query(
          `
          SELECT *
          FROM payment_intents
          WHERE razorpay_order_id=$1
          LIMIT 1
          `,
          [
            razorpayOrderId,
          ]
        );

      if (
        !intentResult.rows.length
      ) {
        return res
          .status(400)
          .json({
            error:
              "Payment order server पर नहीं मिला। Order create नहीं किया गया।",
          });
      }

      const intent =
        intentResult.rows[0];

      /* -----------------------------------------
         DUPLICATE CHECK
      ----------------------------------------- */

      if (
        intent.status ===
        "paid"
      ) {
        const existing =
          await pool.query(
            `
            SELECT
              order_no,
              total
            FROM orders
            WHERE razorpay_payment_id=$1
            LIMIT 1
            `,
            [
              razorpayPaymentId,
            ]
          );

        if (
          existing.rows.length
        ) {
          return res.json({
            ok: true,

            alreadyProcessed:
              true,

            ...existing.rows[0],
          });
        }

        return res
          .status(400)
          .json({
            error:
              "Payment पहले ही process हो चुका है।",
          });
      }

      /* -----------------------------------------
         SIGNATURE VERIFY
      ----------------------------------------- */

      if (
        !verifyRazorpaySignature(
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Payment signature verification failed. Order create नहीं किया गया।",
          });
      }

      /* -----------------------------------------
         RAZORPAY ORDER VERIFY
      ----------------------------------------- */

      const rpOrder =
        await getRazorpayOrder(
          razorpayOrderId
        );

      /* -----------------------------------------
         RAZORPAY PAYMENT VERIFY
      ----------------------------------------- */

      const rpPayment =
        await getRazorpayPayment(
          razorpayPaymentId
        );

      const expectedAmount =
        Math.round(
          Number(
            intent.total
          ) * 100
        );

      /* -----------------------------------------
         AMOUNT / CURRENCY / ORDER VERIFY
      ----------------------------------------- */

      if (
        rpOrder.id !==
          razorpayOrderId ||
        Number(
          rpOrder.amount
        ) !== expectedAmount ||
        rpOrder.currency !==
          "INR"
      ) {
        return res
          .status(400)
          .json({
            error:
              "Payment amount/order verification failed. Order create नहीं किया गया।",
          });
      }

      /* -----------------------------------------
         PAYMENT CAPTURE VERIFY
      ----------------------------------------- */

      if (
        rpPayment.order_id !==
          razorpayOrderId ||
        Number(
          rpPayment.amount
        ) !== expectedAmount ||
        rpPayment.currency !==
          "INR" ||
        rpPayment.status !==
          "captured"
      ) {
        return res
          .status(400)
          .json({
            error:
              "Payment captured नहीं है या amount match नहीं करता। Order create नहीं किया गया।",
          });
      }

      /* -----------------------------------------
         DATABASE TRANSACTION
      ----------------------------------------- */

      client =
        await pool.connect();

      await client.query(
        "BEGIN"
      );

      /* -----------------------------------------
         DUPLICATE PAYMENT CHECK AGAIN
      ----------------------------------------- */

      const duplicate =
        await client.query(
          `
          SELECT
            order_no,
            total
          FROM orders
          WHERE razorpay_payment_id=$1
          LIMIT 1
          FOR UPDATE
          `,
          [
            razorpayPaymentId,
          ]
        );

      if (
        duplicate.rows.length
      ) {
        await client.query(
          "COMMIT"
        );

        return res.json({
          ok: true,

          alreadyProcessed:
            true,

          ...duplicate.rows[0],
        });
      }

      /* -----------------------------------------
         GENERATE ORDER NUMBER
      ----------------------------------------- */

      const orderNo =
        generateOrderNo();

      /* -----------------------------------------
         SAVE ORDER

         IMPORTANT:
         payment_status = paid
      ----------------------------------------- */

      const insert =
        await client.query(
          `
          INSERT INTO orders
          (
            order_no,
            name,
            phone,
            address,
            pincode,
            city,
            state,
            product_id,
            product_name,
            quantity,
            product_price,
            delivery,
            total,
            payment_method,
            payment_status,
            utr,
            razorpay_order_id,
            razorpay_payment_id,
            order_status,
            shiprocket_status
          )
          VALUES
          (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,$12,$13,
            'UPI',
            'paid',
            $14,
            $15,
            $16,
            'confirmed',
            'pending'
          )
          RETURNING *
          `,
          [
            orderNo,

            intent.name,

            intent.phone,

            intent.address,

            intent.pincode,

            intent.city,

            intent.state,

            intent.product_id,

            intent.product_name,

            intent.quantity,

            intent.product_price,

            intent.delivery,

            intent.total,

            rpPayment.acquirer_data
              ?.rrn ||
              rpPayment.vpa ||
              "",

            razorpayOrderId,

            razorpayPaymentId,
          ]
        );

      /* -----------------------------------------
         PAYMENT INTENT MARK PAID
      ----------------------------------------- */

      await client.query(
        `
        UPDATE payment_intents
        SET
          status='paid',
          razorpay_payment_id=$1
        WHERE
          razorpay_order_id=$2
        `,
        [
          razorpayPaymentId,
          razorpayOrderId,
        ]
      );

      await client.query(
        "COMMIT"
      );

      const savedOrder =
        insert.rows[0];

      /* -----------------------------------------
         SHIPROCKET

         Payment verify होने के बाद ही।
      ----------------------------------------- */

      createShiprocketOrder(
        savedOrder
      ).catch(
        (error) =>
          console.error(
            "Shiprocket after paid order:",
            error
          )
      );

      return res.json({
        ok: true,

        orderNo:
          savedOrder.order_no,

        total:
          Number(
            savedOrder.total
          ),

        paymentStatus:
          "paid",

        paymentId:
          razorpayPaymentId,

        message:
          "Payment verified और order confirmed.",
      });
    } catch (error) {
      if (client) {
        try {
          await client.query(
            "ROLLBACK"
          );
        } catch {}
      }

      console.error(
        "order create",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Payment verified हुआ लेकिन order save करते समय server error आया। कृपया payment ID के साथ support से संपर्क करें।",
        });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

/* =========================================================
   CUSTOMER ORDER HISTORY
========================================================= */

app.get(
  "/api/orders",
  async (req, res) => {
    try {
      const phone =
        cleanPhone(
          req.query.phone
        );

      if (
        !/^\d{10}$/.test(
          phone
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Valid 10-digit phone required",
          });
      }

      const result =
        await pool.query(
          `
          SELECT
            id,
            order_no,
            created_at,
            name,
            phone,
            address,
            pincode,
            city,
            state,
            product_id,
            product_name,
            quantity,
            product_price,
            delivery,
            total,
            payment_method,
            payment_status,
            razorpay_payment_id,
            awb,
            shiprocket_status,
            order_status,
            cancellation_reason
          FROM orders
          WHERE phone=$1
          ORDER BY created_at DESC
          LIMIT 50
          `,
          [phone]
        );

      res.json(
        result.rows
      );
    } catch (error) {
      console.error(
        "order history",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Order history load नहीं हुई",
        });
    }
  }
);

/* =========================================================
   CUSTOMER ORDER DETAILS
========================================================= */

app.get(
  "/api/orders/:orderNo",
  async (req, res) => {
    try {
      const orderNo =
        clean(
          req.params.orderNo,
          100
        );

      const phone =
        cleanPhone(
          req.query.phone
        );

      if (
        !orderNo ||
        !/^\d{10}$/.test(
          phone
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Order number और phone required",
          });
      }

      const result =
        await pool.query(
          `
          SELECT *
          FROM orders
          WHERE
            order_no=$1
            AND phone=$2
          LIMIT 1
          `,
          [
            orderNo,
            phone,
          ]
        );

      if (
        !result.rows.length
      ) {
        return res
          .status(404)
          .json({
            error:
              "Order नहीं मिला",
          });
      }

      res.json(
        result.rows[0]
      );
    } catch (error) {
      console.error(
        "order details",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Order details load नहीं हुई",
        });
    }
  }
);

/* =========================================================
   CUSTOMER CANCEL ORDER
========================================================= */

app.post(
  "/api/orders/:orderNo/cancel",
  async (req, res) => {
    try {
      const orderNo =
        clean(
          req.params.orderNo,
          100
        );

      const phone =
        cleanPhone(
          req.body.phone
        );

      const reason =
        clean(
          req.body.reason ||
            "Customer requested cancellation",
          500
        );

      const result =
        await pool.query(
          `
          UPDATE orders
          SET
            order_status='cancelled',
            cancellation_reason=$1
          WHERE
            order_no=$2
            AND phone=$3
            AND order_status
              NOT IN
              ('cancelled','delivered')
          RETURNING
            order_no,
            order_status
          `,
          [
            reason,
            orderNo,
            phone,
          ]
        );

      if (
        !result.rows.length
      ) {
        return res
          .status(400)
          .json({
            error:
              "Order cancel नहीं हो सकता या order नहीं मिला",
          });
      }

      res.json({
        ok: true,

        ...result.rows[0],
      });
    } catch (error) {
      console.error(
        "cancel",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Order cancel नहीं हो पाया",
        });
    }
  }
);

/* =========================================================
   SHIPROCKET
========================================================= */

async function createShiprocketOrder(
  order
) {
  if (
    !SHIPROCKET_EMAIL ||
    !SHIPROCKET_PASSWORD
  ) {
    console.log(
      "Shiprocket credentials missing; paid order saved without Shiprocket submission."
    );

    return null;
  }

  try {
    /* -----------------------------------------
       LOGIN
    ----------------------------------------- */

    const loginResponse =
      await fetch(
        "https://apiv2.shiprocket.in/v1/external/auth/login",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email:
              SHIPROCKET_EMAIL,

            password:
              SHIPROCKET_PASSWORD,
          }),
        }
      );

    const loginData =
      await loginResponse.json();

    if (
      !loginResponse.ok ||
      !loginData.token
    ) {
      throw new Error(
        loginData.message ||
          "Shiprocket login failed"
      );
    }

    /* -----------------------------------------
       CREATE ORDER

       Customer का saved address
       ही Shiprocket को भेजा जाएगा।
    ----------------------------------------- */

    const body = {
      order_id:
        order.order_no,

      order_date:
        new Date(
          order.created_at ||
            Date.now()
        )
          .toISOString()
          .slice(0, 19)
          .replace(
            "T",
            " "
          ),

      pickup_location:
        SHIPROCKET_PICKUP_LOCATION,

      channel_id:
        process.env
          .SHIPROCKET_CHANNEL_ID ||
        "",

      comment:
        "23 Swasthyavardhak Laddu - UPI paid order",

      billing_customer_name:
        order.name,

      billing_last_name:
        "",

      billing_address:
        order.address,

      billing_address_2:
        "",

      billing_city:
        order.city,

      billing_pincode:
        order.pincode,

      billing_state:
        order.state,

      billing_country:
        "India",

      billing_email:
        ORDER_EMAIL,

      billing_phone:
        order.phone,

      shipping_is_billing:
        true,

      shipping_customer_name:
        order.name,

      shipping_last_name:
        "",

      shipping_address:
        order.address,

      shipping_address_2:
        "",

      shipping_city:
        order.city,

      shipping_pincode:
        order.pincode,

      shipping_country:
        "India",

      shipping_state:
        order.state,

      shipping_email:
        ORDER_EMAIL,

      shipping_phone:
        order.phone,

      order_items: [
        {
          name:
            order.product_name,

          sku:
            order.product_id,

          units:
            Number(
              order.quantity
            ),

          selling_price:
            Number(
              order.product_price
            ),

          discount: 0,

          tax: 0,

          hsn: "",
        },
      ],

      payment_method:
        "Prepaid",

      sub_total:
        Number(
          order.product_price
        ) *
        Number(
          order.quantity
        ),

      length: 20,

      breadth: 20,

      height: 10,

      weight:
        Number(
          order.quantity
        ),
    };

    const createResponse =
      await fetch(
        "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${loginData.token}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(body),
        }
      );

    const createData =
      await createResponse.json();

    if (
      !createResponse.ok
    ) {
      throw new Error(
        createData.message ||
          "Shiprocket order create failed"
      );
    }

    await pool.query(
      `
      UPDATE orders
      SET
        awb=$1,
        shiprocket_status=$2
      WHERE order_no=$3
      `,
      [
        createData.awb_code ||
          createData.awb ||
          null,

        createData.status ||
          "created",

        order.order_no,
      ]
    );

    return createData;
  } catch (error) {
    await pool
      .query(
        `
        UPDATE orders
        SET
          shiprocket_status=$1
        WHERE order_no=$2
        `,
        [
          `error: ${String(
            error.message
          ).slice(0, 250)}`,

          order.order_no,
        ]
      )
      .catch(() => {});

    console.error(
      "Shiprocket create",
      error
    );

    return null;
  }
}

/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post(
  "/api/admin/login",
  (req, res) => {
    const username =
      clean(
        req.body.username,
        100
      );

    const password =
      String(
        req.body.password ?? ""
      );

    if (
      username ===
        ADMIN_USERNAME &&
      password ===
        ADMIN_PASSWORD
    ) {
      req.session.isAdmin =
        true;

      return res.json({
        ok: true,

        message:
          "Login successful",
      });
    }

    return res
      .status(401)
      .json({
        error:
          "Invalid username or password",
      });
  }
);

/* =========================================================
   ADMIN LOGOUT
========================================================= */

app.post(
  "/api/admin/logout",
  (req, res) => {
    req.session.destroy(
      () => {
        res.json({
          ok: true,
        });
      }
    );
  }
);

/* =========================================================
   ADMIN ME
========================================================= */

app.get(
  "/api/admin/me",
  requireAdmin,
  (req, res) => {
    res.json({
      ok: true,

      username:
        ADMIN_USERNAME,
    });
  }
);

/* =========================================================
   ADMIN ORDERS
========================================================= */

app.get(
  "/api/admin/orders",
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT *
          FROM orders
          ORDER BY created_at DESC
          LIMIT 500
        `);

      res.json(
        result.rows
      );
    } catch (error) {
      console.error(
        "admin orders",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Orders load नहीं हुए",
        });
    }
  }
);

/* =========================================================
   ADMIN UPDATE ORDER
========================================================= */

app.patch(
  "/api/admin/orders/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const id =
        Number(
          req.params.id
        );

      const allowedStatuses = [
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ];

      const orderStatus =
        clean(
          req.body.order_status ||
            req.body.status,
          30
        );

      const shiprocketStatus =
        clean(
          req.body.shiprocket_status,
          100
        );

      const awb =
        clean(
          req.body.awb,
          100
        );

      if (
        !Number.isInteger(
          id
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid order id",
          });
      }

      const result =
        await pool.query(
          `
          UPDATE orders
          SET
            order_status =
              COALESCE(
                NULLIF($1,''),
                order_status
              ),

            shiprocket_status =
              COALESCE(
                NULLIF($2,''),
                shiprocket_status
              ),

            awb =
              COALESCE(
                NULLIF($3,''),
                awb
              )

          WHERE id=$4

          RETURNING *
          `,
          [
            allowedStatuses.includes(
              orderStatus
            )
              ? orderStatus
              : "",

            shiprocketStatus,

            awb,

            id,
          ]
        );

      if (
        !result.rows.length
      ) {
        return res
          .status(404)
          .json({
            error:
              "Order not found",
          });
      }

      res.json({
        ok: true,

        order:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "admin order update",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Order update नहीं हुआ",
        });
    }
  }
);

/* =========================================================
   ADMIN REVIEWS
========================================================= */

app.get(
  "/api/admin/reviews",
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT *
          FROM reviews
          ORDER BY created_at DESC
        `);

      res.json(
        result.rows
      );
    } catch (error) {
      console.error(
        "admin reviews",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Reviews load नहीं हुए",
        });
    }
  }
);

/* =========================================================
   ADMIN REVIEW UPDATE
========================================================= */

app.patch(
  "/api/admin/reviews/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const id =
        Number(
          req.params.id
        );

      const status =
        clean(
          req.body.status,
          20
        );

      if (
        !Number.isInteger(
          id
        ) ||
        ![
          "pending",
          "approved",
          "hidden",
        ].includes(status)
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid review update",
          });
      }

      const result =
        await pool.query(
          `
          UPDATE reviews
          SET status=$1
          WHERE id=$2
          RETURNING *
          `,
          [
            status,
            id,
          ]
        );

      if (
        !result.rows.length
      ) {
        return res
          .status(404)
          .json({
            error:
              "Review not found",
          });
      }

      res.json({
        ok: true,

        review:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "admin review update",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Review update नहीं हुआ",
        });
    }
  }
);

/* =========================================================
   ADMIN REVIEW DELETE
========================================================= */

app.delete(
  "/api/admin/reviews/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const id =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(
          id
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid review id",
          });
      }

      const result =
        await pool.query(
          `
          DELETE FROM reviews
          WHERE id=$1
          RETURNING id
          `,
          [id]
        );

      if (
        !result.rows.length
      ) {
        return res
          .status(404)
          .json({
            error:
              "Review not found",
          });
      }

      res.json({
        ok: true,
      });
    } catch (error) {
      console.error(
        "admin review delete",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Review delete नहीं हुआ",
        });
    }
  }
);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/health",
  async (req, res) => {
    try {
      await pool.query(
        "SELECT 1"
      );

      res.json({
        ok: true,

        database:
          "connected",

        razorpay:
          Boolean(
            RAZORPAY_KEY_ID &&
            RAZORPAY_KEY_SECRET
          ),
      });
    } catch {
      res
        .status(500)
        .json({
          ok: false,
        });
    }
  }
);

/* =========================================================
   START SERVER
========================================================= */

initializeDatabase()
  .then(() => {
    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `23 Swasthyavardhak Laddu running on port ${PORT}`
        );
      }
    );
  })
  .catch((error) => {
    console.error(
      "Database initialization failed:",
      error
    );

    process.exit(1);
  });
