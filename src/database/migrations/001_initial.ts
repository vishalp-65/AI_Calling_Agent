import { MigrationInterface, QueryRunner } from "typeorm"

export class Initial1640000000000 implements MigrationInterface {
    name = "Initial1640000000000"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "customers" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "firstName" character varying(100) NOT NULL,
                "lastName" character varying(100) NOT NULL,
                "email" character varying(255) NOT NULL,
                "phoneNumber" character varying(20) NOT NULL,
                "status" character varying NOT NULL DEFAULT 'active',
                "company" character varying(100),
                "jobTitle" character varying(100),
                "notes" text,
                "preferences" jsonb,
                "customFields" jsonb,
                "totalCalls" integer NOT NULL DEFAULT '0',
                "successfulCalls" integer NOT NULL DEFAULT '0',
                "avgSentiment" numeric(5,2) NOT NULL DEFAULT '0',
                "lastCallAt" TIMESTAMP,
                "tags" text array NOT NULL DEFAULT '{}',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_customers" PRIMARY KEY ("id")
            )
        `)

        await queryRunner.query(`
            CREATE TABLE "agents" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(100) NOT NULL,
                "type" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'active',
                "description" text,
                "capabilities" jsonb,
                "configuration" jsonb,
                "voiceProfile" character varying(100),
                "systemPrompt" text,
                "maxConcurrentCalls" integer NOT NULL DEFAULT '0',
                "currentActiveCalls" integer NOT NULL DEFAULT '0',
                "totalCalls" integer NOT NULL DEFAULT '0',
                "avgRating" numeric(5,2) NOT NULL DEFAULT '0',
                "avgCallDuration" numeric(5,2) NOT NULL DEFAULT '0',
                "successRate" numeric(5,2) NOT NULL DEFAULT '0',
                "lastActiveAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_agents" PRIMARY KEY ("id")
            )
        `)

        await queryRunner.query(`
            CREATE TABLE "calls" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "callSid" character varying(50) NOT NULL,
                "direction" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'initiated',
                "priority" character varying NOT NULL DEFAULT 'medium',
                "fromNumber" character varying(20) NOT NULL,
                "toNumber" character varying(20) NOT NULL,
                "duration" integer NOT NULL DEFAULT '0',
                "cost" numeric(10,4),
                "transcript" text,
                "summary" text,
                "metadata" jsonb,
                "aiAnalysis" jsonb,
                "isResolved" boolean NOT NULL DEFAULT false,
                "sentimentScore" integer NOT NULL DEFAULT '0',
                "category" character varying(50),
                "tags" text array NOT NULL DEFAULT '{}',
                "customerId" uuid,
                "agentId" uuid,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_calls" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_calls_callSid" UNIQUE ("callSid")
            )
        `)

        await queryRunner.query(`
            CREATE TABLE "knowledge_base" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "title" character varying(255) NOT NULL,
                "content" text NOT NULL,
                "type" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'active',
                "category" character varying(100),
                "tags" text array NOT NULL DEFAULT '{}',
                "keywords" text array NOT NULL DEFAULT '{}',
                "usageCount" integer NOT NULL DEFAULT '0',
                "priority" integer NOT NULL DEFAULT '0',
                "relevanceScore" numeric(5,2) NOT NULL DEFAULT '0',
                "sourceUrl" character varying(255),
                "author" character varying(100),
                "metadata" jsonb,
                "vectorId" character varying(255),
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_knowledge_base" PRIMARY KEY ("id")
            )
        `)

        await queryRunner.query(`
            CREATE TABLE "call_sessions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "callId" uuid NOT NULL,
                "status" character varying NOT NULL DEFAULT 'active',
                "conversationHistory" jsonb,
                "aiContext" jsonb,
                "sessionData" jsonb,
                "messageCount" integer NOT NULL DEFAULT '0',
                "duration" integer NOT NULL DEFAULT '0',
                "startedAt" TIMESTAMP,
                "endedAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_call_sessions" PRIMARY KEY ("id")
            )
        `)

        // Create indexes
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_customers_email" ON "customers" ("email")`)
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_customers_phoneNumber" ON "customers" ("phoneNumber")`)
        await queryRunner.query(`CREATE INDEX "IDX_agents_type_status" ON "agents" ("type", "status")`)
        await queryRunner.query(`CREATE INDEX "IDX_calls_status_createdAt" ON "calls" ("status", "createdAt")`)
        await queryRunner.query(`CREATE INDEX "IDX_calls_customerId_createdAt" ON "calls" ("customerId", "createdAt")`)
        await queryRunner.query(`CREATE INDEX "IDX_calls_agentId_createdAt" ON "calls" ("agentId", "createdAt")`)
        await queryRunner.query(`CREATE INDEX "IDX_knowledge_base_type_status" ON "knowledge_base" ("type", "status")`)
        await queryRunner.query(`CREATE INDEX "IDX_knowledge_base_category_status" ON "knowledge_base" ("category", "status")`)
        await queryRunner.query(`CREATE INDEX "IDX_call_sessions_callId_createdAt" ON "call_sessions" ("callId", "createdAt")`)
        await queryRunner.query(`CREATE INDEX "IDX_call_sessions_status_createdAt" ON "call_sessions" ("status", "createdAt")`)

        // Create foreign keys
        await queryRunner.query(`ALTER TABLE "calls" ADD CONSTRAINT "FK_calls_customerId" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
        await queryRunner.query(`ALTER TABLE "calls" ADD CONSTRAINT "FK_calls_agentId" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
        await queryRunner.query(`ALTER TABLE "call_sessions" ADD CONSTRAINT "FK_call_sessions_callId" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE NO ACTION`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "call_sessions" DROP CONSTRAINT "FK_call_sessions_callId"`)
        await queryRunner.query(`ALTER TABLE "calls" DROP CONSTRAINT "FK_calls_agentId"`)
        await queryRunner.query(`ALTER TABLE "calls" DROP CONSTRAINT "FK_calls_customerId"`)
        await queryRunner.query(`DROP INDEX "IDX_call_sessions_status_createdAt"`)
        await queryRunner.query(`DROP INDEX "IDX_call_sessions_callId_createdAt"`)
        await queryRunner.query(`DROP INDEX "IDX_knowledge_base_category_status"`)
        await queryRunner.query(`DROP INDEX "IDX_knowledge_base_type_status"`)
        await queryRunner.query(`DROP INDEX "IDX_calls_agentId_createdAt"`)
        await queryRunner.query(`DROP INDEX "IDX_calls_customerId_createdAt"`)
        await queryRunner.query(`DROP INDEX "IDX_calls_status_createdAt"`)
        await queryRunner.query(`DROP INDEX "IDX_agents_type_status"`)
        await queryRunner.query(`DROP INDEX "IDX_customers_phoneNumber"`)
        await queryRunner.query(`DROP INDEX "IDX_customers_email"`)
        await queryRunner.query(`DROP TABLE "call_sessions"`)
        await queryRunner.query(`DROP TABLE "knowledge_base"`)
        await queryRunner.query(`DROP TABLE "calls"`)
        await queryRunner.query(`DROP TABLE "agents"`)
        await queryRunner.query(`DROP TABLE "customers"`)
    }
}
