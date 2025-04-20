import winston from "winston"
import { config } from "../config"

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf((info) => {
        const { timestamp, level, message, stack, ...meta } = info
        return JSON.stringify({
            timestamp,
            level,
            message,
            ...(typeof stack === "string" ? { stack } : {}),
            ...(Object.keys(meta).length > 0 && { meta })
        })
    })
)

const transports: winston.transport[] = [
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf((info) => {
                return `${info.timestamp} [${info.level}]: ${info.message}`
            })
        )
    })
]

// Add file transport for production
if (config.env === "production") {
    transports.push(
        new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
            format: logFormat
        }),
        new winston.transports.File({
            filename: "logs/combined.log",
            format: logFormat
        })
    )
}

export const logger = winston.createLogger({
    level: config.monitoring.logLevel,
    format: logFormat,
    transports,
    exitOnError: false
})

// Create a stream object for Morgan middleware
export const logStream = {
    write: (message: string): void => {
        logger.info(message.trim())
    }
}

// Helper functions for structured logging
export const createLogContext = (context: Record<string, any>) => {
    return {
        info: (message: string, meta?: Record<string, any>) =>
            logger.info(message, { ...context, ...meta }),
        error: (message: string, error?: Error, meta?: Record<string, any>) =>
            logger.error(message, {
                ...context,
                error: error?.message,
                stack: error?.stack,
                ...meta
            }),
        warn: (message: string, meta?: Record<string, any>) =>
            logger.warn(message, { ...context, ...meta }),
        debug: (message: string, meta?: Record<string, any>) =>
            logger.debug(message, { ...context, ...meta })
    }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error)
    process.exit(1)
})

process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection at:", { promise, reason })
    process.exit(1)
})
