import twilio from "twilio"
import { config } from "./index"

export const twilioClient = twilio(
    config.twilio.accountSid,
    config.twilio.authToken
)

export const TWILIO_CONFIG = {
    phoneNumber: config.twilio.phoneNumber,
    defaultLanguage: "hi-IN" as const,
    // supportedLanguages: ["hi-IN", "en-IN"] as const,
    voice: {
        hi: {
            language: "hi-IN" as const,
            voice: "Neural2-D" as const
        },
        en: {
            language: "en-IN" as const,
            voice: "Neural2-D" as const
        }
    },
    speechRecognition: {
        timeout: 3, // Reduced from 5 to 3 seconds
        speechTimeout: "auto",
        enhanced: true,
        model: "phone_call"
    },
    accountSid: config.twilio.accountSid,
    authToken: config.twilio.authToken
}

export const getVoiceConfig = (language: "hi-IN" | "en-IN") => {
    return language === "hi-IN"
        ? TWILIO_CONFIG.voice.hi
        : TWILIO_CONFIG.voice.en
}
