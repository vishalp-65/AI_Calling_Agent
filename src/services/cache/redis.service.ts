import Redis from "ioredis"
import { config } from "../../config"
import { logger } from "../../utils/logger"

class RedisService {
    private client: Redis

    constructor() {
        this.client = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password || undefined
        })

        this.client.on("connect", () => {
            logger.info("Connected to Redis")
        })

        this.client.on("error", (error) => {
            logger.error("Redis error", error)
        })
    }

    public async set(
        key: string,
        value: any,
        expiryInSec?: number
    ): Promise<void> {
        try {
            const serializedValue = JSON.stringify(value)
            if (expiryInSec) {
                await this.client.setex(key, expiryInSec, serializedValue)
            } else {
                await this.client.set(key, serializedValue)
            }
        } catch (error) {
            logger.error("Redis set error:", error)
            throw error
        }
    }

    public async get<T>(key: string): Promise<T | null> {
        try {
            const value = await this.client.get(key)
            if (value) {
                return JSON.parse(value)
            }
            return null
        } catch (error) {
            logger.error("Redis get error:", error)
            throw error
        }
    }

    public async delete(key: string): Promise<void> {
        try {
            await this.client.del(key)
        } catch (error) {
            logger.error("Redis delete error:", error)
            throw error
        }
    }

    public async exists(key: string): Promise<boolean> {
        try {
            const result = await this.client.exists(key)
            return result === 1
        } catch (error) {
            logger.error("Redis exists error:", error)
            throw error
        }
    }

    public async expire(key: string, expiryInSec: number): Promise<void> {
        try {
            await this.client.expire(key, expiryInSec)
        } catch (error) {
            logger.error("Redis expire error:", error)
            throw error
        }
    }

    public async flush(): Promise<void> {
        try {
            await this.client.flushall()
        } catch (error) {
            logger.error("Redis flush error:", error)
            throw error
        }
    }

    public async disconnect(): Promise<void> {
        try {
            await this.client.quit()
            logger.info("Redis connection closed")
        } catch (error) {
            logger.error("Redis disconnect error:", error)
            throw error
        }
    }

    public async isHealthy(): Promise<boolean> {
        try {
            await this.client.ping()
            return true
        } catch (error) {
            logger.error("Redis health check failed:", error)
            return false
        }
    }
}

export const redisService = new RedisService()
