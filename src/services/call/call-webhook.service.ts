import twilio from "twilio"
import { TWILIO_CONFIG, getVoiceConfig } from "../../config/twilio"
import { ConversationResult } from "../../types/conversation.types"
import { CallWebhookPayload } from "../../types/call.types"
import { logger } from "../../utils/logger"
import { LanguageDetectionService } from "../ai/language-detection.service"

export class CallWebhookService {
    private languageDetection: LanguageDetectionService

    constructor() {
        this.languageDetection = new LanguageDetectionService()
    }

    async generateIncomingCallResponse(
        webhookData: CallWebhookPayload,
        host: string
    ): Promise<string> {
        try {
            const twiml = new twilio.twiml.VoiceResponse()

            // Detect preferred language based on caller's country code
            const callerNumber = webhookData.From || ""
            const preferredLanguage = this.detectPreferredLanguage(callerNumber)
            const voiceConfig = getVoiceConfig(preferredLanguage)

            logger.info(
                `Incoming call from ${callerNumber}, using language: ${preferredLanguage}`
            )

            // Warm, welcoming greeting with SSML for more natural speech
            twiml.say(
                {
                    voice: voiceConfig.voice as any,
                    language: voiceConfig.language
                },
                this.getWelcomeMessage(preferredLanguage)
            )

            // Start media stream for real-time processing with optimized settings
            const start = twiml.start()
            start.stream({
                url: `wss://${host}/api/calls/media-stream?callSid=${webhookData.CallSid}`,
                name: webhookData.CallSid,
                track: "inbound_track"
            })

            // Enhanced gather for better speech recognition
            const gather = twiml.gather({
                input: ["speech"],
                timeout: TWILIO_CONFIG.speechRecognition.timeout,
                speechTimeout: TWILIO_CONFIG.speechRecognition.speechTimeout,
                enhanced: TWILIO_CONFIG.speechRecognition.enhanced,
                speechModel: TWILIO_CONFIG.speechRecognition.model,
                action: `/api/calls/webhook/gather`,
                method: "POST",
                language: voiceConfig.language,
                // hints: preferredLanguage.startsWith("hi")
                //     ? TWILIO_CONFIG.speechRecognition.hints.hi
                //     : TWILIO_CONFIG.speechRecognition.hints.en
                hints: TWILIO_CONFIG.speechRecognition.hints.hi
            })

            // Prompt to encourage speaking
            // gather.say(
            //     {
            //         voice: voiceConfig.voice as any,
            //         language: voiceConfig.language
            //     },
            //     this.getPromptMessage(preferredLanguage)
            // )

            // Fallback if no input with natural language
            twiml.say(
                {
                    voice: voiceConfig.voice as any,
                    language: voiceConfig.language
                },
                this.getNoInputMessage(preferredLanguage)
            )

            twiml.redirect("/api/calls/webhook/voice")

            return twiml.toString()
        } catch (error) {
            logger.error("Error generating incoming call response:", error)
            // Fallback response in case of error
            const twiml = new twilio.twiml.VoiceResponse()
            twiml.say(
                {
                    voice: TWILIO_CONFIG.voice.en.voice as any,
                    language: TWILIO_CONFIG.voice.en.language
                },
                "Hello! Thank you for calling. How may I help you today?"
            )
            return twiml.toString()
        }
    }

    private detectPreferredLanguage(phoneNumber: string): string {
        // Enhanced detection based on country code and patterns
        // if (phoneNumber.includes("+91") || phoneNumber.startsWith("91")) {
        //     return "hi-IN" // India - default to Hindi
        // }
        // if (phoneNumber.includes("+1") || phoneNumber.startsWith("1")) {
        //     return "en-US" // US/Canada
        // }
        // if (phoneNumber.includes("+44") || phoneNumber.startsWith("44")) {
        //     return "en-US" // UK
        // }
        // Default to Hindi for better Indian market support
        return "hi-IN"
    }

    private getWelcomeMessage(language: string): string {
        if (language.startsWith("hi")) {
            return '<speak><prosody rate="0.9">नमस्ते! <break time="300ms"/> हमारे सेवा केंद्र में कॉल करने के लिए धन्यवाद। <break time="200ms"/> मैं आपकी सहायता करने के लिए यहां हूं। <break time="300ms"/> मैं आपकी कैसे मदद कर सकता हूं?</prosody></speak>'
        }
        return '<speak><prosody rate="0.95">Hello! <break time="300ms"/> Thank you for calling our service center. <break time="200ms"/> I\'m here to help you today. <break time="300ms"/> How may I assist you?</prosody></speak>'
    }

    private getPromptMessage(language: string): string {
        if (language.startsWith("hi")) {
            return '<speak><prosody rate="0.9">कृपया बताएं, मैं आपकी क्या सहायता कर सकता हूं?</prosody></speak>'
        }
        return '<speak><prosody rate="0.95">Please go ahead, how can I help you today?</prosody></speak>'
    }

