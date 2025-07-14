import { logger } from "../../utils/logger"
import { MediaStreamData } from "../../types/call.types"
import { OpenAIService } from "../ai/openai.service"
import { ConversationService } from "../conversation/conversation.service"

class MediaStreamServiceClass {
    private activeStreams: Map<string, any> = new Map()
    private openaiService: OpenAIService
    private conversationService: ConversationService

    constructor() {
        this.openaiService = new OpenAIService()
        this.conversationService = new ConversationService()
    }

    async handleWebSocketConnection(ws: any, callSid: string): Promise<void> {
        try {
            logger.info(
                `Media stream connection established for call: ${callSid}`
            )

            this.activeStreams.set(callSid, ws)

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
                this.activeStreams.delete(callSid)
            })

            ws.on("error", (error: Error) => {
                logger.error(`Media stream error for call ${callSid}:`, error)
                this.activeStreams.delete(callSid)
            })
        } catch (error) {
            logger.error(
                `Error handling media stream connection for ${callSid}:`,
                error
            )
            throw error
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
                        await this.processAudioData(callSid, data.media)
                    }
                    break

                case "stop":
                    logger.info(`Media stream stopped for call: ${callSid}`)
                    this.activeStreams.delete(callSid)
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

    private async processAudioData(callSid: string, media: any): Promise<void> {
        try {
            // Convert base64 audio to buffer
            const audioBuffer = Buffer.from(media.payload, "base64")

            // Process audio through OpenAI Whisper
            const speechResult = await this.openaiService.speechToText(
                audioBuffer
            )

            if (speechResult.text && speechResult.text.trim()) {
                logger.info(
                    `Transcribed audio for ${callSid}: ${speechResult.text}`
                )

                // Process through conversation service
                await this.conversationService.processUserInput(
                    callSid,
                    speechResult.text,
                    speechResult.confidence || 0.9
                )
            }
        } catch (error) {
            logger.error(`Error processing audio data for ${callSid}:`, error)
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
            this.activeStreams.delete(callSid)
        }
    }

    getActiveStreams(): string[] {
        return Array.from(this.activeStreams.keys())
    }
}

export class MediaStreamService {
    private activeStreams: Map<string, any> = new Map()
    private openaiService: OpenAIService
    private conversationService: ConversationService

    constructor() {
        this.openaiService = new OpenAIService()
        this.conversationService = new ConversationService()
    }

    async handleWebSocketConnection(ws: any, callSid: string): Promise<void> {
        try {
            logger.info(`Media stream connection established for call: ${callSid}`)
            
            this.activeStreams.set(callSid, ws)

            ws.on('message', async (message: string) => {
                try {
                    const data: MediaStreamData = JSON.parse(message)
                    await this.handleMediaStreamMessage(callSid, data)
                } catch (error) {
                    logger.error(`Error processing media stream message for ${callSid}:`, error)
                }
            })

            ws.on('close', () => {
                logger.info(`Media stream connection closed for call: ${callSid}`)
                this.activeStreams.delete(callSid)
            })

            ws.on('error', (error: Error) => {
                logger.error(`Media stream error for call ${callSid}:`, error)
                this.activeStreams.delete(callSid)
            })

        } catch (error) {
            logger.error(`Error handling media stream connection for ${callSid}:`, error)
            throw error
        }
    }

    private async handleMediaStreamMessage(callSid: string, data: MediaStreamData): Promise<void> {
        try {
            switch (data.event) {
                case 'connected':
                    logger.info(`Media stream connected for call: ${callSid}`)
                    break
                    
                case 'start':
                    logger.info(`Media stream started for call: ${callSid}`)
                    break
                    
                case 'media':
                    if (data.media) {
                        await this.processAudioData(callSid, data.media)
                    }
                    break
                    
                case 'stop':
                    logger.info(`Media stream stopped for call: ${callSid}`)
                    this.activeStreams.delete(callSid)
                    break
                    
                default:
                    logger.warn(`Unknown media stream event: ${data.event}`)
            }
        } catch (error) {
            logger.error(`Error handling media stream message for ${callSid}:`, error)
        }
    }

    private async processAudioData(callSid: string, media: any): Promise<void> {
        try {
            // Convert base64 audio to buffer
            const audioBuffer = Buffer.from(media.payload, 'base64')
            
            // Process audio through OpenAI Whisper
            const speechResult = await this.openaiService.speechToText(audioBuffer)
            
            if (speechResult.text && speechResult.text.trim()) {
                logger.info(`Transcribed audio for ${callSid}: ${speechResult.text}`)
                
                // Process through conversation service
                await this.conversationService.processUserInput(
                    callSid,
                    speechResult.text,
                    speechResult.confidence || 0.9
                )
            }
        } catch (error) {
            logger.error(`Error processing audio data for ${callSid}:`, error)
        }
    }

    sendAudioToStream(callSid: string, audioBuffer: Buffer): void {
        const ws = this.activeStreams.get(callSid)
        if (ws && ws.readyState === 1) { // WebSocket.OPEN
            const message = {
                event: 'media',
                media: {
                    payload: audioBuffer.toString('base64')
                }
            }
            ws.send(JSON.stringify(message))
        }
    }

    closeStream(callSid: string): void {
        const ws = this.activeStreams.get(callSid)
        if (ws) {
            ws.close()
            this.activeStreams.delete(callSid)
        }
    }

    getActiveStreams(): string[] {
        return Array.from(this.activeStreams.keys())
    }
}

export const mediaStreamService = new MediaStreamService()
