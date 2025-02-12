import { NextFunction, Request, Response } from "express"
import { ResponseHandler } from "../utils/response"

// Request validation middleware
export const validateRequest =
    (schema: any) =>
    (req: Request, res: Response, next: NextFunction): void | Response => {
        const { error } = schema.validate(req.body)

        if (error) {
            return ResponseHandler.badRequest(
                res,
                "Validation error",
                error.details
            )
        }

        next()
    }
