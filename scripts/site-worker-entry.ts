import { handleNarrativeApi } from "../src/narrative-api";
import { handleAppearanceApi, type AppearanceStoreEnv } from "../src/appearance-api";
import assets from "../dist/site-assets.generated.js";

type WorkerEnv = AppearanceStoreEnv & { NANAL_GEMINI_API_KEY?: string; NANAL_GEMINI_MODEL?: string };

const contentTypes: Record<string, string> = {
  css: "text/css; charset=utf-8", html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8", json: "application/json; charset=utf-8",
  png: "image/png", svg: "image/svg+xml", txt: "text/plain; charset=utf-8",
  woff: "font/woff", woff2: "font/woff2",
};

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const imageResponse = await handleAppearanceApi(request, env);
    if (imageResponse) return imageResponse;
    const apiResponse = await handleNarrativeApi(request, env);
    if (apiResponse) return apiResponse;
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }
    const path = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const body = assets[path as keyof typeof assets];
    if (typeof body !== "string") return new Response("Not found", { status: 404 });
    const extension = path.split(".").pop()?.toLowerCase() ?? "";
    const isAdmin = path === "/appearance-admin.html" || path === "/appearance-admin.js";
    const headers = new Headers({
      "content-type": contentTypes[extension] ?? "application/octet-stream",
      "cache-control": isAdmin ? "no-store" : path === "/index.html" ? "no-cache" : "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    });
    if (path === "/appearance-admin.html") {
      headers.set("content-security-policy",
        "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' blob:; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'");
      headers.set("referrer-policy", "no-referrer");
      headers.set("x-frame-options", "DENY");
    }
    return new Response(request.method === "HEAD" ? null : body, { headers });
  },
};