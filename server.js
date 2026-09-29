require("dotenv").config();

const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const path = require("path");
const { Pool } = require("pg");

const app = express();

/* =========================================================
   BASIC SETTINGS
========================================================= */

const PORT = Number(process.env.PORT || 3000);

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME || "admin";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "CHANGE_THIS_PASSWORD";

const UPI_ID =
  process.env.UPI_ID || "YOUR-UPI-ID@upi";

const UPI_NAME =
  process.env.UPI_NAME || "23 Swasthyavardhak Samaan";

/* =========================================================
   POSTGRESQL DATABASE
========================================================= */

if (!process.env.DATABASE_URL) {
  console.error(
    "ERROR: DATABASE_URL environment variable is missing."
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on("error", (error) => {
  console.error(
    "POSTGRES POOL ERROR:",
    error
  );
});

/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

async function initializeDatabase() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* -------------------------------------------------------
       ORDERS TABLE
    ------------------------------------------------------- */

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,

        order_no TEXT UNIQUE NOT NULL,

        created_at TEXT NOT NULL,

        customer_name TEXT NOT NULL,

        phone TEXT NOT NULL,

        address TEXT NOT NULL,

        pincode TEXT NOT NULL,

        city TEXT NOT NULL,

        state TEXT NOT NULL,

        country TEXT DEFAULT 'India',

        product_id TEXT NOT NULL,

        product TEXT NOT NULL,

        price NUMERIC NOT NULL,

        quantity NUMERIC NOT NULL,

        delivery NUMERIC NOT NULL,

        total NUMERIC NOT NULL,

        payment_method TEXT,

        payment_status TEXT DEFAULT 'pending',

        utr TEXT,

        order_status TEXT DEFAULT 'pending',

        awb TEXT DEFAULT '',

        shiprocket_status TEXT DEFAULT '',

        cancellation_reason TEXT DEFAULT ''
      )
    `);

    /* -------------------------------------------------------
       REVIEWS TABLE
    ------------------------------------------------------- */

    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,

        name TEXT NOT NULL,

        rating INTEGER NOT NULL,

        review TEXT NOT NULL,

        status TEXT NOT NULL DEFAULT 'pending',

        created_at TEXT NOT NULL
      )
    `);

    /* -------------------------------------------------------
       INDEXES
    ------------------------------------------------------- */

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_phone
      ON orders(phone)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_order_no
      ON orders(order_no)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reviews_status
      ON reviews(status)
    `);

    await client.query("COMMIT");

    console.log(
      "PostgreSQL database initialized successfully."
    );

  } catch (error) {

    await client.query("ROLLBACK");

    console.error(
      "DATABASE INITIALIZATION ERROR:",
      error
    );

    throw error;

  } finally {

    client.release();

  }
}

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  express.json({
    limit: "100kb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "100kb"
  })
);

/* =========================================================
   SESSION
   POSTGRESQL SESSION STORE
========================================================= */

app.set("trust proxy", 1);

app.use(
  session({

    store: new pgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true
    }),

    secret:
      process.env.SESSION_SECRET ||
      "replace-this-session-secret",

    resave: false,

    saveUninitialized: false,

    cookie: {

      httpOnly: true,

      sameSite: "lax",

      secure:
        process.env.NODE_ENV === "production",

      maxAge:
        8 * 60 * 60 * 1000
    }
  })
);

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
    image: "laddu-main.png"
  },

  {
    id: "23-seeds-dryfruits",
    name: "23 सामग्री - Seeds & Dryfruits",
    price: 1300,
    weight: 1,
    type: "kg",
    image: "laddu-main.png"
  },

  {
    id: "30-seeds-dryfruits",
    name: "30 सामग्री - Seeds & Dryfruits",
    price: 1600,
    weight: 1,
    type: "kg",
    image: "laddu-main.png"
  },

  {
    id: "10-seeds-dryfruits",
    name: "10 सामग्री - Seeds & Dryfruits",
    price: 600,
    weight: 1,
    type: "kg",
    image: "laddu-main.png"
  },

  {
    id: "besan-laddu",
    name: "बेसन लड्डू — 1 किलो",
    price: 600,
    weight: 1,
    type: "kg",
    image: "besan.jpeg"
  },

  {
    id: "dry-fruit-laddu",
    name:
      "23 सीड्स-ड्राई फ्रूट्स (0.5 किलो), 10 ड्राई फ्रूट्स (0.5 किलो) — मिक्स लड्डू 1 किलो",
    price: 1550,
    weight: 1,
    type: "kg",
    image: "dry_fruit.jpeg"
  },

  {
    id: "mix-laddu-2",
    name:
      "बेसन (0.4 किलो), 23 सीड्स-ड्राई फ्रूट्स (0.3 किलो), 10 ड्राई फ्रूट्स (0.3 किलो) — मिक्स लड्डू 1 किलो",
    price: 1110,
    weight: 1,
    type: "kg",
    image: "mix_ladd-2.jpeg"
  },

  {
    id: "mix-laddu",
    name:
      "बेसन (0.5 किलो), 23 सीड्स-ड्राई फ्रूट्स (0.4 किलो), 10 ड्राई फ्रूट्स (0.2 किलो) — मिक्स लड्डू 1 किलो",
    price: 1010,
    weight: 1,
    type: "kg",
    image: "mix_laddu-.jpeg"
  },

  {
    id: "mix-laddu-3",
    name:
      "बेसन (0.5 किलो), 23 सीड्स-ड्राई फ्रूट्स (0.5 किलो) — मिक्स लड्डू 1 किलो",
    price: 1050,
    weight: 1,
    type: "kg",
    image: "mix_laddu-3.jpeg"
  },

  {
    id: "mix-laddu-4",
    name:
      "बेसन (0.7 किलो), 23 सीड्स-ड्राई फ्रूट्स (0.3 किलो) — मिक्स लड्डू 1 किलो",
    price: 810,
    weight: 1,
    type: "kg",
    image: "mix_laddu-4.jpeg"
  },

  {
    id: "mix-laddu-5",
    name:
      "बेसन (0.5 किलो), 10 ड्राई फ्रूट्स (0.5 किलो) — मिक्स लड्डू 1 किलो",
    price: 1100,
    weight: 1,
    type: "kg",
    image: "mix_laddu-5.jpeg"
  }

];

/* =========================================================
   DELIVERY CALCULATION
========================================================= */

function getDeliveryCharge(totalWeight) {

  const weight =
    Number(totalWeight || 0);

  if (
    !Number.isFinite(weight) ||
    weight <= 0
  ) {
    return 0;
  }

  if (weight <= 1) return 100;
  if (weight <= 2) return 200;
  if (weight <= 3) return 300;
  if (weight <= 4) return 400;
  if (weight <= 5) return 500;
  if (weight <= 6) return 600;
  if (weight <= 7) return 700;
  if (weight <= 8) return 800;
  if (weight <= 9) return 900;

  return 1000;
}

/* =========================================================
   KG QUANTITY VALIDATION
========================================================= */

function isValidKgQuantity(quantity) {

  const qty =
    Number(quantity);

  if (!Number.isFinite(qty)) {
    return false;
  }

  if (
    qty < 0.5 ||
    qty > 10
  ) {
    return false;
  }

  return Number.isInteger(qty * 2);
}

/* =========================================================
   PACK QUANTITY VALIDATION
========================================================= */

function isValidPackQuantity(quantity) {

  const qty =
    Number(quantity);

  return (
    Number.isInteger(qty) &&
    qty >= 1 &&
    qty <= 50
  );
}

/* =========================================================
   PRODUCT FINDER
========================================================= */

function getProduct(productId) {

  return PRODUCTS.find(
    (p) =>
      p.id === String(productId)
  );
}

/* =========================================================
   CONFIG API
========================================================= */

app.get(
  "/api/config",
  (req, res) => {

    res.json({

      upiId: UPI_ID,

      upiName: UPI_NAME,

      products: PRODUCTS,

      deliveryRules: {

        upTo1Kg: 100,

        upTo2Kg: 200,

        upTo3Kg: 300,

        upTo4Kg: 400,

        upTo5Kg: 500,

        upTo6Kg: 600,

        upTo7Kg: 700,

        upTo8Kg: 800,

        upTo9Kg: 900,

        above9Kg: 1000
      }

    });

  }
);

/* =========================================================
   CREATE UNIQUE ORDER NUMBER
========================================================= */

async function createOrderNumber() {

  let orderNo;

  do {

    const random =
      Math.floor(
        Math.random() * 1000
      )
      .toString()
      .padStart(3, "0");

    orderNo =
      "23L" +
      (
        Date.now().toString() +
        random
      ).slice(-9);

    const existing =
      await pool.query(
        `
        SELECT id
        FROM orders
        WHERE order_no = $1
        `,
        [orderNo]
      );

    if (
      existing.rows.length === 0
    ) {

      return orderNo;

    }

  } while (true);
}

/* =========================================================
   SHIPROCKET TOKEN
========================================================= */

let shiprocketToken = null;
let shiprocketTokenTime = 0;

async function getShiprocketToken() {

  const email =
    process.env.SHIPROCKET_EMAIL;

  const password =
    process.env.SHIPROCKET_PASSWORD;

  if (
    !email ||
    !password
  ) {

    return null;

  }

  if (
    shiprocketToken &&
    Date.now() -
      shiprocketTokenTime <
      24 * 60 * 60 * 1000
  ) {

    return shiprocketToken;

  }

  const response =
    await fetch(
      "https://apiv2.shiprocket.in/v1/external/auth/login",
      {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            email,
            password
          })

      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.token
  ) {

    throw new Error(
      data.message ||
      "Shiprocket login failed"
    );

  }

  shiprocketToken =
    data.token;

  shiprocketTokenTime =
    Date.now();

  return shiprocketToken;
}

/* =========================================================
   CREATE SHIPROCKET ORDER
========================================================= */

async function createShiprocketOrder(
  order
) {

  const pickupLocation =
    process.env.SHIPROCKET_PICKUP_LOCATION;

  if (
    !process.env.SHIPROCKET_EMAIL ||
    !process.env.SHIPROCKET_PASSWORD ||
    !pickupLocation
  ) {

    return {

      success: false,

      skipped: true,

      message:
        "Shiprocket environment variables not configured"

    };

  }

  const token =
    await getShiprocketToken();

  const product =
    getProduct(
      order.product_id
    );

  const totalWeight =
    product
      ? (
          product.type === "kg"
            ? Number(order.quantity)
            : Number(product.weight) *
              Number(order.quantity)
        )
      : Number(order.quantity);

  const shiprocketBody = {

    order_id:
      order.order_no,

    order_date:
      order.created_at,

    pickup_location:
      pickupLocation,

    billing_customer_name:
      order.customer_name,

    billing_last_name:
      "",

    billing_address:
      order.address,

    billing_address_2:
      "",

    billing_city:
      order.city,

    billing_pincode:
      Number(order.pincode),

    billing_state:
      order.state,

    billing_country:
      "India",

    billing_email:
      process.env.ORDER_EMAIL ||
      "customer@example.com",

    billing_phone:
      Number(order.phone),

    shipping_is_billing:
      true,

    shipping_customer_name:
      order.customer_name,

    shipping_last_name:
      "",

    shipping_address:
      order.address,

    shipping_address_2:
      "",

    shipping_city:
      order.city,

    shipping_pincode:
      Number(order.pincode),

    shipping_country:
      "India",

    shipping_state:
      order.state,

    shipping_email:
      process.env.ORDER_EMAIL ||
      "customer@example.com",

    shipping_phone:
      Number(order.phone),

    order_items: [

      {

        name:
          order.product,

        sku:
          order.product_id ||
          order.order_no,

        units:
          Number(order.quantity),

        selling_price:
          Number(order.price),

        discount:
          0,

        tax:
          0,

        hsn:
          ""
      }

    ],

    payment_method:
      "Prepaid",

    shipping_charges:
      Number(order.delivery),

    giftwrap_charges:
      0,

    transaction_charges:
      0,

    total_discount:
      0,

    sub_total:
      Number(order.price) *
      Number(order.quantity),

    length:
      20,

    breadth:
      20,

    height:
      10,

    weight:
      Number(totalWeight)
  };

  const response =
    await fetch(
      "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
      {

        method: "POST",

        headers: {

          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`
        },

        body:
          JSON.stringify(
            shiprocketBody
          )
      }
    );

  const data =
    await response.json();

  if (
    !response.ok
  ) {

    throw new Error(
      data.message ||
      JSON.stringify(data)
    );

  }

  return {

    success: true,

    data

  };
}

