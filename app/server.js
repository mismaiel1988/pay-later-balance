import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

import cors from 'cors';
dotenv.config();
const app = express();
app.use(cors());


// Load environment variables
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const PORT = process.env.PORT || 10000;

// Helper function to extract numeric ID from GID
function extractOrderId(gid) {
  // Converts "gid://shopify/Order/123456" to "123456"
  const match = gid.match(/\/Order\/(\d+)/);
  return match ? match[1] : null;
}

// Test route (optional)
app.get('/', (req, res) => {
  res.send('✅ Pay Later Balance App is live and connected to Shopify API');
});

// Pay Balance route - Direct checkout link
app.get('/apps/pay-balance', async (req, res) => {
  const orderGid = req.query.order_id;

  if (!orderGid) {
    return res.status(400).send('<h1>Error: Missing order ID</h1>');
  }

  const orderId = extractOrderId(orderGid);
  
  if (!orderId) {
    return res.status(400).send('<h1>Error: Invalid order ID format</h1>');
  }

  try {
    const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/orders/${orderId}.json`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      const order = data.order;
      
      // Check if order has a checkout token
      if (order.checkout_token) {
        // Build the checkout recovery URL
        const checkoutUrl = `https://${SHOPIFY_STORE_DOMAIN.replace('.myshopify.com', '')}.myshopify.com/checkouts/${order.checkout_token}/recover`;
        res.redirect(checkoutUrl);
      } else {
        // No checkout token available
        const remainingBalance = parseFloat(order.total_outstanding || 0);
        res.send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Payment Not Available</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                .info { background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; }
              </style>
            </head>
            <body>
              <h1>Payment Link Unavailable</h1>
              <div class="info">
                <p><strong>Order:</strong> ${order.name}</p>
                <p><strong>Balance Due:</strong> $${remainingBalance.toFixed(2)}</p>
                <p>Please contact support to receive a payment link for this order.</p>
                <p>Email: ${order.email}</p>
              </div>
            </body>
          </html>
        `);
      }
    } else {
      res.status(response.status).send(`<h1>Error fetching order</h1><p>${JSON.stringify(data.errors)}</p>`);
    }

  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).send(`<h1>Server Error</h1><p>${error.message}</p>`);
  }
});

// JSON API endpoint for extension to check payment status
app.get('/api/order-payment-status', async (req, res) => {
  const orderGid = req.query.order_id;

  if (!orderGid) {
    return res.status(400).json({ error: 'Missing order ID' });
  }

  const orderId = extractOrderId(orderGid);
  
  if (!orderId) {
    return res.status(400).json({ error: 'Invalid order ID format' });
  }

  try {
    const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/orders/${orderId}.json`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      const order = data.order;
      const remainingBalance = parseFloat(order.total_outstanding || 0);
      
      // Return JSON for the extension
      res.json({
        orderId: order.id,
        orderName: order.name,
        totalPrice: parseFloat(order.total_price),
        remainingBalance: remainingBalance,
        hasOutstandingBalance: remainingBalance > 0,
        financialStatus: order.financial_status
      });
    } else {
      res.status(response.status).json({ error: 'Failed to fetch order', details: data.errors });
    }

  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Pay Balance App running on port ${PORT}`);
  console.log(`🌐 Store: ${SHOPIFY_STORE_DOMAIN}`);
});

