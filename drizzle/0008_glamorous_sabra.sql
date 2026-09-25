CREATE TABLE `checkout_session_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`sellerId` int NOT NULL,
	`sellerName` varchar(160) NOT NULL,
	`subtotalMinor` int NOT NULL,
	`shippingMinor` int NOT NULL,
	`feeMinor` int NOT NULL,
	`taxMinor` int NOT NULL,
	`totalMinor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `checkout_session_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_checkout_session_group_seller` UNIQUE(`sessionId`,`sellerId`)
);
--> statement-breakpoint
CREATE TABLE `checkout_session_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`sellerId` int NOT NULL,
	`productId` int NOT NULL,
	`variantId` int NOT NULL,
	`productName` varchar(240) NOT NULL,
	`variantName` varchar(180) NOT NULL,
	`sku` varchar(120) NOT NULL,
	`sellerName` varchar(160) NOT NULL,
	`quantity` int NOT NULL,
	`unitPriceMinor` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`lineSubtotalMinor` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `checkout_session_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checkout_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cartId` int NOT NULL,
	`status` enum('active','validated','ready_for_payment','expired','cancelled','completed') NOT NULL DEFAULT 'active',
	`currency` varchar(3) NOT NULL,
	`shippingMethod` varchar(48) NOT NULL,
	`addressId` int,
	`addressSnapshot` json,
	`subtotalMinor` int NOT NULL,
	`shippingMinor` int NOT NULL,
	`feeMinor` int NOT NULL,
	`taxMinor` int NOT NULL,
	`totalMinor` int NOT NULL,
	`issues` json,
	`idempotencyKey` varchar(160),
	`expiresAt` timestamp NOT NULL,
	`validatedAt` timestamp,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checkout_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_checkout_sessions_user_idempotency` UNIQUE(`userId`,`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `checkout_session_groups` ADD CONSTRAINT `checkout_session_groups_sessionId_checkout_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `checkout_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_session_groups` ADD CONSTRAINT `checkout_session_groups_sellerId_sellers_id_fk` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_session_items` ADD CONSTRAINT `checkout_session_items_sessionId_checkout_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `checkout_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_session_items` ADD CONSTRAINT `checkout_session_items_sellerId_sellers_id_fk` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_session_items` ADD CONSTRAINT `checkout_session_items_productId_catalog_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `catalog_products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_session_items` ADD CONSTRAINT `checkout_session_items_variantId_catalog_product_variants_id_fk` FOREIGN KEY (`variantId`) REFERENCES `catalog_product_variants`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_sessions` ADD CONSTRAINT `checkout_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_sessions` ADD CONSTRAINT `checkout_sessions_cartId_commerce_carts_id_fk` FOREIGN KEY (`cartId`) REFERENCES `commerce_carts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_sessions` ADD CONSTRAINT `checkout_sessions_addressId_customer_addresses_id_fk` FOREIGN KEY (`addressId`) REFERENCES `customer_addresses`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_checkout_session_groups_session` ON `checkout_session_groups` (`sessionId`);--> statement-breakpoint
CREATE INDEX `idx_checkout_session_items_session` ON `checkout_session_items` (`sessionId`);--> statement-breakpoint
CREATE INDEX `idx_checkout_session_items_seller` ON `checkout_session_items` (`sessionId`,`sellerId`);--> statement-breakpoint
CREATE INDEX `idx_checkout_sessions_user_status` ON `checkout_sessions` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_checkout_sessions_status_expiry` ON `checkout_sessions` (`status`,`expiresAt`);