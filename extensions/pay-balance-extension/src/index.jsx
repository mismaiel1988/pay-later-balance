import React, { useEffect, useState } from 'react';
import { 
  reactExtension, 
  BlockStack, 
  Button,
  useApi
} from "@shopify/ui-extensions-react/customer-account";

const BACKEND_URL = 'https://pay-later-balance-z555.onrender.com';

// For individual order status page
export default reactExtension(
  "customer-account.order-status.block.render", 
  () => <PayBalanceButton />
);

// For orders list page
export const ordersListExtension = reactExtension(
  "customer-account.order-index.block.render",
  () => null
);

function PayBalanceButton() {
  const { order } = useApi();
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!order?.current?.id) return;
    
    const fetchPaymentStatus = async () => {
      try {
        const response = await fetch(
          `${BACKEND_URL}/api/order-payment-status?order_id=${encodeURIComponent(order.current.id)}`
        );
        
        if (response.ok) {
          const data = await response.json();
          setPaymentStatus(data);
        }
      } catch (error) {
        console.error('Error fetching payment status:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPaymentStatus();
  }, [order]);
  
  if (!order || loading) return null;
  
  // Only show button if there's an outstanding balance
  if (!paymentStatus?.hasOutstandingBalance) return null;

  const handlePayment = () => {
    // Redirect to your payment page
    window.location.href = `${BACKEND_URL}/apps/pay-balance?order_id=${encodeURIComponent(order.current.id)}`;
  };

  return (
    <BlockStack>
      <Button
        onPress={handlePayment}
        kind="primary"
      >
        Pay now
      </Button>
    </BlockStack>
  );
}


