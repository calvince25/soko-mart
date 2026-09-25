CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(128) NOT NULL,
	`entityType` varchar(96) NOT NULL,
	`entityId` varchar(128),
	`beforeState` json,
	`afterState` json,
	`reason` text,
	`requestId` varchar(96),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(160) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_permissions_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roleId` int NOT NULL,
	`permissionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_role_permissions_role_permission` UNIQUE(`roleId`,`permissionId`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`isSystem` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_roles_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`deviceLabel` varchar(160),
	`userAgent` varchar(512),
	`ipAddress` varchar(64),
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_sessions_token_hash` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`roleId` int NOT NULL,
	`assignedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_user_roles_user_role` UNIQUE(`userId`,`roleId`)
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_actor_created` ON `audit_logs` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_entity` ON `audit_logs` (`entityType`,`entityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_request` ON `audit_logs` (`requestId`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_action_created` ON `audit_logs` (`action`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_role_permissions_role` ON `role_permissions` (`roleId`);--> statement-breakpoint
CREATE INDEX `idx_role_permissions_permission` ON `role_permissions` (`permissionId`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_revoked_expires` ON `sessions` (`userId`,`revokedAt`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `idx_user_roles_user` ON `user_roles` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_user_roles_role` ON `user_roles` (`roleId`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);