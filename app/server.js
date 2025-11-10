import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// ✅ Secure Admin API setup
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;  // <— reads from Render environment
const SHOP = "0fme0w-es.myshopify.com";            // use .myshopify.com, not .com

// ✅ Handles Shopify App Proxy and direct Render requests (merged route)
app.get(["/", "/apps/pay-balance", "/pay-balance"], async (req, res) => {
  try {
    const orderId = req.query.order_id || req.query.orderId;
    if (!orderId) return res.status(400).send("Missing order_id");

    // --- Fetch order details from Shopify Admin API ---
    const response = await fetch(
      `https://${SHOP}/admin/api/2024-10/orders/${orderId}.json`,
      {
        headers: {
          "X-Shopify-Access-Token": ADMIN_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      return res
        .status(response.status)
        .send("Error fetching order: " + (await response.text()));
    }

    const data = await response.json();
    const order = data.order;
    if (!order) return res.status(404).send("Order not found.");

    // --- Determine order payment state ---
    const canceled = !!order.cancelled_at;
    const isPending =
      ["pending", "partially_paid"].includes(order.financial_status);

    if (canceled) {
      return res.send(`
        <html>
          <body style="
            font-family: Georgia, 'Times New Roman', serif;
            background-color: #D2C2A7;
            color: #1C1C1C;
            text-align: center;
            margin-top: 96px;
          ">
            <h2 style="letter-spacing:1px;">Order ${order.name}</h2>
            <p>This order has been canceled — no balance due.</p>
            <a href="/account" style="
              display:inline-block;
              border:1px solid #1C1C1C;
              padding:10px 18px;
              border-radius:6px;
              text-decoration:none;
              color:#1C1C1C;
              margin-top:16px;
              font-weight:600;
            ">Back to Orders</a>
          </body>
        </html>
      `);
    }

if (isPending) {
  const due = Number(
    order.total_due ??
    order.total_price - (order.total_paid_amount || 0)
  ).toFixed(2);
  const invoiceUrl = order.invoice_url || order.order_status_url;

  // 🔁 If Shopify returned an active invoice URL, redirect the user there
  if (invoiceUrl && invoiceUrl.includes("checkout") || invoiceUrl.includes("payments")) {
    console.log(`Redirecting to invoice for order ${order.name}: ${invoiceUrl}`);
    return res.redirect(invoiceUrl);
  }

  // 🧾 Otherwise, render the fallback page (if no invoice URL yet)
  return res.send(`
    <html>
      <body style="
        font-family: Georgia, 'Times New Roman', serif;
        background-color: #D2C2A7;
        color: #1C1C1C;
        text-align: center;
        margin-top: 96px;
      ">
        <h2 style="letter-spacing:1px;">Pay Remaining Balance for ${order.name}</h2>
        <p style="font-size:18px;margin-bottom:30px;">
          Outstanding: <strong>$${due}</strong>
        </p>
        <p style="max-width:480px;margin:0 auto 24px;">
          A payment link for this order hasn’t been generated yet.
          Please check your email or contact us for assistance.
        </p>
        <a href="/account" style="
          display:inline-block;
          border:1px solid #1C1C1C;
          padding:10px 18px;
          border-radius:6px;
          text-decoration:none;
          color:#1C1C1C;
          font-weight:600;
        ">Back to Orders</a>
      </body>
    </html>
  `);
}


    // --- Default: fully paid ---
    return res.send(`
      <html>
        <body style="
          font-family: Georgia, 'Times New Roman', serif;
          background-color: #D2C2A7;
          color: #1C1C1C;
          text-align: center;
          margin-top: 96px;
        ">
          <h2 style="letter-spacing:1px;">Order ${order.name}</h2>
          <p>This order is fully paid — no balance due.</p>
          <a href="/account" style="
            display:inline-block;
            border:1px solid #1C1C1C;
            padding:10px 18px;
            border-radius:6px;
            text-decoration:none;
            color:#1C1C1C;
            margin-top:16px;
            font-weight:600;
          ">Back to Orders</a>
        </body>
      </html>
    `);

  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});


/**
 * 🧩 FRONTEND INJECTOR (optional)
 * Hides “Buy Again” and adds “Pay Remaining Balance” link on account pages.
 */
app.get("/inject-script.js", (req, res) => {
  res.type("application/javascript").send(`
    document.addEventListener("DOMContentLoaded", () => {
      const observer = new MutationObserver(() => {
        const orderId = document.querySelector("[data-order-id]")?.dataset.orderId;
        const paymentInfo = document.body.textContent.toLowerCase();
        const buyAgainBtn = [...document.querySelectorAll("button, a")]
          .find(btn => btn.textContent.trim() === "Buy again");

        const isWholesaleInvoice =
          paymentInfo.includes("net 30") ||
          paymentInfo.includes("invoice") ||
          paymentInfo.includes("pending payment");

        if (isWholesaleInvoice && buyAgainBtn) {
          buyAgainBtn.style.display = "none";

          const payBtn = document.createElement("a");
          payBtn.href = \`/apps/pay-balance?order_id=\${orderId}\`;
          payBtn.textContent = "Pay Remaining Balance";
          payBtn.className = "pay-balance-link";
          payBtn.style = \`
            display:inline-block;
            background-color:#0A213E;
            color:#fff;
            padding:10px 20px;
            border-radius:6px;
            text-decoration:none;
            font-weight:600;
            transition:all 0.2s ease-in-out;
          \`;
          payBtn.onmouseover = () => (payBtn.style.backgroundColor = "#000");
          payBtn.onmouseout = () => (payBtn.style.backgroundColor = "#0A213E");

          const targetContainer =
            document.querySelector("[data-order-id]") ||
            document.querySelector(".order-summary") ||
            document.querySelector("main");

          if (targetContainer && !document.querySelector(".pay-balance-link")) {
            targetContainer.appendChild(payBtn);
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Pay Balance App running on port ${PORT}`));
