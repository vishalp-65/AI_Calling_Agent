import { logger } from "../../utils/logger"
import { CallWebhookPayload } from "../../types/call.types"
import { eventService } from "../messaging/event.service"
import { callService } from "./call.service"

interface RecordingData {
    callSid: string
    recordingUrl: string
    recordingSid: string
    duration: number
}

interface TranscriptionData {
    callSid: string
    transcriptionText: string
    transcriptionStatus: string
}

export class CallStatusService {
    async updateCallStatus(statusData: CallWebhookPayload): Promise<void> {
        try {
            logger.info(
                `Updating call status: ${statusData.CallSid} -> ${statusData.CallStatus}`
            )

            // Update call status in database
            await callService.updateCallStatus(
                statusData.CallSid,
                statusData.CallStatus
            )

            // Handle different call statuses
            switch (statusData.CallStatus) {
                case "initiated":
                    await this.handleCallInitiated(statusData)
                    break

                case "ringing":
                    await this.handleCallRinging(statusData)
                    break

                case "answered":
                    await this.handleCallAnswered(statusData)
                    break

                case "completed":
                    await this.handleCallCompleted(statusData)
                    break

                case "failed":
                case "busy":
                case "no-answer":
                    await this.handleCallFailed(statusData)
                    break

                default:
                    logger.warn(`Unknown call status: ${statusData.CallStatus}`)
            }

            // Emit status update event
            await eventService.publishCallEvent("call.status.updated", {
                callSid: statusData.CallSid,
                status: statusData.CallStatus,
                timestamp: new Date().toISOString()
            })
        } catch (error) {
            logger.error(
                `Error updating call status for ${statusData.CallSid}:`,
                error
            )
            throw error
        }
    }

    async handleRecordingComplete(recordingData: RecordingData): Promise<void> {
        try {
            logger.info(
                `Processing recording completion for call: ${recordingData.callSid}`
            )

            // Update call record with recording information
            await callService.updateCallRecording(
                recordingData.callSid,
                recordingData.recordingUrl,
                recordingData.recordingSid,
                recordingData.duration
            )

            // Emit recording complete event
            await eventService.publishCallEvent("call.recording.completed", {
                callSid: recordingData.callSid,
                recordingUrl: recordingData.recordingUrl,
                duration: recordingData.duration,
                timestamp: new Date().toISOString()
            })
        } catch (error) {
            logger.error(
                `Error handling recording completion for ${recordingData.callSid}:`,
                error
            )
            throw error
        }
    }

    async handleTranscriptionComplete(
        transcriptionData: TranscriptionData
    ): Promise<void> {
        try {
            logger.info(
                `Processing transcription completion for call: ${transcriptionData.callSid}`
            )

            // Update call record with transcription
            await callService.updateCallTranscription(
                transcriptionData.callSid,
                transcriptionData.transcriptionText,
                transcriptionData.transcriptionStatus
            )

            // Emit transcription complete event
            await eventService.publishCallEvent(
                "call.transcription.completed",
                {
                    callSid: transcriptionData.callSid,
                    transcriptionText: transcriptionData.transcriptionText,
                    status: transcriptionData.transcriptionStatus,
                    timestamp: new Date().toISOString()
                }
            )
        } catch (error) {
            logger.error(
                `Error handling transcription completion for ${transcriptionData.callSid}:`,
                error
            )
            throw error
        }
    }

    private async handleCallInitiated(
        statusData: CallWebhookPayload
    ): Promise<void> {
        logger.info(`Call initiated: ${statusData.CallSid}`)

        // Initialize call tracking
        await callService.initializeCall(statusData.CallSid, {
            from: statusData.From,
            to: statusData.To,
            direction: statusData.Direction,
            status: statusData.CallStatus
        })
    }

    private async handleCallRinging(
        statusData: CallWebhookPayload
    ): Promise<void> {
        logger.info(`Call ringing: ${statusData.CallSid}`)

        // Update call metrics
        await callService.updateCallMetrics(statusData.CallSid, {
            ringingAt: new Date().toISOString()
        })
    }

    private async handleCallAnswered(
        statusData: CallWebhookPayload
    ): Promise<void> {
        logger.info(`Call answered: ${statusData.CallSid}`)

        // Update call metrics
        await callService.updateCallMetrics(statusData.CallSid, {
            answeredAt: new Date().toISOString()
        })
    }

    private async handleCallCompleted(
        statusData: CallWebhookPayload
    ): Promise<void> {
        logger.info(`Call completed: ${statusData.CallSid}`)

        // Update call metrics
        await callService.updateCallMetrics(statusData.CallSid, {
            completedAt: new Date().toISOString(),
            duration: statusData.Duration ? parseInt(statusData.Duration) : 0
        })

        // Clean up any active resources
        await this.cleanupCallResources(statusData.CallSid)
    }

    private async handleCallFailed(
        statusData: CallWebhookPayload
    ): Promise<void> {
        logger.info(
            `Call failed: ${statusData.CallSid} - ${statusData.CallStatus}`
        )

        // Update call metrics
        await callService.updateCallMetrics(statusData.CallSid, {
            failedAt: new Date().toISOString(),
            failureReason: statusData.CallStatus
        })

        // Clean up any active resources
        await this.cleanupCallResources(statusData.CallSid)
    }

    private async cleanupCallResources(callSid: string): Promise<void> {
        try {
            // Close any active media streams
            const { mediaStreamService } = await import('./media-stream.service')
            mediaStreamService.closeStream(callSid)

            // Clean up conversation history
            const conversationService = await import(
                "../conversation/conversation.service"
            )
            await conversationService.conversationService.endConversation(
                callSid
            )

            logger.info(`Cleaned up resources for call: ${callSid}`)
        } catch (error) {
            logger.error(`Error cleaning up resources for ${callSid}:`, error)
        }
    }
}

export const callStatusService = new CallStatusService()
