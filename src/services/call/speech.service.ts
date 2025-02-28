import { OpenAIService } from "../ai/openai.service"
import { TextToSpeechRequest, SpeechToTextResult } from "../../types/ai.types"
import { logger } from "../../utils/logger"

export class SpeechService {
    private openAIService: OpenAIService

    constructor() {
        this.openAIService = new OpenAIService()
    }

    async convertSpeechToText(audioBuffer: Buffer): Promise<SpeechToTextResult> {
        try {
            return await this.openAIService.speechToText(audioBuffer)
        } catch (error) {
            logger.error("Conversion from speech to text failed:", error)
            throw error
        }
    }

    async convertTextToSpeech(request: TextToSpeechRequest): Promise<Buffer> {
        try {
            return await this.openAIService.textToSpeech(request)
        } catch (error) {
            logger.error("Conversion from text to speech failed:", error)
            throw error
        }
    }
}

export const speechService = new SpeechService()
