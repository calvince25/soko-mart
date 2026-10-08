DROP INDEX `idx_payout_beneficiary_seller_primary` ON `seller_payout_beneficiaries`;--> statement-breakpoint
ALTER TABLE `seller_payout_beneficiaries` MODIFY COLUMN `isPrimary` int;--> statement-breakpoint
ALTER TABLE `seller_payout_beneficiaries` ADD CONSTRAINT `uq_payout_beneficiary_seller_primary` UNIQUE(`sellerId`,`isPrimary`);