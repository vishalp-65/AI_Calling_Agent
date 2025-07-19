import { Request, Response, NextFunction } from "express"
import { ResponseHandler } from "../utils/response"
import { logger } from "../utils/logger"
import { TWILIO_CONFIG } from "../config/twilio"
import twilio from "twilio"
import { HTTP_STATUS } from "../constants/http-status"

// Validate Twilio webhook request
export const validateWebhookSignature = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {
        // Skip validation in development mode for easier testing
        if (
            process.env.NODE_ENV === "development" &&
            process.env.SKIP_WEBHOOK_VALIDATION === "true"
        ) {
            logger.warn("Skipping webhook validation in development mode")
            return next()
        }

        // Get the Twilio signature from the request headers
        const twilioSignature = req.headers["x-twilio-signature"] as string

        if (!twilioSignature) {
            logger.warn("Missing Twilio signature header")
            ResponseHandler.unauthorized(res, "Missing webhook signature")
            return
        }

        // Get the full URL of the request
        const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`

        // Validate the request using Twilio's validator
        const isValid = twilio.validateRequest(
            TWILIO_CONFIG.authToken,
            twilioSignature,
            url,
            req.body
        )

        if (!isValid) {
            logger.warn("Invalid Twilio webhook signature", {
                url,
                signature: twilioSignature,
                body: req.body
            })
            ResponseHandler.unauthorized(res, "Invalid webhook signature")
            return
        }

        next()
    } catch (error) {
        logger.error("Error validating webhook signature:", error)
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
            "Internal Server Error"
        )
    }
}

// Validate and extract webhook data
export const validateWebhookRequest = (data: any): any => {
    if (!data || !data.CallSid) {
        throw new Error("Invalid webhook data: Missing CallSid")
    }

    return data
}
