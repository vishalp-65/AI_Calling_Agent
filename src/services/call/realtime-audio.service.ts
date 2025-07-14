import { logger } from "../../utils/logger"
import { OpenAIService } from "../ai/openai.service"
import { SpeechService } from "./speech.service"
import { webSocketServer } from "../../websocket"
import { kafkaService } from "../messaging/kafka.service"
import { Readable, Transform } from "stream"
import { eventService } from "../messaging/event.service"
import { REALTIME_CONFIG } from "../../config/realtime"
import { realTimeMetricsService } from "../metrics/realtime-metrics.service"

export class RealTimeAudioService {
    private openAIService: OpenAIService
    private speechService: SpeechService
    private activeCalls: Map<string, any> = new Map()
    private conversationHistory: Map<
        string,
        Array<{ role: string; content: string }>
    > = new Map()

    constructor() {
        this.openAIService = new OpenAIService()
        this.speechService = new SpeechService()
    }

    async startRealTimeProcessing(
        callSid: string,
        audioStream: Readable
    ): Promise<void> {
        try {
            logger.info(`Starting real-time processing for call ${callSid}`)

            // Start metrics collection for this call
            realTimeMetricsService.startCall(callSid)

            // Initialize conversation history for this call
            this.conversationHistory.set(callSid, [])

            // Create audio processing pipeline
            const audioProcessor = this.createAudioProcessor(callSid)

            // Store call info
            this.activeCalls.set(callSid, {
                audioStream,
                audioProcessor,
                startTime: Date.now(),
                lastActivity: Date.now()
            })

            // Pipe audio through processor
            audioStream.pipe(audioProcessor)

            // Handle stream events
            audioStream.on("end", () => {
                this.handleCallEnd(callSid)
            })

            audioStream.on("error", (error) => {
                logger.error(`Audio stream error for call ${callSid}:`, error)
                this.handleCallError(callSid, error)
            })

            // Start heartbeat for this call
            this.startHeartbeat(callSid)
        } catch (error) {
            logger.error(
                `Failed to start real-time processing for call ${callSid}:`,
                error
            )
            throw error
        }
    }

    private createAudioProcessor(callSid: string): Transform {
        const chunkSize = 1024 * 4 // 4KB chunks for real-time processing
        let buffer = Buffer.alloc(0)
        let silenceCounter = 0
        const maxSilenceCount = 10 // ~2 seconds of silence

        return new Transform({
            transform: async (chunk: Buffer, encoding, callback) => {
                try {
                    buffer = Buffer.concat([buffer, chunk])

                    // Process chunks when we have enough data
                    while (buffer.length >= chunkSize) {
                        const audioChunk = buffer.slice(0, chunkSize)
                        buffer = buffer.slice(chunkSize)

                        // Check for silence (basic amplitude check)
                        const isSilent = this.detectSilence(audioChunk)

                        if (isSilent) {
                            silenceCounter++
                        } else {
                            silenceCounter = 0
                            await this.processAudioChunk(callSid, audioChunk)
                        }
                    }

                    // If we have accumulated silence, process the last chunk
                    if (
                        silenceCounter >= maxSilenceCount &&
                        buffer.length > 0
                    ) {
                        await this.processAudioChunk(callSid, buffer)
                        buffer = Buffer.alloc(0)
                        silenceCounter = 0
                    }

                    callback()
                } catch (error) {
                    logger.error(
                        `Audio processing error for call ${callSid}:`,
                        error
                    )
                    if (error instanceof Error) {
                        callback(error)
                    } else {
                        callback(new Error(String(error)))
                    }
                }
            }
        })
    }

