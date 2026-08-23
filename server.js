require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();

const PORT = Number(process.env.PORT || 3000);

/* =========================================================
   BASIC SETTINGS
   ========================================================= */

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME || "admin";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "CHANGE_THIS_PASSWORD";

const UPI_ID =
  process.env.UPI_ID || "YOUR-UPI-ID@upi";

const UPI_NAME =
  process.env.UPI_NAME || "23 Swasthyavardhak Samaan";


/*
  DELIVERY CHARGE

  500 gram = ₹100
  1 kg     = ₹200
  1.5 kg   = ₹300
  2 kg     = ₹400

  1 quantity = 500 gram
*/
const DELIVERY_PER_500G = 100;

const PRODUCT_WEIGHT_KG = 0.5;


/* =========================================================
   DELIVERY CALCULATOR
   ========================================================= */

function calculateDelivery(quantity) {
  const qty = Number(quantity);

  if (!Number.isInteger(qty) || qty < 1) {
    return 0;
  }

  return qty * DELIVERY_PER_500G;
}


/*
  Examples:

  quantity 1 = 500g  = ₹100
  quantity 2 = 1kg   = ₹200
  quantity 3 = 1.5kg = ₹300
  quantity 4 = 2kg   = ₹400
*/


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

  shiprocket_error TEXT DEFAULT '',

  cancellation_reason TEXT DEFAULT '',

  cancelled_at TEXT DEFAULT ''
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
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all();

  const exists = columns.some(
    column => column.name === columnName
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

addColumnIfMissing(
  "orders",
  "cancellation_reason",
  "TEXT DEFAULT ''"
);

addColumnIfMissing(
  "orders",
  "cancelled_at",
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


/* =========================================================
   SESSION
   ========================================================= */

app.set("trust proxy", 1);

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "23-Swasthyavardhak-Change-This-Secret",

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000
    }
  })
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

      deliveryPer500g:
        DELIVERY_PER_500G,

      productWeightKg:
        PRODUCT_WEIGHT_KG,

      products

    });

  }
);


/* =========================================================
   SPLIT CUSTOMER NAME
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

        body: JSON.stringify({

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
    "Shiprocket login successful."
  );


  return shiprocketToken;
}


/* =========================================================
   CREATE SHIPROCKET ORDER
   ========================================================= */

async function createShiprocketOrder(
  order
) {

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


  /*
    Package weight is based on quantity.

    1 quantity = 500g
    2 quantity = 1kg
    3 quantity = 1.5kg
  */

  const totalWeight =
    Number(order.quantity) *
    PRODUCT_WEIGHT_KG;


  /*
    Delivery charge is also based on quantity.

    1 quantity = ₹100
    2 quantity = ₹200
    3 quantity = ₹300
  */

  const deliveryCharge =
    calculateDelivery(
      order.quantity
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


    /* BILLING */

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


    /* SHIPPING */

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


    /* PRODUCTS */

    order_items: [

      {

        name:
          order.product,

        sku:
          order.sku ||
          "23-LADOO",

        units:
          Number(
            order.quantity
          ),

        selling_price:
          Number(
            order.price
          ),

        discount:
          0,

        tax:
          0,

        hsn:
          ""
      }

    ],


    /* PAYMENT */

    payment_method:
      order.payment_method === "UPI"
        ? "Prepaid"
        : "COD",

    shipping_charges:
      deliveryCharge,

    giftwrap_charges:
      0,

    transaction_charges:
      0,

    total_discount:
      0,

    sub_total:
      Number(order.price) *
      Number(order.quantity),


    /* PACKAGE */

    length:
      PACKAGE_LENGTH,

    breadth:
      PACKAGE_BREADTH,

    height:
      PACKAGE_HEIGHT,

    weight:
      totalWeight
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
            payload
          )
      }
    );


  let data = {};

  try {

    data =
      await response.json();

  } catch (_) {

    data = {};
  }


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
   CANCEL SHIPROCKET ORDER
   ========================================================= */