/* =========================================================
   CREATE CUSTOMER ORDER
========================================================= */

app.post(
  "/api/orders",
  async (req, res) => {

    try {

      const {
        name,
        phone,
        address,
        city,
        state,
        pincode,
        productId,
        quantity,
        paymentMethod,
        utr
      } = req.body;

      const cleanName =
        String(name || "")
          .trim();

      const cleanPhone =
        String(phone || "")
          .replace(/\D/g, "");

      const cleanAddress =
        String(address || "")
          .trim();

      const cleanCity =
        String(city || "")
          .trim();

      const cleanState =
        String(state || "")
          .trim();

      const cleanPincode =
        String(pincode || "")
          .replace(/\D/g, "");

      const cleanUtr =
        String(utr || "")
          .trim();

      const product =
        getProduct(productId);

      const qty =
        Number(quantity);

      /* ---------------------------------------------------
         VALIDATION
      --------------------------------------------------- */

      if (!cleanName) {

        return res.status(400).json({
          error:
            "कृपया नाम डालें।"
        });

      }

      if (
        !/^\d{10}$/.test(
          cleanPhone
        )
      ) {

        return res.status(400).json({
          error:
            "कृपया 10 अंकों का सही मोबाइल नंबर डालें।"
        });

      }

      if (!cleanAddress) {

        return res.status(400).json({
          error:
            "कृपया पूरा पता डालें।"
        });

      }

      if (!cleanCity) {

        return res.status(400).json({
          error:
            "कृपया शहर का नाम डालें।"
        });

      }

      if (!cleanState) {

        return res.status(400).json({
          error:
            "कृपया राज्य का नाम डालें।"
        });

      }

      if (
        !/^\d{6}$/.test(
          cleanPincode
        )
      ) {

        return res.status(400).json({
          error:
            "कृपया 6 अंकों का सही पिनकोड डालें।"
        });

      }

      if (!product) {

        return res.status(400).json({
          error:
            "कृपया सही product चुनें।"
        });

      }

      if (
        product.type === "kg"
      ) {

        if (
          !isValidKgQuantity(qty)
        ) {

          return res.status(400).json({
            error:
              "Kg मात्रा 0.5 Kg से 10 Kg तक होनी चाहिए और 0.5 Kg के अंतर में होनी चाहिए।"
          });

        }

      } else {

        if (
          !isValidPackQuantity(qty)
        ) {

          return res.status(400).json({
            error:
              "Pack की संख्या 1 से 50 तक होनी चाहिए।"
          });

        }

      }

      /* ---------------------------------------------------
         PAYMENT VALIDATION
      --------------------------------------------------- */

      if (!cleanUtr) {

        return res.status(400).json({

          error:
            "कृपया पहले UPI payment करें और UTR / Reference Number डालें।"

        });

      }

      if (
        !/^\d{12}$/.test(
          cleanUtr
        )
      ) {

        return res.status(400).json({

          error:
            "कृपया सही 12 अंकों का UTR / Reference Number डालें।"

        });

      }

      /* ---------------------------------------------------
         PRICE
      --------------------------------------------------- */

      const safePayment =
        "UPI";

      const productTotal =
        Number(product.price) *
        qty;

      const totalWeight =
        product.type === "kg"
          ? qty
          : Number(product.weight) *
            qty;

      const delivery =
        getDeliveryCharge(
          totalWeight
        );

      const total =
        productTotal +
        delivery;

      const orderNo =
        await createOrderNumber();

      const createdAt =
        new Date().toISOString();

      const paymentStatus =
        "submitted";

      /* ---------------------------------------------------
         SAVE ORDER
      --------------------------------------------------- */

      const insertResult =
        await pool.query(
          `
          INSERT INTO orders (

            order_no,

            created_at,

            customer_name,

            phone,

            address,

            pincode,

            city,

            state,

            country,

            product_id,

            product,

            price,

            quantity,

            delivery,

            total,

            payment_method,

            payment_status,

            utr,

            order_status

          )
          VALUES (

            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            $17,
            $18,
            $19

          )

          RETURNING *
          `,
          [

            orderNo,

            createdAt,

            cleanName,

            cleanPhone,

            cleanAddress,

            cleanPincode,

            cleanCity,

            cleanState,

            "India",

            product.id,

            product.name,

            Number(product.price),

            qty,

            delivery,

            total,

            safePayment,

            paymentStatus,

            cleanUtr,

            "pending"

          ]
        );

      const savedOrder =
        insertResult.rows[0];

      /* ---------------------------------------------------
         SHIPROCKET
      --------------------------------------------------- */

      try {

        const shiprocketResult =
          await createShiprocketOrder(
            savedOrder
          );

        if (
          shiprocketResult &&
          shiprocketResult.success
        ) {

          const shipData =
            shiprocketResult.data ||
            {};

          const awb =
            shipData.awb_code ||
            "";

          await pool.query(
            `
            UPDATE orders

            SET
              awb = $1,
              shiprocket_status = $2

            WHERE id = $3
            `,
            [

              awb,

              "created",

              savedOrder.id

            ]
          );

        } else {

          await pool.query(
            `
            UPDATE orders

            SET shiprocket_status = $1

            WHERE id = $2
            `,
            [

              shiprocketResult &&
              shiprocketResult.message
                ? shiprocketResult.message
                : "skipped",

              savedOrder.id

            ]
          );

        }

      } catch (shiprocketError) {

        console.error(
          "SHIPROCKET ORDER ERROR:",
          shiprocketError
        );

        await pool.query(
          `
          UPDATE orders

          SET shiprocket_status = $1

          WHERE id = $2
          `,
          [

            "ERROR: " +
              shiprocketError.message,

            savedOrder.id

          ]
        );

      }

      /* ---------------------------------------------------
         RESPONSE
      --------------------------------------------------- */

      return res.status(201).json({

        success: true,

        message:
          "Order successfully submit हो गया।",

        order: {

          id:
            savedOrder.id,

          orderNo:
            savedOrder.order_no,

          total:
            Number(savedOrder.total),

          paymentStatus:
            savedOrder.payment_status,

          orderStatus:
            savedOrder.order_status,

          utr:
            savedOrder.utr

        }

      });

    } catch (error) {

      console.error(
        "CREATE ORDER ERROR:",
        error
      );

      return res.status(500).json({

        error:
          "Order submit करते समय server error आया।"

      });

    }

  }
);

