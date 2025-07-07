import { logger } from "../../utils/logger"
import { kafkaService } from "../messaging/kafka.service"
import { REALTIME_CONFIG } from "../../config/realtime"

interface CallMetrics {
    callSid: string
    startTime: number
    endTime?: number
    totalChunks: number
    processedChunks: number
    failedChunks: number
    avgProcessingTime: number
    avgConfidence: number
    totalTranscribedWords: number
    totalAIResponses: number
    avgResponseTime: number
    errors: Array<{
        timestamp: number
        error: string
        stage: string
    }>
}

interface SystemMetrics {
    timestamp: number
    activeCalls: number
    totalProcessingTime: number
    avgProcessingTime: number
    errorRate: number
    throughput: number
    memoryUsage: number
    cpuUsage: number
}

export class RealTimeMetricsService {
    private callMetrics: Map<string, CallMetrics> = new Map()
    private systemMetrics: SystemMetrics[] = []
    private metricsInterval: NodeJS.Timeout | null = null

    constructor() {
        if (REALTIME_CONFIG.metrics.enableMetrics) {
            this.startMetricsCollection()
        }
    }

    private startMetricsCollection(): void {
        this.metricsInterval = setInterval(() => {
            this.collectSystemMetrics()
        }, REALTIME_CONFIG.metrics.metricsInterval)
    }

    private collectSystemMetrics(): void {
        try {
            const memUsage = process.memoryUsage()
            const cpuUsage = process.cpuUsage()

            const metrics: SystemMetrics = {
                timestamp: Date.now(),
                activeCalls: this.callMetrics.size,
                totalProcessingTime: this.getTotalProcessingTime(),
                avgProcessingTime: this.getAverageProcessingTime(),
                errorRate: this.getErrorRate(),
                throughput: this.getThroughput(),
                memoryUsage: memUsage.heapUsed / 1024 / 1024, // MB
                cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000 // milliseconds
            }

            this.systemMetrics.push(metrics)

            // Keep only recent metrics
            if (
                this.systemMetrics.length >
                REALTIME_CONFIG.metrics.maxMetricsHistory
            ) {
                this.systemMetrics.shift()
            }

            // Publish metrics to Kafka
            kafkaService.publishMessage(
                REALTIME_CONFIG.kafka.topics.analyticsEvents,
                {
                    eventType: "system-metrics",
                    metrics,
                    timestamp: Date.now()
                }
            )

            if (REALTIME_CONFIG.logging.logMetrics) {
                logger.info("System metrics collected:", metrics)
            }
        } catch (error) {
            logger.error("Error collecting system metrics:", error)
        }
    }

    startCall(callSid: string): void {
        const metrics: CallMetrics = {
            callSid,
            startTime: Date.now(),
            totalChunks: 0,
            processedChunks: 0,
            failedChunks: 0,
            avgProcessingTime: 0,
            avgConfidence: 0,
            totalTranscribedWords: 0,
            totalAIResponses: 0,
            avgResponseTime: 0,
            errors: []
        }

        this.callMetrics.set(callSid, metrics)
        logger.info(`Started metrics collection for call ${callSid}`)
    }

    endCall(callSid: string): void {
        const metrics = this.callMetrics.get(callSid)
        if (metrics) {
            metrics.endTime = Date.now()

            // Calculate final metrics
            const callDuration = metrics.endTime - metrics.startTime
            const successRate = metrics.processedChunks / metrics.totalChunks
            const failureRate = metrics.failedChunks / metrics.totalChunks

            // Publish final call metrics
            kafkaService.publishMessage(
                REALTIME_CONFIG.kafka.topics.analyticsEvents,
                {
                    eventType: "call-metrics",
                    callSid,
                    metrics: {
                        ...metrics,
                        callDuration,
                        successRate,
                        failureRate
                    },
                    timestamp: Date.now()
                }
            )

            logger.info(`Call ${callSid} metrics:`, {
                duration: callDuration,
                totalChunks: metrics.totalChunks,
                processedChunks: metrics.processedChunks,
                failedChunks: metrics.failedChunks,
                successRate,
                failureRate,
                avgProcessingTime: metrics.avgProcessingTime,
                avgConfidence: metrics.avgConfidence
            })

            this.callMetrics.delete(callSid)
        }
    }

