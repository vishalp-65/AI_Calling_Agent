import { Router } from "express"
import { callRoutes } from "./call.routes"
import { agentRoutes } from "./agent.routes"
import { knowledgeRoutes } from "./knowledge.routes"
import { userKnowledgeRoutes } from "./user-knowledge.routes"
import { ResponseHandler } from "../utils/response"
import { databaseConnection } from "../database/connection"
import { redisService } from "../services/cache/redis.service"
import { HealthCheckResponse } from "../types/common.types"

const router = Router()

// Health check endpoint
router.get("/health", async (req, res) => {
    try {
        const healthCheck: HealthCheckResponse = {
            status: "healthy",
            timestamp: new Date(),
            services: {
                database: await databaseConnection.isHealthy(),
                redis: await redisService.isHealthy(),
                kafka: true, // TODO: Implement kafka health check
                twilio: true, // TODO: Implement twilio health check
                openai: true, // TODO: Implement OpenAI health check
                pinecone: true // TODO: Implement Pinecone health check
            },
            uptime: process.uptime(),
            version: process.env.npm_package_version || "1.0.0"
        }

        const allServicesHealthy = Object.values(healthCheck.services).every(
            (status) => status
        )
        healthCheck.status = allServicesHealthy ? "healthy" : "unhealthy"

        return ResponseHandler.success(
            res,
            healthCheck,
            "Health check completed"
        )
    } catch (error) {
        return ResponseHandler.serverError(res, "Health check failed", error)
    }
})

// API routes
router.use("/calls", callRoutes)
router.use("/agents", agentRoutes)
router.use("/knowledge", knowledgeRoutes)
router.use("/user-knowledge", userKnowledgeRoutes)

// 404 handler for unknown routes
// router.use("*", (req, res) => {
//     return ResponseHandler.notFound(res, "Route not found")
// })

export { router }