async function cancelShiprocketOrder(
  shiprocketOrderId
) {

  if (!shiprocketOrderId) {

    return {
      success: false,
      skipped: true,
      message:
        "Shiprocket order ID उपलब्ध नहीं है।"
    };
  }


  const token =
    await getShiprocketToken();


  const numericId =
    Number(
      shiprocketOrderId
    );


  if (
    !Number.isInteger(
      numericId
    )
  ) {

    throw new Error(
      "Invalid Shiprocket order ID."
    );
  }


  const response =
    await fetch(
      "https://apiv2.shiprocket.in/v1/external/orders/cancel",
      {
        method: "POST",

        headers: {

          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`

        },

        body:
          JSON.stringify({

            ids: [
              numericId
            ]

          })
      }
    );


  if (
    response.status === 204
  ) {

    return {
      success: true,
      message:
        "Shiprocket order cancelled."
    };
  }


  let data = {};

  try {

    data =
      await response.json();

  } catch (_) {}


  if (!response.ok) {

    throw new Error(
      data.message ||
      data.error ||
      `Shiprocket cancellation failed with HTTP ${response.status}`
    );
  }


  return {
    success: true,
    data
  };
}


/* =========================================================
   CANCEL SHIPROCKET SHIPMENT BY AWB
   ========================================================= */

async function cancelShiprocketShipment(
  awb
) {

  if (!awb) {

    return {
      success: false,
      skipped: true,
      message:
        "AWB उपलब्ध नहीं है।"
    };
  }


  const token =
    await getShiprocketToken();


  const response =
    await fetch(
      "https://apiv2.shiprocket.in/v1/external/orders/cancel/shipment/awbs",
      {
        method: "POST",

        headers: {

          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`

        },

        body:
          JSON.stringify({

            awbs: [
              String(awb)
            ]

          })
      }
    );


  if (
    response.status === 204
  ) {

    return {
      success: true,
      message:
        "Shiprocket shipment cancellation request sent."
    };
  }


  let data = {};

  try {

    data =
      await response.json();

  } catch (_) {}


  if (!response.ok) {

    throw new Error(
      data.message ||
      data.error ||
      `Shipment cancellation failed with HTTP ${response.status}`
    );
  }


  return {
    success: true,
    data
  };
}


