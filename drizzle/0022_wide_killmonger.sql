CREATE TABLE `finance_payout_controls` (
	`id` int NOT NULL,
	`paused` int NOT NULL DEFAULT 0,
	`reason` text,
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `finance_payout_controls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `finance_worker_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobKey` varchar(180) NOT NULL,
	`jobType` varchar(80) NOT NULL,
	`resourceId` int NOT NULL,
	`status` enum('queued','processing','completed','failed','retryable','reconciliation_required') NOT NULL DEFAULT 'queued',
	`attempts` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 5,
	`availableAt` timestamp NOT NULL DEFAULT (now()),
	`lockedAt` timestamp,
	`lockedBy` varchar(120),
	`lastError` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `finance_worker_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_finance_worker_job_key` UNIQUE(`jobKey`)
);
--> statement-breakpoint
CREATE TABLE `seller_payout_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payoutId` int NOT NULL,
	`attemptNumber` int NOT NULL,
	`requestReference` varchar(100) NOT NULL,
	`providerReference` varchar(160),
	`status` varchar(40) NOT NULL,
	`safeResponse` json,
	`startedAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seller_payout_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_seller_payout_attempt` UNIQUE(`payoutId`,`attemptNumber`)
);
--> statement-breakpoint
CREATE TABLE `seller_payout_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payoutId` int NOT NULL,
	`provider` varchar(40) NOT NULL,
	`providerEventId` varchar(180) NOT NULL,
	`providerReference` varchar(160),
	`normalizedStatus` varchar(40) NOT NULL,
	`processingStatus` enum('received','processed','ignored','rejected','reconciliation_required') NOT NULL DEFAULT 'received',
	`safePayload` json,
	`errorMessage` text,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `seller_payout_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_seller_payout_provider_event` UNIQUE(`provider`,`providerEventId`)
);
--> statement-breakpoint
CREATE TABLE `seller_payouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payoutReference` varchar(64) NOT NULL,
	`settlementId` int NOT NULL,
	`sellerId` int NOT NULL,
	`beneficiaryId` int NOT NULL,
	`beneficiarySnapshotMasked` varchar(40) NOT NULL,
	`beneficiarySnapshotFingerprint` varchar(128) NOT NULL,
	`beneficiarySnapshotEncrypted` text NOT NULL,
	`provider` varchar(40) NOT NULL,
	`amountMinor` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`status` enum('ready','queued','processing','submitted','pending_confirmation','confirmed','failed','reconciliation_required','cancelled') NOT NULL DEFAULT 'ready',
	`providerReference` varchar(160),
	`failureClass` enum('transient','permanent','ambiguous'),
	`failureReason` text,
	`attemptCount` int NOT NULL DEFAULT 0,
	`idempotencyKey` varchar(180) NOT NULL,
	`lastAttemptAt` timestamp,
	`submittedAt` timestamp,
	`confirmedAt` timestamp,
	`failedAt` timestamp,
	`lastReconciledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seller_payouts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_seller_payout_reference` UNIQUE(`payoutReference`),
	CONSTRAINT `uq_seller_payout_settlement` UNIQUE(`settlementId`),
	CONSTRAINT `uq_seller_payout_idempotency` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `seller_payout_beneficiaries` ADD `encryptedDestination` text;--> statement-breakpoint
ALTER TABLE `finance_payout_controls` ADD CONSTRAINT `fk_finance_payout_control_updater` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_payout_attempts` ADD CONSTRAINT `fk_seller_payout_attempt_payout` FOREIGN KEY (`payoutId`) REFERENCES `seller_payouts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_payout_events` ADD CONSTRAINT `fk_seller_payout_event_payout` FOREIGN KEY (`payoutId`) REFERENCES `seller_payouts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_payouts` ADD CONSTRAINT `fk_seller_payout_settlement` FOREIGN KEY (`settlementId`) REFERENCES `seller_settlements`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_payouts` ADD CONSTRAINT `fk_seller_payout_seller` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_payouts` ADD CONSTRAINT `fk_seller_payout_beneficiary` FOREIGN KEY (`beneficiaryId`) REFERENCES `seller_payout_beneficiaries`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_finance_worker_queue` ON `finance_worker_jobs` (`status`,`availableAt`);--> statement-breakpoint
CREATE INDEX `idx_seller_payout_seller_status` ON `seller_payouts` (`sellerId`,`status`,`createdAt`);