/* =========================================================
   CUSTOMER ORDER HISTORY
========================================================= */

app.get(
  "/api/orders/history/:phone",
  async (req, res) => {

    try {

      const phone =
        String(
          req.params.phone || ""
        ).replace(/\D/g, "");

      if (
        !/^\d{10}$/.test(phone)
      ) {

        return res.status(400).json({
          error:
            "सही 10 अंकों का मोबाइल नंबर डालें।"
        });

      }

      const result =
        await pool.query(
          `
          SELECT
            id,
            order_no,
            created_at,
            customer_name,
            phone,
            address,
            pincode,
            city,
            state,
            product_id,
            product,
            price,
            quantity,
            delivery,
            total,
            payment_method,
            payment_status,
            utr,
            order_status,
            awb,
            shiprocket_status,
            cancellation_reason

          FROM orders

          WHERE phone = $1

          ORDER BY id DESC
          `,
          [phone]
        );

      res.json({
        success: true,
        orders: result.rows
      });

    } catch (error) {

      console.error(
        "ORDER HISTORY ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Order history load नहीं हो सकी।"
      });

    }

  }
);

/* =========================================================
   ORDER DETAILS
========================================================= */

app.get(
  "/api/orders/:orderNo",
  async (req, res) => {

    try {

      const orderNo =
        String(
          req.params.orderNo || ""
        ).trim();

      const result =
        await pool.query(
          `
          SELECT *

          FROM orders

          WHERE order_no = $1

          LIMIT 1
          `,
          [orderNo]
        );

      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          error:
            "Order नहीं मिला।"
        });

      }

      res.json({
        success: true,
        order: result.rows[0]
      });

    } catch (error) {

      console.error(
        "ORDER DETAILS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Order details load नहीं हो सकी।"
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
        String(
          req.params.orderNo || ""
        ).trim();

      const reason =
        String(
          req.body.reason || ""
        ).trim();

      const result =
        await pool.query(
          `
          SELECT *

          FROM orders

          WHERE order_no = $1

          LIMIT 1
          `,
          [orderNo]
        );

      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          error:
            "Order नहीं मिला।"
        });

      }

      const order =
        result.rows[0];

      if (
        [
          "cancelled",
          "shipped",
          "delivered"
        ].includes(
          String(
            order.order_status
          ).toLowerCase()
        )
      ) {

        return res.status(400).json({
          error:
            "यह order अब cancel नहीं किया जा सकता।"
        });

      }

      await pool.query(
        `
        UPDATE orders

        SET

          order_status = 'cancelled',

          cancellation_reason = $1

        WHERE order_no = $2
        `,
        [
          reason ||
            "Customer requested cancellation",

          orderNo
        ]
      );

      res.json({

        success: true,

        message:
          "Order cancel कर दिया गया।"

      });

    } catch (error) {

      console.error(
        "CANCEL ORDER ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Order cancel नहीं हो सका।"
      });

    }

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
        await pool.query(
          `
          SELECT
            id,
            name,
            rating,
            review,
            created_at

          FROM reviews

          WHERE status = 'approved'

          ORDER BY id DESC
          `
        );

      res.json({
        success: true,
        reviews: result.rows
      });

    } catch (error) {

      console.error(
        "PUBLIC REVIEWS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Reviews load नहीं हो सके।"
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
        String(
          req.body.name || ""
        ).trim();

      const review =
        String(
          req.body.review || ""
        ).trim();

      const rating =
        Number(
          req.body.rating
        );

      if (!name) {

        return res.status(400).json({
          error:
            "कृपया नाम डालें।"
        });

      }

      if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      ) {

        return res.status(400).json({
          error:
            "Rating 1 से 5 stars के बीच होनी चाहिए।"
        });

      }

      if (!review) {

        return res.status(400).json({
          error:
            "कृपया review लिखें।"
        });

      }

      await pool.query(
        `
        INSERT INTO reviews (

          name,

          rating,

          review,

          status,

          created_at

        )

        VALUES (

          $1,

          $2,

          $3,

          'pending',

          $4

        )
        `,
        [

          name,

          rating,

          review,

          new Date().toISOString()

        ]
      );

      res.status(201).json({

        success: true,

        message:
          "Review submit हो गया। Admin approval के बाद दिखाई देगा।"

      });

    } catch (error) {

      console.error(
        "CREATE REVIEW ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Review submit नहीं हो सका।"
      });

    }

  }
);

