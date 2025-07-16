import twilio from "twilio"
import { config } from "./index"

export const twilioClient = twilio(
    config.twilio.accountSid,
    config.twilio.authToken
)

export const TWILIO_CONFIG = {
    phoneNumber: config.twilio.phoneNumber,
    defaultLanguage: "hi-IN" as const,
    supportedLanguages: ["hi-IN", "en-IN", "en-US"] as const,
    voice: {
        hi: {
            language: "hi-IN" as const,
            voice: "Polly.Aditi-Neural" as const // Better Hindi voice
        },
        en: {
            language: "en-IN" as const,
            voice: "Polly.Raveena-Neural" as const // Indian English voice
        },
        enUs: {
            language: "en-US" as const,
            voice: "Polly.Joanna-Neural" as const // US English voice
        }
    },
    speechRecognition: {
        timeout: 3, // Optimized for real-time response
        speechTimeout: "auto",
        enhanced: true,
        model: "phone_call",
        hints: {
            hi: "हां नहीं मदद धन्यवाद अंग्रेजी हिंदी समस्या सहायता जानकारी",
            en: "yes no help thank you hindi english problem support information"
        },
        // Optimized settings for low latency
        partialResults: true,
        interimResults: true
    },
    accountSid: config.twilio.accountSid,
    authToken: config.twilio.authToken,
    // Optimized streaming settings for reduced latency
    streamingLatencyReduction: {
        bufferSize: 1024 * 4, // Reduced to 4KB for faster processing
        processingInterval: 200, // Process every 200ms instead of 300ms
        chunkProcessingThreshold: 2, // Process after collecting 2 chunks instead of 3
        maxBufferTime: 1000, // Maximum time to buffer audio (1 second)
        enableVoiceActivityDetection: true // Enable VAD for better speech detection
    }
}

export const getVoiceConfig = (language: string) => {
    if (language.startsWith("hi")) {
        return TWILIO_CONFIG.voice.hi
    } else if (language === "en-IN") {
        return TWILIO_CONFIG.voice.en
    } else {
        return TWILIO_CONFIG.voice.enUs
    }
}
