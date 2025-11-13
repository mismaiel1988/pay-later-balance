import React from 'react';
import { 
  reactExtension, 
  BlockStack, 
  Button,
  useApi
} from "@shopify/ui-extensions-react/customer-account";

export default reactExtension(
  "customer-account.order-status.block.render", 
  () => <PayBalanceButton />
);

function PayBalanceButton() {
  const { order, extension } = useApi();
  
  if (!order) return null;
  
  // Check if there's an outstanding balance
  const hasOutstandingBalance = order?.totalOutstanding?.amount && 
                                 parseFloat(order.totalOutstanding.amount) > 0;

  // Don't show button if order is fully paid
  if (!hasOutstandingBalance) return null;

  const handlePayment = () => {
    // Navigate to the order status page which has payment functionality
    if (order?.statusPageUrl) {
      extension.navigate(order.statusPageUrl);
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

