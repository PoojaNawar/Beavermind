import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./rubrics/**/*.md"],
    "/evaluations/**/*": ["./rubrics/**/*.md"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    middlewareClientMaxBodySize: "10mb",
  },
};

export default nextConfig;
