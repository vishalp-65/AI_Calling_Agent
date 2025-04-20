import { Server } from "socket.io"
import { Server as HttpServer } from "http"
import { logger } from "../utils/logger"
import { CallSocketHandler } from "./call.socket"
import { verifyToken } from "../utils/encryption"

export class WebSocketServer {
    private io: Server
    private callHandler: CallSocketHandler

    constructor(server: HttpServer) {
        this.io = new Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        })
        this.callHandler = new CallSocketHandler(this.io)
        this.setupMiddleware()
        this.setupHandlers()
    }

    private setupMiddleware() {
        this.io.use((socket, next) => {
            const token = socket.handshake.auth.token
            if (!token) {
                return next(new Error("Authentication error"))
            }

            const decoded = verifyToken(token)
            if (!decoded) {
                return next(new Error("Invalid token"))
            }

            socket.data.user = decoded
            next()
        })
    }

    private setupHandlers() {
        this.io.on("connection", (socket) => {
            logger.info(`Client connected: ${socket.id}`)

            // Setup call handlers
            this.callHandler.handleConnection(socket)

            socket.on("disconnect", () => {
                logger.info(`Client disconnected: ${socket.id}`)
            })
        })
    }

    public getIO(): Server {
        return this.io
    }
}

export let webSocketServer: WebSocketServer

export const initializeWebSocket = (server: HttpServer) => {
    webSocketServer = new WebSocketServer(server)
    return webSocketServer
}
