function renderProducts() {

  const grid =
    document.getElementById("productGrid");

  if (!config || !Array.isArray(config.products)) {

    grid.innerHTML =
      "<p>Products उपलब्ध नहीं हैं।</p>";

    return;

  }

  if (config.products.length === 0) {

    grid.innerHTML =
      "<p>अभी कोई product उपलब्ध नहीं है।</p>";

    return;

  }

  grid.innerHTML =
    config.products.map(p => `

      <div class="product-card">

        <img
          src="${escapeHtml(p.image || "laddu-main.png")}"
          alt="${escapeHtml(p.name)}"
          loading="lazy"
          style="
            width:100%;
            height:180px;
            object-fit:cover;
            border-radius:12px;
            margin-bottom:12px;
          "
        >

        <h3>
          ${escapeHtml(p.name)}
        </h3>

        <p>
          <strong>
            ${money(p.price)}
          </strong>
          / Kg
        </p>

        <p>
          ⚖️ वजन:
          <strong>
            ${escapeHtml(p.weight || "0.5–50 Kg")}
          </strong>
        </p>

        <button
          type="button"
          class="primary-btn"
          onclick="selectProduct('${escapeJs(p.id)}')">

          यह पैक चुनें

        </button>

      </div>

    `).join("");

}
