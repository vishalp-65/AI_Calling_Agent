import { OpenAI } from "langchain/llms/openai"
import { PromptTemplate } from "langchain/prompts"
import { LLMChain } from "langchain/chains"
import { config } from "../../config"
import { logger } from "../../utils/logger"
import { PineconeService } from "./pinecone.service"
import { KnowledgeQuery, KnowledgeResult } from "../../types/ai.types"

export class LangChainService {
    private llm: OpenAI
    private pineconeService: PineconeService

    constructor() {
        this.llm = new OpenAI({
            openAIApiKey: config.openai.apiKey,
            modelName: config.openai.model,
            temperature: 0.7
        })
        this.pineconeService = new PineconeService()
    }

    async initialize(): Promise<void> {
        try {
            await this.pineconeService.initialize()
            logger.info("LangChain service initialized")
        } catch (error) {
            logger.error("Failed to initialize LangChain service:", error)
            throw error
        }
    }

    async processQuery(query: KnowledgeQuery): Promise<{
        answer: string
        sources: KnowledgeResult[]
        confidence: number
    }> {
        try {
            // Search for relevant knowledge
            const knowledgeResults = await this.pineconeService.searchKnowledge(
                query.query,
                {
                    topK: query.limit || 5,
                    filter: query.category
                        ? { category: query.category }
                        : undefined
                }
            )

            // Filter by threshold
            const relevantKnowledge = knowledgeResults.filter(
                (result) => result.relevanceScore >= (query.threshold || 0.5)
            )

            if (relevantKnowledge.length === 0) {
                return {
                    answer: "I don't have specific information about that topic. Let me transfer you to a human agent.",
                    sources: [],
                    confidence: 0
                }
            }

            // Create context from relevant knowledge
            const context = relevantKnowledge
                .map((result) => `${result.title}: ${result.content}`)
                .join("\n\n")

            // Create prompt template
            const prompt = PromptTemplate.fromTemplate(`
        Based on the following context, answer the user's question accurately and helpfully.
        If you cannot answer based on the context, say so clearly.
        
        Context:
        {context}
        
        Question: {question}
        
        Answer:
      `)

            // Create chain
            const chain = new LLMChain({
                llm: this.llm,
                prompt
            })

            // Generate response
            const response = await chain.call({
                context,
                question: query.query
            })

            const avgConfidence =
                relevantKnowledge.reduce(
                    (sum, result) => sum + result.relevanceScore,
                    0
                ) / relevantKnowledge.length

            return {
                answer: response.text,
                sources: relevantKnowledge,
                confidence: avgConfidence
            }
        } catch (error) {
            logger.error("Failed to process query:", error)
            throw error
        }
    }

    async generateFollowUpQuestions(context: string): Promise<string[]> {
        try {
            const prompt = PromptTemplate.fromTemplate(`
        Based on the following conversation context, generate 3 relevant follow-up questions
        that a customer service agent might ask to better help the customer.
        
        Context: {context}
        
        Follow-up questions (one per line):
      `)

            const chain = new LLMChain({
                llm: this.llm,
                prompt
            })

            const response = await chain.call({ context })

            return response.text
                .split("\n")
                .filter((line: string) => line.trim().length > 0)
                .slice(0, 3)
        } catch (error) {
            logger.error("Failed to generate follow-up questions:", error)
            return []
        }
    }
}
