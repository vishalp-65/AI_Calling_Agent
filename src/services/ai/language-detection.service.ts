import { LanguageDetectionResult } from "../../types/conversation.types"
import { geminiClient, GEMINI_CONFIG } from "../../config/gemini"
import { logger } from "../../utils/logger"

export class LanguageDetectionService {
    private model: any

    constructor() {
        this.model = geminiClient.getGenerativeModel({
            model: GEMINI_CONFIG.model,
            generationConfig: {
                temperature: 0.1,
                topP: 0.9,
                topK: 40,
                maxOutputTokens: 50,
                responseMimeType: "text/plain"
            }
        })
    }

    async detectLanguage(text: string): Promise<string> {
        try {
            // Simple language detection based on text patterns (faster)
            const hindiPattern = /[\u0900-\u097F]/
            const englishPattern = /[a-zA-Z]/

            if (hindiPattern.test(text)) {
                return "hindi"
            } else if (englishPattern.test(text)) {
                return "english"
            }

            // Fallback to Gemini for more complex detection
            const prompt = `Detect the language of the following text. Respond with only 'english' or 'hindi', nothing else.

Text: ${text}

Language:`

            const result = await this.model.generateContent(prompt)
            const response = await result.response
            const detectedLanguage = response.text().trim().toLowerCase()

            return detectedLanguage === "hindi" ? "hindi" : "english"
        } catch (error) {
            logger.error("Language detection error:", error)
            return "english" // Default fallback
        }
    }

    async detectLanguageWithConfidence(
        text: string
    ): Promise<LanguageDetectionResult> {
        try {
            const language = await this.detectLanguage(text)

            // Simple confidence calculation based on character patterns
            const hindiPattern = /[\u0900-\u097F]/
            const englishPattern = /[a-zA-Z]/

            let confidence = 0.7 // Default confidence

            if (hindiPattern.test(text)) {
                const hindiChars = (text.match(/[\u0900-\u097F]/g) || []).length
                confidence = Math.min(
                    0.95,
                    0.7 + (hindiChars / text.length) * 0.3
                )
            } else if (englishPattern.test(text)) {
                const englishChars = (text.match(/[a-zA-Z]/g) || []).length
                confidence = Math.min(
                    0.95,
                    0.7 + (englishChars / text.length) * 0.3
                )
            }

            return {
                language,
                confidence
            }
        } catch (error) {
            logger.error("Language detection with confidence error:", error)
            return {
                language: "english",
                confidence: 0.5
            }
        }
    }
}
