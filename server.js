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
   STATIC FILES
========================================================= */

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

app.use(
  express.static(__dirname)
);


/* =========================================================
   PRODUCTS
========================================================= */

const products = [
  {
    id: "10-dryfruit",
    name: "10 सामग्री - Only Dryfruits",
    price: 1600
  },

  {
    id: "23-seeds-dryfruit",
    name: "23 सामग्री - Seeds & Dryfruits",
    price: 1300
  },

  {
    id: "30-seeds-dryfruit",
    name: "30 सामग्री - Seeds & Dryfruits",
    price: 1600
  },

  {
    id: "10-seeds-dryfruit",
    name: "10 सामग्री - Seeds & Dryfruits",
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
      data
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
    "Shiprocket login successful."
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


    ...(SHIPROCKET_CHANNEL_ID &&
      /^\d+$/.test(
        String(SHIPROCKET_CHANNEL_ID)
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
    "Sending order to Shiprocket:",
    order.order_no
  );


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
      "SHIPROCKET ORDER API FAILED:",
      data
    );

    throw new Error(
      data.message ||
      data.error ||
      JSON.stringify(data)
    );
  }


  console.log(
    "Shiprocket order created:",
    data
  );


  return data;
}


/* =========================================================
   WEBSITE - CREATE ORDER
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


      /* =====================================================
         SEND ORDER TO SHIPROCKET
      ===================================================== */

      let shiprocketSuccess =
        false;

      let shiprocketData =
        null;


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
            shiprocket_error = ''

          WHERE id = ?

        `).run(

          shiprocketOrderId,

          shipmentId,

          "created",

          result.lastInsertRowid
        );


      } catch (shipErr) {

        console.error(
          "Shiprocket sync error:",
          shipErr
        );


        db.prepare(`

          UPDATE orders

          SET
            shiprocket_status = ?,
            shiprocket_error = ?

          WHERE id = ?

        `).run(

          "failed",

          String(
            shipErr.message ||
            shipErr
          ),

          result.lastInsertRowid
        );
      }


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

            : "ऑर्डर वेबसाइट पर सेव हो गया है, लेकिन Shiprocket में भेजने में समस्या आई।"
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
   CUSTOMER - CHECK ORDER
========================================================= */

app.post(
  "/api/orders/check",
  (req, res) => {

    try {

      const {
        orderNo,
        phone
      } = req.body;


      if (
        !orderNo ||
        !phone ||
        !/^\d{10}$/.test(
          String(phone)
        )
      ) {

        return res.status(400).json({

          error:
            "Order Number और सही Mobile Number डालें।"

        });
      }


      const order =
        db.prepare(`

          SELECT
            order_no,
            created_at,
            customer_name,
            phone,
            product,
            quantity,
            total,
            payment_method,
            payment_status,
            order_status,
            shiprocket_status,
            shiprocket_awb

          FROM orders

          WHERE order_no = ?
          AND phone = ?

        `).get(

          String(orderNo).trim(),

          String(phone)
        );


      if (!order) {

        return res.status(404).json({

          error:
            "Order नहीं मिला। Order Number और Mobile Number जांचें।"

        });
      }


      res.json({

        success: true,

        order

      });


    } catch (err) {

      console.error(
        "CHECK ORDER ERROR:",
        err
      );


      res.status(500).json({

        error:
          "Order की जानकारी प्राप्त नहीं हो सकी।"

      });
    }
  }
);


/* =========================================================
   CUSTOMER - CANCEL ORDER
========================================================= */

app.post(
  "/api/orders/cancel",
  (req, res) => {

    try {

      const {
        orderNo,
        phone
      } = req.body;


      /* ---------------------------------------------
         VALIDATION
      --------------------------------------------- */

      if (
        !orderNo ||
        !phone ||
        !/^\d{10}$/.test(
          String(phone)
        )
      ) {

        return res.status(400).json({

          error:
            "Order Number और सही Mobile Number डालें।"

        });
      }


      /* ---------------------------------------------
         FIND ORDER
         Order No + Mobile दोनों जरूरी हैं
      --------------------------------------------- */

      const order =
        db.prepare(`

          SELECT *

          FROM orders

          WHERE order_no = ?
          AND phone = ?

        `).get(

          String(orderNo).trim(),

          String(phone)
        );


      if (!order) {

        return res.status(404).json({

          error:
            "Order नहीं मिला। कृपया Order Number और Mobile Number सही डालें।"

        });
      }


      /* ---------------------------------------------
         ALREADY CANCELLED
      --------------------------------------------- */

      if (
        order.order_status ===
        "cancelled"
      ) {

        return res.json({

          success: true,

          alreadyCancelled: true,

          message:
            "यह Order पहले से Cancelled है।"

        });
      }


      /* ---------------------------------------------
         CUSTOMER CANNOT CANCEL THESE
      --------------------------------------------- */

      const cannotCancel = [

        "packed",
        "shipped",
        "delivered"

      ];


      if (
        cannotCancel.includes(
          order.order_status
        )
      ) {

        return res.status(400).json({

          error:
            `यह Order अब customer द्वारा cancel नहीं किया जा सकता क्योंकि इसका status "${order.order_status}" है।`

        });
      }


      /* ---------------------------------------------
         ONLY NEW / CONFIRMED CAN BE CANCELLED
      --------------------------------------------- */

      if (
        ![
          "new",
          "confirmed"
        ].includes(
          order.order_status
        )
      ) {

        return res.status(400).json({

          error:
            "यह Order अभी customer cancellation के लिए उपलब्ध नहीं है।"

        });
      }


      /* ---------------------------------------------
         CANCEL
      --------------------------------------------- */

      const result =
        db.prepare(`

          UPDATE orders

          SET
            order_status = 'cancelled'

          WHERE id = ?

          AND phone = ?

          AND order_status IN
            ('new', 'confirmed')

        `).run(

          order.id,

          String(phone)
        );


      if (
        result.changes !== 1
      ) {

        return res.status(409).json({

          error:
            "Order cancel नहीं हो सका। कृपया दोबारा कोशिश करें।"

        });
      }


      /* ---------------------------------------------
         RESPONSE
      --------------------------------------------- */

      res.json({

        success: true,

        orderNo:
          order.order_no,

        message:
          "आपका Order successfully cancelled हो गया है।"

      });


    } catch (err) {

      console.error(
        "CUSTOMER CANCEL ERROR:",
        err
      );


      res.status(500).json({

        error:
          "Order cancel नहीं हो सका।"

      });
    }
  }
);


/* =========================================================
   ADMIN AUTHENTICATION
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
   ADMIN SESSION CHECK
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
   ADMIN - ALL ORDERS
========================================================= */

app.get(
  "/api/admin/orders",
  requireAdmin,
  (req, res) => {

    const rows =
      db.prepare(`

        SELECT *

        FROM orders

        ORDER BY id DESC

      `).all();


    res.json(rows);
  }
);


/* =========================================================
   ADMIN - UPDATE ORDER
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
