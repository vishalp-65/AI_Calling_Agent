import { Request, Response } from "express"
import { ResponseHandler } from "../utils/response"
import { LangChainService } from "../services/ai/langchain.service"

const langchain = new LangChainService()
langchain.initialize().catch((err) => console.error(err))

export class KnowledgeController {
    async query(req: Request, res: Response): Promise<any> {
        try {
            const { query, category, limit, threshold } = req.body
            const { answer, sources, confidence } =
                await langchain.processQuery({
                    query,
                    category,
                    limit,
                    threshold
                })
            return ResponseHandler.success(
                res,
                { answer, sources, confidence },
                "Knowledge query processed successfully"
            )
        } catch (error) {
            return ResponseHandler.serverError(
                res,
                "Failed to process knowledge query",
                error
            )
        }
    }

    async followUp(req: Request, res: Response): Promise<any> {
        try {
            const { context } = req.body
            const questions = await langchain.generateFollowUpQuestions(context)
            return ResponseHandler.success(
                res,
                { questions },
                "Follow-up questions generated successfully"
            )
        } catch (error) {
            return ResponseHandler.serverError(
                res,
                "Failed to generate follow-up questions",
                error
            )
        }
    }
}

export const knowledgeController = new KnowledgeController()
