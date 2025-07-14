import { LanguageDetectionResult } from "../../types/conversation.types"
import { openaiClient, OPENAI_CONFIG } from "../../config/openai"
import { logger } from "../../utils/logger"

export class LanguageDetectionService {
    async detectLanguage(text: string): Promise<string> {
        try {
            // Simple language detection based on text patterns
            const hindiPattern = /[\u0900-\u097F]/
            const englishPattern = /[a-zA-Z]/
            
            if (hindiPattern.test(text)) {
                return "hindi"
            } else if (englishPattern.test(text)) {
                return "english"
            }
            
            // Fallback to OpenAI for more complex detection
            const completion = await openaiClient.chat.completions.create({
                model: OPENAI_CONFIG.model,
                messages: [
                    {
                        role: "system",
                        content: "Detect the language of the following text. Respond with only 'english' or 'hindi'."
                    },
                    { role: "user", content: text }
                ],
                temperature: 0.1,
                max_tokens: 10
            })

            const detectedLanguage = completion.choices[0]?.message?.content?.trim().toLowerCase()
            return detectedLanguage === "hindi" ? "hindi" : "english"
        } catch (error) {
            logger.error("Language detection error:", error)
            return "english" // Default fallback
        }
    }

    async detectLanguageWithConfidence(text: string): Promise<LanguageDetectionResult> {
        try {
            const language = await this.detectLanguage(text)
            return {
                language,
                confidence: 0.9 // Simplified confidence score
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
