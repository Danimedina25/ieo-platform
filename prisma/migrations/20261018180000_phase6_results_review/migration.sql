-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('TEST_INVITATION_CREATED', 'TEST_INVITATION_REISSUED', 'TEST_INVITATION_CANCELLED', 'PARTICIPANT_TEST_SUBMITTED', 'INSTRUMENT_VERSION_LOADED', 'METHODOLOGY_PACKAGE_LOADED', 'ASSESSMENT_OPENED', 'ASSESSMENT_CLOSED', 'ASSESSMENT_REOPENED', 'EXCLUSION_RECORDED', 'EXCLUSION_REVOKED', 'INCIDENT_RECORDED', 'QUALITY_RECORDED', 'CHECKLIST_SAVED', 'ASSESSMENT_FROZEN', 'PROCESSING_SUCCEEDED', 'PROCESSING_FAILED', 'PATTERN_RECORDED', 'QUALITATIVE_REVIEWED', 'DISCLOSURE_RECORDED', 'ORGANIZATION_CREATED', 'ASSESSMENT_CREATED', 'ASSESSMENT_UPDATED', 'PERSPECTIVE_UPDATED', 'SEGMENT_CREATED', 'SEGMENT_UPDATED', 'SEGMENT_DEACTIVATED', 'ADMIN_LOGIN', 'ADMIN_LOGOUT', 'LOGIN_FAILED', 'USER_DISABLED_SESSION_REJECTED') NOT NULL;

-- CreateTable
CREATE TABLE `TriangulationPattern` (
    `id` CHAR(36) NOT NULL,
    `runId` CHAR(36) NOT NULL,
    `elementCode` ENUM('E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08') NOT NULL,
    `patternCode` ENUM('CONSISTENT_STRENGTH', 'CONSISTENT_EROSION', 'PERCEPTION_GAP', 'MIXED_RESULT', 'LIMITED_EVIDENCE') NOT NULL,
    `justification` TEXT NOT NULL,
    `recordedById` CHAR(36) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL,

    INDEX `TriangulationPattern_runId_elementCode_recordedAt_idx`(`runId`, `elementCode`, `recordedAt`),
    INDEX `TriangulationPattern_recordedById_idx`(`recordedById`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QualitativeReview` (
    `id` CHAR(36) NOT NULL,
    `runId` CHAR(36) NOT NULL,
    `surveyResponseId` CHAR(36) NOT NULL,
    `status` ENUM('REVIEW_PENDING', 'SAFE_FOR_REPORT', 'REDACTED', 'DO_NOT_QUOTE') NOT NULL,
    `redactedCiphertext` TEXT NULL,
    `reviewedById` CHAR(36) NOT NULL,
    `reviewedAt` DATETIME(3) NOT NULL,

    INDEX `QualitativeReview_runId_surveyResponseId_reviewedAt_idx`(`runId`, `surveyResponseId`, `reviewedAt`),
    INDEX `QualitativeReview_surveyResponseId_idx`(`surveyResponseId`),
    INDEX `QualitativeReview_reviewedById_idx`(`reviewedById`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DisclosureReview` (
    `id` CHAR(36) NOT NULL,
    `runId` CHAR(36) NOT NULL,
    `perspectiveCode` ENUM('DIR', 'ESP', 'LID', 'COL', 'CLI') NOT NULL,
    `decision` ENUM('REPORTABLE', 'NOT_REPORTABLE') NOT NULL,
    `reason` TEXT NOT NULL,
    `reviewedById` CHAR(36) NOT NULL,
    `reviewedAt` DATETIME(3) NOT NULL,

    INDEX `DisclosureReview_runId_perspectiveCode_reviewedAt_idx`(`runId`, `perspectiveCode`, `reviewedAt`),
    INDEX `DisclosureReview_reviewedById_idx`(`reviewedById`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TriangulationPattern` ADD CONSTRAINT `TriangulationPattern_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `ProcessingRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TriangulationPattern` ADD CONSTRAINT `TriangulationPattern_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QualitativeReview` ADD CONSTRAINT `QualitativeReview_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `ProcessingRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QualitativeReview` ADD CONSTRAINT `QualitativeReview_surveyResponseId_fkey` FOREIGN KEY (`surveyResponseId`) REFERENCES `SurveyResponse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QualitativeReview` ADD CONSTRAINT `QualitativeReview_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DisclosureReview` ADD CONSTRAINT `DisclosureReview_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `ProcessingRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DisclosureReview` ADD CONSTRAINT `DisclosureReview_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Phase 6 integrity rules not expressible in Prisma.
ALTER TABLE `TriangulationPattern` ADD CONSTRAINT `TriangulationPattern_justification_check` CHECK (CHAR_LENGTH(TRIM(`justification`)) > 0);
ALTER TABLE `QualitativeReview` ADD CONSTRAINT `QualitativeReview_redaction_check` CHECK ((`status` = 'REDACTED') = (`redactedCiphertext` IS NOT NULL));
ALTER TABLE `DisclosureReview` ADD CONSTRAINT `DisclosureReview_reason_check` CHECK (CHAR_LENGTH(TRIM(`reason`)) > 0);
