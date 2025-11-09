import express from "express";
import fetch from "node-fetch";

const app = express();
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
const SHOP = "genuinebillycook.com";

app.get("/pay-balance", async (req, res) => {
  const orderId = req.query.order_id;
  if (!orderId) return res.status(400).send("Missing order_id");

  const response = await fetch(
    `https://${SHOP}/admin/api/2025-10/orders/${orderId}.json`,
    { headers: { "X-Shopify-Access-Token": ADMIN_TOKEN } }
  );

  const { order } = await response.json();

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
});

app.listen(3000, () => console.log("Pay Balance proxy running on port 3000"));
