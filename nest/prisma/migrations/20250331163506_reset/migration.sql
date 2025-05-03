-- DropForeignKey
ALTER TABLE `ContentItem` DROP FOREIGN KEY `ContentItem_articleId_fkey`;

-- DropIndex
DROP INDEX `ContentItem_articleId_order_key` ON `ContentItem`;

-- AddForeignKey

