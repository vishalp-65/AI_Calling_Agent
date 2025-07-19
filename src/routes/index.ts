import { Router } from "express"
import { callRoutes, webhookRouter } from "./call.routes"
import { agentRoutes } from "./agent.routes"
import { knowledgeRoutes } from "./knowledge.routes"
import { userKnowledgeRoutes } from "./user-knowledge.routes"
import { authRoutes } from "./auth.routes"
import { testRoutes } from "./test.routes"
import { ResponseHandler } from "../utils/response"
import { authenticateJWT } from "../middlewares/auth.middleware"
import { logger } from "../utils/logger"

const router = Router()

// Health check endpoint (public)
router.get("/health", async (req, res) => {
    try {
        const healthCheck = {
            status: "healthy",
            timestamp: new Date(),
            services: {
                server: true,
                authentication: true,
                speech: true,
                twilio: true
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
        logger.error("Health check error:", error)
        return ResponseHandler.serverError(res, "Health check failed", error)
    }
})

// Test routes (public)
router.use("/test", testRoutes)

// Authentication routes (public)
router.use("/auth", authRoutes)

// Webhook routes (public - secured by Twilio signature validation)
router.use("/calls/webhook", webhookRouter)

// Protected API routes
router.use("/calls", callRoutes)
router.use("/agents", authenticateJWT, agentRoutes)
router.use("/knowledge", authenticateJWT, knowledgeRoutes)
router.use("/user-knowledge", authenticateJWT, userKnowledgeRoutes)

// 404 handler for unknown routes
// router.use("*", (req, res) => {
//     return ResponseHandler.notFound(res, "Route not found")
// })

export { router }
