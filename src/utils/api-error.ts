import httpStatus from "http-status"

export class ApiError extends Error {
    statusCode: number
    isOperational: boolean
    details?: any

    constructor(
        statusCode: number,
        message: string,
        isOperational = true,
        details?: any
    ) {
        super(message)
        this.statusCode = statusCode
        this.isOperational = isOperational
        this.details = details

        // Capture stack trace
        Error.captureStackTrace(this, this.constructor)
    }

    static badRequest(message: string, details?: any): ApiError {
        return new ApiError(httpStatus.BAD_REQUEST, message, true, details)
    }

    static unauthorized(message: string = "Unauthorized"): ApiError {
        return new ApiError(httpStatus.UNAUTHORIZED, message, true)
    }

    static forbidden(message: string = "Forbidden"): ApiError {
        return new ApiError(httpStatus.FORBIDDEN, message, true)
    }

    static notFound(message: string = "Resource not found"): ApiError {
        return new ApiError(httpStatus.NOT_FOUND, message, true)
    }

    static conflict(message: string, details?: any): ApiError {
        return new ApiError(httpStatus.CONFLICT, message, true, details)
    }

    static tooManyRequests(message: string = "Too many requests"): ApiError {
        return new ApiError(httpStatus.TOO_MANY_REQUESTS, message, true)
    }

    static internal(
        message: string = "Internal server error",
        details?: any
    ): ApiError {
        return new ApiError(
            httpStatus.INTERNAL_SERVER_ERROR,
            message,
            false,
            details
        )
    }
}
