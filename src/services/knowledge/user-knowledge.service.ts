import { logger } from "../../utils/logger"
import { PineconeService } from "../ai/pinecone.service"
import { promises as fs } from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import * as csv from "csv-parser"
import { Readable } from "stream"

export interface UserKnowledgeDocument {
    id: string
    userId: string
    phoneNumber: string
    fileName: string
    content: string
    metadata: {
        uploadDate: string
        fileType: "pdf" | "csv"
        size: number
        processed: boolean
        chunks?: number
    }
}

export interface UserProfile {
    phoneNumber: string
    name?: string
    preferredLanguage: "hi-IN" | "en-IN"
    knowledgeDocuments: string[]
    lastCallDate?: string
    totalCalls: number
    metadata: Record<string, any>
}

export class UserKnowledgeService {
    private pineconeService: PineconeService
    private userProfiles: Map<string, UserProfile> = new Map()
    private userKnowledge: Map<string, UserKnowledgeDocument[]> = new Map()
    private knowledgeStorePath: string

    constructor() {
        this.pineconeService = new PineconeService()
        this.knowledgeStorePath = path.join(
            process.cwd(),
            "data",
            "user-knowledge"
        )
        this.initializeStorage()
    }

    private async initializeStorage() {
        try {
            await fs.mkdir(this.knowledgeStorePath, { recursive: true })
            await this.loadUserProfiles()
            logger.info("User knowledge service initialized")
        } catch (error) {
            logger.error("Failed to initialize user knowledge storage:", error)
        }
    }

    private async loadUserProfiles() {
        try {
            const profilesPath = path.join(
                this.knowledgeStorePath,
                "user-profiles.json"
            )
            const data = await fs.readFile(profilesPath, "utf-8")
            const profiles = JSON.parse(data)

            profiles.forEach((profile: UserProfile) => {
                this.userProfiles.set(profile.phoneNumber, profile)
            })

            logger.info(`Loaded ${profiles.length} user profiles`)
        } catch (error) {
            logger.info("No existing user profiles found, starting fresh")
        }
    }

    private async saveUserProfiles() {
        try {
            const profilesPath = path.join(
                this.knowledgeStorePath,
                "user-profiles.json"
            )
            const profiles = Array.from(this.userProfiles.values())
            await fs.writeFile(profilesPath, JSON.stringify(profiles, null, 2))
        } catch (error) {
            logger.error("Failed to save user profiles:", error)
        }
    }

    async getUserProfile(phoneNumber: string): Promise<UserProfile | null> {
        return this.userProfiles.get(phoneNumber) || null
    }

    async createOrUpdateUserProfile(
        phoneNumber: string,
        updates: Partial<UserProfile>
    ): Promise<UserProfile> {
        const existingProfile = this.userProfiles.get(phoneNumber)

        const profile: UserProfile = {
            phoneNumber,
            preferredLanguage: "hi-IN", // Default to Hindi
            knowledgeDocuments: [],
            totalCalls: 0,
            metadata: {},
            ...existingProfile,
            ...updates,
            lastCallDate: new Date().toISOString()
        }

        if (existingProfile) {
            profile.totalCalls = existingProfile.totalCalls + 1
        }

        this.userProfiles.set(phoneNumber, profile)
        await this.saveUserProfiles()

        return profile
    }

    async uploadUserDocument(
        phoneNumber: string,
        fileName: string,
        fileContent: Buffer,
        fileType: "pdf" | "csv"
    ): Promise<UserKnowledgeDocument> {
        try {
            const documentId = uuidv4()
            const userDir = path.join(this.knowledgeStorePath, phoneNumber)

            // Create user directory if it doesn't exist
            await fs.mkdir(userDir, { recursive: true })

            // Save file
            const filePath = path.join(userDir, `${documentId}_${fileName}`)
            await fs.writeFile(filePath, fileContent)

            // Process file content
            const content = await this.extractContent(fileContent, fileType)

            const document: UserKnowledgeDocument = {
                id: documentId,
                userId: phoneNumber,
                phoneNumber,
                fileName,
                content,
                metadata: {
                    uploadDate: new Date().toISOString(),
                    fileType,
                    size: fileContent.length,
                    processed: false
                }
            }

            // Store in memory
            if (!this.userKnowledge.has(phoneNumber)) {
                this.userKnowledge.set(phoneNumber, [])
            }
            this.userKnowledge.get(phoneNumber)!.push(document)

            // Process and embed in background
            this.processDocumentEmbeddings(document)

            // Update user profile
            const profile = await this.getUserProfile(phoneNumber)
            if (profile) {
                profile.knowledgeDocuments.push(documentId)
                await this.createOrUpdateUserProfile(phoneNumber, profile)
            }

            logger.info(
                `Document uploaded for user ${phoneNumber}: ${fileName}`
            )

            return document
        } catch (error) {
            logger.error(
                `Failed to upload document for user ${phoneNumber}:`,
                error
            )
            throw error
        }
    }

