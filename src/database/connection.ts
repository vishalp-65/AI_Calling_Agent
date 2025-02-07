import { DataSource } from "typeorm"
import { AppDataSource } from "../config/database"
import { logger } from "../utils/logger"

export class DatabaseConnection {
    private static instance: DatabaseConnection
    private dataSource: DataSource
    private isConnected: boolean = false

    private constructor() {
        this.dataSource = AppDataSource
    }

    public static getInstance(): DatabaseConnection {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection()
        }
        return DatabaseConnection.instance
    }

    public async connect(): Promise<void> {
        if (this.isConnected) {
            logger.info("Database already connected")
            return
        }

        try {
            await this.dataSource.initialize()
            this.isConnected = true
            logger.info("Database connected successfully")
        } catch (error) {
            logger.error("Database connection failed:", error)
            throw error
        }
    }

    public async disconnect(): Promise<void> {
        if (!this.isConnected) {
            logger.info("Database already disconnected")
            return
        }

        try {
            await this.dataSource.destroy()
            this.isConnected = false
            logger.info("Database disconnected successfully")
        } catch (error) {
            logger.error("Database disconnection failed:", error)
            throw error
        }
    }

    public getDataSource(): DataSource {
        if (!this.isConnected) {
            throw new Error("Database not connected")
        }
        return this.dataSource
    }

    public async isHealthy(): Promise<boolean> {
        try {
            if (!this.isConnected) return false
            await this.dataSource.query("SELECT 1")
            return true
        } catch (error) {
            logger.error("Database health check failed:", error)
            return false
        }
    }

    public async reconnect(): Promise<void> {
        try {
            await this.disconnect()
            await this.connect()
        } catch (error) {
            logger.error("Database reconnection failed:", error)
            throw error
        }
    }
}

export const databaseConnection = DatabaseConnection.getInstance()
