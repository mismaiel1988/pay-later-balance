import React from 'react';
import { 
  reactExtension, 
  BlockStack, 
  Button,
  useApi
} from "@shopify/ui-extensions-react/customer-account";

export default reactExtension(
  "customer-account.order-details.block.render", 
  () => <PayBalanceButton />
);

function PayBalanceButton() {
  const { order, extension } = useApi();
  
  const status = order?.financialStatus?.toLowerCase();
  const showButton = status === "pending" || status === "unpaid" || status === "partially_paid";

  if (!showButton) return null;

  const handlePayment = () => {
    // Navigate to your app's payment page
    const payUrl = `/apps/pay-balance?order_id=${encodeURIComponent(order.id)}`;
    extension.navigate(payUrl);
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
