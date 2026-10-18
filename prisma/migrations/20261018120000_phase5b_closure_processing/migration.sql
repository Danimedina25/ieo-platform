-- AlterTable
ALTER TABLE `Assessment` ADD COLUMN `closedAt` DATETIME(3) NULL,
    ADD COLUMN `currentRunId` CHAR(36) NULL,
    ADD COLUMN `openedAt` DATETIME(3) NULL,
    ADD COLUMN `revisionNumber` INTEGER NOT NULL DEFAULT 1,
    MODIFY `status` ENUM('DRAFT', 'OPEN', 'CLOSED', 'FROZEN', 'PROCESSED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('TEST_INVITATION_CREATED', 'TEST_INVITATION_REISSUED', 'TEST_INVITATION_CANCELLED', 'PARTICIPANT_TEST_SUBMITTED', 'INSTRUMENT_VERSION_LOADED', 'METHODOLOGY_PACKAGE_LOADED', 'ASSESSMENT_OPENED', 'ASSESSMENT_CLOSED', 'ASSESSMENT_REOPENED', 'EXCLUSION_RECORDED', 'EXCLUSION_REVOKED', 'INCIDENT_RECORDED', 'QUALITY_RECORDED', 'CHECKLIST_SAVED', 'ASSESSMENT_FROZEN', 'PROCESSING_SUCCEEDED', 'PROCESSING_FAILED', 'ORGANIZATION_CREATED', 'ASSESSMENT_CREATED', 'ASSESSMENT_UPDATED', 'PERSPECTIVE_UPDATED', 'SEGMENT_CREATED', 'SEGMENT_UPDATED', 'SEGMENT_DEACTIVATED', 'ADMIN_LOGIN', 'ADMIN_LOGOUT', 'LOGIN_FAILED', 'USER_DISABLED_SESSION_REJECTED') NOT NULL;

-- CreateTable
CREATE TABLE `ClosureRecord` (
    `id` CHAR(36) NOT NULL,
    `assessmentId` CHAR(36) NOT NULL,
    `revisionNumber` INTEGER NOT NULL,
    `checklistJson` JSON NULL,
    `actaJson` JSON NULL,
    `actaHash` CHAR(64) NULL,
    `authorizedById` CHAR(36) NULL,
    `authorizedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClosureRecord_authorizedById_idx`(`authorizedById`),
    UNIQUE INDEX `ClosureRecord_assessmentId_revisionNumber_key`(`assessmentId`, `revisionNumber`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QualityAssessment` (
    `id` CHAR(36) NOT NULL,
    `assessmentId` CHAR(36) NOT NULL,
    `revisionNumber` INTEGER NOT NULL,
    `scopeKey` VARCHAR(16) NOT NULL,
    `perspectiveCode` ENUM('DIR', 'ESP', 'LID', 'COL', 'CLI') NULL,
    `elementCode` ENUM('E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08') NULL,
    `verdict` ENUM('A', 'B', 'C') NOT NULL,
    `reservations` TEXT NULL,
    `reviewedById` CHAR(36) NOT NULL,
    `reviewedAt` DATETIME(3) NOT NULL,

    INDEX `QualityAssessment_reviewedById_idx`(`reviewedById`),
    UNIQUE INDEX `QualityAssessment_assessmentId_revisionNumber_scopeKey_key`(`assessmentId`, `revisionNumber`, `scopeKey`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Exclusion` (
    `id` CHAR(36) NOT NULL,
    `assessmentId` CHAR(36) NOT NULL,
    `revisionNumber` INTEGER NOT NULL,
    `responseSessionId` CHAR(36) NOT NULL,
    `reasonCode` ENUM('DUPLICATE', 'TEST_RESPONSE', 'OUT_OF_POPULATION', 'TECHNICAL_INCIDENT', 'REPORTED_MANIPULATION') NOT NULL,
    `description` TEXT NOT NULL,
    `authorizedById` CHAR(36) NOT NULL,
    `authorizedAt` DATETIME(3) NOT NULL,
    `revokedById` CHAR(36) NULL,
    `revokedAt` DATETIME(3) NULL,

    INDEX `Exclusion_authorizedById_idx`(`authorizedById`),
    INDEX `Exclusion_revokedById_idx`(`revokedById`),
    UNIQUE INDEX `Exclusion_assessmentId_revisionNumber_responseSessionId_key`(`assessmentId`, `revisionNumber`, `responseSessionId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Incident` (
    `id` CHAR(36) NOT NULL,
    `assessmentId` CHAR(36) NOT NULL,
    `revisionNumber` INTEGER NOT NULL,
    `occurredOn` DATE NOT NULL,
    `perspectiveCode` ENUM('DIR', 'ESP', 'LID', 'COL', 'CLI') NULL,
    `description` TEXT NOT NULL,
    `impact` TEXT NOT NULL,
    `action` TEXT NOT NULL,
    `responsible` VARCHAR(160) NOT NULL,
    `createdById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Incident_assessmentId_revisionNumber_idx`(`assessmentId`, `revisionNumber`),
    INDEX `Incident_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FrozenSnapshot` (
    `id` CHAR(36) NOT NULL,
    `assessmentId` CHAR(36) NOT NULL,
    `revisionNumber` INTEGER NOT NULL,
    `closureRecordId` CHAR(36) NOT NULL,
    `schemaVersion` INTEGER NOT NULL,
    `payloadJson` JSON NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `frozenById` CHAR(36) NOT NULL,
    `frozenAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FrozenSnapshot_closureRecordId_key`(`closureRecordId`),
    INDEX `FrozenSnapshot_frozenById_idx`(`frozenById`),
    UNIQUE INDEX `FrozenSnapshot_assessmentId_revisionNumber_key`(`assessmentId`, `revisionNumber`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcessingRun` (
    `id` CHAR(36) NOT NULL,
    `assessmentId` CHAR(36) NOT NULL,
    `snapshotId` CHAR(36) NOT NULL,
    `engineVersion` VARCHAR(16) NOT NULL,
    `status` ENUM('SUCCEEDED', 'FAILED') NOT NULL,
    `publishable` BOOLEAN NOT NULL DEFAULT false,
    `inputHash` CHAR(64) NULL,
    `outputHash` CHAR(64) NULL,
    `outputJson` JSON NULL,
    `errorMessage` VARCHAR(500) NULL,
    `requestedById` CHAR(36) NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL,
    `finishedAt` DATETIME(3) NOT NULL,

    INDEX `ProcessingRun_assessmentId_requestedAt_idx`(`assessmentId`, `requestedAt`),
    INDEX `ProcessingRun_snapshotId_idx`(`snapshotId`),
    INDEX `ProcessingRun_requestedById_idx`(`requestedById`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PerspectiveElementResult` (
    `runId` CHAR(36) NOT NULL,
    `perspectiveCode` ENUM('DIR', 'ESP', 'LID', 'COL', 'CLI') NOT NULL,
    `elementCode` ENUM('E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08') NOT NULL,
    `status` VARCHAR(8) NOT NULL,
    `reason` VARCHAR(32) NULL,
    `validPiCount` INTEGER NOT NULL,
    `rpExact` VARCHAR(200) NULL,
    `rpDecimal` DECIMAL(30, 18) NULL,

    PRIMARY KEY (`runId`, `perspectiveCode`, `elementCode`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ElementResult` (
    `runId` CHAR(36) NOT NULL,
    `elementCode` ENUM('E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08') NOT NULL,
    `riStatus` VARCHAR(12) NOT NULL,
    `riExact` VARCHAR(200) NULL,
    `riDecimal` DECIMAL(30, 18) NULL,
    `validPerspectiveCount` INTEGER NOT NULL,
    `perspectivesJson` JSON NOT NULL,
    `btStatus` VARCHAR(16) NOT NULL,
    `btExact` VARCHAR(200) NULL,
    `btDecimal` DECIMAL(30, 18) NULL,
    `btDisplay` INTEGER NULL,
    `btClass` VARCHAR(24) NULL,
    `maxPerspectivesJson` JSON NOT NULL,
    `minPerspectivesJson` JSON NOT NULL,

    PRIMARY KEY (`runId`, `elementCode`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PerspectiveIndexResult` (
    `runId` CHAR(36) NOT NULL,
    `perspectiveCode` ENUM('DIR', 'ESP', 'LID', 'COL', 'CLI') NOT NULL,
    `status` VARCHAR(8) NOT NULL,
    `validElementCount` INTEGER NOT NULL,
    `valueExact` VARCHAR(200) NULL,
    `valueDecimal` DECIMAL(30, 18) NULL,
    `displayScore` INTEGER NULL,
    `healthLevel` INTEGER NULL,
    `trafficLight` VARCHAR(16) NULL,

    PRIMARY KEY (`runId`, `perspectiveCode`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GlobalResult` (
    `runId` CHAR(36) NOT NULL,
    `status` VARCHAR(8) NOT NULL,
    `reason` VARCHAR(32) NULL,
    `valueExact` VARCHAR(200) NULL,
    `valueDecimal` DECIMAL(30, 18) NULL,
    `displayScore` INTEGER NULL,
    `healthLevel` INTEGER NULL,
    `healthLabel` VARCHAR(40) NULL,
    `trafficLight` VARCHAR(16) NULL,
    `integratedElementCount` INTEGER NOT NULL,
    `limitedElementsJson` JSON NOT NULL,

    PRIMARY KEY (`runId`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Assessment_currentRunId_key` ON `Assessment`(`currentRunId`);

-- CreateIndex
CREATE UNIQUE INDEX `ResponseSession_assessmentId_id_key` ON `ResponseSession`(`assessmentId`, `id`);

-- AddForeignKey
ALTER TABLE `Assessment` ADD CONSTRAINT `Assessment_currentRunId_fkey` FOREIGN KEY (`currentRunId`) REFERENCES `ProcessingRun`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ClosureRecord` ADD CONSTRAINT `ClosureRecord_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClosureRecord` ADD CONSTRAINT `ClosureRecord_authorizedById_fkey` FOREIGN KEY (`authorizedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `QualityAssessment` ADD CONSTRAINT `QualityAssessment_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QualityAssessment` ADD CONSTRAINT `QualityAssessment_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Exclusion` ADD CONSTRAINT `Exclusion_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Exclusion` ADD CONSTRAINT `Exclusion_assessmentId_responseSessionId_fkey` FOREIGN KEY (`assessmentId`, `responseSessionId`) REFERENCES `ResponseSession`(`assessmentId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Exclusion` ADD CONSTRAINT `Exclusion_authorizedById_fkey` FOREIGN KEY (`authorizedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Exclusion` ADD CONSTRAINT `Exclusion_revokedById_fkey` FOREIGN KEY (`revokedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Incident` ADD CONSTRAINT `Incident_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Incident` ADD CONSTRAINT `Incident_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FrozenSnapshot` ADD CONSTRAINT `FrozenSnapshot_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FrozenSnapshot` ADD CONSTRAINT `FrozenSnapshot_closureRecordId_fkey` FOREIGN KEY (`closureRecordId`) REFERENCES `ClosureRecord`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FrozenSnapshot` ADD CONSTRAINT `FrozenSnapshot_frozenById_fkey` FOREIGN KEY (`frozenById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcessingRun` ADD CONSTRAINT `ProcessingRun_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcessingRun` ADD CONSTRAINT `ProcessingRun_snapshotId_fkey` FOREIGN KEY (`snapshotId`) REFERENCES `FrozenSnapshot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcessingRun` ADD CONSTRAINT `ProcessingRun_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PerspectiveElementResult` ADD CONSTRAINT `PerspectiveElementResult_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `ProcessingRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ElementResult` ADD CONSTRAINT `ElementResult_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `ProcessingRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PerspectiveIndexResult` ADD CONSTRAINT `PerspectiveIndexResult_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `ProcessingRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GlobalResult` ADD CONSTRAINT `GlobalResult_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `ProcessingRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Phase 5B integrity rules not expressible in Prisma.
ALTER TABLE `Assessment` ADD CONSTRAINT `Assessment_revision_check` CHECK (`revisionNumber` >= 1);
ALTER TABLE `QualityAssessment` ADD CONSTRAINT `QualityAssessment_scope_check` CHECK (
  `revisionNumber` >= 1 AND (
    (`scopeKey` = 'GLOBAL' AND `perspectiveCode` IS NULL AND `elementCode` IS NULL)
    OR (`perspectiveCode` IS NOT NULL AND `elementCode` IS NULL AND `scopeKey` = CONCAT('P:', `perspectiveCode`))
    OR (`perspectiveCode` IS NOT NULL AND `elementCode` IS NOT NULL AND `scopeKey` = CONCAT('P:', `perspectiveCode`, ':', `elementCode`))
  ) AND (`verdict` = 'A' OR `reservations` IS NOT NULL)
);
ALTER TABLE `Exclusion` ADD CONSTRAINT `Exclusion_revocation_check` CHECK (`revisionNumber` >= 1 AND (`revokedAt` IS NULL) = (`revokedById` IS NULL));
ALTER TABLE `ClosureRecord` ADD CONSTRAINT `ClosureRecord_authorization_check` CHECK (`revisionNumber` >= 1 AND ((`authorizedAt` IS NULL AND `authorizedById` IS NULL AND `actaHash` IS NULL) OR (`authorizedAt` IS NOT NULL AND `authorizedById` IS NOT NULL AND `actaHash` IS NOT NULL AND `actaJson` IS NOT NULL AND `checklistJson` IS NOT NULL)));
ALTER TABLE `FrozenSnapshot` ADD CONSTRAINT `FrozenSnapshot_revision_check` CHECK (`revisionNumber` >= 1 AND `schemaVersion` >= 1);
ALTER TABLE `ProcessingRun` ADD CONSTRAINT `ProcessingRun_outcome_check` CHECK (
  (`status` = 'SUCCEEDED' AND `outputHash` IS NOT NULL AND `inputHash` IS NOT NULL AND `outputJson` IS NOT NULL AND `errorMessage` IS NULL)
  OR (`status` = 'FAILED' AND `outputHash` IS NULL AND `outputJson` IS NULL AND `publishable` = 0 AND `errorMessage` IS NOT NULL)
);
ALTER TABLE `PerspectiveElementResult` ADD CONSTRAINT `PerspectiveElementResult_value_check` CHECK (
  `validPiCount` >= 0 AND ((`status` = 'VALID' AND `rpDecimal` BETWEEN 0 AND 100 AND `rpExact` IS NOT NULL) OR (`status` IN ('ND', 'NP') AND `rpDecimal` IS NULL AND `rpExact` IS NULL))
);
ALTER TABLE `ElementResult` ADD CONSTRAINT `ElementResult_value_check` CHECK (
  `validPerspectiveCount` BETWEEN 0 AND 5
  AND ((`riStatus` = 'ND' AND `riDecimal` IS NULL) OR (`riStatus` IN ('INTEGRATED', 'LIMITED') AND `riDecimal` BETWEEN 0 AND 100))
  AND ((`btStatus` = 'NOT_CALCULABLE' AND `btDecimal` IS NULL AND `btDisplay` IS NULL) OR (`btStatus` IN ('PARTIAL', 'INTEGRATED') AND `btDecimal` BETWEEN 0 AND 100 AND `btDisplay` BETWEEN 0 AND 100))
);
ALTER TABLE `PerspectiveIndexResult` ADD CONSTRAINT `PerspectiveIndexResult_value_check` CHECK (
  (`status` = 'COMPLETE' AND `valueDecimal` BETWEEN 0 AND 100 AND `displayScore` BETWEEN 0 AND 100) OR (`status` IN ('ND', 'NP') AND `valueDecimal` IS NULL AND `displayScore` IS NULL)
);
ALTER TABLE `GlobalResult` ADD CONSTRAINT `GlobalResult_value_check` CHECK (
  `integratedElementCount` BETWEEN 0 AND 8
  AND ((`status` IN ('COMPLETE', 'LIMITED') AND `valueDecimal` BETWEEN 0 AND 100 AND `displayScore` BETWEEN 0 AND 100 AND `healthLevel` BETWEEN 1 AND 7)
    OR (`status` = 'ND' AND `valueDecimal` IS NULL AND `displayScore` IS NULL AND `healthLevel` IS NULL))
);
