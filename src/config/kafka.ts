import { Kafka, Producer, Consumer } from "kafkajs"
import { config } from "./index"

export const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
    retry: {
        retries: 5,
        initialRetryTime: 100,
        maxRetryTime: 30000
    },
    connectionTimeout: 10000,
    requestTimeout: 30000
})

export const createProducer = (): Producer => {
    return kafka.producer({
        maxInFlightRequests: 1,
        idempotent: true,
        transactionTimeout: 30000
    })
}

export const createConsumer = (groupId: string): Consumer => {
    return kafka.consumer({
        groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        maxBytesPerPartition: 1048576,
        maxBytes: 10485760
    })
}

// Topic configuration
export const KAFKA_TOPICS = {
    CALL_EVENTS: "call-events",
    CALL_TRANSCRIPTS: "call-transcripts",
    AI_RESPONSES: "ai-responses",
    KNOWLEDGE_UPDATES: "knowledge-updates",
    ANALYTICS_EVENTS: "analytics-events"
}
