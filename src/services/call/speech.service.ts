import { GeminiService } from "../ai/gemini.service"
import { TextToSpeechRequest, SpeechToTextResult } from "../../types/ai.types"
import { logger } from "../../utils/logger"

export class SpeechService {
    private geminiService: GeminiService

    constructor() {
        this.geminiService = new GeminiService()
    }

    async convertSpeechToText(
        audioBuffer: Buffer
    ): Promise<SpeechToTextResult> {
        try {
            return await this.geminiService.speechToText(audioBuffer)
        } catch (error) {
            logger.error("Conversion from speech to text failed:", error)
            throw error
        }
    }

    async convertTextToSpeech(request: TextToSpeechRequest): Promise<Buffer> {
        try {
            return await this.geminiService.textToSpeech(request)
        } catch (error) {
            logger.error("Conversion from text to speech failed:", error)
            throw error
        }
    }
}

export const speechService = new SpeechService()
