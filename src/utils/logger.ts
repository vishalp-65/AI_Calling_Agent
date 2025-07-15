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

// Add file transports for all environments
const fs = require('fs')
const path = require('path')

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
}

// Always add file transports
transports.push(
    new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: "error",
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
    }),
    new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
    }),
    new winston.transports.File({
        filename: path.join(logsDir, 'calls.log'),
        level: "info",
        format: logFormat,
        maxsize: 10485760, // 10MB for call logs
        maxFiles: 10,
        tailable: true
    }),
    new winston.transports.File({
        filename: path.join(logsDir, 'ai-processing.log'),
        level: "debug",
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
    })
)

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
