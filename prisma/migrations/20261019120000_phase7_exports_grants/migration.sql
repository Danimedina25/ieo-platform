-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('TEST_INVITATION_CREATED', 'TEST_INVITATION_REISSUED', 'TEST_INVITATION_CANCELLED', 'PARTICIPANT_TEST_SUBMITTED', 'INSTRUMENT_VERSION_LOADED', 'METHODOLOGY_PACKAGE_LOADED', 'ASSESSMENT_OPENED', 'ASSESSMENT_CLOSED', 'ASSESSMENT_REOPENED', 'EXCLUSION_RECORDED', 'EXCLUSION_REVOKED', 'INCIDENT_RECORDED', 'QUALITY_RECORDED', 'CHECKLIST_SAVED', 'ASSESSMENT_FROZEN', 'PROCESSING_SUCCEEDED', 'PROCESSING_FAILED', 'PATTERN_RECORDED', 'QUALITATIVE_REVIEWED', 'DISCLOSURE_RECORDED', 'QUALITATIVE_READ', 'GRANT_REQUESTED', 'GRANT_APPROVED', 'GRANT_REJECTED', 'GRANT_REVOKED', 'EXPORT_GENERATED', 'ORGANIZATION_CREATED', 'ASSESSMENT_CREATED', 'ASSESSMENT_UPDATED', 'PERSPECTIVE_UPDATED', 'SEGMENT_CREATED', 'SEGMENT_UPDATED', 'SEGMENT_DEACTIVATED', 'ADMIN_LOGIN', 'ADMIN_LOGOUT', 'LOGIN_FAILED', 'USER_DISABLED_SESSION_REJECTED') NOT NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `methodologyCustodian` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `SensitiveAccessGrant` (
    `id` CHAR(36) NOT NULL,
    `assessmentId` CHAR(36) NOT NULL,
    `scope` ENUM('RAW_RESPONSES', 'INDIVIDUAL_SCORES', 'QUALITATIVE_ORIGINAL') NOT NULL,
    `purpose` TEXT NOT NULL,
    `requestedById` CHAR(36) NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `decidedById` CHAR(36) NULL,
    `decidedAt` DATETIME(3) NULL,
    `approved` BOOLEAN NULL,
    `decisionNote` TEXT NULL,
    `revokedById` CHAR(36) NULL,
    `revokedAt` DATETIME(3) NULL,

    INDEX `SensitiveAccessGrant_assessmentId_scope_expiresAt_idx`(`assessmentId`, `scope`, `expiresAt`),
    INDEX `SensitiveAccessGrant_requestedById_idx`(`requestedById`),
    INDEX `SensitiveAccessGrant_decidedById_idx`(`decidedById`),
    INDEX `SensitiveAccessGrant_revokedById_idx`(`revokedById`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExportRecord` (
    `id` CHAR(36) NOT NULL,
    `assessmentId` CHAR(36) NOT NULL,
    `runId` CHAR(36) NOT NULL,
    `exportCode` ENUM('EXP01', 'EXP02', 'EXP03', 'EXP04') NOT NULL,
    `variant` ENUM('STANDARD', 'REPORT', 'TECHNICAL', 'FULL') NOT NULL,
    `grantId` CHAR(36) NULL,
    `requestedById` CHAR(36) NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL,
    `rowCount` INTEGER NOT NULL,
    `manifestHash` CHAR(64) NOT NULL,

    INDEX `ExportRecord_assessmentId_requestedAt_idx`(`assessmentId`, `requestedAt`),
    INDEX `ExportRecord_runId_idx`(`runId`),
    INDEX `ExportRecord_grantId_idx`(`grantId`),
    INDEX `ExportRecord_requestedById_idx`(`requestedById`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SensitiveAccessGrant` ADD CONSTRAINT `SensitiveAccessGrant_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SensitiveAccessGrant` ADD CONSTRAINT `SensitiveAccessGrant_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `SensitiveAccessGrant` ADD CONSTRAINT `SensitiveAccessGrant_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `SensitiveAccessGrant` ADD CONSTRAINT `SensitiveAccessGrant_revokedById_fkey` FOREIGN KEY (`revokedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ExportRecord` ADD CONSTRAINT `ExportRecord_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExportRecord` ADD CONSTRAINT `ExportRecord_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `ProcessingRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExportRecord` ADD CONSTRAINT `ExportRecord_grantId_fkey` FOREIGN KEY (`grantId`) REFERENCES `SensitiveAccessGrant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExportRecord` ADD CONSTRAINT `ExportRecord_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Phase 7 integrity rules not expressible in Prisma (GAP-011 provisional rule).
ALTER TABLE `SensitiveAccessGrant` ADD CONSTRAINT `SensitiveAccessGrant_rules_check` CHECK (
  CHAR_LENGTH(TRIM(`purpose`)) > 0
  AND `expiresAt` > `requestedAt`
  AND `expiresAt` <= `requestedAt` + INTERVAL 30 DAY
  AND ((`decidedAt` IS NULL AND `decidedById` IS NULL AND `approved` IS NULL) OR (`decidedAt` IS NOT NULL AND `decidedById` IS NOT NULL AND `approved` IS NOT NULL))
  AND (`decidedById` IS NULL OR `decidedById` <> `requestedById`)
  AND ((`revokedAt` IS NULL) = (`revokedById` IS NULL))
);
ALTER TABLE `ExportRecord` ADD CONSTRAINT `ExportRecord_rows_check` CHECK (`rowCount` >= 0);
