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

// Pay Balance route - UPDATED PATH
app.get('/apps/pay-balance', async (req, res) => {
  const orderGid = req.query.order_id;

  if (!orderGid) {
    return res.status(400).send('<h1>Error: Missing order ID</h1>');
  }

  // Extract numeric ID from GID
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
      const remainingBalance = parseFloat(order.total_outstanding || 0);
      
      // Return an HTML page for the customer
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Pay Remaining Balance</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .order-info { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
              .amount { font-size: 24px; font-weight: bold; color: #2c6ecb; }
              button { background: #2c6ecb; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
              button:hover { background: #1e5bb8; }
            </style>
          </head>
          <body>
            <h1>Pay Remaining Balance</h1>
            <div class="order-info">
              <p><strong>Order Number:</strong> ${order.name}</p>
              <p><strong>Order Total:</strong> $${order.total_price}</p>
              <p><strong>Amount Paid:</strong> $${(parseFloat(order.total_price) - remainingBalance).toFixed(2)}</p>
              <p class="amount">Remaining Balance: $${remainingBalance.toFixed(2)}</p>
            </div>
            
            ${remainingBalance > 0 ? `
              <p>Click below to complete your payment:</p>
              <button onclick="alert('Payment processing would happen here')">Pay $${remainingBalance.toFixed(2)}</button>
              <p style="color: #666; font-size: 14px; margin-top: 20px;">
                Note: Payment processing integration needed
              </p>
            ` : `
              <p style="color: green;">✓ This order is fully paid!</p>
            `}
          </body>
        </html>
      `);
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
