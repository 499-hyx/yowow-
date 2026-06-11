/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // 把外置提示词 + 赛道/平台/定位配置打进 serverless 函数，运行时可 fs 读取。
    // 这是「脑子在 prompts/config、引擎零方法论」能在 Vercel 上跑起来的关键。
    outputFileTracingIncludes: {
      "/api/**": ["./prompts/**/*", "./config/**/*"],
    },
  },
};

export default nextConfig;
