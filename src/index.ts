import { config } from "./config"
import { logger } from "./utils/logger"
import { databaseConnection } from "./database/connection"
import { app, initializeServices } from "./app"

const startServer = async () => {
    try {
        // Initialize database connection
        await databaseConnection.connect()

        // Initialize services
        await initializeServices()

        // Start server
        app.listen(config.port, () => {
            logger.info(`Server started on port ${config.port}`)
            logger.info(`Environment: ${config.env}`)
        })
    } catch (error) {
        logger.error("Failed to start server:", error)
        process.exit(1)
    }
}

// Start the application
startServer()

// Graceful shutdown
process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, shutting down gracefully")
    await databaseConnection.disconnect()
    process.exit(0)
})

process.on("SIGINT", async () => {
    logger.info("SIGINT received, shutting down gracefully")
    await databaseConnection.disconnect()
    process.exit(0)
})
