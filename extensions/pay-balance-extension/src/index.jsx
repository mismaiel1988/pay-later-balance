import { reactExtension, BlockStack, Button } from "@shopify/ui-extensions-react/customer-account";

export default reactExtension("customer-account.order-details.block.render", ({ order }) => {
  const status = order.financialStatus?.toLowerCase();
  const showButton = status === "pending" || status === "unpaid" || status === "partially_paid";

  if (!showButton) return null;

  const payUrl = `/apps/pay-balance?order_id=${order.id}`;

  return (
    <BlockStack spacing="tight">
      <Button
        accessibilityLabel="Pay Remaining Balance"
        onPress={() => (window.location.href = payUrl)}
        kind="primary"
      >
        Pay Remaining Balance
      </Button>
    </BlockStack>
  );
});

