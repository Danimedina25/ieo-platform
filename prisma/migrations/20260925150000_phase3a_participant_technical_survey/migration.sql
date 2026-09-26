-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('TEST_INVITATION_CREATED', 'TEST_INVITATION_REISSUED', 'TEST_INVITATION_CANCELLED', 'PARTICIPANT_TEST_SUBMITTED', 'ORGANIZATION_CREATED', 'ASSESSMENT_CREATED', 'ASSESSMENT_UPDATED', 'PERSPECTIVE_UPDATED', 'SEGMENT_CREATED', 'SEGMENT_UPDATED', 'SEGMENT_DEACTIVATED', 'ADMIN_LOGIN', 'ADMIN_LOGOUT', 'LOGIN_FAILED', 'USER_DISABLED_SESSION_REJECTED') NOT NULL;

-- CreateTable
CREATE TABLE `Invitation` (
    `id` CHAR(36) NOT NULL,
    `assessmentId` CHAR(36) NOT NULL,
    `assessmentPerspectiveId` CHAR(36) NOT NULL,
    `emailCiphertext` TEXT NOT NULL,
    `emailLookupHmac` CHAR(64) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `tokenGeneration` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('CREATED', 'SENT', 'VERIFIED', 'COMPLETED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'CREATED',
    `expiresAt` DATETIME(3) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `isTest` BOOLEAN NOT NULL DEFAULT true,
    `createdById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Invitation_tokenHash_key`(`tokenHash`),
    INDEX `Invitation_assessmentId_status_idx`(`assessmentId`, `status`),
    INDEX `Invitation_createdById_idx`(`createdById`),
    UNIQUE INDEX `Invitation_assessmentPerspectiveId_emailLookupHmac_key`(`assessmentPerspectiveId`, `emailLookupHmac`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccessChallenge` (
    `id` CHAR(36) NOT NULL,
    `invitationId` CHAR(36) NOT NULL,
    `tokenGeneration` INTEGER NOT NULL,
    `contextHash` CHAR(64) NOT NULL,
    `otpHmac` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `consumedAt` DATETIME(3) NULL,
    `invalidatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AccessChallenge_contextHash_key`(`contextHash`),
    INDEX `AccessChallenge_invitationId_createdAt_idx`(`invitationId`, `createdAt`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ParticipantAccessBinding` (
    `id` CHAR(36) NOT NULL,
    `invitationId` CHAR(36) NOT NULL,
    `responseSessionId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ParticipantAccessBinding_invitationId_key`(`invitationId`),
    UNIQUE INDEX `ParticipantAccessBinding_responseSessionId_key`(`responseSessionId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ParticipantAuthSession` (
    `id` CHAR(36) NOT NULL,
    `accessBindingId` CHAR(36) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `lastSeenAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ParticipantAuthSession_tokenHash_key`(`tokenHash`),
    INDEX `ParticipantAuthSession_accessBindingId_expiresAt_idx`(`accessBindingId`, `expiresAt`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResponseSession` (
    `id` CHAR(36) NOT NULL,
    `assessmentId` CHAR(36) NOT NULL,
    `assessmentPerspectiveId` CHAR(36) NOT NULL,
    `surveyCode` VARCHAR(64) NOT NULL,
    `surveyVersion` INTEGER NOT NULL,
    `status` ENUM('STARTED', 'SUBMITTED', 'INVALIDATED') NOT NULL DEFAULT 'STARTED',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `submittedAt` DATETIME(3) NULL,
    `introAcceptedAt` DATETIME(3) NULL,
    `introVersion` VARCHAR(40) NULL,
    `revision` INTEGER NOT NULL DEFAULT 0,
    `isTest` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ResponseSession_assessmentId_assessmentPerspectiveId_status_idx`(`assessmentId`, `assessmentPerspectiveId`, `status`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SurveyResponse` (
    `id` CHAR(36) NOT NULL,
    `responseSessionId` CHAR(36) NOT NULL,
    `itemKey` VARCHAR(64) NOT NULL,
    `itemType` ENUM('LIKERT', 'TEXT') NOT NULL,
    `answerState` ENUM('MISSING', 'VALUE', 'NA') NOT NULL,
    `numericValue` INTEGER NULL,
    `textCiphertext` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SurveyResponse_responseSessionId_itemKey_key`(`responseSessionId`, `itemKey`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `AssessmentPerspective_assessmentId_id_key` ON `AssessmentPerspective`(`assessmentId`, `id`);

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_assessmentId_assessmentPerspectiveId_fkey` FOREIGN KEY (`assessmentId`, `assessmentPerspectiveId`) REFERENCES `AssessmentPerspective`(`assessmentId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccessChallenge` ADD CONSTRAINT `AccessChallenge_invitationId_fkey` FOREIGN KEY (`invitationId`) REFERENCES `Invitation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParticipantAccessBinding` ADD CONSTRAINT `ParticipantAccessBinding_invitationId_fkey` FOREIGN KEY (`invitationId`) REFERENCES `Invitation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParticipantAccessBinding` ADD CONSTRAINT `ParticipantAccessBinding_responseSessionId_fkey` FOREIGN KEY (`responseSessionId`) REFERENCES `ResponseSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParticipantAuthSession` ADD CONSTRAINT `ParticipantAuthSession_accessBindingId_fkey` FOREIGN KEY (`accessBindingId`) REFERENCES `ParticipantAccessBinding`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResponseSession` ADD CONSTRAINT `ResponseSession_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResponseSession` ADD CONSTRAINT `ResponseSession_assessmentId_assessmentPerspectiveId_fkey` FOREIGN KEY (`assessmentId`, `assessmentPerspectiveId`) REFERENCES `AssessmentPerspective`(`assessmentId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyResponse` ADD CONSTRAINT `SurveyResponse_responseSessionId_fkey` FOREIGN KEY (`responseSessionId`) REFERENCES `ResponseSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforced local invariants for the technical-only vertical.
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_test_only_check` CHECK (`isTest` = 1 AND `tokenGeneration` >= 1);
ALTER TABLE `AccessChallenge` ADD CONSTRAINT `AccessChallenge_attempts_check` CHECK (`attempts` BETWEEN 0 AND 5 AND `tokenGeneration` >= 1);
ALTER TABLE `ResponseSession` ADD CONSTRAINT `ResponseSession_test_only_check` CHECK (`isTest` = 1 AND `revision` >= 0 AND (`status` <> 'SUBMITTED' OR `submittedAt` IS NOT NULL));
ALTER TABLE `SurveyResponse` ADD CONSTRAINT `SurveyResponse_answer_shape_check` CHECK (
  (`answerState` = 'MISSING' AND `numericValue` IS NULL AND `textCiphertext` IS NULL) OR
  (`answerState` = 'NA' AND `itemType` = 'LIKERT' AND `numericValue` IS NULL AND `textCiphertext` IS NULL) OR
  (`answerState` = 'VALUE' AND `itemType` = 'LIKERT' AND `numericValue` BETWEEN 1 AND 5 AND `textCiphertext` IS NULL) OR
  (`answerState` = 'VALUE' AND `itemType` = 'TEXT' AND `numericValue` IS NULL AND `textCiphertext` IS NOT NULL)
);
