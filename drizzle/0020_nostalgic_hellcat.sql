CREATE TABLE `seller_payout_beneficiaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int NOT NULL,
	`provider` enum('mpesa') NOT NULL,
	`accountType` enum('mobile_money') NOT NULL,
	`maskedDestination` varchar(40) NOT NULL,
	`destinationFingerprint` varchar(128) NOT NULL,
	`displayLabel` varchar(120),
	`status` enum('DRAFT','PENDING_VERIFICATION','VERIFIED','SUSPENDED','DEACTIVATED','REJECTED') NOT NULL DEFAULT 'DRAFT',
	`isPrimary` int NOT NULL DEFAULT 0,
	`rejectionReason` text,
	`statusReason` text,
	`createdByUserId` int NOT NULL,
	`verifiedByUserId` int,
	`verifiedAt` timestamp,
	`deactivatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seller_payout_beneficiaries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seller_payout_beneficiary_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`beneficiaryId` int NOT NULL,
	`sellerId` int NOT NULL,
	`actorUserId` int,
	`eventType` varchar(100) NOT NULL,
	`previousStatus` varchar(40),
	`newStatus` varchar(40) NOT NULL,
	`isPrimary` int NOT NULL,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seller_payout_beneficiary_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `seller_payout_beneficiaries` ADD CONSTRAINT `fk_payout_beneficiary_seller` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_payout_beneficiaries` ADD CONSTRAINT `fk_payout_beneficiary_creator` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_payout_beneficiaries` ADD CONSTRAINT `fk_payout_beneficiary_verifier` FOREIGN KEY (`verifiedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_payout_beneficiary_events` ADD CONSTRAINT `fk_payout_beneficiary_event_beneficiary` FOREIGN KEY (`beneficiaryId`) REFERENCES `seller_payout_beneficiaries`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_payout_beneficiary_events` ADD CONSTRAINT `fk_payout_beneficiary_event_seller` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_payout_beneficiary_events` ADD CONSTRAINT `fk_payout_beneficiary_event_actor` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_payout_beneficiary_seller_status` ON `seller_payout_beneficiaries` (`sellerId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_payout_beneficiary_seller_primary` ON `seller_payout_beneficiaries` (`sellerId`,`isPrimary`);--> statement-breakpoint
CREATE INDEX `idx_payout_beneficiary_fingerprint` ON `seller_payout_beneficiaries` (`destinationFingerprint`);--> statement-breakpoint
CREATE INDEX `idx_payout_beneficiary_creator` ON `seller_payout_beneficiaries` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `idx_payout_beneficiary_event_history` ON `seller_payout_beneficiary_events` (`beneficiaryId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_payout_beneficiary_event_seller` ON `seller_payout_beneficiary_events` (`sellerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_payout_beneficiary_event_actor` ON `seller_payout_beneficiary_events` (`actorUserId`);