    private getNoInputMessage(language: string): string {
        if (language.startsWith("hi")) {
            return '<speak><prosody rate="0.9">मुझे कुछ सुनाई नहीं दिया। <break time="200ms"/> कृपया फिर से प्रयास करें।</prosody></speak>'
        }
        return '<speak><prosody rate="0.95">I didn\'t hear anything. <break time="200ms"/> Let me try again.</prosody></speak>'
    }

    async generateOutgoingCallResponse(
        webhookData: CallWebhookPayload,
        host: string
    ): Promise<string> {
        try {
            const twiml = new twilio.twiml.VoiceResponse()

            if (webhookData.CallStatus === "answered") {
                // Detect preferred language based on called number's country code
                const calledNumber = webhookData.To || ""
                const preferredLanguage =
                    this.detectPreferredLanguage(calledNumber)
                const voiceConfig = getVoiceConfig(preferredLanguage)

                logger.info(
                    `Outgoing call to ${calledNumber}, using language: ${preferredLanguage}`
                )

                // Brief pause to let person settle
                twiml.pause({ length: 1 })

                // Polite outgoing call introduction with SSML for more natural speech
                twiml.say(
                    {
                        voice: voiceConfig.voice as any,
                        language: voiceConfig.language
                    },
                    this.getOutgoingCallGreeting(preferredLanguage)
                )

                // Start media stream with optimized settings
                const start = twiml.start()
                start.stream({
                    url: `wss://${host}/api/calls/media-stream?callSid=${webhookData.CallSid}`,
                    name: webhookData.CallSid,
                    track: "inbound_track"
                })

                // Gather response with improved settings
                const gather = twiml.gather({
                    input: ["speech"],
                    timeout: TWILIO_CONFIG.speechRecognition.timeout,
                    speechTimeout:
                        TWILIO_CONFIG.speechRecognition.speechTimeout,
                    enhanced: TWILIO_CONFIG.speechRecognition.enhanced,
                    speechModel: TWILIO_CONFIG.speechRecognition.model,
                    action: `/api/calls/webhook/gather`,
                    method: "POST",
                    language: voiceConfig.language,
                    hints: preferredLanguage.startsWith("hi")
                        ? TWILIO_CONFIG.speechRecognition.hints.hi
                        : TWILIO_CONFIG.speechRecognition.hints.en
                })

                // Prompt with natural language
                gather.say(
                    {
                        voice: voiceConfig.voice as any,
                        language: voiceConfig.language
                    },
                    this.getOutgoingCallPrompt(preferredLanguage)
                )

                twiml.redirect("/api/calls/webhook/voice")
            }

            return twiml.toString()
        } catch (error) {
            logger.error("Error generating outgoing call response:", error)
            // Fallback response in case of error
            const twiml = new twilio.twiml.VoiceResponse()
            twiml.say(
                {
                    voice: TWILIO_CONFIG.voice.en.voice as any,
                    language: TWILIO_CONFIG.voice.en.language
                },
                "Hello! This is your AI assistant calling. How may I help you today?"
            )
            return twiml.toString()
        }
    }

    private getOutgoingCallGreeting(language: string): string {
        if (language.startsWith("hi")) {
            return '<speak><prosody rate="0.9">नमस्ते! <break time="300ms"/> मैं आपका AI सहायक बोल रहा हूं। <break time="200ms"/> मुझे आशा है कि मैं आपको परेशान नहीं कर रहा हूं। <break time="300ms"/> मैं आपके किसी भी प्रश्न या सहायता के लिए यहां हूं। <break time="200ms"/> आप आज कैसे हैं?</prosody></speak>'
        }
        return '<speak><prosody rate="0.95">Hello! <break time="300ms"/> This is your AI assistant calling. <break time="200ms"/> I hope I\'m not disturbing you. <break time="300ms"/> I\'m here to help with any questions or support you might need. <break time="200ms"/> How are you doing today?</prosody></speak>'
    }

    private getOutgoingCallPrompt(language: string): string {
        if (language.startsWith("hi")) {
            return '<speak><prosody rate="0.9">कृपया बेझिझक अपने मन की बात बताएं।</prosody></speak>'
        }
        return '<speak><prosody rate="0.95">Please feel free to share what\'s on your mind.</prosody></speak>'
    }

