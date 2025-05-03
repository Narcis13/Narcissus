-- CreateTable
CREATE TABLE `Article` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('PARAGRAPH', 'FILE', 'IMAGE') NOT NULL,
    `order` INTEGER NOT NULL,
    `html` VARCHAR(191) NULL,
    `url` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `src` VARCHAR(191) NULL,
    `alt` VARCHAR(191) NULL,
    `articleId` INTEGER NOT NULL,

    INDEX `ContentItem_articleId_idx`(`articleId`),
    UNIQUE INDEX `ContentItem_articleId_order_key`(`articleId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ContentItem` ADD CONSTRAINT `ContentItem_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
