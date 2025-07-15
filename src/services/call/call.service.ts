import { TwilioService } from "./twilio.service"
import { GeminiService } from "../ai/gemini.service"
import { SpeechService } from "./speech.service"
import { PineconeService } from "../ai/pinecone.service"
import { eventService } from "../messaging/event.service"
import { logger } from "../../utils/logger"
import { CallRequest, CallResponse } from "../../types/call.types"
import { callQueue } from "../queue/bull.service"
import { webSocketServer } from "../../websocket"
import { Readable } from "stream"
import { ConversationHistoryService } from "../conversation/conversation-history.service"

export class CallService {
    private twilioService: TwilioService
    private geminiService: GeminiService
    private speechService: SpeechService
    private pineconeService: PineconeService
    private historyService = new ConversationHistoryService()

    constructor() {
        this.twilioService = new TwilioService()
        this.geminiService = new GeminiService()
        this.speechService = new SpeechService()
        this.pineconeService = new PineconeService()
        this.historyService = new ConversationHistoryService()
    }

    async initiateCall(request: CallRequest): Promise<CallResponse> {
        try {
            const response = await this.twilioService.initiateCall(request)
            logger.info(`Initiated call with ID: ${response.callSid}`)

            // Add call processing job
            // await callQueue.addJob("process-call", {
            //     callSid: response.callSid
            // })

            return response
        } catch (error) {
            logger.error("Failed to initiate call:", error)
            throw error
        }
    }

    async endCall(callSid: string): Promise<void> {
        try {
            const response = await this.twilioService.endCall(callSid)
            logger.info(`Ended call with ID: ${callSid}`)

            // Add call processing job
            await callQueue.addJob("process-call", {
                callSid
            })

            return response
        } catch (error) {
            logger.error("Failed to initiate call:", error)
            throw error
        }
    }

    async processCall(callSid: string): Promise<void> {
        try {
            // Perform AI processing
            const transcript = await this.twilioService.getCallTranscript(
                callSid
            )
            const sentiment = await this.geminiService.analyzeCallSentiment(
                transcript
            )
            const summary = await this.geminiService.summarizeCall(transcript)

            // Upsert knowledge
            await this.pineconeService.upsertKnowledge(callSid, transcript)

            await eventService.publishCallEvent("call.processed", {
                callSid,
                sentiment,
                summary
            })

            logger.info(`Processed call with ID: ${callSid}`)
        } catch (error) {
            logger.error("Failed to process call:", error)
            throw error
        }
    }

    /**
     * Processes audio chunks in real time, maintaining conversation context.
     */
    async processRealTimeCall(callSid: string): Promise<void> {
        try {
            const audioStream = await this.twilioService.getRealTimeAudio(
                callSid
            )
            const readStream = new Readable().wrap(audioStream)

            // Ensure history initialized
            const history = this.historyService.getHistory(callSid) || []
            let currentLanguage =
                this.historyService.getCurrentLanguage(callSid) || "english"

            readStream.on("data", async (chunk: any) => {
                try {
                    // Convert speech to text
                    const transcriptResult =
                        await this.speechService.convertSpeechToText(chunk)
                    const userInput = transcriptResult.text
                    const confidence = transcriptResult.confidence

                    // Build context
                    const context = {
                        callSid,
                        userInput,
                        confidence: confidence ?? 0,
                        conversationHistory: history,
                        currentLanguage,
                        timestamp: new Date().toISOString()
                    }

                    // Generate AI response
                    const aiResponse =
                        await this.geminiService.generateNaturalResponse(
                            context
                        )

                    // Update history and language
                    history.push({
                        role: "user",
                        content: userInput,
                        id: callSid,
                        language:
                            aiResponse.detectedLanguage || currentLanguage,
                        timestamp: new Date().toISOString()
                    })
                    history.push({
                        role: "assistant",
                        content: aiResponse.message,
                        id: callSid,
                        language:
                            aiResponse.detectedLanguage || currentLanguage,
                        timestamp: new Date().toISOString()
                    })
                    currentLanguage =
                        aiResponse.detectedLanguage || currentLanguage
                    this.historyService.setCurrentLanguage(
                        callSid,
                        currentLanguage
                    )

                    // Convert AI text to speech
                    const ttsBuffer =
                        await this.speechService.convertTextToSpeech({
                            text: aiResponse.message
                        })

                    // Emit both audio and text
                    webSocketServer
                        .getIO()
                        .to(callSid)
                        .emit("call-update", {
                            audio: ttsBuffer.toString("base64"),
                            text: aiResponse.message
                        })
                } catch (err) {
                    logger.error(
                        `Error during real-time processing for ${callSid}:`,
                        err
                    )
                }
            })

            readStream.on("end", async () => {
                await this.endCall(callSid)
            })
        } catch (error) {
            logger.error("Failed to process real-time call:", error)
            throw error
        }
    }

    // inside CallService class
    async getCallStatus(callSid: string): Promise<string> {
        // delegate down to TwilioService
        return this.twilioService.fetchCallStatus(callSid)
    }

    async updateCallStatus(callSid: string, status: string): Promise<void> {
        try {
            logger.info(`Updating call status: ${callSid} -> ${status}`)
            // Here you would update your database with the new status
            // For now, we'll just log and emit an event
            await eventService.publishCallEvent("call.status.updated", {
                callSid,
                status,
                timestamp: new Date().toISOString()
            })
        } catch (error) {
            logger.error(`Failed to update call status for ${callSid}:`, error)
            throw error
        }
    }

    async updateCallRecording(
        callSid: string,
        recordingUrl: string,
        recordingSid: string,
        duration: number
    ): Promise<void> {
        try {
            logger.info(`Updating call recording: ${callSid}`)
            // Here you would update your database with recording information
            await eventService.publishCallEvent("call.recording.updated", {
                callSid,
                recordingUrl,
                recordingSid,
                duration,
                timestamp: new Date().toISOString()
            })
        } catch (error) {
            logger.error(
                `Failed to update call recording for ${callSid}:`,
                error
            )
            throw error
        }
    }

    async updateCallTranscription(
        callSid: string,
        transcriptionText: string,
        transcriptionStatus: string
    ): Promise<void> {
        try {
            logger.info(`Updating call transcription: ${callSid}`)
            // Here you would update your database with transcription information
            await eventService.publishCallEvent("call.transcription.updated", {
                callSid,
                transcriptionText,
                transcriptionStatus,
                timestamp: new Date().toISOString()
            })
        } catch (error) {
            logger.error(
                `Failed to update call transcription for ${callSid}:`,
                error
            )
            throw error
        }
    }

    async initializeCall(callSid: string, callData: any): Promise<void> {
        try {
            logger.info(`Initializing call: ${callSid}`)
            // Here you would create the call record in your database
            await eventService.publishCallEvent("call.initialized", {
                callSid,
                ...callData,
                timestamp: new Date().toISOString()
            })
        } catch (error) {
            logger.error(`Failed to initialize call ${callSid}:`, error)
            throw error
        }
    }

    async updateCallMetrics(callSid: string, metrics: any): Promise<void> {
        try {
            logger.info(`Updating call metrics: ${callSid}`)
            // Here you would update call metrics in your database
            await eventService.publishCallEvent("call.metrics.updated", {
                callSid,
                metrics,
                timestamp: new Date().toISOString()
            })
        } catch (error) {
            logger.error(`Failed to update call metrics for ${callSid}:`, error)
            throw error
        }
    }
}

export const callService = new CallService()
