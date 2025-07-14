import twilio from "twilio"
import { twilioClient, TWILIO_CONFIG } from "../../config/twilio"
import { logger } from "../../utils/logger"
import {
    CallRequest,
    CallResponse,
    CallWebhookPayload
} from "../../types/call.types"
import { EventService } from "../messaging/event.service"
import { GeminiService } from "../ai/gemini.service"
import { Readable } from "stream"
// import WebSocket from "ws"

export class TwilioService {
    private client: typeof twilioClient
    private eventService: EventService

    constructor() {
        this.client = twilioClient
        this.eventService = new EventService()
    }

    async initiateCall(request: CallRequest): Promise<CallResponse> {
        try {
            console.log("Initiate call request", request)
            const call = await this.client.calls.create({
                to: request.toNumber,
                from: request.fromNumber || TWILIO_CONFIG.phoneNumber,
                url: `${process.env.BASE_URL}/api/calls/webhook/voice`,
                statusCallback: `${process.env.BASE_URL}/api/calls/webhook/status`,
                statusCallbackEvent: [
                    "initiated",
                    "ringing",
                    "answered",
                    "completed"
                ],
                statusCallbackMethod: "POST",
                record: true,
                recordingStatusCallback: `${process.env.BASE_URL}/api/calls/webhook/recording`,
                timeout: 30
            })

            console.log("call", call)

            await this.eventService.publishCallEvent("call.initiated", {
                callSid: call.sid,
                to: request.toNumber,
                from: request.fromNumber || TWILIO_CONFIG.phoneNumber,
                metadata: request.metadata
            })

            return {
                callSid: call.sid,
                status: call.status as any
            }
        } catch (error) {
            logger.error("Failed to initiate call:", error)
            throw error
        }
    }

    async endCall(callSid: string): Promise<void> {
        try {
            await this.client.calls(callSid).update({ status: "completed" })

            await this.eventService.publishCallEvent("call.ended", {
                callSid,
                endedBy: "system"
            })
        } catch (error) {
            logger.error("Failed to end call:", error)
            throw error
        }
    }

    async handleWebhook(payload: CallWebhookPayload): Promise<void> {
        try {
            const eventType = `call.${payload.CallStatus}`

            await this.eventService.publishCallEvent(eventType, {
                callSid: payload.CallSid,
                status: payload.CallStatus,
                from: payload.From,
                to: payload.To,
                direction: payload.Direction,
                duration: payload.Duration
                    ? parseInt(payload.Duration)
                    : undefined,
                recordingUrl: payload.RecordingUrl,
                transcript: payload.TranscriptionText
            })
        } catch (error) {
            logger.error("Failed to handle webhook:", error)
            throw error
        }
    }

    generateTwiMLResponse(message: string, options: any = {}): string {
        const response = new twilio.twiml.VoiceResponse()

        response.say(
            {
                voice: (options.voice || TWILIO_CONFIG.voice.voice) as any,
                language: (options.language ||
                    TWILIO_CONFIG.voice.language) as any
            },
            message
        )

        if (options.gather) {
            const gather = response.gather({
                timeout: options.timeout || 5,
                speechTimeout: options.speechTimeout || "auto",
                enhanced: true,
                speechModel: "phone_call",
                action: options.action || "/api/calls/webhook/gather"
            })

            gather.say(options.gatherMessage || "Please speak your response.")
        }

        if (options.record) {
            response.record({
                transcribe: true,
                transcribeCallback: "/api/calls/webhook/transcription",
                maxLength: options.maxLength || 60
            })
        }

        return response.toString()
    }

    // TwilioService class
    async fetchCallStatus(callSid: string): Promise<string> {
        try {
            const call = await this.client.calls(callSid).fetch()
            return call.status
        } catch (err) {
            logger.error(`Failed to fetch status for ${callSid}:`, err)
            throw new Error("Unable to fetch call status")
        }
    }

