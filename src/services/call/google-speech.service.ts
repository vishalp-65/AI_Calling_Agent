import { SpeechClient } from "@google-cloud/speech"
import { TextToSpeechClient } from "@google-cloud/text-to-speech"
import { logger } from "../../utils/logger"
import { SpeechToTextResult } from "../../types/ai.types"

/**
 * Service for handling Google Cloud Speech-to-Text and Text-to-Speech operations
 * This is a separate service to handle Google Cloud specific implementations
 */
export class GoogleSpeechService {
    private speechClient: SpeechClient
    private ttsClient: TextToSpeechClient

    constructor() {
        this.speechClient = new SpeechClient()
        this.ttsClient = new TextToSpeechClient()
    }

    /**
     * Convert speech to text using Google Cloud Speech-to-Text
     * Optimized for Hindi and English language detection
     */
    async speechToText(audioBuffer: Buffer): Promise<SpeechToTextResult> {
        try {
            const startTime = Date.now()

            // Try both Hindi and English recognition in parallel for faster results
            const languageOptions = ["hi-IN", "en-IN"]
            const recognitionPromises = languageOptions.map((language) =>
                this.recognizeSpeech(audioBuffer, language)
            )

            const results = await Promise.allSettled(recognitionPromises)

            // Find the best result based on confidence
            let bestResult: SpeechToTextResult = {
                text: "",
                confidence: 0,
                language: "en"
            }

            results.forEach((result, index) => {
                if (
                    result.status === "fulfilled" &&
                    result.value.confidence! > bestResult.confidence!
                ) {
                    bestResult = result.value
                }
            })

            // If no good result found, return a default result
            if (!bestResult.text || bestResult.confidence === 0) {
                logger.warn(
                    "No speech recognition results found, returning default"
                )
                return {
                    text: "",
                    confidence: 0,
                    language: "hi" // Default to Hindi as per your preference
                }
            }

            const processingTime = Date.now() - startTime
            logger.debug(
                `Google Speech-to-Text processing took ${processingTime}ms`,
                {
                    category: "speech-processing",
                    text: bestResult.text,
                    language: bestResult.language,
                    confidence: bestResult.confidence,
                    processingTime
                }
            )

            return bestResult
        } catch (error) {
            logger.error("Google Speech-to-Text error:", error)
            // Return a safe fallback instead of throwing
            return {
                text: "",
                confidence: 0,
                language: "hi"
            }
        }
    }

    /**
     * Recognize speech in a specific language
     */
    private async recognizeSpeech(
        audioBuffer: Buffer,
        language: string
    ): Promise<SpeechToTextResult> {
        try {
            const [response] = await this.speechClient.recognize({
                audio: { content: audioBuffer.toString("base64") },
                config: {
                    encoding: "LINEAR16",
                    sampleRateHertz: 16000,
                    languageCode: language,
                    model: "phone_call",
                    useEnhanced: true,
                    enableAutomaticPunctuation: true,
                    enableSpokenPunctuation: { value: true },
                    alternativeLanguageCodes:
                        language === "hi-IN" ? ["en-IN"] : ["hi-IN"]
                }
            })

            const transcript = response.results?.[0]?.alternatives?.[0]

            if (!transcript) {
                return {
                    text: "",
                    confidence: 0,
                    language: language.startsWith("hi") ? "hi" : "en"
                }
            }

            return {
                text: transcript.transcript || "",
                confidence: transcript.confidence || 0,
                language: language.startsWith("hi") ? "hi" : "en"
            }
        } catch (error) {
            logger.warn(
                `Speech recognition failed for language ${language}:`,
                error
            )
            return {
                text: "",
                confidence: 0,
                language: language.startsWith("hi") ? "hi" : "en"
            }
        }
    }

    /**
     * Convert text to speech using Google Cloud Text-to-Speech
     * Optimized for natural-sounding Hindi and English speech
     */
    async textToSpeech(
        text: string,
        language: string,
        voice?: string
    ): Promise<Buffer> {
        try {
            const startTime = Date.now()

            // Configure voice based on language
            const languageCode = language === "hindi" ? "hi-IN" : "en-US"
            const voiceName = this.getVoiceName(language, voice)

            // Request with SSML for more natural speech
            const [response] = await this.ttsClient.synthesizeSpeech({
                input: { ssml: text },
                voice: {
                    languageCode,
                    name: voiceName,
                    ssmlGender: voice === "male" ? "MALE" : "FEMALE"
                },
                audioConfig: {
                    audioEncoding: "MP3",
                    effectsProfileId: ["telephony-class-application"],
                    pitch: 0,
                    speakingRate: language === "hindi" ? 0.9 : 1.0
                }
            })

            const processingTime = Date.now() - startTime
            logger.debug(
                `Google Text-to-Speech processing took ${processingTime}ms`,
                {
                    category: "speech-processing",
                    language,
                    voice: voiceName,
                    processingTime
                }
            )

            return Buffer.from(response.audioContent || "")
        } catch (error) {
            logger.error("Google Text-to-Speech error:", error)
            throw error
        }
    }

    /**
     * Get the appropriate voice name based on language and requested voice type
     */
    private getVoiceName(language: string, voice?: string): string {
        if (language === "hindi") {
            return voice === "male" ? "hi-IN-Neural2-B" : "hi-IN-Neural2-A"
        } else {
            return voice === "male" ? "en-US-Neural2-D" : "en-US-Neural2-F"
        }
    }
}

export const googleSpeechService = new GoogleSpeechService()
