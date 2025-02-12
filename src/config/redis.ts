import Redis from "redis"
import { config } from "./index"
import { logger } from "../utils/logger"

const redisConfig = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keepAlive: 30000,
    connectTimeout: 10000,
    commandTimeout: 5000
}

export const redisClient = Redis.createClient(redisConfig)

redisClient.on("connect", () => {
    logger.info("Redis client connected")
})

redisClient.on("error", (err) => {
    logger.error("Redis client error:", err)
})

redisClient.on("ready", () => {
    logger.info("Redis client ready")
})

redisClient.on("end", () => {
    logger.info("Redis client disconnected")
})

export const connectRedis = async (): Promise<void> => {
    try {
        await redisClient.connect()
    } catch (error) {
        logger.error("Failed to connect to Redis:", error)
        throw error
    }
}
