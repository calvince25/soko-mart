CREATE TABLE `customer_addresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`recipientName` varchar(160) NOT NULL,
	`recipientPhone` varchar(32) NOT NULL,
	`label` enum('home','work','other') NOT NULL DEFAULT 'home',
	`country` varchar(80) NOT NULL,
	`county` varchar(100) NOT NULL,
	`town` varchar(100) NOT NULL,
	`neighborhood` varchar(160) NOT NULL,
	`estateBuilding` varchar(160),
	`apartmentHouse` varchar(120),
	`streetRoad` varchar(160),
	`directions` text,
	`postalCode` varchar(24),
	`latitude` varchar(32),
	`longitude` varchar(32),
	`isDefault` int NOT NULL DEFAULT 0,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_phones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`normalizedPhone` varchar(32) NOT NULL,
	`displayPhone` varchar(48) NOT NULL,
	`countryCode` varchar(2) NOT NULL DEFAULT 'KE',
	`verifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_phones_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_customer_phones_user` UNIQUE(`userId`),
	CONSTRAINT `uq_customer_phones_normalized` UNIQUE(`normalizedPhone`)
);
--> statement-breakpoint
CREATE TABLE `customer_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`firstName` varchar(80),
	`lastName` varchar(80),
	`displayName` varchar(160),
	`avatarUrl` varchar(1024),
	`dateOfBirth` timestamp,
	`preferredLanguage` varchar(16) NOT NULL DEFAULT 'en',
	`preferredCurrency` varchar(3) NOT NULL DEFAULT 'KES',
	`status` enum('active','suspended','closed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_customer_profiles_user` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `customer_addresses` ADD CONSTRAINT `customer_addresses_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_phones` ADD CONSTRAINT `customer_phones_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_profiles` ADD CONSTRAINT `customer_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_customer_addresses_user_status` ON `customer_addresses` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_customer_addresses_user_default` ON `customer_addresses` (`userId`,`isDefault`);--> statement-breakpoint
CREATE INDEX `idx_customer_addresses_country_county_town` ON `customer_addresses` (`country`,`county`,`town`);--> statement-breakpoint
CREATE INDEX `idx_customer_phones_verified` ON `customer_phones` (`verifiedAt`);--> statement-breakpoint
CREATE INDEX `idx_customer_profiles_status` ON `customer_profiles` (`status`);