import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index
} from "typeorm"

export enum KnowledgeType {
    FAQ = "faq",
    PROCEDURE = "procedure",
    PRODUCT_INFO = "product_info",
    POLICY = "policy",
    TROUBLESHOOTING = "troubleshooting"
}

export enum KnowledgeStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    PENDING_REVIEW = "pending_review",
    ARCHIVED = "archived"
}

@Entity("knowledge_base")
@Index(["type", "status"])
@Index(["category", "status"])
export class Knowledge {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "varchar", length: 255 })
    title!: string

    @Column({ type: "text" })
    content!: string

    @Column({ type: "enum", enum: KnowledgeType })
    type!: KnowledgeType

    @Column({
        type: "enum",
        enum: KnowledgeStatus,
        default: KnowledgeStatus.ACTIVE
    })
    status!: KnowledgeStatus

    @Column({ type: "varchar", length: 100, nullable: true })
    category!: string | null

    @Column("text", { array: true, default: () => "ARRAY[]::text[]" })
    tags!: string[]

    @Column("text", { array: true, default: () => "ARRAY[]::text[]" })
    keywords!: string[]

    @Column({ type: "int", default: 0 })
    usageCount!: number

    @Column({ type: "int", default: 0 })
    priority!: number

    @Column({
        type: "decimal",
        precision: 5,
        scale: 2,
        default: 0,
        transformer: {
            to: (value: number) => value,
            from: (value: string) => parseFloat(value)
        }
    })
    relevanceScore!: number

    @Column({ type: "varchar", length: 255, nullable: true })
    sourceUrl!: string | null

    @Column({ type: "varchar", length: 100, nullable: true })
    author!: string | null

    @Column({ type: "jsonb", nullable: true, default: () => "'{}'::jsonb" })
    metadata!: Record<string, any> | null

    @Column({ type: "varchar", length: 255, nullable: true })
    vectorId!: string | null

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date
}
