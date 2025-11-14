import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();
const app = express();
app.use(cors());

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const PORT = process.env.PORT || 10000;

function extractOrderId(gid) {
  const match = gid.match(/\/Order\/(\d+)/);
  return match ? match[1] : null;
}

function extractCustomerId(gid) {
  const match = gid.match(/\/Customer\/(\d+)/);
  return match ? match[1] : null;
}

async function shopifyGraphQL(query) {
  const graphqlUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/graphql.json`;
  const response = await fetch(graphqlUrl, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  return response.json();
}

app.get('/', (req, res) => {
  res.send('✅ Pay Later Balance App is live');
});

// API endpoint to check order payment status
app.get('/api/order-payment-status', async (req, res) => {
  try {
    const orderGid = req.query.order_id;
    
    if (!orderGid) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const orderId = extractOrderId(orderGid);
    
    const query = `
      query {
        order(id: "gid://shopify/Order/${orderId}") {
          id
          name
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalOutstandingSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          financialStatus
        }
      }
    `;

    const data = await shopifyGraphQL(query);
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return res.status(500).json({ error: 'Failed to fetch order data' });
    }

    const order = data.data.order;
    const totalOutstanding = parseFloat(order.totalOutstandingSet.shopMoney.amount);
    
    res.json({
      orderId: order.id,
      orderName: order.name,
      totalPrice: parseFloat(order.totalPriceSet.shopMoney.amount),
      remainingBalance: totalOutstanding,
      hasOutstandingBalance: totalOutstanding > 0,
      financialStatus: order.financialStatus
    });
  } catch (error) {
    console.error('Error fetching order payment status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if customer has any unpaid orders
app.get('/api/customer-unpaid-orders', async (req, res) => {
  try {
    const customerGid = req.query.customer_id;
    
    if (!customerGid) {
      return res.json({ hasUnpaidOrders: false });
    }

    const customerId = extractCustomerId(customerGid);
    
    const query = `
      query {
        customer(id: "gid://shopify/Customer/${customerId}") {
          orders(first: 50) {
            edges {
              node {
                id
                totalOutstandingSet {
                  shopMoney {
                    amount
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await shopifyGraphQL(query);
    
    const hasUnpaidOrders = data.data?.customer?.orders?.edges?.some(
      edge => parseFloat(edge.node.totalOutstandingSet.shopMoney.amount) > 0
    ) || false;

    res.json({ hasUnpaidOrders });
  } catch (error) {
    console.error('Error checking unpaid orders:', error);
    res.json({ hasUnpaidOrders: false });
  }
});

// Main payment page route
app.get('/apps/pay-balance', async (req, res) => {
  try {
    const orderGid = req.query.order_id;
    
    if (!orderGid) {
      return res.status(400).send('Order ID is required');
    }

    const orderId = extractOrderId(orderGid);
    
    const query = `
      query {
        order(id: "gid://shopify/Order/${orderId}") {
          id
          name
          email
          totalOutstandingSet {
            shopMoney {
              amount
              currencyCode
            }
          }
        }
      }
    `;

    const data = await shopifyGraphQL(query);
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return res.status(500).send('Error fetching order details');
    }

    const order = data.data.order;
    const outstandingAmount = parseFloat(order.totalOutstandingSet.shopMoney.amount);

    if (outstandingAmount <= 0) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>No Payment Required</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              text-align: center;
            }
            .message {
              background: #f0f0f0;
              padding: 30px;
              border-radius: 8px;
            }
          </style>
        </head>
        <body>
          <div class="message">
            <h1>✓ Order Paid</h1>
            <p>Order ${order.name} has been fully paid.</p>
          </div>
        </body>
        </html>
      `);
    }

    const createInvoiceMutation = `
      mutation {
        draftOrderInvoiceSend(id: "gid://shopify/DraftOrder/${orderId}") {
          draftOrder {
            id
            invoiceUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    try {
      const invoiceData = await shopifyGraphQL(createInvoiceMutation);
      
      if (invoiceData.data?.draftOrderInvoiceSend?.userErrors?.length > 0) {
        console.error('Invoice errors:', invoiceData.data.draftOrderInvoiceSend.userErrors);
      }
    } catch (invoiceError) {
      console.error('Error sending invoice:', invoiceError);
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Invoice Sent</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            text-align: center;
          }
          .message {
            background: #f8f9fa;
            padding: 40px;
            border-radius: 8px;
          }
          .amount {
            font-size: 32px;
            font-weight: bold;
            color: #27ae60;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="message">
          <h1>📧 Payment Invoice Sent</h1>
          <p class="amount">$${outstandingAmount.toFixed(2)}</p>
          <p>A payment invoice has been sent to <strong>${order.email}</strong></p>
          <p>Please check your email for payment instructions.</p>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Error processing payment request:', error);
    res.status(500).send('An error occurred');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

