// Central API base for Claxton Quant services (EC2 via Cloudflare tunnel)
// IMPORTANT: use NEXT_PUBLIC_API_BASE in Vercel env for a stable URL.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  'https://movie-parties-kong-ferry.trycloudflare.com';
