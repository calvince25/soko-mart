CREATE TABLE `commerce_cart_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cartId` int NOT NULL,
	`variantId` int NOT NULL,
	`quantity` int NOT NULL,
	`addedPriceMinor` int NOT NULL,
	`addedCurrency` varchar(3) NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commerce_cart_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_commerce_cart_items_cart_variant` UNIQUE(`cartId`,`variantId`)
);
--> statement-breakpoint
CREATE TABLE `commerce_carts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` enum('active','converted','abandoned') NOT NULL DEFAULT 'active',
	`currency` varchar(3) NOT NULL DEFAULT 'KES',
	`activeKey` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commerce_carts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_commerce_carts_active_key` UNIQUE(`activeKey`)
);
--> statement-breakpoint
CREATE TABLE `commerce_wishlist_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`variantId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commerce_wishlist_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_commerce_wishlist_user_variant` UNIQUE(`userId`,`variantId`)
);
--> statement-breakpoint
ALTER TABLE `commerce_cart_items` ADD CONSTRAINT `commerce_cart_items_cartId_commerce_carts_id_fk` FOREIGN KEY (`cartId`) REFERENCES `commerce_carts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commerce_cart_items` ADD CONSTRAINT `commerce_cart_items_variantId_catalog_product_variants_id_fk` FOREIGN KEY (`variantId`) REFERENCES `catalog_product_variants`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commerce_carts` ADD CONSTRAINT `commerce_carts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commerce_wishlist_items` ADD CONSTRAINT `commerce_wishlist_items_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commerce_wishlist_items` ADD CONSTRAINT `commerce_wishlist_items_variantId_catalog_product_variants_id_fk` FOREIGN KEY (`variantId`) REFERENCES `catalog_product_variants`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_commerce_cart_items_cart_updated` ON `commerce_cart_items` (`cartId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `idx_commerce_cart_items_variant` ON `commerce_cart_items` (`variantId`);--> statement-breakpoint
CREATE INDEX `idx_commerce_carts_user_status` ON `commerce_carts` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_commerce_wishlist_user_created` ON `commerce_wishlist_items` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_commerce_wishlist_variant` ON `commerce_wishlist_items` (`variantId`);