/* =========================================================
   ADMIN AUTH
========================================================= */

function requireAdmin(
  req,
  res,
  next
) {

  if (
    req.session &&
    req.session.isAdmin === true
  ) {

    return next();

  }

  return res.status(401).json({
    error:
      "Admin login required."
  });
}

/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post(
  "/api/admin/login",
  (req, res) => {

    const username =
      String(
        req.body.username || ""
      );

    const password =
      String(
        req.body.password || ""
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
        success: true,
        message:
          "Admin login successful."
      });

    }

    return res.status(401).json({
      error:
        "Username या password गलत है।"
    });

  }
);

/* =========================================================
   ADMIN LOGOUT
========================================================= */

app.post(
  "/api/admin/logout",
  requireAdmin,
  (req, res) => {

    req.session.destroy(
      (error) => {

        if (error) {

          return res.status(500).json({
            error:
              "Logout नहीं हो सका।"
          });

        }

        res.json({
          success: true
        });

      }
    );

  }
);

/* =========================================================
   ADMIN CHECK
========================================================= */

app.get(
  "/api/admin/me",
  (req, res) => {

    res.json({

      loggedIn:
        !!(
          req.session &&
          req.session.isAdmin === true
        )

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
        await pool.query(
          `
          SELECT *

          FROM orders

          ORDER BY id DESC
          `
        );

      res.json({
        success: true,
        orders: result.rows
      });

    } catch (error) {

      console.error(
        "ADMIN ORDERS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Orders load नहीं हो सके।"
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
        Number(req.params.id);

      const orderStatus =
        String(
          req.body.order_status || ""
        ).trim();

      const paymentStatus =
        String(
          req.body.payment_status || ""
        ).trim();

      const shiprocketStatus =
        String(
          req.body.shiprocket_status || ""
        ).trim();

      const awb =
        String(
          req.body.awb || ""
        ).trim();

      if (
        !Number.isInteger(id)
      ) {

        return res.status(400).json({
          error:
            "Invalid order ID."
        });

      }

      const result =
        await pool.query(
          `
          UPDATE orders

          SET

            order_status =
              COALESCE(
                NULLIF($1, ''),
                order_status
              ),

            payment_status =
              COALESCE(
                NULLIF($2, ''),
                payment_status
              ),

            shiprocket_status =
              COALESCE(
                NULLIF($3, ''),
                shiprocket_status
              ),

            awb =
              COALESCE(
                NULLIF($4, ''),
                awb
              )

          WHERE id = $5

          RETURNING *
          `,
          [

            orderStatus,

            paymentStatus,

            shiprocketStatus,

            awb,

            id

          ]
        );

      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          error:
            "Order नहीं मिला।"
        });

      }

      res.json({

        success: true,

        order:
          result.rows[0]

      });

    } catch (error) {

      console.error(
        "ADMIN UPDATE ORDER ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Order update नहीं हो सका।"
      });

    }

  }
);

