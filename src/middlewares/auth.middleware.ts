import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export function verifyToken(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer "))
        return res.status(401).json({ error: "No token" });
    const token = auth.split(" ")[1];
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET!);
        next();
    } catch {
        res.status(401).json({ error: "Invalid token" });
    }
}
