export class ApiError extends Error {
    public statusCode: number
    public isOperational: boolean

    constructor(message: string, statusCode: number, isOperational = true) {
        super(message)
        this.statusCode = statusCode
        this.isOperational = isOperational

        // Maintain proper stack trace
        Error.captureStackTrace(this, this.constructor)
    }

    static badRequest(message: string): ApiError {
        return new ApiError(message, 400)
    }

    static unauthorized(message: string): ApiError {
        return new ApiError(message, 401)
    }

    static forbidden(message: string): ApiError {
        return new ApiError(message, 403)
    }

    static notFound(message: string): ApiError {
        return new ApiError(message, 404)
    }

    static conflict(message: string): ApiError {
        return new ApiError(message, 409)
    }

    static unprocessableEntity(message: string): ApiError {
        return new ApiError(message, 422)
    }

    static tooManyRequests(message: string): ApiError {
        return new ApiError(message, 429)
    }

    static internal(message: string): ApiError {
        return new ApiError(message, 500)
    }

    static serviceUnavailable(message: string): ApiError {
        return new ApiError(message, 503)
    }
}
