import { Request, Response, NextFunction } from "express"
import { logger } from "../utils/logger"
import { CallWebhookPayload } from "../types/call.types"

export interface ValidatedWebhookRequest extends Request {
    body: CallWebhookPayload
}

export function validateWebhookRequest(body: any): CallWebhookPayload {
    // Basic validation for required fields
    if (!body.CallSid) {
        throw new Error("CallSid is required")
    }

    if (!body.From) {
        throw new Error("From number is required")
    }

    if (!body.To) {
        throw new Error("To number is required")
    }

    return {
        CallSid: body.CallSid,
        CallStatus: body.CallStatus || "unknown",
        From: body.From,
        To: body.To,
        Direction: body.Direction || "unknown",
        Duration: body.Duration,
        RecordingUrl: body.RecordingUrl,
        TranscriptionText: body.TranscriptionText
    }
}

export function webhookValidationMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    try {
        const validatedData = validateWebhookRequest(req.body)
        req.body = validatedData
        next()
    } catch (error) {
        logger.error("Webhook validation failed:", error)
        res.status(400).json({
            error: "Invalid webhook payload",
            message: error instanceof Error ? error.message : "Unknown error"
        })
    }
}
