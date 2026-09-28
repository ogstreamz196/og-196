import { Purchases as PurchasesWeb, CustomerInfo as CustomerInfoWeb, Offerings as OfferingsWeb, Package as PackageWeb } from "@revenuecat/purchases-js";
import { Purchases as PurchasesCapacitor, CustomerInfo as CustomerInfoCap, Offerings as OfferingsCap, PurchasesPackage as PackageCap } from "@revenuecat/purchases-capacitor";
import { Capacitor } from "@capacitor/core";

// RevenueCat Keys
const RC_WEB_API_KEY = "test_UFDSOGyDTSPOjElYUXAqieTfcny";
const RC_ANDROID_API_KEY = "test_UFDSOGyDTSPOjElYUXAqieTfcny"; // TODO: Replace with Android API Key from RevenueCat Dashboard
const RC_IOS_API_KEY = "test_UFDSOGyDTSPOjElYUXAqieTfcny"; // TODO: Replace with iOS API Key from RevenueCat Dashboard

let purchasesWebInstance: PurchasesWeb | null = null;
let isNativeConfigured = false;

/**
 * Configure and initialize RevenueCat for Web or Native
 */
export async function configureRevenueCat(appUserId?: string) {
  if (typeof window === "undefined") return;

  if (Capacitor.isNativePlatform()) {
    try {
      await PurchasesCapacitor.setLogLevel({ level: "DEBUG" });
      const platform = Capacitor.getPlatform();
      const apiKey = platform === "ios" ? RC_IOS_API_KEY : RC_ANDROID_API_KEY;

      if (appUserId) {
        await PurchasesCapacitor.configure({ apiKey, appUserID: appUserId });
      } else {
        await PurchasesCapacitor.configure({ apiKey });
      }
      isNativeConfigured = true;
      console.log(`RevenueCat Native SDK configured for ${platform} with appUserId:`, appUserId || "anonymous");
    } catch (error) {
      console.error("Failed to initialize RevenueCat Native", error);
    }
  } else {
    const finalUserId = appUserId || PurchasesWeb.generateRevenueCatAnonymousAppUserId();
    purchasesWebInstance = PurchasesWeb.configure(RC_WEB_API_KEY, finalUserId);
    console.log("RevenueCat Web SDK configured with appUserId:", finalUserId);
  }
}

/**
 * Check if the user has the VIP Pass entitlement
 */
export async function checkVipEntitlement(): Promise<boolean> {
  try {
    const customerInfo = await getCustomerInfo();
    return customerInfo?.entitlements.active["og_vip_pass"] !== undefined;
  } catch (error) {
    console.error("Error checking VIP entitlement:", error);
    return false;
  }
}

/**
 * Fetch the current Customer Info
 */
export async function getCustomerInfo(): Promise<CustomerInfoWeb | CustomerInfoCap | null> {
  try {
    if (Capacitor.isNativePlatform() && isNativeConfigured) {
      const info = await PurchasesCapacitor.getCustomerInfo();
      return info.customerInfo;
    } else if (purchasesWebInstance) {
      return await purchasesWebInstance.getCustomerInfo();
    }
    return null;
  } catch (error) {
    console.error("Error fetching Customer Info:", error);
    return null;
  }
}

/**
 * Fetch available Offerings configured in the RevenueCat dashboard
 */
export async function getOfferings(): Promise<OfferingsWeb | OfferingsCap | null> {
  try {
    if (Capacitor.isNativePlatform() && isNativeConfigured) {
      const offerings = await PurchasesCapacitor.getOfferings();
      return offerings.offerings;
    } else if (purchasesWebInstance) {
      return await purchasesWebInstance.getOfferings();
    }
    return null;
  } catch (error) {
    console.error("Error fetching offerings:", error);
    return null;
  }
}

/**
 * Purchase a specific package
 */
export async function purchasePackage(rcPackage: PackageWeb | PackageCap): Promise<CustomerInfoWeb | CustomerInfoCap | null> {
  try {
    if (Capacitor.isNativePlatform() && isNativeConfigured) {
      const result = await PurchasesCapacitor.purchasePackage({
        aPackage: rcPackage as PackageCap
      });
      return result.customerInfo;
    } else if (purchasesWebInstance) {
      const result = await purchasesWebInstance.purchasePackage(rcPackage as PackageWeb);
      return result.customerInfo;
    }
    return null;
  } catch (error) {
    console.error("Purchase failed or was cancelled:", error);
    throw error;
  }
}

/**
 * Open Customer Center
 */
export async function showCustomerCenter() {
  try {
    if (Capacitor.isNativePlatform()) {
      // For native, RevenueCat Customer Center requires the experimental UI plugin,
      // or you simply direct the user to their respective app store subscription management page.
      if (Capacitor.getPlatform() === 'ios') {
        // window.location.href = "https://apps.apple.com/account/subscriptions";
        alert("Please manage your subscription in your Apple ID settings.");
      } else {
        window.location.href = "https://play.google.com/store/account/subscriptions";
      }
    } else {
      const customerInfo = await getCustomerInfo() as CustomerInfoWeb;
      if (customerInfo?.managementURL) {
        window.location.href = customerInfo.managementURL;
      } else {
        alert("No active subscription to manage.");
      }
    }
  } catch (error) {
    console.error("Error opening Customer Center:", error);
  }
}