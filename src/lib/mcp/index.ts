import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getProfileTool from "./tools/get-profile";
import getCoinBalanceTool from "./tools/get-coin-balance";
import listMySongsTool from "./tools/list-my-songs";

// The OAuth issuer MUST be the direct Supabase host — the .lovable.cloud proxy
// is rejected by mcp-js as an RFC 8414 issuer mismatch on publish. The project
// ref is the only Supabase value that survives publish unchanged.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "og-studio-mcp",
  title: "OG Studio",
  version: "0.1.0",
  instructions:
    "Tools for the OG Studio account of the signed-in user. Use `get_profile` for account details, `get_coin_balance` for the current OG coin balance, and `list_my_songs` to browse songs the user has created.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getProfileTool, getCoinBalanceTool, listMySongsTool],
});
