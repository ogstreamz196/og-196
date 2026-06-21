// Shared domain types. Re-exports the generated DB row types so app code
// can `import { Song, Profile } from "@/types"` instead of redeclaring
// inline interfaces in every consumer.
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

export type Profile = Tables["profiles"]["Row"];
export type Song = Tables["songs"]["Row"];
export type CoinTransaction = Tables["coin_transactions"]["Row"];
export type AppSetting = Tables["app_settings"]["Row"];
export type SiteContent = Tables["site_content"]["Row"];
export type UserRole = Tables["user_roles"]["Row"];
export type BotToken = Tables["bot_tokens"]["Row"];

export type SongStatus = "queued" | "processing" | "completed" | "failed";

export type CoinStats = {
  minted: number;
  inWallets: number;
  burnt: number;
};
