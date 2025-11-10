import express from "express";
import fetch from "node-fetch";

const app = express();
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
const SHOP = "genuinebillycook.com";

app.get("/pay-balance", async (req, res) => {
  try {
    const orderId = req.query.order_id;
    if (!orderId) return res.status(400).send("Missing order_id");

    const response = await fetch(
      `https://${SHOP}/admin/api/2025-10/orders/${orderId}.json`,
      { headers: { "X-Shopify-Access-Token": ADMIN_TOKEN } }
    );

    if (!response.ok) {
      return res
        .status(response.status)
        .send("Error fetching order: " + (await response.text()));
    }

    const data = await response.json();
    const order = data.order;
    if (!order) return res.status(404).send("Order not found.");

    const canceled = !!order.cancelled_at;
    const fullyPaid =
      order.financial_status === "paid" ||
      (order.total_due ?? 0) <= 0;

    if (canceled || fullyPaid) {
      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;margin-top:96px">
          <h2>Order ${order.name}</h2>
          <p>This order is fully paid or canceled — no balance due.</p>
          <a href="/account" style="border:1px solid #111;padding:8px 14px;border-radius:8px;text-decoration:none;color:#111">Back to Orders</a>
        </body></html>
      `);
    }

    const invoiceUrl = order.invoice_url || order.order_status_url;
    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;margin-top:96px">
        <h2>Pay Remaining Balance for ${order.name}</h2>
        <p>Outstanding: $${Number(
          order.total_due ??
            order.total_price - (order.total_paid_amount || 0)
        ).toFixed(2)}</p>
        <a href="${invoiceUrl}" style="background:#000;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;">Pay in Full</a>
      </body></html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});


// ✅ Inject custom frontend script for hiding "Buy Again" and adding "Pay Remaining Balance"
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

import express from "express";
const app = express();

// Your existing setup (if not already present)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Pay Balance Proxy Route (Shopify → Render)
app.get("/pay-balance", (req, res) => {
  const orderId = req.query.order_id || "unknown";

  // For now, just confirm it’s connected
  res.send(`
    <html>
      <body style="font-family:sans-serif; text-align:center; margin-top:50px;">
        <h2>Shopify App Proxy Connected ✅</h2>
        <p>Order ID: <strong>${orderId}</strong></p>
        <p>This confirms that Shopify → Render proxy is working.</p>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ App running on port ${PORT}`));



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Pay Balance proxy running on port ${PORT}`));
