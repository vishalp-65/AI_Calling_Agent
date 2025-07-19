import { Request, Response, NextFunction } from "express"
import { ResponseHandler } from "../utils/response"

/**
 * Role-based authorization middleware
 * @param allowedRoles Array of roles that are allowed to access the route
 */
export const authorizeRoles = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const userRole = res.locals.user?.role

            if (!userRole) {
                return ResponseHandler.unauthorized(res, "User role not found")
            }

            if (!allowedRoles.includes(userRole)) {
                return ResponseHandler.forbidden(
                    res,
                    "You don't have permission to access this resource"
                )
            }

            next()
        } catch (error) {
            return ResponseHandler.serverError(
                res,
                "Authorization error",
                error
            )
        }
    }
}
