import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index
} from "typeorm"
import { Customer } from "./Customer.entity"
import { Agent } from "./Agent.entity"
import { CallSession } from "./CallSession.entity"

export enum CallStatus {
    INITIATED = "initiated",
    RINGING = "ringing",
    ANSWERED = "answered",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    FAILED = "failed",
    BUSY = "busy",
    NO_ANSWER = "no_answer"
}

export enum CallDirection {
    INBOUND = "inbound",
    OUTBOUND = "outbound"
}

export enum CallPriority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    URGENT = "urgent"
}

@Entity("calls")
@Index(["status", "createdAt"])
@Index(["customerId", "createdAt"])
@Index(["agentId", "createdAt"])
export class Call {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "varchar", length: 50, unique: true })
    callSid!: string

    @Column({ type: "enum", enum: CallDirection })
    direction!: CallDirection

    @Column({ type: "enum", enum: CallStatus, default: CallStatus.INITIATED })
    status!: CallStatus

    @Column({ type: "enum", enum: CallPriority, default: CallPriority.MEDIUM })
    priority!: CallPriority

    @Column({ type: "varchar", length: 20 })
    fromNumber!: string

    @Column({ type: "varchar", length: 20 })
    toNumber!: string

    @Column({ type: "integer", default: 0 })
    duration!: number // in seconds

    @Column({ type: "decimal", precision: 10, scale: 4, nullable: true })
    cost!: number

    @Column({ type: "text", nullable: true })
    transcript!: string

    @Column({ type: "text", nullable: true })
    summary!: string

    @Column({ type: "json", nullable: true })
    metadata!: Record<string, any>

    @Column({ type: "json", nullable: true })
    aiAnalysis!: Record<string, any>

    @Column({ type: "boolean", default: false })
    isResolved!: boolean

    @Column({ type: "integer", default: 0 })
    sentimentScore!: number // -100 to 100

    @Column({ type: "varchar", length: 50, nullable: true })
    category!: string

    @Column({ type: "text", array: true, default: [] })
    tags!: string[]

    @Column({ type: "uuid", nullable: true })
    customerId!: string

    @Column({ type: "uuid", nullable: true })
    agentId!: string

    @ManyToOne(() => Customer, (customer) => customer.calls)
    @JoinColumn({ name: "customerId" })
    customer!: Customer

    @ManyToOne(() => Agent, (agent) => agent.calls)
    @JoinColumn({ name: "agentId" })
    agent!: Agent

    @OneToMany(() => CallSession, (session) => session.call)
    sessions!: CallSession[]

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date
}
