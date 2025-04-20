import { Response } from "express"
import httpStatus from "http-status"
import { logger } from "./logger"

export interface ApiResponse<T = any> {
    success: boolean
    message: string
    data?: T
    error?: any
    timestamp: string
    requestId?: string
    pagination?: {
        page: number
        limit: number
        total: number
        totalPages: number
    }
}

export interface ErrorResponse {
    success: false
    message: string
    error: {
        code: string
        details?: any
        stack?: string
    }
    timestamp: string
    requestId?: string
}

export class ResponseHandler {
    static success<T>(
        res: Response,
        data: T,
        message: string = "Success",
        statusCode: number = httpStatus.OK
    ): Response {
        const response: ApiResponse<T> = {
            success: true,
            message,
            data,
            timestamp: new Date().toISOString(),
            requestId: res.locals.requestId
        }

        return res.status(statusCode).json(response)
    }

    static error(
        res: Response,
        message: string,
        statusCode: number = httpStatus.INTERNAL_SERVER_ERROR,
        error?: any
    ): Response {
        const response: ErrorResponse = {
            success: false,
            message,
            error: {
                code:
                    httpStatus[statusCode as keyof typeof httpStatus] ||
                    "UNKNOWN_ERROR",
                details: error?.message || error,
                ...(process.env.NODE_ENV === "development" &&
                    error?.stack && { stack: error.stack })
            },
            timestamp: new Date().toISOString(),
            requestId: res.locals.requestId
        }

        logger.error(`API Error: ${message}`, {
            statusCode,
            error: error?.message || error,
            stack: error?.stack,
            requestId: res.locals.requestId
        })

        return res.status(statusCode).json(response)
    }

    static paginated<T>(
        res: Response,
        data: T[],
        pagination: {
            page: number
            limit: number
            total: number
        },
        message: string = "Success",
        statusCode: number = httpStatus.OK
    ): Response {
        const response: ApiResponse<T[]> = {
            success: true,
            message,
            data,
            pagination: {
                ...pagination,
                totalPages: Math.ceil(pagination.total / pagination.limit)
            },
            timestamp: new Date().toISOString(),
            requestId: res.locals.requestId
        }

        return res.status(statusCode).json(response)
    }

    static created<T>(
        res: Response,
        data: T,
        message: string = "Created successfully"
    ): Response {
        return this.success(res, data, message, httpStatus.CREATED)
    }

    static updated<T>(
        res: Response,
        data: T,
        message: string = "Updated successfully"
    ): Response {
        return this.success(res, data, message, httpStatus.OK)
    }

    static deleted(
        res: Response,
        message: string = "Deleted successfully"
    ): Response {
        return this.success(res, null, message, httpStatus.NO_CONTENT)
    }

    static notFound(
        res: Response,
        message: string = "Resource not found"
    ): Response {
        return this.error(res, message, httpStatus.NOT_FOUND)
    }

    static badRequest(
        res: Response,
        message: string = "Bad request",
        error?: any
    ): Response {
        return this.error(res, message, httpStatus.BAD_REQUEST, error)
    }

    static unauthorized(
        res: Response,
        message: string = "Unauthorized"
    ): Response {
        return this.error(res, message, httpStatus.UNAUTHORIZED)
    }

    static forbidden(res: Response, message: string = "Forbidden"): Response {
        return this.error(res, message, httpStatus.FORBIDDEN)
    }

    static conflict(
        res: Response,
        message: string = "Conflict",
        error?: any
    ): Response {
        return this.error(res, message, httpStatus.CONFLICT, error)
    }

    static tooManyRequests(
        res: Response,
        message: string = "Too many requests"
    ): Response {
        return this.error(res, message, httpStatus.TOO_MANY_REQUESTS)
    }

    static serverError(
        res: Response,
        message: string = "Internal server error",
        error?: any
    ): Response {
        return this.error(res, message, httpStatus.INTERNAL_SERVER_ERROR, error)
    }
}
