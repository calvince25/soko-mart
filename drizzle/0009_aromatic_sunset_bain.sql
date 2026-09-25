CREATE TABLE `payment_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`checkoutSessionId` int NOT NULL,
	`provider` enum('mpesa','card','other') NOT NULL,
	`providerReference` varchar(160),
	`internalReference` varchar(160) NOT NULL,
	`idempotencyKey` varchar(160),
	`amountMinor` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`status` enum('created','pending','processing','successful','failed','cancelled','expired','refunded','partially_refunded') NOT NULL DEFAULT 'created',
	`phone` varchar(32),
	`failureCode` varchar(80),
	`failureMessage` text,
	`metadata` json,
	`expiresAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_payment_attempts_provider_reference` UNIQUE(`provider`,`providerReference`),
	CONSTRAINT `uq_payment_attempts_internal_reference` UNIQUE(`internalReference`),
	CONSTRAINT `uq_payment_attempts_user_idempotency` UNIQUE(`userId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `payment_callback_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('mpesa','card','other') NOT NULL,
	`providerEventId` varchar(200) NOT NULL,
	`paymentAttemptId` int,
	`payload` json,
	`status` enum('received','processed','ignored','failed') NOT NULL DEFAULT 'received',
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_callback_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_payment_callback_provider_event` UNIQUE(`provider`,`providerEventId`)
);
--> statement-breakpoint
CREATE TABLE `payment_reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paymentAttemptId` int NOT NULL,
	`inventoryReservationId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_reservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_payment_reservation_inventory` UNIQUE(`inventoryReservationId`)
);
--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD CONSTRAINT `fk_payment_attempt_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD CONSTRAINT `fk_payment_attempt_checkout` FOREIGN KEY (`checkoutSessionId`) REFERENCES `checkout_sessions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_callback_events` ADD CONSTRAINT `fk_payment_callback_attempt` FOREIGN KEY (`paymentAttemptId`) REFERENCES `payment_attempts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_reservations` ADD CONSTRAINT `fk_payment_reservation_attempt` FOREIGN KEY (`paymentAttemptId`) REFERENCES `payment_attempts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_reservations` ADD CONSTRAINT `fk_payment_reservation_inventory` FOREIGN KEY (`inventoryReservationId`) REFERENCES `inventory_reservations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_payment_attempts_user_created` ON `payment_attempts` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_payment_attempts_checkout_status` ON `payment_attempts` (`checkoutSessionId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_payment_callback_payment` ON `payment_callback_events` (`paymentAttemptId`);--> statement-breakpoint
CREATE INDEX `idx_payment_reservation_payment` ON `payment_reservations` (`paymentAttemptId`);