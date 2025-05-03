-- CreateTable
CREATE TABLE `Structure` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StructureAttributes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `structureId` INTEGER NOT NULL,
    `datatype` ENUM('TEXT', 'FLOAT', 'DATE', 'TIME', 'BOOLEAN') NOT NULL,
    `attributeName` VARCHAR(191) NOT NULL,
    `attributeValue` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StructureAttributes` ADD CONSTRAINT `StructureAttributes_structureId_fkey` FOREIGN KEY (`structureId`) REFERENCES `Structure`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
