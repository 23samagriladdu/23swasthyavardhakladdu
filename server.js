require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const Database = require("better-sqlite3");

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
   DATABASE
========================================================= */

const db = new Database(
  path.join(__dirname, "orders.db")
);

db.pragma("journal_mode = WAL");


/* =========================================================
   CREATE ORDERS TABLE
========================================================= */

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    order_no TEXT UNIQUE NOT NULL,

    created_at TEXT NOT NULL,

    customer_name TEXT NOT NULL,

    phone TEXT NOT NULL,

    address TEXT NOT NULL,

    city TEXT DEFAULT '',

    state TEXT DEFAULT '',

    pincode TEXT NOT NULL,

    product_id TEXT DEFAULT '',

    product TEXT NOT NULL,

    price INTEGER NOT NULL,

    quantity REAL NOT NULL,

    delivery INTEGER NOT NULL,

    total INTEGER NOT NULL,

    payment_method TEXT NOT NULL,

    payment_status TEXT NOT NULL DEFAULT 'pending',

    utr TEXT DEFAULT '',

    order_status TEXT NOT NULL DEFAULT 'new',

    awb TEXT DEFAULT '',

    shiprocket_status TEXT DEFAULT '',

    cancellation_reason TEXT DEFAULT ''

  );
`);


/* =========================================================
   DATABASE MIGRATION
========================================================= */

function addColumnIfMissing(
  table,
  column,
  definition
) {

  const columns =
    db
      .prepare(`PRAGMA table_info(${table})`)
      .all();

  const exists =
    columns.some(
      c => c.name === column
    );

  if (!exists) {

    db.exec(
      `ALTER TABLE ${table}
       ADD COLUMN ${column} ${definition}`
    );

    console.log(
      `Database column added: ${column}`
    );

  }

}


/* =========================================================
   OLD DATABASE MIGRATION
========================================================= */

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
  "product_id",
  "TEXT DEFAULT ''"
);

addColumnIfMissing(
  "orders",
  "quantity",
  "REAL NOT NULL DEFAULT 1"
);

addColumnIfMissing(
  "orders",
  "awb",
  "TEXT DEFAULT ''"
);

addColumnIfMissing(
  "orders",
  "shiprocket_status",
  "TEXT DEFAULT ''"
);

addColumnIfMissing(
  "orders",
  "cancellation_reason",
  "TEXT DEFAULT ''"
);


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  express.json()
);

app.use(
  express.urlencoded({
    extended: true
  })
);


/* =========================================================
   SESSION
========================================================= */

app.set(
  "trust proxy",
  1
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

      secure:
        process.env.NODE_ENV === "production",

      maxAge:
        8 * 60 * 60 * 1000

    }

  })
);


/* =========================================================
   STATIC WEBSITE
========================================================= */

app.use(
  express.static(__dirname)
);


/* =========================================================
   PRODUCTS
========================================================= */

const PRODUCTS = [

  /* =======================================================
     4 PRODUCTS — 1 KG
  ======================================================= */

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


  /* =======================================================
     NEW MIX PRODUCTS — 1 KG
  ======================================================= */

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
    name: "23 सीड्स-ड्राई फ्रूट्स (0.5 किलो), 10 ड्राई फ्रूट्स (0.5 किलो) — मिक्स लड्डू 1 किलो",
    price: 1550,
    weight: 1,
    type: "kg",
    image: "dry_fruit.jpeg"
  },

  {
    id: "mix-laddu-2",
    name: "बेसन (0.4 किलो), 23 सीड्स-ड्राई फ्रूट्स (0.3 किलो), 10 ड्राई फ्रूट्स (0.3 किलो) — मिक्स लड्डू 1 किलो",
    price: 1110,
    weight: 1,
    type: "kg",
    image: "mix_ladd-2.jpeg"
  },

  {
    id: "mix-laddu",
    name: "बेसन (0.5 किलो), 23 सीड्स-ड्राई फ्रूट्स (0.4 किलो), 10 ड्राई फ्रूट्स (0.2 किलो) — मिक्स लड्डू 1 किलो",
    price: 1010,
    weight: 1,
    type: "kg",
    image: "mix_laddu-.jpeg"
  },

  {
    id: "mix-laddu-3",
    name: "बेसन (0.5 किलो), 23 सीड्स-ड्राई फ्रूट्स (0.5 किलो) — मिक्स लड्डू 1 किलो",
    price: 1050,
    weight: 1,
    type: "kg",
    image: "mix_laddu-3.jpeg"
  },

  {
    id: "mix-laddu-4",
    name: "बेसन (0.7 किलो), 23 सीड्स-ड्राई फ्रूट्स (0.3 किलो) — मिक्स लड्डू 1 किलो",
    price: 810,
    weight: 1,
    type: "kg",
    image: "mix_laddu-4.jpeg"
  },

    {
    id: "mix-laddu-5",
    name: "बेसन (0.5 किलो), 10 ड्राई फ्रूट्स (0.5 किलो) — मिक्स लड्डू 1 किलो",
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

  /* 1 Kg तक */

  if (weight <= 1) {

    return 100;

  }

  /* 1 Kg से ज्यादा और 2 Kg तक */

  if (weight <= 2) {

    return 200;

  }

  /* 2 Kg से ज्यादा */

  return 300;

}


/* =========================================================
   KG QUANTITY VALIDATION
========================================================= */

function isValidKgQuantity(quantity) {

  const qty =
    Number(quantity);

  if (
    !Number.isFinite(qty)
  ) {

    return false;

  }

  if (
    qty < 0.5 ||
    qty > 50
  ) {

    return false;

  }

  /*
    केवल:

    0.5
    1
    1.5
    2
    2.5
    ...

    allowed
  */

  return Number.isInteger(
    qty * 2
  );

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
    p =>
      p.id === String(productId)
  );

}


/* =========================================================
   CONFIG API
========================================================= */

app.get("/api/config", (req, res) => {
  res.json({
    upiId: UPI_ID,
    upiName: UPI_NAME,

    products: PRODUCTS,

    deliveryRules: {
      upTo1Kg: 100,
      upTo2Kg: 200,
      above2Kg: 300
    }
  });
});


/* =========================================================
   CREATE UNIQUE ORDER NUMBER
========================================================= */

function createOrderNumber() {

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

  } while (

    db
      .prepare(
        "SELECT id FROM orders WHERE order_no = ?"
      )
      .get(orderNo)

  );

  return orderNo;

}


/* =========================================================
   SHIPROCKET TOKEN
========================================================= */

let shiprocketToken =
  null;

let shiprocketTokenTime =
  0;


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


  /*
    Token को 24 घंटे cache करेंगे।
  */

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

        method:
          "POST",

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

      success:
        false,

      skipped:
        true,

      message:
        "Shiprocket environment variables not configured"

    };

  }


  const token =
    await getShiprocketToken();


  const paymentMethod =
    order.payment_method === "COD"
      ? "COD"
      : "Prepaid";


  /*
    Product information से actual product निकालना
  */

  const product =
    getProduct(
      order.product_id
    );


  /*
    KG product:
      quantity = Kg

    PACK product:
      quantity = number of packs

    Pack weight = 0.8 Kg
  */

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


    /* =====================================================
       BILLING
    ===================================================== */

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


    /* =====================================================
       SHIPPING
    ===================================================== */

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


    /* =====================================================
       ORDER ITEM
    ===================================================== */

    order_items: [

      {

        name:
          order.product,

        sku:
          order.product_id ||
          order.order_no,

        /*
          Pack में number of packs जाएगा
          Kg में Kg quantity जाएगी
        */

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
      paymentMethod,

    shipping_charges:
      Number(order.delivery),

    giftwrap_charges:
      0,

    transaction_charges:
      0,

    total_discount:
      0,

    /*
      Product price × quantity
    */

    sub_total:
      Number(order.price) *
      Number(order.quantity),


    /*
      Package dimensions
    */

    length:
      20,

    breadth:
      20,

    height:
      10,


    /*
      IMPORTANT:
      Shiprocket को actual total weight
      भेजना है।
    */

    weight:
      Number(totalWeight)

  };


  const response =
    await fetch(
      "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
      {

        method:
          "POST",

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

    success:
      true,

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


      /* =====================================================
         CLEAN INPUT
      ===================================================== */

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


      /* =====================================================
         CUSTOMER VALIDATION
      ===================================================== */

      if (
        !cleanName
      ) {

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


      if (
        !cleanAddress
      ) {

        return res.status(400).json({

          error:
            "कृपया पूरा पता डालें।"

        });

      }


      if (
        !cleanCity
      ) {

        return res.status(400).json({

          error:
            "कृपया शहर का नाम डालें।"

        });

      }


      if (
        !cleanState
      ) {

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


      /* =====================================================
         PRODUCT VALIDATION
      ===================================================== */

      if (
        !product
      ) {

        return res.status(400).json({

          error:
            "कृपया सही product चुनें।"

        });

      }


      /* =====================================================
         QUANTITY VALIDATION
      =====================================================

         KG PRODUCT
         -----------
         0.5 Kg से 50 Kg

         PACK PRODUCT
         ------------
         1 Pack से 50 Pack
      ===================================================== */

      if (
        product.type === "kg"
      ) {

        if (
          !isValidKgQuantity(
            qty
          )
        ) {

          return res.status(400).json({

            error:
              "Kg मात्रा 0.5 Kg से 50 Kg तक होनी चाहिए और 0.5 Kg के अंतर में होनी चाहिए।"

          });

        }

      } else {

        if (
          !isValidPackQuantity(
            qty
          )
        ) {

          return res.status(400).json({

            error:
              "Pack की संख्या 1 से 50 तक होनी चाहिए।"

          });

        }

      }


      /* =====================================================
         PAYMENT
      ===================================================== */

      const safePayment =
        paymentMethod === "COD"
          ? "COD"
          : "UPI";


      /* =====================================================
         SERVER-SIDE PRICE
      ===================================================== */

      const productTotal =
        Number(product.price) *
        qty;


      /* =====================================================
         TOTAL WEIGHT
      =====================================================

         KG:
           quantity = actual Kg

         PACK:
           quantity = number of packs
           प्रत्येक pack = 0.8 Kg
      ===================================================== */

      const totalWeight =
        product.type === "kg"
          ? qty
          : Number(product.weight) *
            qty;


      /* =====================================================
         DELIVERY
      ===================================================== */

      const delivery =
        getDeliveryCharge(
          totalWeight
        );


      /* =====================================================
         FINAL TOTAL
      ===================================================== */

      const total =
        productTotal +
        delivery;


      /* =====================================================
         ORDER NUMBER
      ===================================================== */

      const orderNo =
        createOrderNumber();


      const createdAt =
        new Date()
          .toISOString();


      /* =====================================================
         PAYMENT STATUS
      ===================================================== */

      const paymentStatus =
        safePayment === "UPI" &&
        cleanUtr
          ? "submitted"
          : "pending";


      /* =====================================================
         SAVE ORDER
      ===================================================== */

      const stmt =
        db.prepare(`

          INSERT INTO orders (

            order_no,

            created_at,

            customer_name,

            phone,

            address,

            city,

            state,

            pincode,

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

          )

          VALUES (

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
            ?,
            ?,
            ?

          )

        `);


      stmt.run(

        orderNo,

        createdAt,

        cleanName,

        cleanPhone,

        cleanAddress,

        cleanCity,

        cleanState,

        cleanPincode,

        product.id,

        product.name,

        product.price,

        qty,

        delivery,

        total,

        safePayment,

        paymentStatus,

        cleanUtr,

        "new",

        "",

        "",

        ""

      );


      /* =====================================================
         GET SAVED ORDER
      ===================================================== */

      let savedOrder =
        db
          .prepare(
            "SELECT * FROM orders WHERE order_no = ?"
          )
          .get(orderNo);


      /* =====================================================
         SHIPROCKET
      ===================================================== */

      let shiprocketMessage =
        "";


      try {

        const sr =
          await createShiprocketOrder(
            savedOrder
          );


        if (
          sr &&
          sr.success
        ) {

          const srData =
            sr.data || {};


          const awb =
            srData.awb_code ||
            "";


          const srStatus =
            srData.status ||
            srData.shipment_status ||
            "Created";


          db.prepare(`

            UPDATE orders

            SET

              awb = ?,

              shiprocket_status = ?

            WHERE order_no = ?

          `).run(

            awb,

            String(srStatus),

            orderNo

          );


          shiprocketMessage =
            " Shipment में भेज दिया गया है।";

        }

      } catch (
        shiprocketError
      ) {

        console.error(
          "SHIPROCKET ERROR:",
          shiprocketError.message
        );

        /*
          Shiprocket fail होने पर भी
          customer का order database में save रहेगा।
        */

        shiprocketMessage =
          "";

      }


      /* =====================================================
         SUCCESS RESPONSE
      ===================================================== */

      return res.json({

        success:
          true,

        orderNo,

        total,

        productTotal,

        delivery,

        quantity:
          qty,

        productType:
          product.type,

        packWeight:
          product.type === "pack"
            ? Number(product.weight)
            : null,

        totalWeight,

        paymentStatus,

        message:
          safePayment === "UPI"

            ? (
                "ऑर्डर सेव हो गया है। " +
                "UPI payment के बाद UTR/Reference admin द्वारा verify किया जाएगा." +
                shiprocketMessage
              )

            : (
                "ऑर्डर सेव हो गया है। " +
                "Cash on Delivery चुना गया है." +
                shiprocketMessage
              )

      });


    } catch (
      error
    ) {

      console.error(
        "ORDER ERROR:",
        error
      );


      return res.status(500).json({

        error:
          "ऑर्डर सेव नहीं हो सका। कृपया दोबारा कोशिश करें।"

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
        )
          .replace(/\D/g, "");


      if (
        !/^\d{10}$/.test(
          phone
        )
      ) {

        return res.status(400).json({

          error:
            "सही 10 अंकों का mobile number डालें।"

        });

      }


      const rows =
        db.prepare(`

          SELECT *

          FROM orders

          WHERE phone = ?

          ORDER BY id DESC

        `).all(phone);


      const orders =
        rows.map(
          mapOrderForCustomer
        );


      return res.json({

        count:
          orders.length,

        orders

      });


    } catch (
      error
    ) {

      console.error(
        "HISTORY ERROR:",
        error
      );


      return res.status(500).json({

        error:
          "Orders load नहीं हो सके।"

      });

    }

  }
);


/* =========================================================
   CUSTOMER ORDER DETAILS
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
        )
          .replace(/\D/g, "");


      if (
        !orderNo ||
        !/^\d{10}$/.test(
          phone
        )
      ) {

        return res.status(400).json({

          error:
            "Order No. और सही mobile number आवश्यक है।"

        });

      }


      const row =
        db.prepare(`

          SELECT *

          FROM orders

          WHERE order_no = ?

          AND phone = ?

        `).get(

          orderNo,

          phone

        );


      if (!row) {

        return res.status(404).json({

          error:
            "Order details नहीं मिली।"

        });

      }


      return res.json({

        order:
          mapOrderDetails(row)

      });


    } catch (
      error
    ) {

      console.error(
        "DETAIL ERROR:",
        error
      );


      return res.status(500).json({

        error:
          "Order details load नहीं हो सकीं।"

      });

    }

  }
);


/* =========================================================
   CUSTOMER CANCEL ORDER
========================================================= */

app.post(
  "/api/orders/cancel",
  (req, res) => {

    try {

      const orderNo =
        String(
          req.body.orderNo || ""
        ).trim();


      const phone =
        String(
          req.body.phone || ""
        )
          .replace(/\D/g, "");


      const reason =
        String(
          req.body.reason || ""
        ).trim();


      if (
        !orderNo
      ) {

        return res.status(400).json({

          error:
            "Order No. डालें।"

        });

      }


      if (
        !/^\d{10}$/.test(
          phone
        )
      ) {

        return res.status(400).json({

          error:
            "सही 10 अंकों का mobile number डालें।"

        });

      }


      const order =
        db.prepare(`

          SELECT *

          FROM orders

          WHERE order_no = ?

          AND phone = ?

        `).get(

          orderNo,

          phone

        );


      if (!order) {

        return res.status(404).json({

          error:
            "Order नहीं मिला।"

        });

      }


      const cancellableStatuses = [

        "new",

        "confirmed",

        "packed"

      ];


      if (
        !cancellableStatuses.includes(
          order.order_status
        )
      ) {

        return res.status(400).json({

          error:
            "यह Order अब cancel नहीं किया जा सकता।"

        });

      }


      db.prepare(`

        UPDATE orders

        SET

          order_status =
            'cancelled',

          cancellation_reason = ?

        WHERE order_no = ?

        AND phone = ?

      `).run(

        reason,

        orderNo,

        phone

      );


      return res.json({

        success:
          true,

        orderNo,

        message:
          "Order successfully cancelled."

      });


    } catch (
      error
    ) {

      console.error(
        "CANCEL ERROR:",
        error
      );


      return res.status(500).json({

        error:
          "Order cancel नहीं हुआ।"

      });

    }

  }
);


/* =========================================================
   CAN CANCEL ORDER
========================================================= */

function canCancelOrder(
  order
) {

  return [

    "new",

    "confirmed",

    "packed"

  ].includes(
    order.order_status
  );

}


/* =========================================================
   GET PRODUCT TYPE / WEIGHT
========================================================= */

function getOrderProductInfo(
  order
) {

  const product =
    getProduct(
      order.product_id
    );


  if (!product) {

    return {

      type:
        "kg",

      packWeight:
        null,

      totalWeight:
        Number(
          order.quantity
        )

    };

  }


  const totalWeight =
    product.type === "kg"
      ? Number(order.quantity)
      : Number(product.weight) *
        Number(order.quantity);


  return {

    type:
      product.type,

    packWeight:
      product.type === "pack"
        ? Number(product.weight)
        : null,

    totalWeight

  };

}


/* =========================================================
   CUSTOMER ORDER MAPPER
========================================================= */

function mapOrderForCustomer(
  order
) {

  const productInfo =
    getOrderProductInfo(
      order
    );


  return {

    id:
      order.id,

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

    city:
      order.city,

    state:
      order.state,

    pincode:
      order.pincode,

    product:
      order.product,

    price:
      order.price,

    quantity:
      order.quantity,

    productType:
      productInfo.type,

    packWeight:
      productInfo.packWeight,

    totalWeight:
      productInfo.totalWeight,

    delivery:
      order.delivery,

    total:
      order.total,

    paymentMethod:
      order.payment_method,

    paymentStatus:
      order.payment_status,

    utr:
      order.utr,

    orderStatus:
      order.order_status,

    awb:
      order.awb,

    shiprocketStatus:
      order.shiprocket_status,

    cancellationReason:
      order.cancellation_reason,

    canCancel:
      canCancelOrder(order)

  };

}


/* =========================================================
   CUSTOMER ORDER DETAILS MAPPER
========================================================= */

function mapOrderDetails(
  order
) {

  const productInfo =
    getOrderProductInfo(
      order
    );


  return {

    id:
      order.id,

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

    city:
      order.city,

    state:
      order.state,

    pincode:
      order.pincode,

    product:
      order.product,

    price:
      order.price,

    quantity:
      order.quantity,

    productType:
      productInfo.type,

    packWeight:
      productInfo.packWeight,

    totalWeight:
      productInfo.totalWeight,

    delivery:
      order.delivery,

    total:
      order.total,

    paymentMethod:
      order.payment_method,

    paymentStatus:
      order.payment_status,

    utr:
      order.utr,

    orderStatus:
      order.order_status,

    awb:
      order.awb,

    shiprocketStatus:
      order.shiprocket_status,

    cancellationReason:
      order.cancellation_reason,

    canCancel:
      canCancelOrder(order)

  };

}


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


    return res.status(401).json({

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
   ADMIN SESSION CHECK
========================================================= */

app.get(
  "/api/admin/me",
  (req, res) => {

    res.json({

      loggedIn:
        Boolean(

          req.session &&
          req.session.admin

        )

    });

  }
);


/* =========================================================
   ADMIN GET ORDERS
========================================================= */

app.get(
  "/api/admin/orders",
  requireAdmin,
  (req, res) => {

    try {

      const rows =
        db.prepare(`

          SELECT *

          FROM orders

          ORDER BY id DESC

        `).all();


      /*
        Admin में भी product type,
        pack weight और total weight
        भेजेंगे।
      */

      const orders =
        rows.map(
          order => {

            const info =
              getOrderProductInfo(
                order
              );


            return {

              ...order,

              product_type:
                info.type,

              pack_weight:
                info.packWeight,

              total_weight:
                info.totalWeight

            };

          }
        );


      res.json(
        orders
      );


    } catch (
      error
    ) {

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
  (req, res) => {

    try {

      const id =
        Number(
          req.params.id
        );


      const {

        orderStatus,

        paymentStatus,

        awb,

        shiprocketStatus

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
          "SELECT * FROM orders WHERE id = ?"
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
            ),

          awb =
            COALESCE(
              ?,
              awb
            ),

          shiprocket_status =
            COALESCE(
              ?,
              shiprocket_status
            )

        WHERE id = ?

      `).run(

        orderStatus ||
          null,

        paymentStatus ||
          null,

        awb !== undefined
          ? String(awb)
          : null,

        shiprocketStatus !== undefined
          ? String(shiprocketStatus)
          : null,

        id

      );


      return res.json({

        success:
          true

      });


    } catch (
      error
    ) {

      console.error(
        "ADMIN UPDATE ERROR:",
        error
      );


      return res.status(500).json({

        error:
          "Order update नहीं हुआ।"

      });

    }

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
   ROOT
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
   ERROR HANDLER
========================================================= */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {

    console.error(
      "SERVER ERROR:",
      err
    );


    res.status(500).json({

      error:
        "Server error"

    });

  }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `23 Swasthyavardhak Laddu running on port ${PORT}`
    );

  }
);
