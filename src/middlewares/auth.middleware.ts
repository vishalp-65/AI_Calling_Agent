import { NextFunction, Request, Response } from "express"
import { verifyToken } from "../utils/encryption"
import { ResponseHandler } from "../utils/response"

// JWT authentication middleware
export const authenticateJWT = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        ResponseHandler.unauthorized(
            res,
            "Authorization header missing or malformed"
        )
        return
    }

    const token = authHeader.split(" ")[1]
    if (!token) {
        ResponseHandler.unauthorized(res, "Authorization token missing")
        return
    }
    const decoded = verifyToken(token)
    if (!decoded) {
        ResponseHandler.unauthorized(res, "Invalid or expired token")
        return
    }

    res.locals.user = decoded
    next()
}
