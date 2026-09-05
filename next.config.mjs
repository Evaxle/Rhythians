const mobileOrigin = process.env.RHYTHIANS_MOBILE_ORIGIN?.replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*",
      }
    ],
    unoptimized: false,
  },
  rewrites: async () => mobileOrigin ? [{ source: "/mobile", destination: `${mobileOrigin}/mobile` }, { source: "/mobile/:path*", destination: `${mobileOrigin}/mobile/:path*` }] : [],
  headers: async () => {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
