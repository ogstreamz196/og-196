import React, { createContext, useContext, useEffect, useState } from "react";
import { CustomerInfo, Offerings, PurchasesPackage } from "@revenuecat/purchases-js";
import {
  configureRevenueCat,
  getCustomerInfo,
  getOfferings,
  purchasePackage as rcPurchasePackage,
  checkVipEntitlement
} from "@/lib/revenuecat";

interface RevenueCatContextType {
  isConfigured: boolean;
  isVip: boolean;
  customerInfo: CustomerInfo | null;
  offerings: Offerings | null;
  loading: boolean;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  refreshInfo: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

export function RevenueCatProvider({
  children,
  userId // Pass the authenticated user ID here when available
}: {
  children: React.ReactNode;
  userId?: string;
}) {
  const [isConfigured, setIsConfigured] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<Offerings | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Configure RC when the component mounts or userId changes
    configureRevenueCat(userId);
    setIsConfigured(true);
    refreshInfo();
  }, [userId]);

  const refreshInfo = async () => {
    setLoading(true);
    try {
      const [info, offers, vipStatus] = await Promise.all([
        getCustomerInfo(),
        getOfferings(),
        checkVipEntitlement()
      ]);
      setCustomerInfo(info);
      setOfferings(offers);
      setIsVip(vipStatus);
    } catch (error) {
      console.error("Error fetching RevenueCat data", error);
    } finally {
      setLoading(false);
    }
  };

  const purchasePackage = async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      const updatedInfo = await rcPurchasePackage(pkg);
      if (updatedInfo) {
        setCustomerInfo(updatedInfo);
        const vipStatus = updatedInfo.entitlements.active["og_vip_pass"] !== undefined;
        setIsVip(vipStatus);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Purchase error", error);
      return false; // Error handled inside purchasePackage, could be cancellation
    }
  };

  return (
    <RevenueCatContext.Provider value={{
      isConfigured,
      isVip,
      customerInfo,
      offerings,
      loading,
      purchasePackage,
      refreshInfo
    }}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat() {
  const context = useContext(RevenueCatContext);
  if (context === undefined) {
    throw new Error("useRevenueCat must be used within a RevenueCatProvider");
  }
  return context;
}
