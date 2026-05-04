import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const limiters = {
  auth: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "15 m"), prefix: "rl:auth" }),
  trade: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m"), prefix: "rl:trade" }),
  payout: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 h"), prefix: "rl:payout" }),
  startChallenge: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, "1 h"), prefix: "rl:challenge" }),
  affiliateApply: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, "1 h"), prefix: "rl:affiliate-apply" }),
  walletUpdate: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 h"), prefix: "rl:affiliate-wallet" }),
  payoutRequest: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(1, "1 d"), prefix: "rl:affiliate-payout" }),
  webhook: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, "1 m"), prefix: "rl:webhook" }),
  admin: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 m"), prefix: "rl:admin" }),
  default: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m"), prefix: "rl:default" }),
};

export function getLimiter(pathname: string) {
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/login") || pathname.startsWith("/api/register")) return limiters.auth;
  if (pathname.startsWith("/api/trade")) return limiters.trade;
  if (pathname === "/api/user/payout") return limiters.payout;
  if (pathname === "/api/user/start-challenge") return limiters.startChallenge;
  if (pathname.includes("/webhook")) return limiters.webhook;
  if (pathname.startsWith("/api/admin")) return limiters.admin;
  return limiters.default;
}
