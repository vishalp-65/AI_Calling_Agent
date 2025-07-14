import twilio from "twilio"
import { config } from "./index"

export const twilioClient = twilio(
    config.twilio.accountSid,
    config.twilio.authToken
)

export const TWILIO_CONFIG = {
    phoneNumber: config.twilio.phoneNumber,
    voice: {
        language: "hi-IN" as const,
        voice: "aditi" as const
    },
    speechRecognition: {
        timeout: 5,
        speechTimeout: "auto",
        enhanced: true,
        model: "phone_call"
    },
    accountSid: config.twilio.accountSid,
    authToken: config.twilio.authToken
}