    private async processAudioChunk(
        callSid: string,
        audioChunk: Buffer
    ): Promise<void> {
        const startTime = Date.now()

        try {
            // Update last activity
            const callInfo = this.activeCalls.get(callSid)
            if (callInfo) {
                callInfo.lastActivity = Date.now()
            }

            // Convert speech to text
            const transcriptResult =
                await this.speechService.convertSpeechToText(audioChunk)

            if (transcriptResult.text.trim().length === 0) {
                return // Skip empty transcripts
            }

            logger.info(
                `Transcribed text for call ${callSid}: ${transcriptResult.text}`
            )

            // Get conversation history
            const history = this.conversationHistory.get(callSid) || []

            // Add user message to history
            history.push({ role: "user", content: transcriptResult.text })

            // Generate AI response
            const aiStartTime = Date.now()
            const conversationContext = {
                callSid,
                currentLanguage: "english", // Default language, could be detected
                userInput: transcriptResult.text,
                confidence: transcriptResult.confidence || 0.9,
                conversationHistory: history.map(msg => ({
                    id: String(Date.now()),
                    role: msg.role as "user" | "assistant",
                    content: msg.content,
                    language: "english",
                    timestamp: new Date().toISOString()
                })),
                timestamp: new Date().toISOString()
            }
            const aiResponse = await this.openAIService.generateNaturalResponse(conversationContext)
            const aiResponseTime = Date.now() - aiStartTime

            // Add AI response to history
            history.push({ role: "assistant", content: aiResponse.message })

            // Keep only last 20 messages to manage memory
            if (history.length > 20) {
                history.splice(0, history.length - 20)
            }

            this.conversationHistory.set(callSid, history)

            // Convert response to speech
            const audioResponse = await this.speechService.convertTextToSpeech({
                text: aiResponse.message,
                voice: "alloy",
                speed: 1.0
            })

            // Stream response back via WebSocket
            const responseData = {
                callSid,
                transcript: transcriptResult.text,
                aiResponse: aiResponse.message,
                audioResponse: audioResponse.toString("base64"),
                timestamp: Date.now(),
                confidence: transcriptResult.confidence
            }

            // Broadcast to connected clients
            webSocketServer
                .getIO()
                .to(callSid)
                .emit("real-time-response", responseData)

            // Publish to Kafka for analytics
            await kafkaService.publishMessage("real-time-audio-events", {
                eventType: "audio-processed",
                callSid,
                transcript: transcriptResult.text,
                aiResponse: aiResponse.message,
                timestamp: Date.now(),
                processingTime:
                    Date.now() - (callInfo?.lastActivity || Date.now())
            })

            // Record metrics
            const processingTime = Date.now() - startTime
            const wordCount = transcriptResult.text
                .split(" ")
                .filter((word) => word.length > 0).length
            realTimeMetricsService.recordChunkProcessed(
                callSid,
                processingTime,
                transcriptResult.confidence || 0,
                wordCount
            )
            realTimeMetricsService.recordAIResponse(callSid, aiResponseTime)

            logger.info(
                `Processed audio chunk for call ${callSid}, response: ${aiResponse.message}`
            )
        } catch (error: any) {
            logger.error(
                `Failed to process audio chunk for call ${callSid}:`,
                error
            )
            realTimeMetricsService.recordChunkFailed(
                callSid,
                error.message,
                "audio-processing"
            )
            // Continue processing even if one chunk fails
        }
    }

    private detectSilence(audioChunk: Buffer): boolean {
        // Simple silence detection based on amplitude
        const samples = new Int16Array(
            audioChunk.buffer,
            audioChunk.byteOffset,
            audioChunk.byteLength / 2
        )
        const threshold = 500 // Adjust based on your audio input

        let totalAmplitude = 0
        for (let i = 0; i < samples.length; i++) {
            totalAmplitude += Math.abs(samples[i] ?? 0)
        }

        const averageAmplitude = totalAmplitude / samples.length
        return averageAmplitude < threshold
    }

    private startHeartbeat(callSid: string): void {
        const heartbeatInterval = setInterval(() => {
            const callInfo = this.activeCalls.get(callSid)
            if (!callInfo) {
                clearInterval(heartbeatInterval)
                return
            }

            const timeSinceLastActivity = Date.now() - callInfo.lastActivity
            const maxInactivityTime = 30000 // 30 seconds

            if (timeSinceLastActivity > maxInactivityTime) {
                logger.info(
                    `Call ${callSid} inactive for ${timeSinceLastActivity}ms, ending call`
                )
                this.handleCallEnd(callSid)
                clearInterval(heartbeatInterval)
            }
        }, 5000) // Check every 5 seconds
    }

    private handleCallEnd(callSid: string): void {
        try {
            logger.info(`Ending real-time processing for call ${callSid}`)

            const callInfo = this.activeCalls.get(callSid)
            if (callInfo) {
                // Clean up resources
                if (callInfo.audioProcessor) {
                    callInfo.audioProcessor.destroy()
                }
                this.activeCalls.delete(callSid)
            }

            // End metrics collection for this call
            realTimeMetricsService.endCall(callSid)

            // Clean up conversation history
            this.conversationHistory.delete(callSid)

            // Notify clients
            webSocketServer.getIO().to(callSid).emit("call-ended", { callSid })

            // Publish end event
            eventService.publishCallEvent("call.real-time-ended", {
                callSid,
                endTime: Date.now()
            })
        } catch (error) {
            logger.error(`Error ending call ${callSid}:`, error)
        }
    }

    private handleCallError(callSid: string, error: any): void {
        try {
            logger.error(`Call error for ${callSid}:`, error)

            // Clean up resources
            this.activeCalls.delete(callSid)
            this.conversationHistory.delete(callSid)

            // Notify clients
            webSocketServer.getIO().to(callSid).emit("call-error", {
                callSid,
                error: error.message
            })

            // Publish error event
            eventService.publishCallEvent("call.real-time-error", {
                callSid,
                error: error.message,
                timestamp: Date.now()
            })
        } catch (cleanupError) {
            logger.error(
                `Error during call cleanup for ${callSid}:`,
                cleanupError
            )
        }
    }

    async endCall(callSid: string): Promise<void> {
        const callInfo = this.activeCalls.get(callSid)
        if (callInfo) {
            if (callInfo.audioStream) {
                callInfo.audioStream.destroy()
            }
            this.handleCallEnd(callSid)
        }
    }

    getActiveCalls(): string[] {
        return Array.from(this.activeCalls.keys())
    }

    getCallInfo(callSid: string): any {
        return this.activeCalls.get(callSid)
    }
}

export const realTimeAudioService = new RealTimeAudioService()
