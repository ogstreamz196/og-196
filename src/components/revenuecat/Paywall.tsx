import React, { useState } from "react";
import { useRevenueCat } from "./RevenueCatProvider";
import { showCustomerCenter } from "@/lib/revenuecat";

export function Paywall() {
  const { offerings, loading, purchasePackage, isVip } = useRevenueCat();
  const [purchasing, setPurchasing] = useState(false);

  // Example: Use the current offering configured in RevenueCat
  const currentOffering = offerings?.current;

  if (loading) {
    return <div className="p-4 text-center">Loading Subscription Details...</div>;
  }

  // If user is already VIP, show Customer Center option instead of Paywall
  if (isVip) {
    return (
      <div className="p-6 bg-green-50 rounded-xl shadow border border-green-200 text-center">
        <h2 className="text-2xl font-bold text-green-800 mb-2">You are a VIP!</h2>
        <p className="text-green-700 mb-6">Enjoy your premium features.</p>
        <button
          onClick={showCustomerCenter}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          Manage Subscription (Customer Center)
        </button>
      </div>
    );
  }

  if (!currentOffering || currentOffering.packages.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No subscription packages available at the moment.
      </div>
    );
  }

  const handlePurchase = async (pkg: any) => {
    setPurchasing(true);
    try {
      const success = await purchasePackage(pkg);
      if (success) {
        alert("Welcome to VIP!");
      }
    } catch (e: any) {
      alert(e.message || "Purchase failed or cancelled.");
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg border">
      <h2 className="text-3xl font-extrabold text-center mb-2">Unlock OG VIP Pass</h2>
      <p className="text-center text-gray-600 mb-8">Get unlimited access to all premium features.</p>

      <div className="grid gap-6 md:grid-cols-2">
        {currentOffering.packages.map((pkg) => {
          // You expect products with identifiers "monthly" and "yearly"
          const isYearly = pkg.identifier === "yearly";

          return (
            <div
              key={pkg.identifier}
              className={`p-6 border-2 rounded-xl flex flex-col ${isYearly ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}
            >
              {isYearly && <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded w-fit mb-2">BEST VALUE</span>}
              <h3 className="text-xl font-bold mb-1">{pkg.product.title}</h3>
              <div className="text-2xl font-black mb-4">
                {pkg.product.currentPrice?.currency} {pkg.product.currentPrice?.amount.toFixed(2)}
              </div>
              <p className="text-gray-600 flex-grow mb-6">{pkg.product.description}</p>

              <button
                disabled={purchasing}
                onClick={() => handlePurchase(pkg)}
                className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${
                  purchasing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : isYearly
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-gray-800 hover:bg-gray-900'
                }`}
              >
                {purchasing ? 'Processing...' : `Subscribe ${pkg.identifier === 'monthly' ? 'Monthly' : 'Yearly'}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
