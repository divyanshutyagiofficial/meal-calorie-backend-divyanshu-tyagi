import express, { Application, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { rateLimitConfig } from "./config/rate-limit.config";
import authRoutes from "./routes/auth.routes";
import calRoutes from "./routes/calories.routes";
dotenv.config();

const app: Application = express();
// Trust proxy (needed when behind a reverse proxy like Render)
app.set("trust proxy", 1);

// CORS configuration - MUST be before other middleware
app.use(cors({
    origin: [
        "http://localhost:3000", // Next.js dev server
        "http://localhost:3001", // Alternative Next.js port
        "https://localhost:3000", // HTTPS version
        "https://localhost:3001"  // HTTPS version
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Global rate limiter with environment-based configuration
const globalLimiter = rateLimit({
    ...rateLimitConfig.global,
    // Skip rate limiting for static files, health checks, etc.
    skip: (req) => {
        return req.path.startsWith('/static') || 
               req.path.startsWith('/assets') || 
               req.path === '/health';
    }
});

app.use(globalLimiter);
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/", calRoutes);

app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ status: "OK" });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Server error" });
});

// Export the app instance
export default app;

// Only start the server if this file is run directly
if (require.main === module) {
    const PORT = process.env.PORT ?? 5000;
    mongoose
        .connect(process.env.MONGODB_URI!, {})
        .then(() =>
            app.listen(PORT, () =>
                console.log(`Server running on port ${PORT}`)
            )
        )
        .catch((err) => console.error(err));
}
