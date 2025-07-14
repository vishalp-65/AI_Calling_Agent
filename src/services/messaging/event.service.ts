import { kafkaService } from "./kafka.service"
import { logger } from "../../utils/logger"

export class EventService {
    async publishCallEvent(eventType: string, data: any): Promise<void> {
        try {
            await kafkaService.publishMessage("call-events", {
                eventType,
                data,
                timestamp: new Date().toISOString()
            })
            logger.info(`Event published: ${eventType}`)
        } catch (error) {
            logger.error(`Failed to publish event: ${eventType}`, error)
            throw error
        }
    }

    async publishAnalyticsEvent(eventType: string, data: any): Promise<void> {
        try {
            await kafkaService.publishMessage("analytics-events", {
                eventType,
                data,
                timestamp: new Date().toISOString()
            })
            logger.info(`Analytics event published: ${eventType}`)
        } catch (error) {
            logger.error(`Failed to publish analytics event: ${eventType}`, error)
            throw error
        }
    }

    async publishKnowledgeEvent(eventType: string, data: any): Promise<void> {
        try {
            await kafkaService.publishMessage("knowledge-events", {
                eventType,
                data,
                timestamp: new Date().toISOString()
            })
            logger.info(`Knowledge event published: ${eventType}`)
        } catch (error) {
            logger.error(`Failed to publish knowledge event: ${eventType}`, error)
            throw error
        }
    }

    async publishConversationEvent(eventType: string, data: any): Promise<void> {
        try {
            await kafkaService.publishMessage("conversation-events", {
                eventType,
                data,
                timestamp: new Date().toISOString()
            })
            logger.info(`Conversation event published: ${eventType}`)
        } catch (error) {
            logger.error(`Failed to publish conversation event: ${eventType}`, error)
            throw error
        }
    }
}

export const eventService = new EventService()