    async generateConversationResponse(
        conversationResult: ConversationResult
    ): Promise<string> {
        try {
            const twiml = new twilio.twiml.VoiceResponse()

            // Determine voice settings based on detected language
            const language =
                conversationResult.language === "hindi" ? "hi-IN" : "en-US"
            const voiceConfig = getVoiceConfig(language)

            // Add SSML enhancements to make speech more natural and human-like
            const enhancedResponse = this.addSpeechEnhancements(
                conversationResult.response,
                conversationResult.language,
                conversationResult.emotionalTone
            )

            // Play AI response with appropriate voice and enhanced speech
            twiml.say(
                {
                    voice: voiceConfig.voice as any,
                    language: voiceConfig.language
                },
                enhancedResponse
            )

            // Handle special cases with enhanced speech
            if (conversationResult.shouldTransfer) {
                const transferMessage = this.getTransferMessage(
                    conversationResult.language
                )
                twiml.say(
                    {
                        voice: voiceConfig.voice as any,
                        language: voiceConfig.language
                    },
                    transferMessage
                )
                twiml.dial("+1234567890")
                return twiml.toString()
            }

            if (conversationResult.shouldEndCall) {
                const goodbyeMessage = this.getGoodbyeMessage(
                    conversationResult.language
                )
                twiml.say(
                    {
                        voice: voiceConfig.voice as any,
                        language: voiceConfig.language
                    },
                    goodbyeMessage
                )
                twiml.hangup()
                return twiml.toString()
            }

            // Continue conversation with optimized settings
            const gather = twiml.gather({
                input: ["speech"],
                timeout: TWILIO_CONFIG.speechRecognition.timeout,
                speechTimeout: TWILIO_CONFIG.speechRecognition.speechTimeout,
                enhanced: TWILIO_CONFIG.speechRecognition.enhanced,
                speechModel: TWILIO_CONFIG.speechRecognition.model,
                action: `/api/calls/webhook/gather`,
                method: "POST",
                language: voiceConfig.language,
                hints: this.getLanguageHints(conversationResult.language)
            })

            // Add natural follow-up prompt if needed
            if (Math.random() > 0.7) {
                // Only add follow-up 30% of the time for more natural conversation
                const followUp = this.getFollowUpMessage(
                    conversationResult.language
                )
                gather.say(
                    {
                        voice: voiceConfig.voice as any,
                        language: voiceConfig.language
                    },
                    followUp
                )
            }

            // Redirect to keep conversation flowing
            twiml.redirect("/api/calls/webhook/voice")

            return twiml.toString()
        } catch (error) {
            logger.error("Error generating conversation response:", error)
            // Fallback response in case of error
            const twiml = new twilio.twiml.VoiceResponse()
            twiml.say(
                {
                    voice: TWILIO_CONFIG.voice.en.voice as any,
                    language: TWILIO_CONFIG.voice.en.language
                },
                "I understand. Is there anything else I can help you with?"
            )
            return twiml.toString()
        }
    }

    private addSpeechEnhancements(
        text: string,
        language: string,
        emotionalTone?: string
    ): string {
        // Don't add SSML if text already contains it
        if (text.includes("<speak>")) return text

        // Add natural pauses, emphasis, and prosody for more human-like speech
        let ssml = "<speak>"

        // Set speech rate based on language and emotional tone
        const rate = language === "hindi" ? "0.9" : "0.95"

        // Add breathing sounds occasionally for more human-like speech
        if (Math.random() > 0.7) {
            ssml += "<break time='300ms'/>"
        }

        // Split text into sentences
        const sentences = text.split(/(?<=[.!?])\s+/)

        sentences.forEach((sentence, index) => {
            // Add emphasis to important words
            let enhancedSentence = sentence

            // Add emotional tone through prosody
            if (emotionalTone) {
                const pitchAdjustment =
                    this.getEmotionalPitchAdjustment(emotionalTone)
                ssml += `<prosody rate="${rate}" pitch="${pitchAdjustment}">${enhancedSentence}</prosody>`
            } else {
                ssml += `<prosody rate="${rate}">${enhancedSentence}</prosody>`
            }

            // Add appropriate pauses between sentences
            if (index < sentences.length - 1) {
                const pauseLength = sentence.endsWith("?")
                    ? "500ms"
                    : sentence.endsWith("!")
                    ? "600ms"
                    : "400ms"
                ssml += `<break time='${pauseLength}'/>`
            }
        })

        ssml += "</speak>"
        return ssml
    }

    private getEmotionalPitchAdjustment(emotionalTone: string): string {
        switch (emotionalTone.toLowerCase()) {
            case "excited":
            case "happy":
                return "+15%"
            case "empathetic":
            case "sad":
                return "-10%"
            case "confident":
                return "+5%"
            case "calm":
                return "-5%"
            default:
                return "medium"
        }
    }

    private getTransferMessage(language: string): string {
        if (language === "hindi") {
            return '<speak><prosody rate="0.9">मैं आपको हमारे विशेषज्ञों में से एक से जोड़ रहा हूं जो आपकी बेहतर सहायता कर सकते हैं। <break time="300ms"/> कृपया थोड़ा इंतज़ार करें।</prosody></speak>'
        }
        return '<speak><prosody rate="0.95">Let me connect you with one of our human specialists who can better assist you. <break time="300ms"/> Please hold for a moment.</prosody></speak>'
    }

    private getGoodbyeMessage(language: string): string {
        if (language === "hindi") {
            return '<speak><prosody rate="0.9">कॉल करने के लिए धन्यवाद। <break time="200ms"/> आपका दिन शुभ हो!</prosody></speak>'
        }
        return '<speak><prosody rate="0.95">Thank you for calling. <break time="200ms"/> Have a wonderful day!</prosody></speak>'
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
