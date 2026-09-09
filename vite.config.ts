// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { loadEnv } from "vite";
import path from "node:path";

const serverEnv = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
Object.assign(process.env, serverEnv);


export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Hide internal logic in shipped bundles so the foul-mouth lexicon, persona
    // prompts, and other server-side strings cannot be traced back to source.
    build: { sourcemap: false, minify: "esbuild" },
    css: { devSourcemap: false },
    resolve: {
      alias: [
        {
          find: /^entities\/lib\/decode\.js$/,
          replacement: path.resolve(process.cwd(), "node_modules/entities/lib/decode.js"),
        },
        {
          find: /^entities\/lib\/encode\.js$/,
          replacement: path.resolve(process.cwd(), "node_modules/entities/lib/encode.js"),
        },
      ],
    },
    plugins: [mcpPlugin()],
  },

});

