import { TwilioService } from "./twilio.service"
import { OpenAIService } from "../ai/openai.service"
import { SpeechService } from "./speech.service"
import { PineconeService } from "../ai/pinecone.service"
import { eventService } from "../messaging/event.service"
import { logger } from "../../utils/logger"
import { CallRequest, CallResponse } from "../../types/call.types"
import { callQueue } from "../queue/bull.service"
import { webSocketServer } from "../../websocket"
import { Readable } from "stream"

export class CallService {
    private twilioService: TwilioService
    private openAIService: OpenAIService
    private speechService: SpeechService
    private pineconeService: PineconeService

    constructor() {
        this.twilioService = new TwilioService()
        this.openAIService = new OpenAIService()
        this.speechService = new SpeechService()
        this.pineconeService = new PineconeService()
    }

    async initiateCall(request: CallRequest): Promise<CallResponse> {
        try {
            const response = await this.twilioService.initiateCall(request)
            logger.info(`Initiated call with ID: ${response.callSid}`)

            // Add call processing job
            await callQueue.addJob("process-call", {
                callSid: response.callSid
            })

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
            const sentiment = await this.openAIService.analyzeCallSentiment(
                transcript
            )
            const summary = await this.openAIService.summarizeCall(transcript)

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

    async processRealTimeCall(callSid: string): Promise<void> {
        try {
            const audioStream = await this.twilioService.getRealTimeAudio(
                callSid
            )
            const readStream = new Readable().wrap(audioStream)

            // Real-time processing
            readStream.on("data", async (chunk: any) => {
                const transcriptResult =
                    await this.speechService.convertSpeechToText(chunk)
                const aiResponse =
                    await this.openAIService.generateNaturalResponse(
                        transcriptResult.text
                    )
                const ttsResponse =
                    await this.speechService.convertTextToSpeech({
                        text: aiResponse.message
                    })
                webSocketServer
                    .getIO()
                    .to(callSid)
                    .emit("call-update", {
                        audio: ttsResponse.toString("base64"),
                        text: aiResponse.message
                    })
            })

            readStream.on("end", () => {
                this.endCall(callSid)
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
