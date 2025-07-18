import { GeminiService } from "../ai/gemini.service"
import { TextToSpeechRequest, SpeechToTextResult } from "../../types/ai.types"
import { logger } from "../../utils/logger"
import { LanguageDetectionService } from "../ai/language-detection.service"
import axios from "axios"
import { googleSpeechService } from "./google-speech.service"

export class SpeechService {
    private geminiService: GeminiService
    private languageDetection: LanguageDetectionService

    constructor() {
        this.geminiService = new GeminiService()
        this.languageDetection = new LanguageDetectionService()
    }

    async convertSpeechToText(
        audioBuffer: Buffer
    ): Promise<SpeechToTextResult> {
        try {
            const startTime = Date.now()

            // Try Google Speech API first (optimized for both Hindi and English)
            try {
                const result = await googleSpeechService.speechToText(
                    audioBuffer
                )

                // If we got a valid result, return it
                if (result && result.text && result.text.trim()) {
                    const processingTime = Date.now() - startTime
                    logger.debug(
                        `Speech-to-text processing took ${processingTime}ms`,
                        {
                            category: "speech-processing",
                            text: result.text,
                            language: result.language,
                            confidence: result.confidence,
                            processingTime
                        }
                    )
                    return result
                }
            } catch (err) {
                logger.warn(
                    "Google Speech API failed, falling back to Gemini:",
                    err
                )
            }

            // Fallback to Gemini
            logger.info("Using Gemini for speech recognition")
            try {
                const geminiResult = await this.geminiService.speechToText(
                    audioBuffer
                )

                // Detect language from text for better accuracy
                const textLanguage =
                    await this.languageDetection.detectLanguage(
                        geminiResult.text
                    )

                const result: SpeechToTextResult = {
                    text: geminiResult.text,
                    confidence: geminiResult.confidence || 0.5,
                    language: textLanguage === "hindi" ? "hi" : "en"
                }

                const processingTime = Date.now() - startTime
                logger.debug(
                    `Fallback speech-to-text processing took ${processingTime}ms`,
                    {
                        category: "speech-processing",
                        text: result.text,
                        language: result.language,
                        confidence: result.confidence,
                        processingTime
                    }
                )

                return result
            } catch (geminiError) {
                logger.error(
                    "Gemini speech recognition also failed:",
                    geminiError
                )
                // Return empty result to prevent crash
                return {
                    text: "",
                    confidence: 0,
                    language: "hi" // Default to Hindi as per your preference
                }
            }
        } catch (error) {
            logger.error("Conversion from speech to text failed:", error)
            throw error
        }
    }

    async convertTextToSpeech(request: TextToSpeechRequest): Promise<Buffer> {
        try {
            const startTime = Date.now()

            // Detect language for better voice selection (with caching for performance)
            const cacheKey = `lang_${request.text.substring(0, 50)}`
            let detectedLanguage = this.languageCache.get(cacheKey)

            if (!detectedLanguage) {
                detectedLanguage = await this.languageDetection.detectLanguage(
                    request.text
                )
                this.languageCache.set(cacheKey, detectedLanguage)
            }

            // Add SSML enhancements to make speech more natural and human-like
            const enhancedText = this.addSpeechEnhancements(
                request.text,
                detectedLanguage,
                (request as any).emotionalTone
            )
            const enhancedRequest = { ...request, text: enhancedText }

            // Use Google TTS directly for faster response (10ms vs 300+ms)
            try {
                const audioBuffer = await this.generateGoogleTTS(
                    enhancedRequest,
                    detectedLanguage
                )

                const processingTime = Date.now() - startTime
                logger.debug(
                    `Text-to-speech processing took ${processingTime}ms`,
                    {
                        category: "speech-processing",
                        textLength: request.text.length,
                        language: detectedLanguage,
                        voice: request.voice,
                        processingTime
                    }
                )

                return audioBuffer
            } catch (error) {
                logger.warn("Primary TTS failed, using fallback:", error)

                // Try ElevenLabs if available
                if (process.env.ELEVENLABS_API_KEY) {
                    try {
                        return await this.generateElevenLabsAudio(
                            enhancedRequest,
                            detectedLanguage as "hindi" | "english"
                        )
                    } catch (elevenLabsError) {
                        logger.warn(
                            "ElevenLabs TTS failed, using final fallback:",
                            elevenLabsError
                        )
                    }
                }

                // Final fallback to Gemini
                return await this.generateGeminiAudio(
                    enhancedRequest,
                    detectedLanguage
                )
            }
        } catch (error) {
            logger.error("Conversion from text to speech failed:", error)
            throw error
        }
    }

    // Simple in-memory cache for language detection
    private languageCache = new Map<string, string>()

