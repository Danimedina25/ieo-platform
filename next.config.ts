import type { NextConfig } from "next";
// Full CSP for every page. Next.js inlines its bootstrap scripts and styles; development also needs eval.
const csp = ["default-src 'self'", `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "connect-src 'self'", "font-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"].join("; ");
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["argon2"],
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: csp },
    ] }, { source: "/r/:path*", headers: [
      { key: "Cache-Control", value: "no-store, max-age=0" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Content-Security-Policy", value: csp },
    ] }, { source: "/api/:path*", headers: [
      { key: "Cache-Control", value: "no-store, max-age=0" },
    ] }, { source: "/api/participant/:path*", headers: [
      { key: "Cache-Control", value: "no-store, max-age=0" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ] }];
  },
};
export default config;
