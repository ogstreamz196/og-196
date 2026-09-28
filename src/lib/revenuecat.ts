import { Purchases, CustomerInfo, Offerings, PurchasesPackage } from "@revenuecat/purchases-js";

// RevenueCat Web SDK Key
const RC_WEB_API_KEY = "test_UFDSOGyDTSPOjElYUXAqieTfcny";

let purchasesInstance: Purchases | null = null;

/**
 * Configure and initialize RevenueCat for Web
 */
export function configureRevenueCat(appUserId?: string) {
  if (typeof window !== "undefined") {
    // If no specific user ID is provided, generate an anonymous one using the correct Web SDK method
    const finalUserId = appUserId || Purchases.generateRevenueCatAnonymousAppUserId();
    purchasesInstance = Purchases.configure(RC_WEB_API_KEY, finalUserId);
    console.log("RevenueCat Web SDK configured with appUserId:", finalUserId);
  }
}

/**
 * Get the initialized instance of RevenueCat.
 * Throws an error if not configured.
 */
export function getPurchases(): Purchases {
  if (!purchasesInstance) {
    throw new Error("RevenueCat Web SDK is not configured yet. Call configureRevenueCat first.");
  }
  return purchasesInstance;
}

/**
 * Check if the user has the VIP Pass entitlement
 */
export async function checkVipEntitlement(): Promise<boolean> {
  try {
    const rc = getPurchases();
    const customerInfo = await rc.getCustomerInfo();
    // Check for the specific entitlement "og_vip_pass"
    return customerInfo.entitlements.active["og_vip_pass"] !== undefined;
  } catch (error) {
    console.error("Error checking VIP entitlement:", error);
    return false;
  }
}

/**
 * Fetch the current Customer Info
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    const rc = getPurchases();
    return await rc.getCustomerInfo();
  } catch (error) {
    console.error("Error fetching Customer Info:", error);
    return null;
  }
}

/**
 * Fetch available Offerings configured in the RevenueCat dashboard
 */
export async function getOfferings(): Promise<Offerings | null> {
  try {
    const rc = getPurchases();
    return await rc.getOfferings();
  } catch (error) {
    console.error("Error fetching offerings:", error);
    return null;
  }
}

/**
 * Purchase a specific package
 */
export async function purchasePackage(rcPackage: PurchasesPackage): Promise<CustomerInfo | null> {
  try {
    const rc = getPurchases();
    const result = await rc.purchasePackage(rcPackage);
    return result.customerInfo;
  } catch (error) {
    console.error("Purchase failed or was cancelled:", error);
    throw error;
  }
}

/**
 * Open Customer Center for Web (Stripe Customer Portal)
 * RevenueCat Web handles redirecting to the Stripe customer portal for active subscribers.
 */
export async function showCustomerCenter() {
  try {
    // Note: The Web SDK handles the customer portal via the CustomerInfo.managementURL
    const rc = getPurchases();
    const customerInfo = await rc.getCustomerInfo();

    if (customerInfo.managementURL) {
      window.location.href = customerInfo.managementURL;
    } else {
      console.warn("No management URL found. User may not have an active web subscription.");
      alert("No active subscription to manage.");
    }
  } catch (error) {
    console.error("Error opening Customer Center:", error);
  }
}
