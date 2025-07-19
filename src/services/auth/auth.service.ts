import {
    hashPassword,
    comparePassword,
    generateToken
} from "../../utils/encryption"
import { logger } from "../../utils/logger"
import { ApiError } from "../../utils/api-error"
import { HTTP_STATUS } from "../../constants/http-status"

// User interface for in-memory storage (replace with database in production)
interface User {
    id: string
    email: string
    password: string
    name: string
    role: string
    isActive: boolean
    lastLoginAt?: Date
    createdAt: Date
    updatedAt: Date
}

// User DTO interface
interface UserDTO {
    id: string
    email: string
    name: string
    role: string
    isActive: boolean
}

export class AuthService {
    // In-memory user storage (replace with database in production)
    private users: Map<string, User> = new Map()
    private usersByEmail: Map<string, User> = new Map()

    constructor() {
        // Create a default admin user for testing
        this.createDefaultUsers()
    }

    private async createDefaultUsers() {
        try {
            const adminUser: User = {
                id: "admin-001",
                email: "admin@example.com",
                password: await hashPassword("admin123"),
                name: "Admin User",
                role: "admin",
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }

            this.users.set(adminUser.id, adminUser)
            this.usersByEmail.set(adminUser.email, adminUser)

            logger.info(
                "Default admin user created: admin@example.com / admin123"
            )
        } catch (error) {
            logger.error("Error creating default users:", error)
        }
    }

    private toUserDTO(user: User): UserDTO {
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isActive: user.isActive
        }
    }

    private generateUserId(): string {
        return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    async register(userData: {
        email: string
        password: string
        name: string
    }): Promise<{ user: UserDTO; token: string }> {
        try {
            // Check if user already exists
            const existingUser = this.usersByEmail.get(userData.email)

            if (existingUser) {
                throw new ApiError(
                    HTTP_STATUS.CONFLICT,
                    "User with this email already exists"
                )
            }

            // Hash password
            const hashedPassword = await hashPassword(userData.password)

            // Create new user
            const newUser: User = {
                id: this.generateUserId(),
                email: userData.email,
                password: hashedPassword,
                name: userData.name,
                role: "user",
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }

            // Store user
            this.users.set(newUser.id, newUser)
            this.usersByEmail.set(newUser.email, newUser)

            // Generate JWT token
            const token = generateToken({
                id: newUser.id,
                email: newUser.email,
                role: newUser.role
            })

            logger.info(`New user registered: ${newUser.email}`)

            return {
                user: this.toUserDTO(newUser),
                token
            }
        } catch (error) {
            logger.error("Error during user registration:", error)
            throw error
        }
    }

    async login(credentials: {
        email: string
        password: string
    }): Promise<{ user: UserDTO; token: string }> {
        try {
            // Find user by email
            const user = this.usersByEmail.get(credentials.email)

            if (!user) {
                throw new ApiError(
                    HTTP_STATUS.UNAUTHORIZED,
                    "Invalid email or password"
                )
            }

            // Check if user is active
            if (!user.isActive) {
                throw new ApiError(
                    HTTP_STATUS.FORBIDDEN,
                    "Account is deactivated"
                )
            }

            // Verify password
            const isPasswordValid = await comparePassword(
                credentials.password,
                user.password
            )

            if (!isPasswordValid) {
                throw new ApiError(
                    HTTP_STATUS.UNAUTHORIZED,
                    "Invalid email or password"
                )
            }

            // Update last login timestamp
            user.lastLoginAt = new Date()
            user.updatedAt = new Date()

            // Generate JWT token
            const token = generateToken({
                id: user.id,
                email: user.email,
                role: user.role
            })

            logger.info(`User logged in: ${user.email}`)

            return {
                user: this.toUserDTO(user),
                token
            }
        } catch (error) {
            logger.error("Error during user login:", error)
            throw error
        }
    }

    async refreshToken(userId: string): Promise<string> {
        try {
            const user = this.users.get(userId)

            if (!user || !user.isActive) {
                throw new ApiError(
                    HTTP_STATUS.UNAUTHORIZED,
                    "Invalid or inactive user"
                )
            }

            return generateToken({
                id: user.id,
                email: user.email,
                role: user.role
            })
        } catch (error) {
            logger.error("Error refreshing token:", error)
            throw error
        }
    }

    async getUserById(userId: string): Promise<UserDTO> {
        try {
            const user = this.users.get(userId)

            if (!user) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, "User not found")
            }

            return this.toUserDTO(user)
        } catch (error) {
            logger.error("Error fetching user by ID:", error)
            throw error
        }
    }

    async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string
    ): Promise<void> {
        try {
            const user = this.users.get(userId)

            if (!user) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, "User not found")
            }

            // Verify current password
            const isPasswordValid = await comparePassword(
                currentPassword,
                user.password
            )

            if (!isPasswordValid) {
                throw new ApiError(
                    HTTP_STATUS.UNAUTHORIZED,
                    "Current password is incorrect"
                )
            }

            // Hash new password
            const hashedPassword = await hashPassword(newPassword)
            user.password = hashedPassword
            user.updatedAt = new Date()

            logger.info(`Password changed for user: ${user.email}`)
        } catch (error) {
            logger.error("Error changing password:", error)
            throw error
        }
    }

    // Get all users (admin only)
    async getAllUsers(): Promise<UserDTO[]> {
        try {
            const users = Array.from(this.users.values())
            return users.map((user) => this.toUserDTO(user))
        } catch (error) {
            logger.error("Error fetching all users:", error)
            throw error
        }
    }

    // Deactivate user (admin only)
    async deactivateUser(userId: string): Promise<void> {
        try {
            const user = this.users.get(userId)

            if (!user) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, "User not found")
            }

            user.isActive = false
            user.updatedAt = new Date()

            logger.info(`User deactivated: ${user.email}`)
        } catch (error) {
            logger.error("Error deactivating user:", error)
            throw error
        }
    }
}

export const authService = new AuthService()
