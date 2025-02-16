import Bull from "bull"
import { logger } from "../../utils/logger"

export class BullService {
    private queue: Bull.Queue

    constructor(queueName: string) {
        this.queue = new Bull(queueName, {
            redis: {
                host: process.env.REDIS_HOST,
                port: process.env.REDIS_PORT
                    ? parseInt(process.env.REDIS_PORT, 10)
                    : 6379
            }
        })
    }

    async addJob(name: string, data: any): Promise<void> {
        try {
            await this.queue.add(name, data)
            logger.info(`Job added: ${name}`)
        } catch (error) {
            logger.error("Failed to add job:", error)
            throw error
        }
    }

    process(name: string, processor: Bull.ProcessCallbackFunction<void>): void {
        this.queue.process(name, processor)
    }

    onCompleted(callback: (job: Bull.Job) => void): void {
        this.queue.on("completed", callback)
    }

    onFailed(callback: (job: Bull.Job, error: Error) => void): void {
        this.queue.on("failed", callback)
    }
}

export const callQueue = new BullService("call-queue")
export const analyticsQueue = new BullService("analytics-queue")
export const knowledgeQueue = new BullService("knowledge-queue")
