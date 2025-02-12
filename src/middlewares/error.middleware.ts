import { NextFunction, Request, Response } from "express"
import { ResponseHandler } from "../utils/response"
import { logger } from "../utils/logger"

// Global error handling middleware
export const errorMiddleware = (
    error: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    logger.error("Unhandled error:", error)
    ResponseHandler.error(
        res,
        error.message || "Internal Server Error",
        error.status || 500,
        error
    )
}
