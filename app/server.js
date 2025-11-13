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

// Pay Balance route - Auto-send invoice
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
    // First, get the order details
    const orderUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/orders/${orderId}.json`;
    const orderResponse = await fetch(orderUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      return res.status(orderResponse.status).send(`<h1>Error fetching order</h1><p>${JSON.stringify(orderData.errors)}</p>`);
    }

    const order = orderData.order;
    const remainingBalance = parseFloat(order.total_outstanding || 0);

    // Send invoice via Shopify API
    const invoiceUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/orders/${orderId}/invoice.json`;
    const invoiceResponse = await fetch(invoiceUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoice: {
          subject: `Payment Required for Order ${order.name}`,
          to: order.email,
          custom_message: `Your order has a remaining balance of $${remainingBalance.toFixed(2)}. Please click the button below to complete your payment using your preferred payment method.`
        }
      })
    });

    // Log the response for debugging
    console.log('Invoice API Status:', invoiceResponse.status);

    // Check if invoice was sent successfully (204 = success with no content)
    if (invoiceResponse.status === 204 || invoiceResponse.ok) {
      // Invoice sent successfully
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Payment Link Sent</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                max-width: 600px; 
                margin: 50px auto; 
                padding: 20px; 
                text-align: center;
                background: #f9fafb;
              }
              .success { 
                background: white;
                padding: 40px; 
                border-radius: 12px; 
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                margin: 20px 0; 
              }
              .checkmark {
                font-size: 64px;
                color: #10b981;
                margin-bottom: 20px;
              }
              h1 {
                color: #111827;
                margin-bottom: 10px;
              }
              .email {
                font-size: 18px;
                font-weight: 600;
                color: #2563eb;
                margin: 20px 0;
              }
              .amount { 
                font-size: 32px; 
                font-weight: bold; 
                color: #10b981; 
                margin: 20px 0; 
              }
              .info {
                color: #6b7280;
                line-height: 1.6;
              }
              .payment-methods {
                margin-top: 30px;
                padding-top: 30px;
                border-top: 1px solid #e5e7eb;
              }
              .payment-methods p {
                color: #6b7280;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="success">
              <div class="checkmark">✓</div>
              <h1>Payment Link Sent!</h1>
              <p class="info">We've sent a secure payment link to:</p>
              <p class="email">${order.email}</p>
              <p class="amount">$${remainingBalance.toFixed(2)}</p>
              <p class="info">
                Please check your email inbox (and spam folder) for the payment link.<br>
                The email should arrive within a few moments.
              </p>
              <div class="payment-methods">
                <p><strong>Available payment methods:</strong><br>
                Apple Pay • Google Pay • Credit/Debit Card</p>
              </div>
              <p style="margin-top: 30px; color: #9ca3af; font-size: 12px;">Order ${order.name}</p>
            </div>
          </body>
        </html>
      `);
    } else {
      // Error sending invoice
      const responseText = await invoiceResponse.text();
      console.log('Invoice API Error Response:', responseText);
      
      res.status(invoiceResponse.status).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error Sending Invoice</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .error { background: #fee; padding: 20px; border-radius: 8px; border-left: 4px solid #c00; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>Unable to Send Payment Link</h1>
              <p>There was an error sending the payment link. Please contact support.</p>
              <p><small>Status: ${invoiceResponse.status}</small></p>
            </div>
          </body>
        </html>
      `);
    }

  } catch (error) {
    console.error('Error:', error);
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

