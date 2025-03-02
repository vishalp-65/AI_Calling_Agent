import { Kafka, Producer, Consumer, EachMessagePayload } from "kafkajs"
import { config } from "../../config"
import { logger } from "../../utils/logger"

export class KafkaService {
    private kafka: Kafka
    private producer: Producer
    private consumers: Map<string, Consumer> = new Map()
    private isProducerConnected: boolean = false

    constructor() {
        this.kafka = new Kafka({
            clientId: config.kafka.clientId,
            brokers: config.kafka.brokers,
            retry: {
                initialRetryTime: 100,
                retries: 8
            }
        })
        this.producer = this.kafka.producer()
    }

    async connect(): Promise<void> {
        try {
            await this.producer.connect()
            this.isProducerConnected = true
            logger.info("Kafka producer connected")
        } catch (error) {
            logger.error("Failed to connect to Kafka:", error)
            throw error
        }
    }

    async disconnect(): Promise<void> {
        try {
            // Disconnect all consumers
            for (const [topic, consumer] of this.consumers) {
                await consumer.disconnect()
                logger.info(`Kafka consumer for ${topic} disconnected`)
            }
            this.consumers.clear()

            // Disconnect producer
            if (this.isProducerConnected) {
                await this.producer.disconnect()
                this.isProducerConnected = false
                logger.info("Kafka producer disconnected")
            }
        } catch (error) {
            logger.error("Failed to disconnect from Kafka:", error)
            throw error
        }
    }

    async publishMessage(
        topic: string,
        message: any,
        key?: string,
        partition?: number
    ): Promise<void> {
        try {
            if (!this.isProducerConnected) {
                await this.connect()
            }

            await this.producer.send({
                topic,
                messages: [
                    {
                        key: key || null,
                        value: JSON.stringify(message),
                        partition,
                        timestamp: Date.now().toString()
                    }
                ]
            })

            logger.debug(`Message published to topic ${topic}`, { message, key })
        } catch (error) {
            logger.error(`Failed to publish message to ${topic}:`, error)
            throw error
        }
    }

    async subscribe(
        topic: string,
        groupId: string,
        messageHandler: (payload: EachMessagePayload) => Promise<void>
    ): Promise<void> {
        try {
            const consumer = this.kafka.consumer({ groupId })
            await consumer.connect()
            await consumer.subscribe({ topic, fromBeginning: false })

            await consumer.run({
                eachMessage: async (payload: EachMessagePayload) => {
                    try {
                        await messageHandler(payload)
                    } catch (error) {
                        logger.error(`Error processing message from ${topic}:`, error)
                        // Implement retry logic or dead letter queue here
                    }
                }
            })

            this.consumers.set(topic, consumer)
            logger.info(`Kafka consumer subscribed to topic ${topic} with group ${groupId}`)
        } catch (error) {
            logger.error(`Failed to subscribe to topic ${topic}:`, error)
            throw error
        }
    }

    async unsubscribe(topic: string): Promise<void> {
        try {
            const consumer = this.consumers.get(topic)
            if (consumer) {
                await consumer.disconnect()
                this.consumers.delete(topic)
                logger.info(`Unsubscribed from topic ${topic}`)
            }
        } catch (error) {
            logger.error(`Failed to unsubscribe from topic ${topic}:`, error)
            throw error
        }
    }

    async createTopic(topic: string, numPartitions: number = 1, replicationFactor: number = 1): Promise<void> {
        try {
            const admin = this.kafka.admin()
            await admin.connect()

            await admin.createTopics({
                topics: [
                    {
                        topic,
                        numPartitions,
                        replicationFactor
                    }
                ]
            })

            await admin.disconnect()
            logger.info(`Topic ${topic} created successfully`)
        } catch (error) {
            logger.error(`Failed to create topic ${topic}:`, error)
            throw error
        }
    }

    async isHealthy(): Promise<boolean> {
        try {
            const admin = this.kafka.admin()
            await admin.connect()
            
            const metadata = await admin.fetchTopicMetadata()
            await admin.disconnect()
            
            return metadata.topics.length >= 0
        } catch (error) {
            logger.error("Kafka health check failed:", error)
            return false
        }
    }

    // Call-specific event methods
    async publishCallEvent(eventType: string, data: any): Promise<void> {
        await this.publishMessage('call-events', {
            eventType,
            data,
            timestamp: new Date().toISOString()
        }, data.callSid)
    }

    async publishAnalyticsEvent(eventType: string, data: any): Promise<void> {
        await this.publishMessage('analytics-events', {
            eventType,
            data,
            timestamp: new Date().toISOString()
        })
    }

    async publishKnowledgeEvent(eventType: string, data: any): Promise<void> {
        await this.publishMessage('knowledge-events', {
            eventType,
            data,
            timestamp: new Date().toISOString()
        })
    }
}

export const kafkaService = new KafkaService()
