// Web SDK is loaded lazily (dynamic import only inside handlers). Its module
// scope performs operations the Cloudflare worker forbids at global scope, so
// a static import here crashes every SSR page.
import type { CustomerInfo as CustomerInfoWeb, Offerings as OfferingsWeb, Package as PackageWeb } from "@revenuecat/purchases-js";
import type { CustomerInfo as CustomerInfoCap, PurchasesOfferings as OfferingsCap, PurchasesPackage as PackageCap } from "@revenuecat/purchases-capacitor";
import { Capacitor } from "@capacitor/core";

type RCWebModule = typeof import("@revenuecat/purchases-js");
type PurchasesWebInstance = Awaited<ReturnType<RCWebModule["Purchases"]["configure"]>>;

// Native SDK is loaded lazily so the web server never evaluates it.
const loadNative = () => import("@revenuecat/purchases-capacitor").then((m) => m.Purchases);
const loadWeb = (): Promise<RCWebModule> => import("@revenuecat/purchases-js");

// RevenueCat Keys
const RC_WEB_API_KEY = "test_UFDSOGyDTSPOjElYUXAqieTfcny";
const RC_ANDROID_API_KEY = "goog_dIqlVeXWmOVtTicDbLnkWOkNUTb"; // Android public SDK key from RevenueCat
const RC_IOS_API_KEY = "test_UFDSOGyDTSPOjElYUXAqieTfcny"; // TODO: Replace with iOS API Key from RevenueCat Dashboard

let purchasesWebInstance: PurchasesWebInstance | null = null;
let isNativeConfigured = false;

// Native SDK is loaded lazily so the web server never evaluates it.
const loadNative = () => import("@revenuecat/purchases-capacitor").then((m) => m.Purchases);

/**
 * Configure and initialize RevenueCat for Web or Native
 */
export async function configureRevenueCat(appUserId?: string) {
  if (typeof window === "undefined") return;

  if (Capacitor.isNativePlatform()) {
    try {
      await (await loadNative()).setLogLevel({ level: "DEBUG" as any });
      const platform = Capacitor.getPlatform();
      const apiKey = platform === "ios" ? RC_IOS_API_KEY : RC_ANDROID_API_KEY;

      if (appUserId) {
        await (await loadNative()).configure({ apiKey, appUserID: appUserId });
      } else {
        await (await loadNative()).configure({ apiKey });
      }
      isNativeConfigured = true;
      console.log(`RevenueCat Native SDK configured for ${platform} with appUserId:`, appUserId || "anonymous");
    } catch (error) {
      console.error("Failed to initialize RevenueCat Native", error);
    }
  } else {
    const rc = await loadWeb();
    const finalUserId = appUserId || rc.Purchases.generateRevenueCatAnonymousAppUserId();
    purchasesWebInstance = rc.Purchases.configure(RC_WEB_API_KEY, finalUserId);
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
      const info = await (await loadNative()).getCustomerInfo();
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
      const offerings = await (await loadNative()).getOfferings();
      return offerings as any;
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
      const result = await (await loadNative()).purchasePackage({
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