    /**
     * Retrieve and transcribe the call recording for a given CallSid
     */
    async getCallTranscript(callSid: string): Promise<string> {
        try {
            const recordings = await this.client.recordings.list({ callSid })

            if (!recordings.length) {
                throw new Error(`No recordings found for callSid: ${callSid}`)
            }

            // Use the earliest recording (or adjust sorting as needed)
            const recording = recordings.sort(
                (a, b) =>
                    new Date(a.dateCreated!).getTime() -
                    new Date(b.dateCreated!).getTime()
            )[0]

            // Construct the audio URL (Twilio returns URI without domain)
            if (!recording) {
                throw new Error(
                    `Recording URI is missing for callSid: ${callSid}`
                )
            }
            const audioUrl = `https://api.twilio.com${recording.uri.replace(
                ".json",
                ".mp3"
            )}`

            // Download and transcribe
            const audioBuffer = await this.downloadAudioAsBuffer(audioUrl)
            const transcriptResult = await new GeminiService().speechToText(
                audioBuffer
            )

            return transcriptResult.text
        } catch (error) {
            logger.error(`Failed to get transcript for call ${callSid}:`, error)
            throw new Error("Unable to fetch call transcript")
        }
    }

    /**
     * Download the audio from a given URL into a Buffer
     */
    private async downloadAudioAsBuffer(url: string): Promise<Buffer> {
        const https = await import("https")
        const auth = `${TWILIO_CONFIG.accountSid}:${TWILIO_CONFIG.authToken}`

        return new Promise((resolve, reject) => {
            https.get(url, { auth }, (res) => {
                const chunks: Uint8Array[] = []
                res.on("data", (chunk) => chunks.push(chunk))
                res.on("end", () => resolve(Buffer.concat(chunks)))
                res.on("error", reject)
            })
        })
    }

    // Generate TwiML for real-time audio streaming
    generateRealTimeStreamTwiML(callSid: string): string {
        const response = new twilio.twiml.VoiceResponse()

        // Welcome message
        response.say(
            {
                voice: TWILIO_CONFIG.voice.voice as any,
                language: TWILIO_CONFIG.voice.language as any
            },
            "Hello! I'm your AI assistant. How can I help you today?"
        )

        // Start media stream
        const start = response.start()
        start.stream({
            url: `wss://${process.env.BASE_URL}/api/calls/media-stream`,
            name: callSid
        })

        // Keep the call active
        response.pause({ length: 3600 }) // 1 hour max call duration

        return response.toString()
    }

    // Start real-time audio stream from Twilio
    async getRealTimeAudio(callSid: string): Promise<Readable> {
        try {
            // This would be used if we need to create a direct stream
            // For now, we use WebSocket streams in the webhook handler
            const audioStream = new Readable({
                read() {}
            })

            // Simulate real-time audio stream
            setTimeout(() => {
                audioStream.push(null) // End stream
            }, 1000)

            return audioStream
        } catch (error) {
            logger.error("Failed to get real-time audio stream:", error)
            throw error
        }
    }

    // Create outbound call with real-time processing
    async initiateRealTimeCall(request: CallRequest): Promise<CallResponse> {
        try {
            const call = await this.client.calls.create({
                to: request.toNumber,
                from: request.fromNumber || TWILIO_CONFIG.phoneNumber,
                twiml: this.generateRealTimeStreamTwiML(request.toNumber),
                statusCallback: `${process.env.BASE_URL}/api/calls/webhook/status`,
                statusCallbackEvent: [
                    "initiated",
                    "ringing",
                    "answered",
                    "completed"
                ],
                statusCallbackMethod: "POST",
                timeout: 30
            })

            await this.eventService.publishCallEvent(
                "call.real-time-initiated",
                {
                    callSid: call.sid,
                    to: request.toNumber,
                    from: request.fromNumber || TWILIO_CONFIG.phoneNumber,
                    metadata: request.metadata
                }
            )

            return {
                callSid: call.sid,
                status: call.status as any
            }
        } catch (error) {
            logger.error("Failed to initiate real-time call:", error)
            throw error
        }
    }
}
