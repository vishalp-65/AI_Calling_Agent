import { Router } from "express"
import { Request, Response } from "express"
import multer from "multer"
import { userKnowledgeService } from "../services/knowledge/user-knowledge.service"
import { logger } from "../utils/logger"
import { ResponseHandler } from "../utils/response"
import { HTTP_STATUS } from "../constants/http-status"

const router = Router()

// Configure multer for file uploads
const storage = multer.memoryStorage()
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "application/pdf",
            "text/csv",
            "application/vnd.ms-excel"
        ]
        const allowedExtensions = [".pdf", ".csv"]

        const hasAllowedType = allowedTypes.includes(file.mimetype)
        const hasAllowedExtension = allowedExtensions.some((ext) =>
            file.originalname.toLowerCase().endsWith(ext)
        )

        if (hasAllowedType || hasAllowedExtension) {
            cb(null, true)
        } else {
            cb(new Error("Only PDF and CSV files are allowed"))
        }
    }
})

// Upload user document
router.post(
    "/upload",
    upload.single("document"),
    async (req: Request, res: Response) => {
        try {
            const { phoneNumber } = req.body
            const file = req.file

            if (!phoneNumber) {
                return ResponseHandler.badRequest(
                    res,
                    "Phone number is required"
                )
            }

            if (!file) {
                return ResponseHandler.badRequest(
                    res,
                    "Document file is required"
                )
            }

            // Determine file type
            const fileType = file.originalname.toLowerCase().endsWith(".pdf")
                ? "pdf"
                : "csv"

            // Upload document
            const document = await userKnowledgeService.uploadUserDocument(
                phoneNumber,
                file.originalname,
                file.buffer,
                fileType
            )

            return ResponseHandler.created(
                res,
                {
                    documentId: document.id,
                    fileName: document.fileName,
                    fileType: document.metadata.fileType,
                    uploadDate: document.metadata.uploadDate,
                    size: document.metadata.size
                },
                "Document uploaded successfully"
            )
        } catch (error) {
            logger.error("Failed to upload user document:", error)
            return ResponseHandler.serverError(
                res,
                "Failed to upload document",
                error
            )
        }
    }
)

// Get user profile
router.get("/profile/:phoneNumber", async (req: Request, res: Response) => {
    try {
        const { phoneNumber } = req.params

        const profile = await userKnowledgeService.getUserProfile(phoneNumber!)

        if (!profile) {
            return ResponseHandler.notFound(res, "User profile not found")
        }

        return ResponseHandler.success(
            res,
            profile,
            "User profile retrieved successfully"
        )
    } catch (error) {
        logger.error("Failed to get user profile:", error)
        return ResponseHandler.serverError(
            res,
            "Failed to retrieve user profile",
            error
        )
    }
})

// Update user profile
router.put("/profile/:phoneNumber", async (req: Request, res: Response) => {
    try {
        const { phoneNumber } = req.params
        const updates = req.body

        const profile = await userKnowledgeService.createOrUpdateUserProfile(
            phoneNumber!,
            updates
        )

        return ResponseHandler.success(
            res,
            profile,
            "User profile updated successfully"
        )
    } catch (error) {
        logger.error("Failed to update user profile:", error)
        return ResponseHandler.serverError(
            res,
            "Failed to update user profile",
            error
        )
    }
})

// Get user documents
router.get("/documents/:phoneNumber", async (req: Request, res: Response) => {
    try {
        const { phoneNumber } = req.params

        const documents = await userKnowledgeService.getUserDocuments(
            phoneNumber!
        )

        // Return only metadata, not full content
        const documentsMetadata = documents.map((doc) => ({
            id: doc.id,
            fileName: doc.fileName,
            metadata: doc.metadata
        }))

        return ResponseHandler.success(
            res,
            documentsMetadata,
            "User documents retrieved successfully"
        )
    } catch (error) {
        logger.error("Failed to get user documents:", error)
        return ResponseHandler.serverError(
            res,
            "Failed to retrieve user documents",
            error
        )
    }
})

// Delete user document
router.delete(
    "/documents/:phoneNumber/:documentId",
    async (req: Request, res: Response) => {
        try {
            const { phoneNumber, documentId } = req.params

            const deleted = await userKnowledgeService.deleteUserDocument(
                phoneNumber!,
                documentId!
            )

            if (!deleted) {
                return ResponseHandler.notFound(res, "Document not found")
            }

            return ResponseHandler.success(
                res,
                null,
                "Document deleted successfully"
            )
        } catch (error) {
            logger.error("Failed to delete user document:", error)
            return ResponseHandler.serverError(
                res,
                "Failed to delete document",
                error
            )
        }
    }
)

// Search user knowledge
router.post("/search", async (req: Request, res: Response) => {
    try {
        const { phoneNumber, query } = req.body

        if (!phoneNumber || !query) {
            return ResponseHandler.badRequest(
                res,
                "Phone number and query are required"
            )
        }

        const results = await userKnowledgeService.searchUserKnowledge(
            phoneNumber,
            query
        )

        return ResponseHandler.success(
            res,
            {
                phoneNumber,
                query,
                results,
                resultCount: results.length
            },
            "Knowledge search completed successfully"
        )
    } catch (error) {
        logger.error("Failed to search user knowledge:", error)
        return ResponseHandler.serverError(
            res,
            "Failed to search knowledge",
            error
        )
    }
})

// Get knowledge context for user query
router.post("/context", async (req: Request, res: Response) => {
    try {
        const { phoneNumber, query } = req.body

        if (!phoneNumber || !query) {
            return ResponseHandler.badRequest(
                res,
                "Phone number and query are required"
            )
        }

        const context = await userKnowledgeService.getContextForUser(
            phoneNumber,
            query
        )

        return ResponseHandler.success(
            res,
            {
                phoneNumber,
                query,
                context,
                hasContext: context.length > 0
            },
            "Knowledge context retrieved successfully"
        )
    } catch (error) {
        logger.error("Failed to get knowledge context:", error)
        return ResponseHandler.serverError(
            res,
            "Failed to retrieve knowledge context",
            error
        )
    }
})

// Health check for user knowledge service
router.get("/health", async (req: Request, res: Response) => {
    try {
        return ResponseHandler.success(
            res,
            {
                status: "healthy",
                timestamp: new Date().toISOString(),
                version: "1.0.0"
            },
            "User knowledge service is healthy"
        )
    } catch (error) {
        logger.error("User knowledge service health check failed:", error)
        return ResponseHandler.serverError(
            res,
            "Service health check failed",
            error
        )
    }
})

export { router as userKnowledgeRoutes }