    recordChunkProcessed(
        callSid: string,
        processingTime: number,
        confidence: number,
        wordCount: number
    ): void {
        const metrics = this.callMetrics.get(callSid)
        if (metrics) {
            metrics.totalChunks++
            metrics.processedChunks++
            metrics.totalTranscribedWords += wordCount

            // Update average processing time
            metrics.avgProcessingTime =
                (metrics.avgProcessingTime * (metrics.processedChunks - 1) +
                    processingTime) /
                metrics.processedChunks

            // Update average confidence
            metrics.avgConfidence =
                (metrics.avgConfidence * (metrics.processedChunks - 1) +
                    confidence) /
                metrics.processedChunks
        }
    }

    recordChunkFailed(callSid: string, error: string, stage: string): void {
        const metrics = this.callMetrics.get(callSid)
        if (metrics) {
            metrics.totalChunks++
            metrics.failedChunks++
            metrics.errors.push({
                timestamp: Date.now(),
                error,
                stage
            })
        }
    }

    recordAIResponse(callSid: string, responseTime: number): void {
        const metrics = this.callMetrics.get(callSid)
        if (metrics) {
            metrics.totalAIResponses++

            // Update average response time
            metrics.avgResponseTime =
                (metrics.avgResponseTime * (metrics.totalAIResponses - 1) +
                    responseTime) /
                metrics.totalAIResponses
        }
    }

    private getTotalProcessingTime(): number {
        let total = 0
        for (const [, metrics] of this.callMetrics) {
            total += metrics.avgProcessingTime * metrics.processedChunks
        }
        return total
    }

    private getAverageProcessingTime(): number {
        if (this.callMetrics.size === 0) return 0

        let totalTime = 0
        let totalChunks = 0

        for (const [, metrics] of this.callMetrics) {
            totalTime += metrics.avgProcessingTime * metrics.processedChunks
            totalChunks += metrics.processedChunks
        }

        return totalChunks > 0 ? totalTime / totalChunks : 0
    }

    private getErrorRate(): number {
        if (this.callMetrics.size === 0) return 0

        let totalChunks = 0
        let failedChunks = 0

        for (const [, metrics] of this.callMetrics) {
            totalChunks += metrics.totalChunks
            failedChunks += metrics.failedChunks
        }

        return totalChunks > 0 ? failedChunks / totalChunks : 0
    }

    private getThroughput(): number {
        if (this.systemMetrics.length < 2) return 0

        const latest = this.systemMetrics[this.systemMetrics.length - 1]
        const previous = this.systemMetrics[this.systemMetrics.length - 2]

        if (!latest || !previous) {
            return 0
        }

        const timeDiff = latest.timestamp - previous.timestamp
        const activeCalls = latest.activeCalls

        return timeDiff > 0 ? (activeCalls * 1000) / timeDiff : 0
    }

    getCallMetrics(callSid: string): CallMetrics | undefined {
        return this.callMetrics.get(callSid)
    }

    getSystemMetrics(): SystemMetrics[] {
        return [...this.systemMetrics]
    }

    getLatestSystemMetrics(): SystemMetrics | undefined {
        return this.systemMetrics[this.systemMetrics.length - 1]
    }

    getActiveCalls(): string[] {
        return Array.from(this.callMetrics.keys())
    }

    getHealthStatus(): {
        healthy: boolean
        activeCalls: number
        avgProcessingTime: number
        errorRate: number
        memoryUsage: number
    } {
        const latest = this.getLatestSystemMetrics()
        const errorRate = this.getErrorRate()
        const avgProcessingTime = this.getAverageProcessingTime()

        const healthy =
            errorRate < 0.1 && // Less than 10% error rate
            avgProcessingTime < 2000 && // Less than 2 seconds average processing time
            this.callMetrics.size <
                REALTIME_CONFIG.processing.maxConcurrentCalls && // Within concurrent call limit
            (latest?.memoryUsage || 0) < 512 // Less than 512MB memory usage

        return {
            healthy,
            activeCalls: this.callMetrics.size,
            avgProcessingTime,
            errorRate,
            memoryUsage: latest?.memoryUsage || 0
        }
    }

    stop(): void {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval)
            this.metricsInterval = null
        }
    }
}

export const realTimeMetricsService = new RealTimeMetricsService()
