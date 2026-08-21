require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();

const PORT = Number(process.env.PORT || 3000);

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME || "admin";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "CHANGE_THIS_PASSWORD";

const UPI_ID =
  process.env.UPI_ID || "YOUR-UPI-ID@upi";

const UPI_NAME =
  process.env.UPI_NAME ||
  "23 Swasthyavardhak Samaan";

const DELIVERY = 300;


/* =========================================================
   SHIPROCKET SETTINGS
   ========================================================= */

const SHIPROCKET_API_EMAIL =
  process.env.SHIPROCKET_API_EMAIL || "";

const SHIPROCKET_API_PASSWORD =
  process.env.SHIPROCKET_API_PASSWORD || "";

const SHIPROCKET_PICKUP_LOCATION =
  process.env.SHIPROCKET_PICKUP_LOCATION || "Home";

const SHIPROCKET_CHANNEL_ID =
  process.env.SHIPROCKET_CHANNEL_ID || "";


/* =========================================================
   PACKAGE SETTINGS
   ========================================================= */

const PACKAGE_LENGTH =
  Number(process.env.PACKAGE_LENGTH || 10);

const PACKAGE_BREADTH =
  Number(process.env.PACKAGE_BREADTH || 10);

const PACKAGE_HEIGHT =
  Number(process.env.PACKAGE_HEIGHT || 10);

const PACKAGE_WEIGHT =
  Number(process.env.PACKAGE_WEIGHT || 0.5);


/* =========================================================
   DATABASE
   ========================================================= */

