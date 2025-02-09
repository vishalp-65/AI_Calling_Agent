import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index
} from "typeorm"
import { Call } from "./Call.entity"

export enum SessionStatus {
    ACTIVE = "active",
    COMPLETED = "completed",
    FAILED = "failed",
    TIMEOUT = "timeout"
}

export enum MessageType {
    USER = "user",
    AGENT = "agent",
    SYSTEM = "system"
}

@Entity("call_sessions")
@Index(["callId", "createdAt"])
@Index(["status", "createdAt"])
export class CallSession {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "uuid" })
    callId!: string

    @Column({
        type: "enum",
        enum: SessionStatus,
        default: SessionStatus.ACTIVE
    })
    status!: SessionStatus

    @Column({ type: "json", nullable: true })
    conversationHistory!: Array<{
        type: MessageType
        content: string
        timestamp: Date
        metadata?: Record<string, any>
    }>

    @Column({ type: "json", nullable: true })
    aiContext!: Record<string, any>

    @Column({ type: "json", nullable: true })
    sessionData!: Record<string, any>

    @Column({ type: "integer", default: 0 })
    messageCount!: number

    @Column({ type: "integer", default: 0 })
    duration!: number // in seconds

    @Column({ type: "timestamp", nullable: true })
    startedAt!: Date

    @Column({ type: "timestamp", nullable: true })
    endedAt!: Date

    @ManyToOne(() => Call, (call) => call.sessions)
    @JoinColumn({ name: "callId" })
    call!: Call

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date
}
