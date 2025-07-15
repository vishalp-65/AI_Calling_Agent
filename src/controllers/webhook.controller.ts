import { Request, Response } from "express"
import { logger } from "../utils/logger"
import { MediaStreamService } from "../services/call/media-stream.service"
import { CallStatusService } from "../services/call/call-status.service"
import { validateWebhookRequest } from "../middlewares/webhook-validation"
import { ApiError } from "../utils/api-error"
import { HTTP_STATUS } from "../constants/http-status"
import { CallWebhookService } from "../services/call/call-webhook.service"
import { ConversationService } from "../services/conversation/conversation.service"
import { TWILIO_CONFIG } from "../config/twilio"

export class WebhookController {
    private callWebhookService: CallWebhookService
    private conversationService: ConversationService
    private mediaStreamService: any // Fixed type issue
    private callStatusService: any // Fixed type issue

    constructor() {
        this.callWebhookService = new CallWebhookService()
        this.conversationService = new ConversationService()
        this.mediaStreamService = new MediaStreamService()
        this.callStatusService = new CallStatusService()
    }

    // Handle incoming call webhook
    async handleIncomingCall(req: Request, res: Response): Promise<void> {
        try {
            const webhookData = validateWebhookRequest(req.body)
            logger.info(
                `Incoming call: ${webhookData.CallSid} from ${webhookData.From}`
            )

            const twiml =
                await this.callWebhookService.generateIncomingCallResponse(
                    webhookData,
                    req.get("host") || "localhost"
                )

            res.type("text/xml").send(twiml)
        } catch (error) {
            logger.error("Error handling incoming call:", error)
            res.status(500)
                .type("text/xml")
                .send(
                    `<Response><Say voice=${TWILIO_CONFIG.voice.hi.voice} language=${TWILIO_CONFIG.defaultLanguage}>
                        I apologize, but I'm experiencing technical difficulties.</Say></Response>`
                )
        }
    }

    // Handle outgoing call webhook
    async handleOutgoingCall(req: Request, res: Response): Promise<void> {
        try {
            const webhookData = validateWebhookRequest(req.body)
            logger.info(
                `Outgoing call: ${webhookData.CallSid}, status: ${webhookData.CallStatus}`
            )

            const twiml =
                await this.callWebhookService.generateOutgoingCallResponse(
                    webhookData,
                    req.get("host") || "localhost"
                )

            res.type("text/xml").send(twiml)
        } catch (error) {
            logger.error("Error handling outgoing call:", error)
            const errorTwiml = this.callWebhookService.generateErrorResponse(
                "I apologize, but I'm experiencing technical difficulties."
            )
            res.type("text/xml").send(errorTwiml)
        }
    }

    // Handle speech input from user
    async handleSpeechInput(req: Request, res: Response): Promise<void> {
        try {
            const speechData = {
                callSid: req.body.CallSid,
                speechResult: req.body.SpeechResult?.trim(),
                confidence: parseFloat(req.body.Confidence) || 0
            }

            logger.info(
                `Speech input [${speechData.callSid}]: "${speechData.speechResult}" (confidence: ${speechData.confidence})`
            )

            // Handle empty speech
            if (!speechData.speechResult) {
                const twiml = this.callWebhookService.generateNoSpeechResponse()
                res.type("text/xml").send(twiml)
                return
            }

            // Extract phone number from request for user knowledge context
            const phoneNumber = req.body.From || req.body.Caller

            // Process conversation through service
            const conversationResult =
                await this.conversationService.processUserInput(
                    speechData.callSid,
                    speechData.speechResult,
                    speechData.confidence,
                    phoneNumber
                )

            // Generate TwiML response
            const twiml =
                await this.callWebhookService.generateConversationResponse(
                    conversationResult
                )

            res.type("text/xml").send(twiml)
        } catch (error) {
            logger.error("Error handling speech input:", error)
            const errorTwiml = this.callWebhookService.generateErrorResponse(
                "I apologize, but I'm having trouble understanding. Could you please repeat that?"
            )
            res.type("text/xml").send(errorTwiml)
        }
    }

    // Handle call status updates
    async handleCallStatus(req: Request, res: Response): Promise<void> {
        try {
            const statusData = validateWebhookRequest(req.body)
            logger.info(
                `Call status update: ${statusData.CallSid} -> ${statusData.CallStatus}`
            )

            await this.callStatusService.updateCallStatus(statusData)

            res.status(HTTP_STATUS.OK).send("OK")
        } catch (error) {
            logger.error("Error handling call status:", error)
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
                "Internal Server Error"
            )
        }
    }

    // Handle media stream WebSocket connection
    async handleMediaStream(ws: any, req: Request): Promise<void> {
        try {
            const callSid = req.params.callSid || (req.query.callSid as string)

            if (!callSid) {
                logger.error("Media stream connection without callSid")
                ws.close(1008, "CallSid required")
                return
            }

            logger.info(`Media stream connected: ${callSid}`)

            await this.mediaStreamService.handleWebSocketConnection(ws, callSid)
        } catch (error) {
            logger.error("Error handling media stream:", error)
            ws.close(1011, "Internal server error")
        }
    }

    // Handle recording completion
    async handleRecordingComplete(req: Request, res: Response): Promise<void> {
        try {
            const recordingData = {
                callSid: req.body.CallSid,
                recordingUrl: req.body.RecordingUrl,
                recordingSid: req.body.RecordingSid,
                duration: parseInt(req.body.Duration) || 0
            }

            logger.info(
                `Recording completed: ${recordingData.callSid} -> ${recordingData.recordingUrl}`
            )

            await this.callStatusService.handleRecordingComplete(recordingData)

            res.status(HTTP_STATUS.OK).send("OK")
        } catch (error) {
            logger.error("Error handling recording completion:", error)
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
                "Internal Server Error"
            )
        }
    }

    // Handle transcription completion
    async handleTranscriptionComplete(
        req: Request,
        res: Response
    ): Promise<void> {
        try {
            const transcriptionData = {
                callSid: req.body.CallSid,
                transcriptionText: req.body.TranscriptionText,
                transcriptionStatus: req.body.TranscriptionStatus
            }

            logger.info(`Transcription completed: ${transcriptionData.callSid}`)

            await this.callStatusService.handleTranscriptionComplete(
                transcriptionData
            )

            res.status(HTTP_STATUS.OK).send("OK")
        } catch (error) {
            logger.error("Error handling transcription completion:", error)
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
                "Internal Server Error"
            )
        }
    }
}

export const webhookController = new WebhookController()
