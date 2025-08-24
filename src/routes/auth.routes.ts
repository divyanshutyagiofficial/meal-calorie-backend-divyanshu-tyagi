import { RequestHandler, Router } from "express";
import * as authController from "../controllers/auth.controller";
import rateLimit from "express-rate-limit";
import { rateLimitConfig } from "../config/rate-limit.config";

const router = Router();

// Auth-specific rate limiter with environment-based configuration
const authLimiter = rateLimit(rateLimitConfig.auth);

router.post(
    "/register",
    authLimiter,
    authController.register as RequestHandler
);
router.post("/login", authLimiter, authController.login as RequestHandler);

export default router;
