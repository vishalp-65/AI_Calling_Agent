import { GeminiService } from "../ai/gemini.service"
import { TextToSpeechRequest, SpeechToTextResult } from "../../types/ai.types"
import { logger } from "../../utils/logger"
import { LanguageDetectionService } from "../ai/language-detection.service"
import axios from "axios"

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

            // Use Gemini for speech-to-text conversion
            const result = await this.geminiService.speechToText(audioBuffer)

            // Enhanced language detection
            const detectedLanguage =
                await this.languageDetection.detectLanguage(result.text)
            result.language = detectedLanguage === "hindi" ? "hi" : "en"

            const processingTime = Date.now() - startTime
            logger.debug(`Speech-to-text processing took ${processingTime}ms`, {
                category: "speech-processing",
                text: result.text,
                language: result.language,
                confidence: result.confidence,
                processingTime
            })

            return result
        } catch (error) {
            logger.error("Conversion from speech to text failed:", error)
            throw error
        }
    }

    async convertTextToSpeech(request: TextToSpeechRequest): Promise<Buffer> {
        try {
            const startTime = Date.now()

            // Detect language for better voice selection
            const detectedLanguage =
                await this.languageDetection.detectLanguage(request.text)

            let audioBuffer: Buffer

            // Use ElevenLabs for better voice quality if available, otherwise fallback to Gemini
            if (process.env.ELEVENLABS_API_KEY) {
                try {
                    audioBuffer = await this.generateElevenLabsAudio(
                        request,
                        detectedLanguage as "hindi" | "english"
                    )
                } catch (elevenLabsError) {
                    logger.warn(
                        "ElevenLabs failed, falling back to Gemini:",
                        elevenLabsError
                    )
                    audioBuffer = await this.generateGeminiAudio(
                        request,
                        detectedLanguage
                    )
                }
            } else {
                audioBuffer = await this.generateGeminiAudio(
                    request,
                    detectedLanguage
                )
            }

            const processingTime = Date.now() - startTime
            logger.debug(`Text-to-speech processing took ${processingTime}ms`, {
                category: "speech-processing",
                textLength: request.text.length,
                language: detectedLanguage,
                voice: request.voice,
                processingTime
            })

            return audioBuffer
        } catch (error) {
            logger.error("Conversion from text to speech failed:", error)
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
