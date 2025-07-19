import { Request, Response } from "express"
import { authService } from "../services/auth/auth.service"
import { ResponseHandler } from "../utils/response"
import { logger } from "../utils/logger"

export class AuthController {
    async register(req: Request, res: Response): Promise<any> {
        try {
            const { email, password, name } = req.body
            const result = await authService.register({ email, password, name })

            return ResponseHandler.created(
                res,
                { user: result.user, token: result.token },
                "User registered successfully"
            )
        } catch (error) {
            logger.error("Registration error:", error)
            return ResponseHandler.handleError(res, error)
        }
    }

    async login(req: Request, res: Response): Promise<any> {
        try {
            const { email, password } = req.body
            const result = await authService.login({ email, password })

            return ResponseHandler.success(
                res,
                { user: result.user, token: result.token },
                "Login successful"
            )
        } catch (error) {
            logger.error("Login error:", error)
            return ResponseHandler.handleError(res, error)
        }
    }

    async refreshToken(req: Request, res: Response): Promise<any> {
        try {
            const userId = res.locals.user.id
            const token = await authService.refreshToken(userId)

            return ResponseHandler.success(
                res,
                { token },
                "Token refreshed successfully"
            )
        } catch (error) {
            logger.error("Token refresh error:", error)
            return ResponseHandler.handleError(res, error)
        }
    }

    async getProfile(req: Request, res: Response): Promise<any> {
        try {
            const userId = res.locals.user.id
            const user = await authService.getUserById(userId)

            return ResponseHandler.success(
                res,
                { user },
                "User profile retrieved successfully"
            )
        } catch (error) {
            logger.error("Get profile error:", error)
            return ResponseHandler.handleError(res, error)
        }
    }

    async changePassword(req: Request, res: Response): Promise<any> {
        try {
            const userId = res.locals.user.id
            const { currentPassword, newPassword } = req.body

            await authService.changePassword(
                userId,
                currentPassword,
                newPassword
            )

            return ResponseHandler.success(
                res,
                null,
                "Password changed successfully"
            )
        } catch (error) {
            logger.error("Change password error:", error)
            return ResponseHandler.handleError(res, error)
        }
    }
}

export const authController = new AuthController()