    private async extractContent(
        fileContent: Buffer,
        fileType: "pdf" | "csv"
    ): Promise<string> {
        if (fileType === "csv") {
            return this.extractCSVContent(fileContent)
        } else if (fileType === "pdf") {
            return this.extractPDFContent(fileContent)
        }
        throw new Error(`Unsupported file type: ${fileType}`)
    }

    private async extractCSVContent(fileContent: Buffer): Promise<string> {
        return new Promise((resolve, reject) => {
            const results: any[] = []
            const stream = Readable.from(fileContent.toString())

            // stream
            //     .pipe(csv())
            //     .on('data', (data:any ) => results.push(data))
            //     .on('end', () => {
            //         // Convert CSV data to readable text
            //         const content = results.map(row =>
            //             Object.entries(row).map(([key, value]) => `${key}: ${value}`).join(', ')
            //         ).join('\n')
            //         resolve(content)
            //     })
            //     .on('error', reject)
        })
    }

    private async extractPDFContent(fileContent: Buffer): Promise<string> {
        // For now, return a placeholder. In production, you'd use a PDF parser like pdf-parse
        try {
            // This is a simplified version - you should use a proper PDF parser
            const content = fileContent.toString("utf-8")
            return content
        } catch (error) {
            logger.error("Failed to extract PDF content:", error)
            return "PDF content extraction failed"
        }
    }

    private async processDocumentEmbeddings(document: UserKnowledgeDocument) {
        try {
            // Chunk the content for better embeddings
            const chunks = this.chunkContent(document.content, 1000)

            for (let i = 0; i < chunks.length; i++) {
                const chunkId = `${document.id}_chunk_${i}`
                await this.pineconeService.upsertKnowledge(
                    chunkId,
                    chunks[i]!,
                    {
                        userId: document.userId,
                        phoneNumber: document.phoneNumber,
                        fileName: document.fileName,
                        chunkIndex: i,
                        totalChunks: chunks.length,
                        documentId: document.id
                    }
                )
            }

            // Update document metadata
            document.metadata.processed = true
            document.metadata.chunks = chunks.length

            logger.info(
                `Processed embeddings for ${document.fileName}: ${chunks.length} chunks`
            )
        } catch (error) {
            logger.error(
                `Failed to process embeddings for ${document.fileName}:`,
                error
            )
        }
    }

    private chunkContent(content: string, chunkSize: number): string[] {
        const chunks: string[] = []
        const words = content.split(" ")
        let currentChunk = ""

        for (const word of words) {
            if (currentChunk.length + word.length + 1 <= chunkSize) {
                currentChunk += (currentChunk ? " " : "") + word
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk)
                    currentChunk = word
                }
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk)
        }

        return chunks
    }

    async searchUserKnowledge(
        phoneNumber: string,
        query: string
    ): Promise<string[]> {
        try {
            const searchResults = await this.pineconeService.searchKnowledge(
                query,
                {
                    phoneNumber
                }
            )

            return searchResults.map((result) => result.content)
        } catch (error) {
            logger.error(
                `Failed to search knowledge for user ${phoneNumber}:`,
                error
            )
            return []
        }
    }

    async getUserDocuments(
        phoneNumber: string
    ): Promise<UserKnowledgeDocument[]> {
        return this.userKnowledge.get(phoneNumber) || []
    }

    async deleteUserDocument(
        phoneNumber: string,
        documentId: string
    ): Promise<boolean> {
        try {
            const userDocs = this.userKnowledge.get(phoneNumber)
            if (!userDocs) return false

            const docIndex = userDocs.findIndex((doc) => doc.id === documentId)
            if (docIndex === -1) return false

            // Remove from memory
            userDocs.splice(docIndex, 1)

            // Remove from filesystem
            const userDir = path.join(this.knowledgeStorePath, phoneNumber)
            const files = await fs.readdir(userDir)
            const docFile = files.find((file) => file.startsWith(documentId))

            if (docFile) {
                await fs.unlink(path.join(userDir, docFile))
            }

            // Remove from vector database
            await this.pineconeService.deleteKnowledge(documentId)

            // Update user profile
            const profile = await this.getUserProfile(phoneNumber)
            if (profile) {
                profile.knowledgeDocuments = profile.knowledgeDocuments.filter(
                    (id) => id !== documentId
                )
                await this.createOrUpdateUserProfile(phoneNumber, profile)
            }

            logger.info(
                `Document ${documentId} deleted for user ${phoneNumber}`
            )
            return true
        } catch (error) {
            logger.error(
                `Failed to delete document ${documentId} for user ${phoneNumber}:`,
                error
            )
            return false
        }
    }

    async getContextForUser(
        phoneNumber: string,
        query: string
    ): Promise<string> {
        const relevantKnowledge = await this.searchUserKnowledge(
            phoneNumber,
            query
        )

        if (relevantKnowledge.length === 0) {
            return ""
        }

        return `Based on your documents:\n${relevantKnowledge.join("\n\n")}`
    }
}

export const userKnowledgeService = new UserKnowledgeService()