/* =========================================================
   CUSTOMER CREATE ORDER
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
            p.id ===
            productId
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

        !Number.isInteger(
          qty
        ) ||

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


      /*
        PRODUCT TOTAL

        Example:
        ₹1300 × 1 = ₹1300
        ₹1300 × 2 = ₹2600
      */

      const productTotal =
        product.price *
        qty;


      /*
        DELIVERY

        500g = ₹100
        1kg = ₹200
        1.5kg = ₹300
        2kg = ₹400
      */

      const delivery =
        calculateDelivery(qty);


      /*
        FINAL TOTAL
      */

      const total =
        productTotal +
        delivery;


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
            ?,?,?,?,?,?,?,?,?,?,
            ?,?,?,?,?,?,?,?,?
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

          delivery,

          total,

          safePayment,

          safePayment === "UPI"
            ? "submitted"
            : "pending",

          (utr || "")
            .trim(),

          "new"

        );


      const localOrder =
        db.prepare(
          "SELECT * FROM orders WHERE id = ?"
        ).get(
          result.lastInsertRowid
        );


      let shiprocketSuccess =
        false;


      try {

        const shiprocketData =
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


        const awb =
          shiprocketData.awb_code
            ? String(
                shiprocketData.awb_code
              )
            : "";


        db.prepare(`

          UPDATE orders

          SET

            shiprocket_order_id = ?,

            shiprocket_shipment_id = ?,

            shiprocket_awb = ?,

            shiprocket_status = ?,

            shiprocket_error = ?

          WHERE id = ?

        `).run(

          shiprocketOrderId,

          shipmentId,

          awb,

          "created",

          "",

          result.lastInsertRowid

        );


      } catch (shipErr) {

        const shiprocketError =
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


      res.json({

        success: true,

        orderNo,

        productTotal,

        delivery,

        total,

        quantity: qty,

        weightKg:
          qty * PRODUCT_WEIGHT_KG,

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
   CUSTOMER ORDER HISTORY
   ========================================================= */

app.get(
  "/api/orders/history",
  (req, res) => {

    try {

      const phone =
        String(
          req.query.phone || ""
        ).replace(
          /\D/g,
          ""
        );


      if (
        !/^\d{10}$/.test(phone)
      ) {

        return res.status(400).json({

          error:
            "कृपया 10 अंकों का सही मोबाइल नंबर डालें।"

        });
      }


      const rows =
        db.prepare(`

          SELECT

            order_no,

            created_at,

            customer_name,

            phone,

            address,

            pincode,

            city,

            state,

            product,

            quantity,

            price,

            delivery,

            total,

            payment_method,

            payment_status,

            order_status,

            shiprocket_awb,

            shiprocket_status,

            cancellation_reason,

            cancelled_at

          FROM orders

          WHERE phone = ?

          ORDER BY id DESC

        `).all(phone);


      const orders =
        rows.map(order => ({

          orderNo:
            order.order_no,

          createdAt:
            order.created_at,

          customerName:
            order.customer_name,

          product:
            order.product,

          quantity:
            order.quantity,

          weightKg:
            Number(order.quantity) *
            PRODUCT_WEIGHT_KG,

          price:
            order.price,

          delivery:
            order.delivery,

          total:
            order.total,

          paymentMethod:
            order.payment_method,

          paymentStatus:
            order.payment_status,

          orderStatus:
            order.order_status,

          awb:
            order.shiprocket_awb || "",

          shiprocketStatus:
            order.shiprocket_status || "",

          cancellationReason:
            order.cancellation_reason || "",

          cancelledAt:
            order.cancelled_at || "",

          canCancel:
            ![
              "shipped",
              "delivered",
              "cancelled"
            ].includes(
              order.order_status
            )

        }));


      res.json({

        success: true,

        phone,

        count:
          orders.length,

        orders

      });


    } catch (err) {

      console.error(
        "Order history error:",
        err
      );


      res.status(500).json({

        error:
          "Order history load नहीं हो सकी।"

      });
    }
  }
);


/* =========================================================
   CUSTOMER SINGLE ORDER DETAILS
   ========================================================= */

app.post(
  "/api/orders/details",
  (req, res) => {

    try {

      const orderNo =
        String(
          req.body.orderNo || ""
        ).trim();


      const phone =
        String(
          req.body.phone || ""
        ).replace(
          /\D/g,
          ""
        );


      if (

        !orderNo ||

        !/^\d{10}$/.test(phone)

      ) {

        return res.status(400).json({

          error:
            "Order No. और सही Mobile Number डालें।"

        });
      }


      const order =
        db.prepare(`

          SELECT *

          FROM orders

          WHERE order_no = ?

          AND phone = ?

          LIMIT 1

        `).get(

          orderNo,

          phone

        );


      if (!order) {

        return res.status(404).json({

          error:
            "Order No. और Mobile Number का मिलान नहीं हुआ।"

        });
      }


      res.json({

        success: true,

        order: {

          orderNo:
            order.order_no,

          createdAt:
            order.created_at,

          customerName:
            order.customer_name,

          phone:
            order.phone,

          address:
            order.address,

          pincode:
            order.pincode,

          city:
            order.city,

          state:
            order.state,

          product:
            order.product,

          quantity:
            order.quantity,

          weightKg:
            Number(order.quantity) *
            PRODUCT_WEIGHT_KG,

          price:
            order.price,

          delivery:
            order.delivery,

          total:
            order.total,

          paymentMethod:
            order.payment_method,

          paymentStatus:
            order.payment_status,

          orderStatus:
            order.order_status,

          awb:
            order.shiprocket_awb || "",

          shiprocketStatus:
            order.shiprocket_status || "",

          cancellationReason:
            order.cancellation_reason || "",

          cancelledAt:
            order.cancelled_at || "",

          canCancel:
            ![
              "shipped",
              "delivered",
              "cancelled"
            ].includes(
              order.order_status
            )

        }

      });


    } catch (err) {

      console.error(
        "Order details error:",
        err
      );


      res.status(500).json({

        error:
          "Order details load नहीं हो सके।"

      });
    }
  }
);


/* =========================================================
   CUSTOMER ORDER CANCELLATION
   ========================================================= */

app.post(
  "/api/orders/cancel",
  async (req, res) => {

    try {

      const {

        orderNo,

        phone,

        reason

      } = req.body;


      const cleanOrderNo =
        String(
          orderNo || ""
        ).trim();


      const cleanPhone =
        String(
          phone || ""
        ).replace(
          /\D/g,
          ""
        );


      if (

        !cleanOrderNo ||

        !/^\d{10}$/.test(
          cleanPhone
        )

      ) {

        return res.status(400).json({

          error:
            "कृपया सही Order No. और 10 अंकों का मोबाइल नंबर डालें।"

        });
      }


      const order =
        db.prepare(`

          SELECT *

          FROM orders

          WHERE order_no = ?

          AND phone = ?

          LIMIT 1

        `).get(

          cleanOrderNo,

          cleanPhone

        );


      if (!order) {

        return res.status(404).json({

          error:
            "Order No. और Mobile Number का मिलान नहीं हुआ।"

        });
      }


      if (
        order.order_status ===
        "cancelled"
      ) {

        return res.status(400).json({

          error:
            "यह order पहले ही cancelled है।"

        });
      }


      const blockedStatuses = [

        "shipped",

        "delivered",

        "cancelled"

      ];


      if (
        blockedStatuses.includes(
          order.order_status
        )
      ) {

        return res.status(400).json({

          error:
            "इस order को अब website से cancel नहीं किया जा सकता। कृपया customer support से संपर्क करें।"

        });
      }


      let shiprocketErrors =
        [];


      /* CANCEL SHIPMENT */

      if (
        order.shiprocket_awb
      ) {

        try {

          await cancelShiprocketShipment(
            order.shiprocket_awb
          );

        } catch (err) {

          shiprocketErrors.push(

            "Shipment cancellation: " +

            String(
              err.message ||
              err
            )

          );
        }
      }


      /* CANCEL ORDER */

      if (
        order.shiprocket_order_id
      ) {

        try {

          await cancelShiprocketOrder(
            order.shiprocket_order_id
          );

        } catch (err) {

          shiprocketErrors.push(

            "Order cancellation: " +

            String(
              err.message ||
              err
            )

          );
        }
      }


      if (
        shiprocketErrors.length > 0
      ) {

        db.prepare(`

          UPDATE orders

          SET

            shiprocket_status = ?,

            shiprocket_error = ?

          WHERE id = ?

        `).run(

          "cancellation_failed",

          shiprocketErrors.join(
            " | "
          ),

          order.id

        );


        return res.status(409).json({

          success: false,

          error:
            "Shiprocket में cancellation पूरा नहीं हो सका। Order को cancelled नहीं किया गया।",

          details:
            shiprocketErrors

        });
      }


      const cancelledAt =
        new Date().toISOString();


      db.prepare(`

        UPDATE orders

        SET

          order_status = ?,

          cancellation_reason = ?,

          cancelled_at = ?,

          shiprocket_status = ?,

          shiprocket_error = ?

        WHERE id = ?

      `).run(

        "cancelled",

        String(
          reason || ""
        )
          .trim()
          .slice(0, 500),

        cancelledAt,

        "cancelled",

        "",

        order.id

      );


      res.json({

        success: true,

        orderNo:
          order.order_no,

        message:
          "आपका order successfully cancelled हो गया है।"

      });


    } catch (err) {

      console.error(
        "Customer cancellation error:",
        err
      );


      res.status(500).json({

        error:
          "Order cancellation में समस्या आई। कृपया बाद में फिर प्रयास करें।"

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

        success:
          true

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

          success:
            true

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
      db.prepare(`

        SELECT *

        FROM orders

        ORDER BY id DESC

      `).all();


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
      Number(
        req.params.id
      );


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

      orderStatus ||
        null,

      paymentStatus ||
        null,

      id

    );


    res.json({

      success:
        true

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
   HOME
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
   ADMIN
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


    console.log(
      `Delivery charge: ₹${DELIVERY_PER_500G} per 500 gram`
    );

  }
);
