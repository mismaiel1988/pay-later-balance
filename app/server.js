import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

// Load environment variables
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const PORT = process.env.PORT || 10000;

// Test route (optional)
app.get('/', (req, res) => {
  res.send('✅ Pay Later Balance App is live and connected to Shopify API');
});

// Pay Balance route
app.get('/pay-balance', async (req, res) => {
  const orderId = req.query.order_id;

  if (!orderId) {
    return res.status(400).json({ error: 'Missing order_id parameter' });
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
      res.json(data);
    } else {
      res.status(response.status).json({ error: data.errors || 'Failed to fetch order' });
    }

  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Pay Balance App running on port ${PORT}`);
  console.log(`🌐 Store: ${SHOPIFY_STORE_DOMAIN}`);
});
