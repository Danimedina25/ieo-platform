-- AlterTable
ALTER TABLE `Assessment` ADD COLUMN `methodologyPackageId` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('TEST_INVITATION_CREATED', 'TEST_INVITATION_REISSUED', 'TEST_INVITATION_CANCELLED', 'PARTICIPANT_TEST_SUBMITTED', 'INSTRUMENT_VERSION_LOADED', 'METHODOLOGY_PACKAGE_LOADED', 'ORGANIZATION_CREATED', 'ASSESSMENT_CREATED', 'ASSESSMENT_UPDATED', 'PERSPECTIVE_UPDATED', 'SEGMENT_CREATED', 'SEGMENT_UPDATED', 'SEGMENT_DEACTIVATED', 'ADMIN_LOGIN', 'ADMIN_LOGOUT', 'LOGIN_FAILED', 'USER_DISABLED_SESSION_REJECTED') NOT NULL;

-- CreateTable
CREATE TABLE `MethodologyPackage` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `version` VARCHAR(16) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MethodologyPackage_code_version_key`(`code`, `version`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PackageInstrument` (
    `packageId` CHAR(36) NOT NULL,
    `perspectiveCode` ENUM('DIR', 'ESP', 'LID', 'COL', 'CLI') NOT NULL,
    `instrumentVersionId` CHAR(36) NOT NULL,

    INDEX `PackageInstrument_instrumentVersionId_perspectiveCode_idx`(`instrumentVersionId`, `perspectiveCode`),
    PRIMARY KEY (`packageId`, `perspectiveCode`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Assessment_methodologyPackageId_idx` ON `Assessment`(`methodologyPackageId`);

-- CreateIndex
CREATE UNIQUE INDEX `InstrumentVersion_id_perspectiveCode_key` ON `InstrumentVersion`(`id`, `perspectiveCode`);

-- AddForeignKey
ALTER TABLE `Assessment` ADD CONSTRAINT `Assessment_methodologyPackageId_fkey` FOREIGN KEY (`methodologyPackageId`) REFERENCES `MethodologyPackage`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PackageInstrument` ADD CONSTRAINT `PackageInstrument_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `MethodologyPackage`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PackageInstrument` ADD CONSTRAINT `PackageInstrument_instrumentVersionId_perspectiveCode_fkey` FOREIGN KEY (`instrumentVersionId`, `perspectiveCode`) REFERENCES `InstrumentVersion`(`id`, `perspectiveCode`) ON DELETE RESTRICT ON UPDATE RESTRICT;

