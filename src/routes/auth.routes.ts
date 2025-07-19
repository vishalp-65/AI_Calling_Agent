import { Router } from "express"
import { authController } from "../controllers/auth.controller"
import { authenticateJWT } from "../middlewares/auth.middleware"
import { validateRequest } from "../middlewares/validation.middleware"
import {
    registerSchema,
    loginSchema,
    changePasswordSchema
} from "../models/schemas/auth.schema"

const router = Router()

// Public routes
router.post(
    "/register",
    validateRequest(registerSchema),
    authController.register.bind(authController)
)

router.post(
    "/login",
    validateRequest(loginSchema),
    authController.login.bind(authController)
)

// Protected routes
router.get(
    "/profile",
    authenticateJWT,
    authController.getProfile.bind(authController)
)

router.post(
    "/refresh-token",
    authenticateJWT,
    authController.refreshToken.bind(authController)
)

router.post(
    "/change-password",
    authenticateJWT,
    validateRequest(changePasswordSchema),
    authController.changePassword.bind(authController)
)

export { router as authRoutes }
