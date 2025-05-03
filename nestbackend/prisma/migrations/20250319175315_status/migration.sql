/*
  Warnings:

  - You are about to alter the column `status` on the `StructureAttributes` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(24)`.

*/
-- AlterTable
ALTER TABLE `Structure` ADD COLUMN `status` VARCHAR(24) NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE `StructureAttributes` MODIFY `status` VARCHAR(24) NULL DEFAULT 'active';
