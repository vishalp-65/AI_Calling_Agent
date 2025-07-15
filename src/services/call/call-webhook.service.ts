import twilio from "twilio"
import { TWILIO_CONFIG, getVoiceConfig } from "../../config/twilio"
import { ConversationResult } from "../../types/conversation.types"
import { CallWebhookPayload } from "../../types/call.types"

export class CallWebhookService {
    async generateIncomingCallResponse(
        webhookData: CallWebhookPayload,
        host: string
    ): Promise<string> {
        const twiml = new twilio.twiml.VoiceResponse()

        // Warm, welcoming greeting
        twiml.say(
            {
                voice: TWILIO_CONFIG.voice.hi.voice as any,
                language: TWILIO_CONFIG.defaultLanguage
            },
            "Hello! Thank you for calling. I'm here to help you today. How may I assist you?"
        )

        // Start media stream for real-time processing
        const start = twiml.start()
        start.stream({
            url: `wss://${host}/api/calls/media-stream?callSid=${webhookData.CallSid}`,
            name: webhookData.CallSid
        })

        // Enhanced gather for better speech recognition
        const gather = twiml.gather({
            input: ["speech"],
            timeout: 10,
            speechTimeout: "auto",
            enhanced: true,
            speechModel: "phone_call",
            action: `/api/calls/webhook/gather`,
            method: "POST",
            language: TWILIO_CONFIG.voice.hi.language,
            hints: "yes, no, help, support, information, hindi, english, problem, issue"
        })

        // gather.say(
        //     {
        //         voice: TWILIO_CONFIG.voice.hi.voice as any,
        //         language: TWILIO_CONFIG.voice.hi.language
        //     },
        //     "I'm listening carefully. Please go ahead and tell me what you need."
        // )

        // Fallback if no input
        twiml.say("I didn't hear anything. Let me try again.")
        twiml.redirect("/api/calls/webhook/voice")

        return twiml.toString()
    }

    async generateOutgoingCallResponse(
        webhookData: CallWebhookPayload,
        host: string
    ): Promise<string> {
        const twiml = new twilio.twiml.VoiceResponse()

        if (webhookData.CallStatus === "answered") {
            // Brief pause to let person settle
            twiml.pause({ length: 2 })

            // Polite outgoing call introduction
            twiml.say(
                {
                    voice: TWILIO_CONFIG.voice.hi.voice as any,
                    language: TWILIO_CONFIG.voice.hi.language
                },
                "Hello! This is your AI assistant calling. I hope I'm not disturbing you. I'm here to help with any questions or support you might need. How are you doing today?"
            )

            // Start media stream
            const start = twiml.start()
            start.stream({
                url: `wss://${host}/api/calls/media-stream?callSid=${webhookData.CallSid}`,
                name: webhookData.CallSid
            })

            // Gather response
            const gather = twiml.gather({
                input: ["speech"],
                timeout: 10,
                speechTimeout: "auto",
                enhanced: true,
                speechModel: "phone_call",
                action: `/api/calls/webhook/gather`,
                method: "POST",
                language: TWILIO_CONFIG.voice.hi.language
            })

            gather.say(
                {
                    voice: TWILIO_CONFIG.voice.hi.voice as any,
                    language: TWILIO_CONFIG.voice.hi.language
                },
                "Please feel free to share what's on your mind."
            )

            twiml.redirect("/api/calls/webhook/voice")
        }

        return twiml.toString()
    }

    async generateConversationResponse(
        conversationResult: ConversationResult
    ): Promise<string> {
        const twiml = new twilio.twiml.VoiceResponse()

        // Determine voice settings based on detected language
        const voiceSettings = this.getVoiceSettings(conversationResult.language)

        // Play AI response with appropriate voice
        twiml.say(voiceSettings, conversationResult.response)

        // Handle special cases
        if (conversationResult.shouldTransfer) {
            twiml.say(
                voiceSettings,
                "Let me connect you with one of our human specialists who can better assist you."
            )
            twiml.dial("+1234567890")
            return twiml.toString()
        }

        if (conversationResult.shouldEndCall) {
            twiml.say(
                voiceSettings,
                "Thank you for calling. Have a wonderful day!"
            )
            twiml.hangup()
            return twiml.toString()
        }

        // Continue conversation
        const gather = twiml.gather({
            input: ["speech"],
            timeout: 15, // Longer timeout for better UX
            speechTimeout: "auto",
            enhanced: true,
            speechModel: "phone_call",
            action: `/api/calls/webhook/gather`,
            method: "POST",
            language:
                conversationResult.language === "hindi"
                    ? TWILIO_CONFIG.voice.hi.language
                    : TWILIO_CONFIG.voice.en.language,
            hints: this.getLanguageHints(conversationResult.language)
        })

        // Natural follow-up based on language
        // const followUp = this.getFollowUpMessage(conversationResult.language)
        // gather.say(voiceSettings, followUp)

        // Redirect to keep conversation flowing
        twiml.redirect("/api/calls/webhook/voice")

        return twiml.toString()
    }

    generateNoSpeechResponse(): string {
        const twiml = new twilio.twiml.VoiceResponse()

        const messages = [
            "I didn't catch that. Could you please speak a bit louder?",
            "I'm having trouble hearing you. Could you repeat that please?",
            "Sorry, I didn't hear anything. Please try speaking again."
        ]

        const randomMessage =
            messages[Math.floor(Math.random() * messages.length)] ??
            "Sorry, I didn't hear anything. Please try speaking again."

        twiml.say(
            {
                voice: TWILIO_CONFIG.voice.hi.voice as any,
                language: TWILIO_CONFIG.voice.hi.language
            },
            randomMessage
        )

        twiml.redirect("/api/calls/webhook/voice")
        return twiml.toString()
    }

    generateErrorResponse(message: string): string {
        const twiml = new twilio.twiml.VoiceResponse()

        twiml.say(
            {
                voice: TWILIO_CONFIG.voice.hi.voice as any,
                language: TWILIO_CONFIG.voice.hi.language
            },
            message
        )

        twiml.hangup()
        return twiml.toString()
    }

    private getVoiceSettings(language: string) {
        const langCode = language === "hindi" ? "hi-IN" : "en-IN"
        const voiceConfig = getVoiceConfig(langCode as "hi-IN" | "en-IN")
        return {
            voice: voiceConfig.voice as any,
            language: voiceConfig.language
        }
    }

    private getLanguageHints(language: string): string {
        if (language === "hindi") {
            return "हाँ, नहीं, मदद, सहायता, जानकारी, समस्या, धन्यवाद, अंग्रेजी"
        }
        return "yes, no, help, support, information, problem, issue, thank you, hindi"
    }

    private getFollowUpMessage(language: string): string {
        if (language === "hindi") {
            return "क्या आपको कोई और सहायता चाहिए ?"
        }
        return "Is there anything else I can help you with ?"
    }
}

export const callWebhookService = new CallWebhookService()
