-- AlterTable
ALTER TABLE `Incident` ADD COLUMN `impactLevel` ENUM('LOW', 'MEDIUM', 'HIGH') NULL,
    ADD COLUMN `incidentType` ENUM('DUPLICATE_SUBMISSION', 'TEST_RESPONSE', 'OUT_OF_POPULATION', 'TECHNICAL_ERROR', 'PRESSURE_OR_MANIPULATION', 'WINDOW_OR_SCOPE_CHANGE', 'EMAIL_NOT_RECEIVED', 'OTHER') NOT NULL DEFAULT 'OTHER',
    MODIFY `impact` TEXT NULL;


-- Incidents registered from now on carry a structured impact level (Diccionario §33 impact_level);
-- rows created before this migration keep a NULL level and their free-text impact.
