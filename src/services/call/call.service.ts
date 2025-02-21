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
            readStream.on("data", async (chunk) => {
                const transcriptResult =
                    await this.speechService.convertSpeechToText(chunk)
                const aiResponse = await this.openAIService.generateResponse(
                    transcriptResult.text
                )
                const ttsResponse =
                    await this.speechService.convertTextToSpeech({
                        text: aiResponse.message
                    })
                webSocketServer.getIO().to(callSid).emit('call-update', {
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
}

export const callService = new CallService()
