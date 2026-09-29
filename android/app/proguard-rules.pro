# OG BOT ProGuard / R8 rules.
#
# Release builds run with minifyEnabled true so Google Play's DEX code
# optimization threshold is met. These keep-rules protect the Capacitor
# JavaScript bridge and the billing SDKs, which are reached by reflection
# and would otherwise be stripped or renamed.

# Keep line numbers so Play Console crash reports stay readable.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Annotations and generics used by the bridge and JSON parsing.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# --- Capacitor / Cordova bridge -------------------------------------------
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public <methods>;
}
-keep class org.apache.cordova.** { *; }
-keep class og.bot.** { *; }

# Anything exposed to the WebView via @JavascriptInterface.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- RevenueCat / Google Play Billing -------------------------------------
-keep class com.revenuecat.purchases.** { *; }
-keep class com.android.billingclient.** { *; }
-dontwarn com.revenuecat.purchases.**
-dontwarn com.android.billingclient.**

# --- Misc -----------------------------------------------------------------
-dontwarn org.jetbrains.annotations.**
-dontwarn javax.annotation.**
