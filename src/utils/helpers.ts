// Generic helper functions

// Delay helper for asynchronous operations
export const delay = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

// Helper to generate unique identifiers
import { v4 as uuidv4 } from "uuid"

export const generateUUID = (): string => {
    return uuidv4()
}

// Helper for date and time formatting
export const formatDate = (date: Date): string => {
    return `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${date
        .getHours()
        .toString()
        .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
}

// Calculating sentiment score average
export const calculateAverageSentiment = (scores: number[]): number => {
    if (scores.length === 0) return 0
    const sum = scores.reduce((a, b) => a + b, 0)
    return parseFloat((sum / scores.length).toFixed(2))
}

// Normalize phone number format
export const normalizePhoneNumber = (phone: string): string => {
    return phone.replace(/[\s-()]/g, "")
}
