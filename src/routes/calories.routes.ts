import { Router, RequestHandler } from "express";
import { getCalories } from "../controllers/calories.controller";
import { verifyToken } from "../middlewares/auth.middleware";
import rateLimit from "express-rate-limit";
import apicache from "apicache";
import { rateLimitConfig } from "../config/rate-limit.config";

const router = Router();

// Calories-specific rate limiter with environment-based configuration
const caloriesLimiter = rateLimit(rateLimitConfig.calories);

const cacheInstance = apicache.options({
    appendKey: (req) => JSON.stringify(req.body),
}).middleware;

router.post(
    "/get-calories",
    verifyToken as RequestHandler,
    caloriesLimiter,
    cacheInstance("1 minutes"),
    getCalories as RequestHandler
);
export default router;
