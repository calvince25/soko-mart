CREATE TABLE `finance_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountCode` varchar(80) NOT NULL,
	`accountType` enum('platform','seller','clearing','commission','receivable') NOT NULL,
	`sellerId` int,
	`currency` varchar(3) NOT NULL,
	`status` enum('active','suspended','closed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `finance_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_finance_account_code` UNIQUE(`accountCode`),
	CONSTRAINT `uq_finance_account_seller_currency` UNIQUE(`sellerId`,`currency`)
);
--> statement-breakpoint
CREATE TABLE `finance_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`sellerId` int NOT NULL,
	`amountMinor` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`reason` text NOT NULL,
	`reference` text NOT NULL,
	`createdByUserId` int NOT NULL,
	`idempotencyKey` varchar(180) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `finance_adjustments_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_finance_adjustment_idempotency` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `finance_commission_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int,
	`categoryId` int,
	`productId` int,
	`rateBasisPoints` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'KES',
	`priority` int NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`effectiveFrom` timestamp NOT NULL DEFAULT (now()),
	`effectiveTo` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `finance_commission_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `finance_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`accountId` int NOT NULL,
	`debitMinor` int NOT NULL DEFAULT 0,
	`creditMinor` int NOT NULL DEFAULT 0,
	`currency` varchar(3) NOT NULL,
	`lineType` varchar(80) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `finance_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `finance_holds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int NOT NULL,
	`amountMinor` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`reason` varchar(160) NOT NULL,
	`referenceType` varchar(80) NOT NULL,
	`referenceId` int NOT NULL,
	`status` enum('active','released','cancelled') NOT NULL DEFAULT 'active',
	`createdByUserId` int NOT NULL,
	`releasedByUserId` int,
	`releasedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `finance_holds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `finance_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`sellerOrderId` int,
	`orderItemId` int,
	`sellerId` int NOT NULL,
	`grossMinor` int NOT NULL,
	`commissionMinor` int NOT NULL,
	`sellerNetMinor` int NOT NULL,
	`rateBasisPoints` int NOT NULL,
	`ruleId` int,
	`currency` varchar(3) NOT NULL,
	`calculationVersion` varchar(40) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `finance_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_finance_snapshot_transaction_item` UNIQUE(`transactionId`,`orderItemId`)
);
--> statement-breakpoint
CREATE TABLE `finance_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionNumber` varchar(48) NOT NULL,
	`idempotencyKey` varchar(180) NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`referenceType` varchar(80) NOT NULL,
	`referenceId` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`description` text NOT NULL,
	`status` enum('draft','posted','reversed') NOT NULL DEFAULT 'draft',
	`postedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `finance_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_finance_transaction_number` UNIQUE(`transactionNumber`),
	CONSTRAINT `uq_finance_transaction_idempotency` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `seller_settlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settlementNumber` varchar(48) NOT NULL,
	`periodId` int NOT NULL,
	`sellerId` int NOT NULL,
	`grossMinor` int NOT NULL,
	`commissionMinor` int NOT NULL,
	`refundsMinor` int NOT NULL,
	`adjustmentsMinor` int NOT NULL,
	`holdsMinor` int NOT NULL,
	`netMinor` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`status` enum('draft','approved','processing','completed','failed','cancelled') NOT NULL DEFAULT 'draft',
	`idempotencyKey` varchar(180) NOT NULL,
	`approvedAt` timestamp,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seller_settlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_seller_settlement_number` UNIQUE(`settlementNumber`),
	CONSTRAINT `uq_seller_settlement_idempotency` UNIQUE(`idempotencyKey`),
	CONSTRAINT `uq_seller_settlement_seller_period` UNIQUE(`sellerId`,`periodId`)
);
--> statement-breakpoint
CREATE TABLE `settlement_periods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodNumber` varchar(40) NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`status` enum('open','calculating','review','approved','processing','completed','failed','cancelled') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `settlement_periods_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_settlement_period_number` UNIQUE(`periodNumber`)
);
--> statement-breakpoint
ALTER TABLE `finance_accounts` ADD CONSTRAINT `fk_finance_account_seller` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_adjustments` ADD CONSTRAINT `fk_finance_adjustment_transaction` FOREIGN KEY (`transactionId`) REFERENCES `finance_transactions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_adjustments` ADD CONSTRAINT `fk_finance_adjustment_seller` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_adjustments` ADD CONSTRAINT `fk_finance_adjustment_creator` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_commission_rules` ADD CONSTRAINT `fk_finance_commission_seller` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_commission_rules` ADD CONSTRAINT `fk_finance_commission_category` FOREIGN KEY (`categoryId`) REFERENCES `catalog_categories`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_commission_rules` ADD CONSTRAINT `fk_finance_commission_product` FOREIGN KEY (`productId`) REFERENCES `catalog_products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_entries` ADD CONSTRAINT `fk_finance_entry_transaction` FOREIGN KEY (`transactionId`) REFERENCES `finance_transactions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_entries` ADD CONSTRAINT `fk_finance_entry_account` FOREIGN KEY (`accountId`) REFERENCES `finance_accounts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_holds` ADD CONSTRAINT `fk_finance_hold_seller` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_holds` ADD CONSTRAINT `fk_finance_hold_creator` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_snapshots` ADD CONSTRAINT `fk_finance_snapshot_transaction` FOREIGN KEY (`transactionId`) REFERENCES `finance_transactions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_snapshots` ADD CONSTRAINT `fk_finance_snapshot_seller_order` FOREIGN KEY (`sellerOrderId`) REFERENCES `order_seller_orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_snapshots` ADD CONSTRAINT `fk_finance_snapshot_order_item` FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_snapshots` ADD CONSTRAINT `fk_finance_snapshot_seller` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `finance_snapshots` ADD CONSTRAINT `fk_finance_snapshot_rule` FOREIGN KEY (`ruleId`) REFERENCES `finance_commission_rules`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_settlements` ADD CONSTRAINT `fk_seller_settlement_period` FOREIGN KEY (`periodId`) REFERENCES `settlement_periods`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_settlements` ADD CONSTRAINT `fk_seller_settlement_seller` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_finance_account_seller` ON `finance_accounts` (`sellerId`);--> statement-breakpoint
CREATE INDEX `idx_finance_commission_lookup` ON `finance_commission_rules` (`sellerId`,`categoryId`,`productId`,`active`,`priority`);--> statement-breakpoint
CREATE INDEX `idx_finance_entry_transaction` ON `finance_entries` (`transactionId`);--> statement-breakpoint
CREATE INDEX `idx_finance_entry_account_created` ON `finance_entries` (`accountId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_finance_hold_seller_status` ON `finance_holds` (`sellerId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_finance_snapshot_seller` ON `finance_snapshots` (`sellerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_finance_transaction_reference` ON `finance_transactions` (`referenceType`,`referenceId`);--> statement-breakpoint
CREATE INDEX `idx_finance_transaction_status` ON `finance_transactions` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_settlement_period_status` ON `settlement_periods` (`status`,`endsAt`);