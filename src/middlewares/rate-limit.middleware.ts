import rateLimit from "express-rate-limit"
import { config } from "../config"

// Rate limit configuration
export const rateLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
        success: false,
        message: "Too many requests, please try again later."
    }
})
