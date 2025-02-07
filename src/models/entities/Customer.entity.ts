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

export enum CustomerStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    BLOCKED = "blocked"
}

@Entity("customers")
@Index(["email"], { unique: true })
@Index(["phoneNumber"], { unique: true })
export class Customer {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "varchar", length: 100 })
    firstName!: string

    @Column({ type: "varchar", length: 100 })
    lastName!: string

    @Column({ type: "varchar", length: 255, unique: true })
    email!: string

    @Column({ type: "varchar", length: 20, unique: true })
    phoneNumber!: string

    @Column({
        type: "enum",
        enum: CustomerStatus,
        default: CustomerStatus.ACTIVE
    })
    status!: CustomerStatus

    @Column({ type: "varchar", length: 100, nullable: true })
    company!: string

    @Column({ type: "varchar", length: 100, nullable: true })
    jobTitle!: string

    @Column({ type: "text", nullable: true })
    notes!: string

    @Column({ type: "json", nullable: true })
    preferences!: Record<string, any>

    @Column({ type: "json", nullable: true })
    customFields!: Record<string, any>

    @Column({ type: "integer", default: 0 })
    totalCalls!: number

    @Column({ type: "integer", default: 0 })
    successfulCalls!: number

    @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
    avgSentiment!: number

    @Column({ type: "timestamp", nullable: true })
    lastCallAt!: Date

    @Column({ type: "text", array: true, default: [] })
    tags!: string[]

    @OneToMany(() => Call, (call) => call.customer)
    calls!: Call[]

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date
}
