-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('TEST_INVITATION_CREATED', 'TEST_INVITATION_REISSUED', 'TEST_INVITATION_CANCELLED', 'PARTICIPANT_TEST_SUBMITTED', 'INSTRUMENT_VERSION_LOADED', 'ORGANIZATION_CREATED', 'ASSESSMENT_CREATED', 'ASSESSMENT_UPDATED', 'PERSPECTIVE_UPDATED', 'SEGMENT_CREATED', 'SEGMENT_UPDATED', 'SEGMENT_DEACTIVATED', 'ADMIN_LOGIN', 'ADMIN_LOGOUT', 'LOGIN_FAILED', 'USER_DISABLED_SESSION_REJECTED') NOT NULL;

-- AlterTable
ALTER TABLE `ResponseSession` ADD COLUMN `instrumentVersionId` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `SurveyResponse` ADD COLUMN `instrumentVersionId` CHAR(36) NULL,
    ADD COLUMN `questionVersionId` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `InstrumentVersion` (
    `id` CHAR(36) NOT NULL,
    `instrumentCode` VARCHAR(32) NOT NULL,
    `version` VARCHAR(16) NOT NULL,
    `perspectiveCode` ENUM('DIR', 'ESP', 'LID', 'COL', 'CLI') NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `certified` BOOLEAN NOT NULL DEFAULT false,
    `contentHash` CHAR(64) NOT NULL,
    `sourcesJson` JSON NOT NULL,
    `correctionsJson` JSON NOT NULL,
    `introJson` JSON NOT NULL,
    `thanksText` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `InstrumentVersion_contentHash_key`(`contentHash`),
    UNIQUE INDEX `InstrumentVersion_instrumentCode_version_key`(`instrumentCode`, `version`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InstrumentScaleOption` (
    `instrumentVersionId` CHAR(36) NOT NULL,
    `valueCode` VARCHAR(4) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `displayOrder` INTEGER NOT NULL,

    UNIQUE INDEX `InstrumentScaleOption_instrumentVersionId_displayOrder_key`(`instrumentVersionId`, `displayOrder`),
    PRIMARY KEY (`instrumentVersionId`, `valueCode`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InstrumentSection` (
    `id` CHAR(36) NOT NULL,
    `instrumentVersionId` CHAR(36) NOT NULL,
    `elementCode` ENUM('E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08') NULL,
    `label` VARCHAR(40) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `introduction` TEXT NULL,
    `instructions` TEXT NULL,
    `displayOrder` INTEGER NOT NULL,

    UNIQUE INDEX `InstrumentSection_instrumentVersionId_displayOrder_key`(`instrumentVersionId`, `displayOrder`),
    UNIQUE INDEX `InstrumentSection_instrumentVersionId_id_key`(`instrumentVersionId`, `id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestionVersion` (
    `id` CHAR(36) NOT NULL,
    `instrumentVersionId` CHAR(36) NOT NULL,
    `sectionId` CHAR(36) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `kind` ENUM('QUANT', 'OPEN') NOT NULL,
    `elementCode` ENUM('E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08') NULL,
    `text` TEXT NOT NULL,
    `orientation` ENUM('DIRECT', 'REVERSE') NULL,
    `allowNA` BOOLEAN NOT NULL,
    `officialOrder` INTEGER NOT NULL,
    `orderInElement` INTEGER NULL,
    `displayOrder` INTEGER NOT NULL,
    `sourceGlobalId` INTEGER NULL,
    `sourceOfficialCode` VARCHAR(32) NULL,
    `sourceLocator` VARCHAR(120) NOT NULL,

    UNIQUE INDEX `QuestionVersion_instrumentVersionId_code_key`(`instrumentVersionId`, `code`),
    UNIQUE INDEX `QuestionVersion_instrumentVersionId_displayOrder_key`(`instrumentVersionId`, `displayOrder`),
    UNIQUE INDEX `QuestionVersion_instrumentVersionId_id_key`(`instrumentVersionId`, `id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ResponseSession_instrumentVersionId_idx` ON `ResponseSession`(`instrumentVersionId`);

-- CreateIndex
CREATE UNIQUE INDEX `ResponseSession_id_instrumentVersionId_key` ON `ResponseSession`(`id`, `instrumentVersionId`);

-- CreateIndex
CREATE INDEX `SurveyResponse_instrumentVersionId_questionVersionId_idx` ON `SurveyResponse`(`instrumentVersionId`, `questionVersionId`);

-- CreateIndex
CREATE UNIQUE INDEX `SurveyResponse_responseSessionId_questionVersionId_key` ON `SurveyResponse`(`responseSessionId`, `questionVersionId`);

-- AddForeignKey
ALTER TABLE `ResponseSession` ADD CONSTRAINT `ResponseSession_instrumentVersionId_fkey` FOREIGN KEY (`instrumentVersionId`) REFERENCES `InstrumentVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyResponse` ADD CONSTRAINT `SurveyResponse_session_instrument_fkey` FOREIGN KEY (`responseSessionId`, `instrumentVersionId`) REFERENCES `ResponseSession`(`id`, `instrumentVersionId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `SurveyResponse` ADD CONSTRAINT `SurveyResponse_instrumentVersionId_questionVersionId_fkey` FOREIGN KEY (`instrumentVersionId`, `questionVersionId`) REFERENCES `QuestionVersion`(`instrumentVersionId`, `id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `InstrumentScaleOption` ADD CONSTRAINT `InstrumentScaleOption_instrumentVersionId_fkey` FOREIGN KEY (`instrumentVersionId`) REFERENCES `InstrumentVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InstrumentSection` ADD CONSTRAINT `InstrumentSection_instrumentVersionId_fkey` FOREIGN KEY (`instrumentVersionId`) REFERENCES `InstrumentVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionVersion` ADD CONSTRAINT `QuestionVersion_instrumentVersionId_fkey` FOREIGN KEY (`instrumentVersionId`) REFERENCES `InstrumentVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionVersion` ADD CONSTRAINT `QuestionVersion_instrumentVersionId_sectionId_fkey` FOREIGN KEY (`instrumentVersionId`, `sectionId`) REFERENCES `InstrumentSection`(`instrumentVersionId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Phase 3B integrity rules not expressible in Prisma.
ALTER TABLE `InstrumentScaleOption` ADD CONSTRAINT `InstrumentScaleOption_value_check` CHECK (`valueCode` IN ('1', '2', '3', '4', '5', 'NA') AND `displayOrder` >= 1);
ALTER TABLE `InstrumentSection` ADD CONSTRAINT `InstrumentSection_order_check` CHECK (`displayOrder` >= 1);
ALTER TABLE `QuestionVersion` ADD CONSTRAINT `QuestionVersion_kind_shape_check` CHECK (
  `displayOrder` >= 1 AND `officialOrder` >= 1 AND (
    (`kind` = 'QUANT' AND `elementCode` IS NOT NULL AND `orientation` IS NOT NULL AND `orderInElement` >= 1)
    OR (`kind` = 'OPEN' AND `orientation` IS NULL AND `allowNA` = 0 AND `orderInElement` IS NULL)
  )
);
ALTER TABLE `SurveyResponse` ADD CONSTRAINT `SurveyResponse_catalog_pair_check` CHECK ((`instrumentVersionId` IS NULL) = (`questionVersionId` IS NULL));
