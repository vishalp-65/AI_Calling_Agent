import { Request, Response } from "express"
import { ResponseHandler } from "../utils/response"
import { GeminiService } from "../services/ai/gemini.service"

const aiService = new GeminiService()

export class AgentController {
    async message(req: Request, res: Response): Promise<any> {
        try {
            const { prompt, context, history } = req.body
            const conversationContext = {
                callSid: "agent-controller-call",
                currentLanguage: context?.language || "hindi",
                userInput: prompt,
                confidence: 0.9,
                conversationHistory: history || [],
                timestamp: new Date().toISOString()
            }
            const aiResponse = await aiService.generateNaturalResponse(
                conversationContext
            )
            return ResponseHandler.success(
                res,
                aiResponse,
                "AI response generated successfully"
            )
        } catch (error) {
            return ResponseHandler.serverError(
                res,
                "Failed to generate AI response",
                error
            )
        }
    }

    async speechToText(req: Request, res: Response): Promise<any> {
        try {
            if (!req.file || !req.file.buffer) {
                return ResponseHandler.badRequest(res, "No audio file uploaded")
            }
            const audioBuffer: Buffer = req.file.buffer
            const result = await aiService.speechToText(audioBuffer)
            return ResponseHandler.success(
                res,
                result,
                "Speech converted to text successfully"
            )
        } catch (error) {
            return ResponseHandler.serverError(
                res,
                "Failed to convert speech to text",
                error
            )
        }
    }

    async textToSpeech(req: Request, res: Response): Promise<any> {
        try {
            const { text, voice, speed } = req.body
            const audio = await aiService.textToSpeech({ text, voice, speed })
            res.setHeader("Content-Type", "audio/mpeg")
            return res.send(audio)
        } catch (error) {
            return ResponseHandler.serverError(
                res,
                "Failed to convert text to speech",
                error
            )
        }
    }
}

export const agentController = new AgentController()
