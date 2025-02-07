import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    Index
} from "typeorm"
import { Call } from "./Call.entity"

export enum AgentType {
    AI = "ai",
    HUMAN = "human",
    HYBRID = "hybrid"
}

export enum AgentStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    TRAINING = "training",
    MAINTENANCE = "maintenance"
}

@Entity("agents")
@Index(["type", "status"])
export class Agent {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "varchar", length: 100 })
    name!: string

    @Column({ type: "enum", enum: AgentType })
    type!: AgentType

    @Column({ type: "enum", enum: AgentStatus, default: AgentStatus.ACTIVE })
    status!: AgentStatus

    @Column({ type: "text", nullable: true })
    description!: string

    @Column({ type: "json", nullable: true })
    capabilities!: string[]

    @Column({ type: "json", nullable: true })
    configuration!: Record<string, any>

    @Column({ type: "varchar", length: 100, nullable: true })
    voiceProfile!: string

    @Column({ type: "text", nullable: true })
    systemPrompt!: string

    @Column({ type: "integer", default: 0 })
    maxConcurrentCalls!: number

    @Column({ type: "integer", default: 0 })
    currentActiveCalls!: number

    @Column({ type: "integer", default: 0 })
    totalCalls!: number

    @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
    avgRating!: number

    @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
    avgCallDuration!: number

    @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
    successRate!: number

    @Column({ type: "timestamp", nullable: true })
    lastActiveAt!: Date

    @OneToMany(() => Call, (call) => call.agent)
    calls!: Call[]

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date
}
