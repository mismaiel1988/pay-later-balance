import React from 'react';
import { 
  reactExtension, 
  BlockStack, 
  Button,
  useApi
} from "@shopify/ui-extensions-react/customer-account";

// For order details page
export default reactExtension(
  "customer-account.order-details.block.render", 
  () => <PayBalanceButton />
);

// For orders list page
reactExtension(
  "customer-account.order-index.block.render",
  () => <PayBalanceButton />
);

function PayBalanceButton() {
  const { order, extension } = useApi();
  
  if (!order) return null;
  
  const status = order?.financialStatus?.toLowerCase();
  const showButton = status === "pending" || status === "unpaid" || status === "partially_paid";

  // Don't show button if order is fully paid
  if (!showButton) return null;

  const handlePayment = () => {
    // Navigate to the order status page which has payment functionality
    if (order?.statusPageUrl) {
      extension.navigate(order.statusPageUrl);
    } else {
      // Fallback: navigate to order details if statusPageUrl isn't available
      extension.navigate(`/orders/${order.id}`);
    }
  };

  return (
    <BlockStack spacing="tight">
      <Button
        accessibilityLabel="Pay Remaining Balance"
        onPress={handlePayment}
        kind="primary"
      >
        Pay Remaining Balance
      </Button>
    </BlockStack>
  );
}
