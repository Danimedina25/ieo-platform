-- AlterTable
ALTER TABLE `Assessment` ADD COLUMN `consultantUserId` CHAR(36) NULL,
    ADD COLUMN `coordinatorUserId` CHAR(36) NULL,
    ADD COLUMN `methodologyNotes` TEXT NULL,
    ADD COLUMN `objective` TEXT NULL,
    ADD COLUMN `plannedClosesAt` DATETIME(3) NULL,
    ADD COLUMN `plannedOpensAt` DATETIME(3) NULL,
    ADD COLUMN `scopeUnitsText` TEXT NULL,
    ADD COLUMN `sponsorName` VARCHAR(160) NULL,
    ADD COLUMN `timezone` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('ORGANIZATION_CREATED', 'ASSESSMENT_CREATED', 'ASSESSMENT_UPDATED', 'PERSPECTIVE_UPDATED', 'SEGMENT_CREATED', 'SEGMENT_UPDATED', 'SEGMENT_DEACTIVATED', 'ADMIN_LOGIN', 'ADMIN_LOGOUT', 'LOGIN_FAILED', 'USER_DISABLED_SESSION_REJECTED') NOT NULL;

-- CreateTable
CREATE TABLE `AssessmentPerspective` (
    `id` CHAR(36) NOT NULL,
    `assessmentId` CHAR(36) NOT NULL,
    `perspectiveCode` ENUM('DIR', 'ESP', 'LID', 'COL', 'CLI') NOT NULL,
    `applicability` ENUM('APPLICABLE', 'NOT_APPLICABLE', 'NOT_AVAILABLE') NULL,
    `populationEstimate` INTEGER NULL,
    `collectionMode` ENUM('CENSUS', 'SAMPLE') NULL,
    `notes` TEXT NULL,
    `cliUnitType` ENUM('B2B', 'B2C') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AssessmentPerspective_assessmentId_perspectiveCode_key`(`assessmentId`, `perspectiveCode`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Segment` (
    `id` CHAR(36) NOT NULL,
    `assessmentId` CHAR(36) NOT NULL,
    `dimension` VARCHAR(80) NOT NULL,
    `label` VARCHAR(160) NOT NULL,
    `reportabilityStatus` ENUM('PENDING', 'REPORTABLE', 'NOT_REPORTABLE') NOT NULL DEFAULT 'PENDING',
    `reason` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Segment_assessmentId_active_idx`(`assessmentId`, `active`),
    UNIQUE INDEX `Segment_assessmentId_dimension_label_key`(`assessmentId`, `dimension`, `label`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Assessment_consultantUserId_idx` ON `Assessment`(`consultantUserId`);

-- CreateIndex
CREATE INDEX `Assessment_coordinatorUserId_idx` ON `Assessment`(`coordinatorUserId`);

-- AddForeignKey
ALTER TABLE `Assessment` ADD CONSTRAINT `Assessment_consultantUserId_fkey` FOREIGN KEY (`consultantUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assessment` ADD CONSTRAINT `Assessment_coordinatorUserId_fkey` FOREIGN KEY (`coordinatorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssessmentPerspective` ADD CONSTRAINT `AssessmentPerspective_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Segment` ADD CONSTRAINT `Segment_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing Phase 1 assessments must also have the five technical capture rows.
INSERT INTO `AssessmentPerspective` (`id`, `assessmentId`, `perspectiveCode`, `applicability`, `populationEstimate`, `collectionMode`, `notes`, `cliUnitType`, `createdAt`, `updatedAt`)
SELECT UUID(), a.`id`, codes.`perspectiveCode`, NULL, NULL, NULL, NULL, NULL, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
FROM `Assessment` AS a
CROSS JOIN (
  SELECT 'DIR' AS `perspectiveCode` UNION ALL SELECT 'ESP' UNION ALL SELECT 'LID' UNION ALL SELECT 'COL' UNION ALL SELECT 'CLI'
) AS codes;

-- MySQL 8 CHECKs reinforce core data invariants independently of HTTP validation.
ALTER TABLE `Assessment` ADD CONSTRAINT `Assessment_planned_dates_check`
  CHECK (`plannedOpensAt` IS NULL OR `plannedClosesAt` IS NULL OR `plannedOpensAt` < `plannedClosesAt`);
ALTER TABLE `AssessmentPerspective` ADD CONSTRAINT `Perspective_population_check`
  CHECK (`populationEstimate` IS NULL OR `populationEstimate` >= 0);
ALTER TABLE `AssessmentPerspective` ADD CONSTRAINT `Perspective_cli_unit_check`
  CHECK (`perspectiveCode` = 'CLI' OR `cliUnitType` IS NULL);
ALTER TABLE `AssessmentPerspective` ADD CONSTRAINT `Perspective_plan_check`
  CHECK (`applicability` = 'APPLICABLE' OR (`populationEstimate` IS NULL AND `collectionMode` IS NULL));
