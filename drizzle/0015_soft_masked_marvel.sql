CREATE TABLE `notification_delivery_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notificationId` int NOT NULL,
	`channel` enum('in_app','email','sms','whatsapp') NOT NULL,
	`provider` varchar(80),
	`attemptNumber` int NOT NULL,
	`result` enum('sent','failed','retryable') NOT NULL,
	`providerMessageId` varchar(240),
	`providerStatus` varchar(80),
	`failureReason` text,
	`attemptedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_delivery_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_notification_delivery_attempt` UNIQUE(`notificationId`,`attemptNumber`)
);
--> statement-breakpoint
CREATE TABLE `notification_outbox` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventKey` varchar(240) NOT NULL,
	`eventType` varchar(120) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` int NOT NULL,
	`payload` json NOT NULL,
	`status` enum('queued','processing','processed','failed','retrying') NOT NULL DEFAULT 'queued',
	`attempts` int NOT NULL DEFAULT 0,
	`nextAttemptAt` timestamp,
	`lastError` text,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_outbox_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_notification_outbox_event_key` UNIQUE(`eventKey`)
);
--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`channel` enum('email','sms','whatsapp') NOT NULL,
	`category` enum('transactional','promotional','security','operational') NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_notification_preference_user_channel_category` UNIQUE(`userId`,`channel`,`category`)
);
--> statement-breakpoint
CREATE TABLE `notification_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(120) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`category` enum('transactional','promotional','security','operational') NOT NULL,
	`channel` enum('in_app','email','sms','whatsapp') NOT NULL,
	`titleTemplate` varchar(240) NOT NULL,
	`bodyTemplate` text NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_notification_template_code_version` UNIQUE(`code`,`version`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`recipientType` enum('customer','seller','courier','staff','admin') NOT NULL,
	`eventType` varchar(120) NOT NULL,
	`category` enum('transactional','promotional','security','operational') NOT NULL,
	`channel` enum('in_app','email','sms','whatsapp') NOT NULL,
	`status` enum('queued','processing','sent','failed','retrying') NOT NULL DEFAULT 'queued',
	`title` varchar(240) NOT NULL,
	`body` text NOT NULL,
	`templateCode` varchar(120) NOT NULL,
	`templateVersion` int NOT NULL DEFAULT 1,
	`relatedEntityType` varchar(80),
	`relatedEntityId` int,
	`navigationPath` varchar(240),
	`idempotencyKey` varchar(240) NOT NULL,
	`retryCount` int NOT NULL DEFAULT 0,
	`maxRetries` int NOT NULL DEFAULT 3,
	`nextAttemptAt` timestamp,
	`sentAt` timestamp,
	`readAt` timestamp,
	`failureReason` text,
	`providerMessageId` varchar(240),
	`providerStatus` varchar(80),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_notifications_idempotency` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `notification_delivery_attempts` ADD CONSTRAINT `fk_notification_delivery_attempt_notification` FOREIGN KEY (`notificationId`) REFERENCES `notifications`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD CONSTRAINT `fk_notification_preference_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `fk_notification_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_notification_delivery_attempts_notification` ON `notification_delivery_attempts` (`notificationId`,`attemptedAt`);--> statement-breakpoint
CREATE INDEX `idx_notification_outbox_status_retry` ON `notification_outbox` (`status`,`nextAttemptAt`);--> statement-breakpoint
CREATE INDEX `idx_notification_outbox_event_type` ON `notification_outbox` (`eventType`);--> statement-breakpoint
CREATE INDEX `idx_notification_preferences_user` ON `notification_preferences` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_notification_templates_active` ON `notification_templates` (`code`,`isActive`);--> statement-breakpoint
CREATE INDEX `idx_notifications_recipient_read_created` ON `notifications` (`userId`,`readAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_notifications_recipient_created` ON `notifications` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_notifications_status_next_attempt` ON `notifications` (`status`,`nextAttemptAt`);--> statement-breakpoint
CREATE INDEX `idx_notifications_event` ON `notifications` (`eventType`);--> statement-breakpoint
CREATE INDEX `idx_notifications_related_entity` ON `notifications` (`relatedEntityType`,`relatedEntityId`);--> statement-breakpoint
CREATE INDEX `idx_notifications_channel_status` ON `notifications` (`channel`,`status`);