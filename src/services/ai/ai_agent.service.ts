import { OpenAIService } from "./openai.service"

export class AiAgentService {
    private openAI = new OpenAIService()
    private userLang: "en" | "hi" = "en"

    // initial greeting
    greet() {
        return this.userLang === "hi"
            ? "नमस्ते! आप हमारे AI सहायक से बात कर रहे हैं। मैं आपकी कैसे मदद कर सकता हूँ?"
            : `Hello! You're speaking with our AI assistant. How can I help you today?`
    }

    promptListening() {
        return this.userLang === "hi"
            ? "मैं सुन रहा हूँ..."
            : `I'm listening...`
    }

    notHeard() {
        return this.userLang === "hi"
            ? "माफ़ कीजिये, मैं वो सुन नहीं पाया। कृपया दोबारा कहें।"
            : `I didn't catch that. Could you please repeat?`
    }

    transferNotice(lang: string) {
        return lang === "hi"
            ? "मैं आपको मानव एजेंट से जोड़ रहा हूँ।"
            : "Let me transfer you to a human agent."
    }

    promptContinue(lang: string) {
        return lang === "hi"
            ? "और कुछ मदद चाहिए?"
            : "Is there anything else I can help you with?"
    }

    async respond(text: string, langCode: "en-US" | "hi-IN") {
        // switch userLang if requested
        if (langCode === "hi-IN") this.userLang = "hi"
        else this.userLang = "en"

        const language = this.userLang === "hi" ? "hindi" : "english"
        
        const conversationContext = {
            callSid: "ai-agent-call",
            currentLanguage: language,
            userInput: text,
            confidence: 0.9,
            conversationHistory: [],
            timestamp: new Date().toISOString()
        }

        const ai = await this.openAI.generateNaturalResponse(conversationContext)

        return {
            message: ai.message,
            shouldTransfer: ai.shouldTransfer,
            lang: langCode
        }
    }

    private buildPrompt(userText: string, lang: "en" | "hi") {
        const tone =
            lang === "hi"
                ? "दया से, दोस्ताना और शांत"
                : "kind, friendly, and calm"
        const switchNote =
            lang === "hi"
                ? "भविष्य में हिंदी में जवाब दें।"
                : "Please continue responding in English."

        return (
            `You are a helpful AI assistant speaking in ${
                lang === "hi" ? "Hindi" : "English"
            }. ` +
            `Your tone should be ${tone}, and you should show genuine interest in the caller's needs. ` +
            `${switchNote} Caller said: "${userText}"`
        )
    }
}
