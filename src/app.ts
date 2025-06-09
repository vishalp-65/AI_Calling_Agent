import express from "express"
import helmet from "helmet"
import compression from "compression"
import cors from "cors"
import http from "http"
import { config } from "./config"
import { requestLogger } from "./middlewares/logging.middleware"
import { rateLimiter } from "./middlewares/rate-limit.middleware"
import { errorMiddleware } from "./middlewares/error.middleware"
import { router as apiRouter } from "./routes"
import { initializeWebSocket } from "./websocket"
import { kafkaService } from "./services/messaging/kafka.service"
import { logger } from "./utils/logger"

const app = express()

// Security and middlewares
app.use(helmet())
app.use(compression())
app.use(cors())
app.use(rateLimiter)

// Application middlewares
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(requestLogger)

// API routes
app.use("/api", apiRouter)

// Error middleware must be last
app.use(errorMiddleware)

// Creating HTTP server
const server = http.createServer(app)

// Initialize WebSocket
const webSocketServer = initializeWebSocket(server)

// Initialize services
const initializeServices = async () => {
    try {
        await kafkaService.connect()
        logger.info("All services initialized successfully")
    } catch (error) {
        logger.error("Failed to initialize services:", error)
        process.exit(1)
    }
}

export { app, server, webSocketServer, initializeServices }
