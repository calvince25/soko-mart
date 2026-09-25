CREATE TABLE `seller_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int NOT NULL,
	`applicationVersion` int NOT NULL DEFAULT 1,
	`businessRegistrationNumber` varchar(120),
	`taxIdentificationNumber` varchar(120),
	`legalRepresentativeName` varchar(160) NOT NULL,
	`status` enum('draft','submitted','under_review','approved','rejected','withdrawn') NOT NULL DEFAULT 'draft',
	`submittedAt` timestamp,
	`reviewedAt` timestamp,
	`reviewedByUserId` int,
	`rejectionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seller_applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_seller_applications_seller_version` UNIQUE(`sellerId`,`applicationVersion`)
);
--> statement-breakpoint
CREATE TABLE `seller_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int NOT NULL,
	`userId` int NOT NULL,
	`memberRole` enum('owner','manager','catalog_staff','fulfilment_staff','finance_staff') NOT NULL DEFAULT 'owner',
	`status` enum('active','invited','removed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seller_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_seller_members_seller_user` UNIQUE(`sellerId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `seller_slug_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int NOT NULL,
	`slug` varchar(180) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seller_slug_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_seller_slug_history_slug` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `seller_verification_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int NOT NULL,
	`applicationId` int NOT NULL,
	`documentType` varchar(80) NOT NULL,
	`storageKey` varchar(1024) NOT NULL,
	`originalFilename` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`fileSize` int NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`rejectionReason` text,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seller_verification_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sellers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`legalBusinessName` varchar(200) NOT NULL,
	`storeName` varchar(160) NOT NULL,
	`storeSlug` varchar(180) NOT NULL,
	`businessDescription` text,
	`businessType` varchar(80) NOT NULL,
	`country` varchar(80) NOT NULL,
	`county` varchar(100) NOT NULL,
	`town` varchar(100) NOT NULL,
	`businessAddress` text NOT NULL,
	`businessPhone` varchar(32) NOT NULL,
	`businessEmail` varchar(320) NOT NULL,
	`logoKey` varchar(1024),
	`bannerKey` varchar(1024),
	`status` enum('draft','pending_verification','under_review','approved','rejected','suspended','closed') NOT NULL DEFAULT 'draft',
	`verificationStatus` enum('not_started','pending','approved','rejected') NOT NULL DEFAULT 'not_started',
	`approvedAt` timestamp,
	`suspendedAt` timestamp,
	`rejectionReason` text,
	`suspensionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sellers_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_sellers_store_slug` UNIQUE(`storeSlug`)
);
--> statement-breakpoint
ALTER TABLE `seller_applications` ADD CONSTRAINT `seller_applications_sellerId_sellers_id_fk` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_applications` ADD CONSTRAINT `seller_applications_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_members` ADD CONSTRAINT `seller_members_sellerId_sellers_id_fk` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_members` ADD CONSTRAINT `seller_members_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_slug_history` ADD CONSTRAINT `seller_slug_history_sellerId_sellers_id_fk` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_verification_documents` ADD CONSTRAINT `seller_verification_documents_sellerId_sellers_id_fk` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_verification_documents` ADD CONSTRAINT `seller_documents_application_fk` FOREIGN KEY (`applicationId`) REFERENCES `seller_applications`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_verification_documents` ADD CONSTRAINT `seller_verification_documents_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_seller_applications_seller_status` ON `seller_applications` (`sellerId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_seller_applications_status_submitted` ON `seller_applications` (`status`,`submittedAt`);--> statement-breakpoint
CREATE INDEX `idx_seller_applications_reviewer` ON `seller_applications` (`reviewedByUserId`);--> statement-breakpoint
CREATE INDEX `idx_seller_members_user_status` ON `seller_members` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_seller_members_seller_role` ON `seller_members` (`sellerId`,`memberRole`);--> statement-breakpoint
CREATE INDEX `idx_seller_slug_history_seller_active` ON `seller_slug_history` (`sellerId`,`active`);--> statement-breakpoint
CREATE INDEX `idx_seller_documents_seller_status` ON `seller_verification_documents` (`sellerId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_seller_documents_application` ON `seller_verification_documents` (`applicationId`);--> statement-breakpoint
CREATE INDEX `idx_seller_documents_reviewer` ON `seller_verification_documents` (`reviewedByUserId`);--> statement-breakpoint
CREATE INDEX `idx_sellers_status_verification` ON `sellers` (`status`,`verificationStatus`);--> statement-breakpoint
CREATE INDEX `idx_sellers_country_county_town` ON `sellers` (`country`,`county`,`town`);
