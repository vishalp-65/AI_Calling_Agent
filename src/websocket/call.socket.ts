import { Server, Socket } from "socket.io"
import { logger } from "../utils/logger"
import { eventService } from "../services/messaging/event.service"
import { callService } from "../services/call/call.service"

export class CallSocketHandler {
    private io: Server
    private callRooms: Map<string, Set<string>> = new Map()

    constructor(io: Server) {
        this.io = io
    }

    public handleConnection(socket: Socket) {
        socket.on("join-call", (callSid: string) => {
            this.handleJoinCall(socket, callSid)
        })

        socket.on("leave-call", (callSid: string) => {
            this.handleLeaveCall(socket, callSid)
        })

        socket.on("call-message", (data: any) => {
            this.handleCallMessage(socket, data)
        })

        socket.on("call-action", (data: any) => {
            this.handleCallAction(socket, data)
        })

        socket.on("audio-stream", (data: any) => {
            this.handleAudioStream(socket, data)
        })

        socket.on("disconnect", () => {
            this.handleDisconnect(socket)
        })
    }

    private handleJoinCall(socket: Socket, callSid: string) {
        try {
            socket.join(callSid)
            
            if (!this.callRooms.has(callSid)) {
                this.callRooms.set(callSid, new Set())
            }
            this.callRooms.get(callSid)!.add(socket.id)

            logger.info(`Socket ${socket.id} joined call ${callSid}`)
            
            // Notify others in the room
            socket.to(callSid).emit("user-joined", {
                userId: socket.data.user.id,
                socketId: socket.id
            })

            // Send current call status
            this.sendCallStatus(callSid)
        } catch (error) {
            logger.error("Error joining call:", error)
            socket.emit("error", { message: "Failed to join call" })
        }
    }

    private handleLeaveCall(socket: Socket, callSid: string) {
        try {
            socket.leave(callSid)
            
            if (this.callRooms.has(callSid)) {
                this.callRooms.get(callSid)!.delete(socket.id)
                if (this.callRooms.get(callSid)!.size === 0) {
                    this.callRooms.delete(callSid)
                }
            }

            logger.info(`Socket ${socket.id} left call ${callSid}`)
            
            // Notify others in the room
            socket.to(callSid).emit("user-left", {
                userId: socket.data.user.id,
                socketId: socket.id
            })
        } catch (error) {
            logger.error("Error leaving call:", error)
        }
    }

    private handleCallMessage(socket: Socket, data: any) {
        try {
            const { callSid, message, type } = data
            
            // Broadcast message to all participants in the call
            this.io.to(callSid).emit("call-message", {
                userId: socket.data.user.id,
                message,
                type,
                timestamp: new Date().toISOString()
            })

            // Publish event for processing
            eventService.publishCallEvent("call.message", {
                callSid,
                userId: socket.data.user.id,
                message,
                type
            })
        } catch (error) {
            logger.error("Error handling call message:", error)
            socket.emit("error", { message: "Failed to send message" })
        }
    }

    private handleCallAction(socket: Socket, data: any) {
        try {
            const { callSid, action, payload } = data
            
            // Broadcast action to all participants in the call
            socket.to(callSid).emit("call-action", {
                userId: socket.data.user.id,
                action,
                payload,
                timestamp: new Date().toISOString()
            })

            // Publish event for processing
            eventService.publishCallEvent("call.action", {
                callSid,
                userId: socket.data.user.id,
                action,
                payload
            })
        } catch (error) {
            logger.error("Error handling call action:", error)
            socket.emit("error", { message: "Failed to execute action" })
        }
    }

    private handleAudioStream(socket: Socket, data: any) {
        try {
            const { callSid, audioData, timestamp } = data
            
            // Broadcast audio data to all participants in the call (except sender)
            socket.to(callSid).emit("audio-stream", {
                userId: socket.data.user.id,
                audioData,
                timestamp
            })

            // Publish event for real-time processing
            eventService.publishCallEvent("call.audio-stream", {
                callSid,
                userId: socket.data.user.id,
                audioData,
                timestamp
            })
        } catch (error) {
            logger.error("Error handling audio stream:", error)
            socket.emit("error", { message: "Failed to process audio stream" })
        }
    }

    private handleDisconnect(socket: Socket) {
        try {
            // Remove socket from all call rooms
            for (const [callSid, sockets] of this.callRooms.entries()) {
                if (sockets.has(socket.id)) {
                    sockets.delete(socket.id)
                    if (sockets.size === 0) {
                        this.callRooms.delete(callSid)
                    }
                    
                    // Notify others in the room
                    socket.to(callSid).emit("user-disconnected", {
                        userId: socket.data.user?.id,
                        socketId: socket.id
                    })
                }
            }
        } catch (error) {
            logger.error("Error handling disconnect:", error)
        }
    }

    private async sendCallStatus(callSid: string) {
        try {
            const status = await callService.getCallStatus(callSid)
            this.io.to(callSid).emit("call-status", status)
        } catch (error) {
            logger.error("Error sending call status:", error)
        }
    }

    public broadcastCallUpdate(callSid: string, update: any) {
        this.io.to(callSid).emit("call-update", update)
    }

    public broadcastCallEnd(callSid: string) {
        this.io.to(callSid).emit("call-ended")
        // Clean up the room
        this.callRooms.delete(callSid)
    }
}
