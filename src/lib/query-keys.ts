// Central typed query-key factory. Use these instead of inline string arrays
// so invalidations stay consistent and refactors are safe.
export const queryKeys = {
  profile: (userId?: string) => ["profile", userId] as const,
  coinBalance: (userId?: string) => ["coin-balance", userId] as const,
  
  coinTransactions: (userId?: string) => ["coin-transactions", userId] as const,
  songs: (userId?: string) => ["songs", userId] as const,
  song: (songId: string) => ["song", songId] as const,
  variations: (songId: string) => ["variations", songId] as const,
  recentSongs: (userId?: string) => ["recent-songs", userId] as const,
  siteContent: (key?: string) => ["site-content", key] as const,
  appSettings: () => ["app-settings"] as const,
  adminUsers: (filters?: Record<string, unknown>) => ["admin-users", filters] as const,
  adminUser: (userId: string) => ["admin-user", userId] as const,
  ogBotStatus: (userId?: string) => ["og-bot-status", userId] as const,
  portals: () => ["portals"] as const,
  portal: (slug: string) => ["portal", slug] as const,
  ogPersona: () => ["og-persona"] as const,
} as const;
