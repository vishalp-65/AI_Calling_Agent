export interface PaginationOptions {
    page: number
    limit: number
    sortBy?: string
    sortOrder?: "ASC" | "DESC"
}

export interface PaginatedResponse<T> {
    data: T[]
    pagination: {
        page: number
        limit: number
        total: number
        pages: number
    }
}

export interface ApiResponse<T = any> {
    success: boolean
    data?: T
    message?: string
    errors?: string[]
    timestamp: Date
}

export interface ErrorResponse {
    success: false
    message: string
    errors?: string[]
    code?: string
    timestamp: Date
}

export interface HealthCheckResponse {
    status: "healthy" | "unhealthy"
    timestamp: Date
    services: {
        database: boolean
        redis: boolean
        kafka: boolean
        twilio: boolean
        openai: boolean
        pinecone: boolean
    }
    uptime: number
    version: string
}