/* =========================================================
   ADMIN DELETE ORDER
========================================================= */

app.delete(
  "/api/admin/orders/:id",
  requireAdmin,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id)
      ) {

        return res.status(400).json({
          error:
            "Invalid order ID."
        });

      }

      const result =
        await pool.query(
          `
          DELETE FROM orders

          WHERE id = $1

          RETURNING id
          `,
          [id]
        );

      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          error:
            "Order नहीं मिला।"
        });

      }

      res.json({
        success: true
      });

    } catch (error) {

      console.error(
        "ADMIN DELETE ORDER ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Order delete नहीं हो सका।"
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
        await pool.query(
          `
          SELECT *

          FROM reviews

          ORDER BY id DESC
          `
        );

      res.json({
        success: true,
        reviews: result.rows
      });

    } catch (error) {

      console.error(
        "ADMIN REVIEWS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Reviews load नहीं हो सके।"
      });

    }

  }
);

/* =========================================================
   ADMIN UPDATE REVIEW
========================================================= */

app.patch(
  "/api/admin/reviews/:id",
  requireAdmin,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      const status =
        String(
          req.body.status || ""
        ).trim();

      if (
        !Number.isInteger(id)
      ) {

        return res.status(400).json({
          error:
            "Invalid review ID."
        });

      }

      if (
        ![
          "pending",
          "approved",
          "hidden"
        ].includes(status)
      ) {

        return res.status(400).json({
          error:
            "Invalid review status."
        });

      }

      const result =
        await pool.query(
          `
          UPDATE reviews

          SET status = $1

          WHERE id = $2

          RETURNING *
          `,
          [
            status,
            id
          ]
        );

      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          error:
            "Review नहीं मिला।"
        });

      }

      res.json({

        success: true,

        review:
          result.rows[0]

      });

    } catch (error) {

      console.error(
        "ADMIN UPDATE REVIEW ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Review update नहीं हो सका।"
      });

    }

  }
);

/* =========================================================
   ADMIN DELETE REVIEW
========================================================= */

app.delete(
  "/api/admin/reviews/:id",
  requireAdmin,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id)
      ) {

        return res.status(400).json({
          error:
            "Invalid review ID."
        });

      }

      const result =
        await pool.query(
          `
          DELETE FROM reviews

          WHERE id = $1

          RETURNING id
          `,
          [id]
        );

      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          error:
            "Review नहीं मिला।"
        });

      }

      res.json({
        success: true
      });

    } catch (error) {

      console.error(
        "ADMIN DELETE REVIEW ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Review delete नहीं हो सका।"
      });

    }

  }
);

/* =========================================================
   STATIC FILES
========================================================= */

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);

/* =========================================================
   ADMIN PAGE
========================================================= */

app.get(
  "/admin",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "admin.html"
      )
    );

  }
);

/* =========================================================
   ROOT PAGE
========================================================= */

app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );

  }
);

/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {

    res.status(404).json({
      error:
        "Page / API route नहीं मिला।"
    });

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
      "SERVER START ERROR:",
      error
    );

    process.exit(1);

  });
