import { logger } from "../../utils/logger"
import { MediaStreamData } from "../../types/call.types"
import { ConversationService } from "../conversation/conversation.service"
import { SpeechService } from "./speech.service"
import { TWILIO_CONFIG } from "../../config/twilio"

class MediaStreamServiceClass {
    private activeStreams: Map<string, any> = new Map()
    private conversationService: ConversationService
    private audioChunks: Map<string, Buffer[]> = new Map()
    private processingTimers: Map<string, NodeJS.Timeout> = new Map()
    private isProcessing: Map<string, boolean> = new Map()
    private speechService: SpeechService

    // Cache for speech service instances to avoid creating new instances
    private static speechServiceInstance: SpeechService | null = null

    constructor() {
        this.conversationService = new ConversationService()
        this.speechService = MediaStreamServiceClass.getSpeechService()
    }

    // Singleton pattern for speech service to improve performance
    private static getSpeechService(): SpeechService {
        if (!MediaStreamServiceClass.speechServiceInstance) {
            MediaStreamServiceClass.speechServiceInstance = new SpeechService()
        }
        return MediaStreamServiceClass.speechServiceInstance
    }

    async handleWebSocketConnection(ws: any, callSid: string): Promise<void> {
        try {
            logger.info(
                `Media stream connection established for call: ${callSid}`
            )

            this.activeStreams.set(callSid, ws)
            this.audioChunks.set(callSid, [])
            this.isProcessing.set(callSid, false)

            ws.on("message", async (message: string) => {
                try {
                    const data: MediaStreamData = JSON.parse(message)
                    await this.handleMediaStreamMessage(callSid, data)
                } catch (error) {
                    logger.error(
                        `Error processing media stream message for ${callSid}:`,
                        error
                    )
                }
            })

            ws.on("close", () => {
                logger.info(
                    `Media stream connection closed for call: ${callSid}`
                )
                this.cleanupResources(callSid)
            })

            ws.on("error", (error: Error) => {
                logger.error(`Media stream error for call ${callSid}:`, error)
                this.cleanupResources(callSid)
            })
        } catch (error) {
            logger.error(
                `Error handling media stream connection for ${callSid}:`,
                error
            )
            throw error
        }
    }

    private cleanupResources(callSid: string): void {
        this.activeStreams.delete(callSid)
        this.audioChunks.delete(callSid)
        this.isProcessing.delete(callSid)

        const timer = this.processingTimers.get(callSid)
        if (timer) {
            clearTimeout(timer)
            this.processingTimers.delete(callSid)
        }
    }

    private async handleMediaStreamMessage(
        callSid: string,
        data: MediaStreamData
    ): Promise<void> {
        try {
            switch (data.event) {
                case "connected":
                    logger.info(`Media stream connected for call: ${callSid}`)
                    break

                case "start":
                    logger.info(`Media stream started for call: ${callSid}`)
                    break

                case "media":
                    if (data.media) {
                        await this.bufferAudioData(callSid, data.media)
                    }
                    break

                case "stop":
                    logger.info(`Media stream stopped for call: ${callSid}`)
                    // Process any remaining audio before cleanup
                    await this.processBufferedAudio(callSid, true)
                    this.cleanupResources(callSid)
                    break

                default:
                    logger.warn(`Unknown media stream event: ${data.event}`)
            }
        } catch (error) {
            logger.error(
                `Error handling media stream message for ${callSid}:`,
                error
            )
        }
    }

    private async bufferAudioData(callSid: string, media: any): Promise<void> {
        try {
            // Convert base64 audio to buffer and add to chunks
            const audioBuffer = Buffer.from(media.payload, "base64")
            const chunks = this.audioChunks.get(callSid) || []
            chunks.push(audioBuffer)
            this.audioChunks.set(callSid, chunks)

            // Use optimized processing interval from Twilio config
            const processingInterval =
                TWILIO_CONFIG.streamingLatencyReduction.processingInterval

            // Schedule processing if not already in progress
            if (!this.processingTimers.has(callSid)) {
                const timer = setTimeout(() => {
                    this.processBufferedAudio(callSid, false).catch((err) => {
                        logger.error(`Error processing buffered audio: ${err}`)
                    })
                }, processingInterval) // Use optimized interval (200ms)

                this.processingTimers.set(callSid, timer)
            }
        } catch (error) {
            logger.error(`Error buffering audio data for ${callSid}:`, error)
        }
    }

    private async processBufferedAudio(
        callSid: string,
        forceProcess: boolean
    ): Promise<void> {
        // Clear the timer
        const timer = this.processingTimers.get(callSid)
        if (timer) {
            clearTimeout(timer)
            this.processingTimers.delete(callSid)
        }

        // Check if we're already processing or if there's not enough audio
        const chunks = this.audioChunks.get(callSid) || []
        if (
            this.isProcessing.get(callSid) ||
            (chunks.length < 2 && !forceProcess) // Reduced from 3 to 2 chunks for faster processing
        ) {
            return
        }

        try {
            this.isProcessing.set(callSid, true)

            // Combine all audio chunks
            const combinedBuffer = Buffer.concat(chunks)

            // Clear the buffer
            this.audioChunks.set(callSid, [])

            if (combinedBuffer.length > 0) {
                // Use the cached speech service instance for better performance
                const speechResult =
                    await this.speechService.convertSpeechToText(combinedBuffer)

                if (speechResult.text && speechResult.text.trim()) {
                    logger.info(
                        `Transcribed audio for ${callSid}: ${speechResult.text}`
                    )

                    // Process through conversation service with streaming flag
                    await this.conversationService.processUserInput(
                        callSid,
                        speechResult.text,
                        speechResult.confidence || 0.9,
                        undefined,
                        true // Mark as streaming for faster processing
                    )
                }
            }
        } catch (error) {
            logger.error(`Error processing audio data for ${callSid}:`, error)
        } finally {
            this.isProcessing.set(callSid, false)

            // If more audio has accumulated during processing, schedule another processing
            const newChunks = this.audioChunks.get(callSid) || []
            if (newChunks.length > 0) {
                const timer = setTimeout(() => {
                    this.processBufferedAudio(callSid, false).catch((err) => {
                        logger.error(`Error processing buffered audio: ${err}`)
                    })
                }, 200) // Reduced from 300ms to 200ms for faster processing

                this.processingTimers.set(callSid, timer)
            }
        }
    }

    sendAudioToStream(callSid: string, audioBuffer: Buffer): void {
        const ws = this.activeStreams.get(callSid)
        if (ws && ws.readyState === 1) {
            // WebSocket.OPEN
            const message = {
                event: "media",
                media: {
                    payload: audioBuffer.toString("base64")
                }
            }
            ws.send(JSON.stringify(message))
        }
    }

    closeStream(callSid: string): void {
        const ws = this.activeStreams.get(callSid)
        if (ws) {
            ws.close()
            this.cleanupResources(callSid)
        }
    }

    getActiveStreams(): string[] {
        return Array.from(this.activeStreams.keys())
    }
}

export class MediaStreamService extends MediaStreamServiceClass {
    // Using the optimized implementation from MediaStreamServiceClass
}

export const mediaStreamService = new MediaStreamService()