const db = new Database(
  path.join(__dirname, "orders.db")
);

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

  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  country TEXT DEFAULT 'India',

  product TEXT NOT NULL,
  sku TEXT DEFAULT '',

  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,

  delivery INTEGER NOT NULL,
  total INTEGER NOT NULL,

  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',

  utr TEXT DEFAULT '',

  order_status TEXT NOT NULL DEFAULT 'new',

  shiprocket_order_id TEXT DEFAULT '',
  shiprocket_shipment_id TEXT DEFAULT '',
  shiprocket_awb TEXT DEFAULT '',
  shiprocket_status TEXT DEFAULT '',
  shiprocket_error TEXT DEFAULT ''
);
`);


/* =========================================================
   DATABASE MIGRATION
   ========================================================= */

function addColumnIfMissing(
  tableName,
  columnName,
  columnDefinition
) {
  const columns =
    db
      .prepare(
        `PRAGMA table_info(${tableName})`
      )
      .all();

  const exists =
    columns.some(
      column =>
        column.name === columnName
    );

  if (!exists) {
    db.exec(
      `ALTER TABLE ${tableName}
       ADD COLUMN ${columnName}
       ${columnDefinition}`
    );
  }
}


addColumnIfMissing(
  "orders",
  "city",
  "TEXT DEFAULT ''"
);

addColumnIfMissing(
  "orders",
  "state",
  "TEXT DEFAULT ''"
);

addColumnIfMissing(
  "orders",
  "country",
  "TEXT DEFAULT 'India'"
);

addColumnIfMissing(
  "orders",
  "sku",
  "TEXT DEFAULT ''"
);

addColumnIfMissing(
  "orders",
  "shiprocket_order_id",
  "TEXT DEFAULT ''"
);

addColumnIfMissing(
  "orders",
  "shiprocket_shipment_id",
  "TEXT DEFAULT ''"
);

addColumnIfMissing(
  "orders",
  "shiprocket_awb",
  "TEXT DEFAULT ''"
);

addColumnIfMissing(
  "orders",
  "shiprocket_status",
  "TEXT DEFAULT ''"
);

addColumnIfMissing(
  "orders",
  "shiprocket_error",
  "TEXT DEFAULT ''"
);


/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "replace-this-session-secret",

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge:
        8 * 60 * 60 * 1000
    }
  })
);


/* =========================================================
   PRODUCTS
   ========================================================= */

const products = [
  {
    id: "10-dryfruit",
    name:
      "10 सामग्री - Only Dryfruits",
    price: 1600
  },

  {
    id: "23-seeds-dryfruit",
    name:
      "23 सामग्री - Seeds & Dryfruits",
    price: 1300
  },

  {
    id: "30-seeds-dryfruit",
    name:
      "30 सामग्री - Seeds & Dryfruits",
    price: 1600
  },

  {
    id: "10-seeds-dryfruit",
    name:
      "10 सामग्री - Seeds & Dryfruits",
    price: 600
  }
];


/* =========================================================
   CONFIG API
   ========================================================= */

app.get(
  "/api/config",
  (req, res) => {

    res.json({
      upiId: UPI_ID,
      upiName: UPI_NAME,
      delivery: DELIVERY,
      products
    });
  }
);


/* =========================================================
   CUSTOMER NAME HELPER
   ========================================================= */

/*
   Shiprocket में first name और last name
   दोनों जरूरी हो सकते हैं।

   उदाहरण:

   "Ramesh Kumar"
   first name = Ramesh
   last name  = Kumar

   "Ramesh"
   first name = Ramesh
   last name  = Customer
*/

function splitCustomerName(fullName) {

  const cleaned =
    String(fullName || "")
      .trim()
      .replace(/\s+/g, " ");

  const parts =
    cleaned.split(" ");

  const firstName =
    parts.shift() || "Customer";

  const lastName =
    parts.join(" ") || "Customer";

  return {
    firstName,
    lastName
  };
}


/* =========================================================
   SHIPROCKET TOKEN
   ========================================================= */

let shiprocketToken = "";
let shiprocketTokenCreatedAt = 0;


async function getShiprocketToken() {

  if (
    !SHIPROCKET_API_EMAIL ||
    !SHIPROCKET_API_PASSWORD
  ) {

    throw new Error(
      "Shiprocket API credentials are not configured."
    );
  }


  const TOKEN_VALIDITY =
    9 * 24 * 60 * 60 * 1000;


  if (
    shiprocketToken &&
    Date.now() -
      shiprocketTokenCreatedAt <
      TOKEN_VALIDITY
  ) {

    return shiprocketToken;
  }


  console.log(
    "Shiprocket: Trying API login..."
  );

  console.log(
    "Shiprocket API email:",
    SHIPROCKET_API_EMAIL
  );


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
            email:
              SHIPROCKET_API_EMAIL,

            password:
              SHIPROCKET_API_PASSWORD
          })
      }
    );


  const data =
    await response.json();


  console.log(
    "Shiprocket login HTTP status:",
    response.status
  );


  if (
    !response.ok ||
    !data.token
  ) {

    console.error(
      "Shiprocket login failed:",
      {
        status:
          response.status,

        message:
          data.message || "",

        error:
          data.error || ""
      }
    );


    throw new Error(
      data.message ||
      data.error ||
      `Shiprocket login failed with HTTP ${response.status}`
    );
  }


  shiprocketToken =
    data.token;

  shiprocketTokenCreatedAt =
    Date.now();


  console.log(
    "Shiprocket login successful. Token received."
  );


  return shiprocketToken;
}


/* =========================================================
   CREATE ORDER IN SHIPROCKET
   ========================================================= */

async function createShiprocketOrder(order) {

  const token =
    await getShiprocketToken();


  if (
    !order.city ||
    !order.state
  ) {

    throw new Error(
      "Customer city/state missing."
    );
  }


  /*
     IMPORTANT FIX:

     Shiprocket billing_last_name
     और shipping_last_name मांग रहा है।
  */

  const customerName =
    splitCustomerName(
      order.customer_name
    );


  const payload = {

    order_id:
      String(order.order_no),


    order_date:
      new Date(order.created_at)
        .toISOString()
        .slice(0, 16)
        .replace("T", " "),


    pickup_location:
      SHIPROCKET_PICKUP_LOCATION,


    /*
       channel_id तभी भेजेंगे जब
       Render में valid numeric ID दिया गया हो।
    */

    ...(SHIPROCKET_CHANNEL_ID &&
      /^\d+$/.test(
        String(
          SHIPROCKET_CHANNEL_ID
        )
      )
      ? {
          channel_id:
            Number(
              SHIPROCKET_CHANNEL_ID
            )
        }
      : {}),


    company_name:
      "23 Swasthyavardhak Ladoo",


    /* =====================================================
       BILLING
       ===================================================== */

    billing_customer_name:
      customerName.firstName,

    billing_last_name:
      customerName.lastName,

    billing_address:
      order.address,

    billing_city:
      order.city,

    billing_pincode:
      Number(order.pincode),

    billing_state:
      order.state,

    billing_country:
      "India",

    billing_phone:
      String(order.phone),


    /* =====================================================
       SHIPPING
       ===================================================== */

    shipping_is_billing:
      true,


    shipping_customer_name:
      customerName.firstName,

    shipping_last_name:
      customerName.lastName,

    shipping_address:
      order.address,

    shipping_city:
      order.city,

    shipping_pincode:
      Number(order.pincode),

    shipping_state:
      order.state,

    shipping_country:
      "India",

    shipping_phone:
      String(order.phone),


    /* =====================================================
       PRODUCTS
       ===================================================== */

    order_items: [

      {
        name:
          order.product,

        sku:
          order.sku ||
          "23-LADOO",

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


    /* =====================================================
       PAYMENT
       ===================================================== */

    payment_method:
      order.payment_method ===
      "UPI"
        ? "Prepaid"
        : "COD",


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


    /* =====================================================
       PACKAGE
       ===================================================== */

    length:
      Number(PACKAGE_LENGTH),

    breadth:
      Number(PACKAGE_BREADTH),

    height:
      Number(PACKAGE_HEIGHT),

    weight:
      Number(PACKAGE_WEIGHT)
  };


  console.log(
    "========================================"
  );

  console.log(
    "Sending order to Shiprocket:",
    order.order_no
  );

  console.log(
    "Shiprocket pickup location:",
    SHIPROCKET_PICKUP_LOCATION
  );

  console.log(
    "Shiprocket channel ID:",
    SHIPROCKET_CHANNEL_ID
      ? SHIPROCKET_CHANNEL_ID
      : "NOT SET - using Default Custom channel"
  );

  console.log(
    "Shiprocket customer first name:",
    customerName.firstName
  );

  console.log(
    "Shiprocket customer last name:",
    customerName.lastName
  );


  /* =====================================================
     SEND API REQUEST
     ===================================================== */

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
          JSON.stringify(payload)
      }
    );


  const data =
    await response.json();


  console.log(
    "Shiprocket order API HTTP status:",
    response.status
  );


  if (!response.ok) {

    console.error(
      "========================================"
    );

    console.error(
      "SHIPROCKET ORDER API FAILED"
    );

    console.error(
      "HTTP STATUS:",
      response.status
    );

    console.error(
      "RESPONSE:",
      data
    );

    console.error(
      "========================================"
    );


    throw new Error(
      data.message ||
      data.error ||
      JSON.stringify(data)
    );
  }


  console.log(
    "Shiprocket order created successfully:"
  );

  console.log(
    data
  );


  return data;
}


/* =========================================================
   CREATE WEBSITE ORDER
   ========================================================= */

app.post(
  "/api/orders",
  async (req, res) => {

    try {

      const {
        name,
        phone,
        address,
        pincode,
        city,
        state,
        productId,
        quantity,
        paymentMethod,
        utr
      } = req.body;


      const product =
        products.find(
          p =>
            p.id === productId
        );


      const qty =
        Number(quantity);


      /* ===================================================
         VALIDATION
         =================================================== */

      if (
        !name ||
        !/^\d{10}$/.test(
          String(phone)
        ) ||
        !address ||
        !/^\d{6}$/.test(
          String(pincode)
        ) ||
        !city ||
        !state ||
        !product ||
        !Number.isInteger(qty) ||
        qty < 1 ||
        qty > 50
      ) {

        return res.status(400).json({

          error:
            "कृपया नाम, मोबाइल, पूरा पता, शहर, राज्य और सही पिनकोड भरें।"

        });
      }


      const safePayment =
        paymentMethod === "UPI"
          ? "UPI"
          : "COD";


      const productTotal =
        product.price * qty;


      const total =
        productTotal + DELIVERY;


      const orderNo =
        "23L" +
        Date.now()
          .toString()
          .slice(-9);


      const createdAt =
        new Date().toISOString();


      /* ===================================================
         SAVE ORDER
         =================================================== */

      const stmt =
        db.prepare(`

          INSERT INTO orders
          (
            order_no,
            created_at,

            customer_name,
            phone,
            address,
            pincode,

            city,
            state,
            country,

            product,
            sku,
            price,
            quantity,

            delivery,
            total,

            payment_method,
            payment_status,
            utr,

            order_status
          )

          VALUES
          (
            ?,
            ?,

            ?,
            ?,
            ?,
            ?,

            ?,
            ?,
            ?,

            ?,
            ?,
            ?,
            ?,

            ?,
            ?,

            ?,
            ?,
            ?,

            ?
          )

        `);


      const result =
        stmt.run(

          orderNo,
          createdAt,

          name.trim(),
          String(phone),
          address.trim(),
          String(pincode),

          city.trim(),
          state.trim(),
          "India",

          product.name,
          product.id,
          product.price,
          qty,

          DELIVERY,
          total,

          safePayment,

          safePayment === "UPI"
            ? "submitted"
            : "pending",

          (utr || "").trim(),

          "new"
        );


      const localOrder =
        db.prepare(
          "SELECT * FROM orders WHERE id = ?"
        ).get(
          result.lastInsertRowid
        );


      /* ===================================================
         SHIPROCKET
         =================================================== */

      let shiprocketSuccess =
        false;

      let shiprocketData =
        null;

      let shiprocketError =
        "";


      try {

        shiprocketData =
          await createShiprocketOrder(
            localOrder
          );


        shiprocketSuccess =
          true;


        const shiprocketOrderId =
          shiprocketData.order_id
            ? String(
                shiprocketData.order_id
              )
            : "";


        const shipmentId =
          shiprocketData.shipment_id
            ? String(
                shiprocketData.shipment_id
              )
            : "";


        db.prepare(`

          UPDATE orders

          SET
            shiprocket_order_id = ?,
            shiprocket_shipment_id = ?,
            shiprocket_status = ?,
            shiprocket_error = ?

          WHERE id = ?

        `).run(

          shiprocketOrderId,

          shipmentId,

          "created",

          "",

          result.lastInsertRowid
        );


      } catch (shipErr) {

        shiprocketError =
          String(
            shipErr.message ||
            shipErr
          );


        console.error(
          "Shiprocket sync error:",
          shiprocketError
        );


        db.prepare(`

          UPDATE orders

          SET
            shiprocket_status = ?,
            shiprocket_error = ?

          WHERE id = ?

        `).run(

          "failed",

          shiprocketError,

          result.lastInsertRowid
        );
      }


      /* ===================================================
         CUSTOMER RESPONSE
         =================================================== */

      res.json({

        success: true,

        orderNo,

        total,

        paymentStatus:
          safePayment === "UPI"
            ? "submitted"
            : "pending",

        shiprocket:
          shiprocketSuccess
            ? "created"
            : "failed",

        message:

          shiprocketSuccess

            ? (

                safePayment === "UPI"

                  ? "ऑर्डर सफलतापूर्वक सेव हो गया और Shiprocket में भेज दिया गया है। UPI payment के बाद UTR verify किया जाएगा।"

                  : "ऑर्डर सफलतापूर्वक सेव हो गया और Shiprocket में भेज दिया गया है।"

              )

            : (

                "ऑर्डर वेबसाइट पर सेव हो गया है, लेकिन Shiprocket में भेजने में समस्या आई।"

              )
      });


    } catch (err) {

      console.error(
        "Order API Error:",
        err
      );


      res.status(500).json({

        error:
          "ऑर्डर सेव नहीं हो सका।"

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
    req.session.admin
  ) {

    return next();
  }


  return res.status(401).json({

    error:
      "Unauthorized"

  });
}


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

app.post(
  "/api/admin/login",
  (req, res) => {

    const {
      username,
      password
    } = req.body;


    if (
      username ===
        ADMIN_USERNAME &&
      password ===
        ADMIN_PASSWORD
    ) {

      req.session.admin =
        true;


      return res.json({
        success: true
      });
    }


    res.status(401).json({

      error:
        "गलत username या password"

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
          success: true
        });

      }
    );
  }
);


/* =========================================================
   ADMIN SESSION
   ========================================================= */

app.get(
  "/api/admin/me",
  (req, res) => {

    res.json({

      loggedIn:
        !!(
          req.session &&
          req.session.admin
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
  (req, res) => {

    const rows =
      db.prepare(
        "SELECT * FROM orders ORDER BY id DESC"
      ).all();


    res.json(rows);
  }
);


/* =========================================================
   ADMIN UPDATE ORDER
   ========================================================= */

app.patch(
  "/api/admin/orders/:id",
  requireAdmin,
  (req, res) => {

    const id =
      Number(req.params.id);


    const {
      orderStatus,
      paymentStatus
    } = req.body;


    const allowedOrder = [

      "new",
      "confirmed",
      "packed",
      "shipped",
      "delivered",
      "cancelled"

    ];


    const allowedPayment = [

      "pending",
      "submitted",
      "paid",
      "failed",
      "refunded"

    ];


    if (
      orderStatus &&
      !allowedOrder.includes(
        orderStatus
      )
    ) {

      return res.status(400).json({

        error:
          "Invalid order status"

      });
    }


    if (
      paymentStatus &&
      !allowedPayment.includes(
        paymentStatus
      )
    ) {

      return res.status(400).json({

        error:
          "Invalid payment status"

      });
    }


    const row =
      db.prepare(
        "SELECT * FROM orders WHERE id=?"
      ).get(id);


    if (!row) {

      return res.status(404).json({

        error:
          "Order not found"

      });
    }


    db.prepare(`

      UPDATE orders

      SET
        order_status =
          COALESCE(
            ?,
            order_status
          ),

        payment_status =
          COALESCE(
            ?,
            payment_status
          )

      WHERE id=?

    `).run(

      orderStatus || null,

      paymentStatus || null,

      id
    );


    res.json({
      success: true
    });
  }
);


/* =========================================================
   STATIC FILES
   ========================================================= */

app.use(
  express.static(__dirname)
);


/* =========================================================
   HOME PAGE
   ========================================================= */

app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );
  }
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
        "admin.html"
      )
    );
  }
);


/* =========================================================
   SERVER START
   ========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      `23 Swasthyavardhak Laddu running on port ${PORT}`
    );

    console.log(
      `Shiprocket integration: ${
        SHIPROCKET_API_EMAIL
          ? "CONFIGURED"
          : "NOT CONFIGURED"
      }`
    );

    console.log(
      `Shiprocket pickup location: ${
        SHIPROCKET_PICKUP_LOCATION
      }`
    );
  }
);