    private addSpeechEnhancements(
        text: string,
        language: string,
        emotionalTone?: string
    ): string {
        // Don't add SSML if text already contains it
        if (text.includes("<speak>")) return text

        // Add natural pauses, emphasis, and prosody for more human-like speech
        let ssml = "<speak>"

        // Add breathing sounds occasionally for more human-like speech
        if (Math.random() > 0.7) {
            ssml += "<break time='300ms'/>"
        }

        // Split text into sentences
        const sentences = text.split(/(?<=[.!?])\s+/)

        // Set base rate based on language (Hindi needs slightly slower speech)
        const baseRate = language === "hindi" ? 0.85 : 0.95

        // Adjust pitch based on emotional tone
        const pitchAdjustment = this.getEmotionalPitchAdjustment(emotionalTone)

        sentences.forEach((sentence, index) => {
            // Add emphasis to important words
            const enhancedSentence = sentence.replace(
                /\b(important|critical|urgent|necessary|must|should|please|thank you|sorry)\b/gi,
                "<emphasis level='moderate'>$1</emphasis>"
            )

            // Add fillers occasionally for more natural speech
            const enhancedWithFillers = this.addNaturalFillers(
                enhancedSentence,
                language
            )

            // Vary speaking rate slightly for natural rhythm (±10%)
            const rate = baseRate + (Math.random() * 0.2 - 0.1)

            // Add prosody for more natural intonation with emotional tone
            ssml += `<prosody rate="${rate.toFixed(
                2
            )}" pitch="${pitchAdjustment}">${enhancedWithFillers}</prosody>`

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

    private getEmotionalPitchAdjustment(emotionalTone?: string): string {
        if (!emotionalTone) return "medium"

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

    private addNaturalFillers(text: string, language: string): string {
        // Only add fillers occasionally (20% chance)
        if (Math.random() > 0.2) return text

        const englishFillers = ["um", "well", "you know", "actually", "so"]
        const hindiFillers = ["अच्छा", "मतलब", "तो", "हां"]

        const fillers = language === "hindi" ? hindiFillers : englishFillers
        const selectedFiller =
            fillers[Math.floor(Math.random() * fillers.length)]

        // Add filler at the beginning of the sentence with a pause
        if (text.length > 15 && Math.random() > 0.5) {
            return `${selectedFiller}, <break time='200ms'/> ${text}`
        }

        return text
    }

    private async generateGoogleTTS(
        request: TextToSpeechRequest,
        language: string
    ): Promise<Buffer> {
        try {
            // Use our optimized Google Speech service
            return await googleSpeechService.textToSpeech(
                request.text,
                language,
                request.voice
            )
        } catch (error) {
            logger.error("Google TTS failed:", error)
            throw error
        }
    }

    private async generateElevenLabsAudio(
        request: TextToSpeechRequest,
        language: "hindi" | "english"
    ): Promise<Buffer> {
        const voiceId = this.getElevenLabsVoiceId(language, request.voice)

        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                text: request.text,
                voice_settings: {
                    stability: 0.6,
                    similarity_boost: 0.8,
                    style: 0.4,
                    use_speaker_boost: true
                },
                model_id: "eleven_multilingual_v2"
            },
            {
                headers: {
                    "xi-api-key": process.env.ELEVENLABS_API_KEY,
                    "Content-Type": "application/json"
                },
                responseType: "arraybuffer",
                timeout: 30000
            }
        )

        return Buffer.from(response.data)
    }

    private async generateGeminiAudio(
        request: TextToSpeechRequest,
        language: string
    ): Promise<Buffer> {
        const enhancedRequest = {
            ...request,
            voice: this.getGeminiVoice(language, request.voice),
            speed: request.speed || (language === "hindi" ? 0.9 : 1.0) // Slightly slower for Hindi
        }

        return await this.geminiService.textToSpeech(enhancedRequest)
    }

    private getElevenLabsVoiceId(
        language: "hindi" | "english",
        requestedVoice?: string
    ): string {
        const voiceMap: Record<"hindi" | "english", Record<string, string>> = {
            hindi: {
                male: "pNInz6obpgDQGcFmaJgB",
                female: "EXAVITQu4vr4xnSDxMaL",
                default: "EXAVITQu4vr4xnSDxMaL"
            },
            english: {
                male: "pNInz6obpgDQGcFmaJgB",
                female: "EXAVITQu4vr4xnSDxMaL",
                alloy: "pNInz6obpgDQGcFmaJgB",
                default: "EXAVITQu4vr4xnSDxMaL"
            }
        }

        // Now TS knows `language` is exactly one of the keys
        const langVoices = voiceMap[language]
        return langVoices[requestedVoice ?? "default"]! ?? langVoices.default
    }

    private getGeminiVoice(language: string, requestedVoice?: string): string {
        const voiceMap: Record<string, string> = {
            hindi: "nova",
            english: requestedVoice ?? "alloy"
        }

        return voiceMap[language] ?? "alloy"
    }
}

export const speechService = new SpeechService()
