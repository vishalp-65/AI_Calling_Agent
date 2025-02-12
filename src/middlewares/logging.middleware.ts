import morgan from "morgan"
import { logStream } from "../utils/logger"

// HTTP request logger middleware with morgan
export const requestLogger = morgan(
    ":method :url :status :res[content-length] - :response-time ms",
    { stream: logStream }
)
