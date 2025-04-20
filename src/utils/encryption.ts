import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { config } from "../config"

// Hashing passwords
export const hashPassword = async (password: string): Promise<string> => {
    const salt = await bcrypt.genSalt(config.security.bcryptSaltRounds)
    return await bcrypt.hash(password, salt)
}

// Comparing passwords
export const comparePassword = async (
    password: string,
    hashedPassword: string
): Promise<boolean> => {
    return await bcrypt.compare(password, hashedPassword)
}

// Generate JWT token
export const generateToken = (
    payload: Record<string, any>,
    expiresIn?: string
): string => {
    return jwt.sign(payload, config.security.jwtSecret, {
        expiresIn: expiresIn || config.security.jwtExpiresIn
    })
}

// Verify JWT token
export const verifyToken = (token: string): any => {
    try {
        return jwt.verify(token, config.security.jwtSecret)
    } catch (error) {
        return null
    }
}

// Decode JWT token (without verifying)
export const decodeToken = (token: string): any => {
    return jwt.decode(token)
}
