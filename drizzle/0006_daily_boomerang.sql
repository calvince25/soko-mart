CREATE TABLE `inventory_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int NOT NULL,
	`variantId` int NOT NULL,
	`locationId` int NOT NULL,
	`onHand` int NOT NULL DEFAULT 0,
	`reserved` int NOT NULL DEFAULT 0,
	`damaged` int NOT NULL DEFAULT 0,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_balances_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_inventory_balance_sku_location` UNIQUE(`sellerId`,`variantId`,`locationId`)
);
--> statement-breakpoint
CREATE TABLE `inventory_locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int,
	`name` varchar(160) NOT NULL,
	`type` enum('seller_location','warehouse','fulfillment_center') NOT NULL,
	`country` varchar(80) NOT NULL,
	`county` varchar(100),
	`city` varchar(100),
	`address` text,
	`status` enum('active','inactive','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int NOT NULL,
	`variantId` int NOT NULL,
	`locationId` int NOT NULL,
	`reservationId` int,
	`movementType` enum('initial_stock','purchase_receipt','manual_adjustment','transfer_out','transfer_in','damage','loss','return','correction','reservation','reservation_release','sale') NOT NULL,
	`balanceType` enum('on_hand','reserved','damaged') NOT NULL,
	`direction` enum('in','out') NOT NULL,
	`quantity` int NOT NULL,
	`referenceType` varchar(80),
	`referenceId` varchar(160),
	`reason` text,
	`actorUserId` int,
	`requestId` varchar(96),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int NOT NULL,
	`variantId` int NOT NULL,
	`locationId` int NOT NULL,
	`quantity` int NOT NULL,
	`status` enum('active','released','expired','converted','cancelled') NOT NULL DEFAULT 'active',
	`expiresAt` timestamp NOT NULL,
	`referenceType` varchar(80) NOT NULL,
	`referenceId` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`releasedAt` timestamp,
	`convertedAt` timestamp,
	`releaseReason` text,
	CONSTRAINT `inventory_reservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `inventory_balances` ADD CONSTRAINT `inventory_balances_sellerId_sellers_id_fk` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_balances` ADD CONSTRAINT `inventory_balances_variantId_catalog_product_variants_id_fk` FOREIGN KEY (`variantId`) REFERENCES `catalog_product_variants`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_balances` ADD CONSTRAINT `inventory_balances_locationId_inventory_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `inventory_locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_locations` ADD CONSTRAINT `inventory_locations_sellerId_sellers_id_fk` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_sellerId_sellers_id_fk` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_variantId_catalog_product_variants_id_fk` FOREIGN KEY (`variantId`) REFERENCES `catalog_product_variants`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_locationId_inventory_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `inventory_locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_reservationId_inventory_reservations_id_fk` FOREIGN KEY (`reservationId`) REFERENCES `inventory_reservations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_sellerId_sellers_id_fk` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_variantId_catalog_product_variants_id_fk` FOREIGN KEY (`variantId`) REFERENCES `catalog_product_variants`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_locationId_inventory_locations_id_fk` FOREIGN KEY (`locationId`) REFERENCES `inventory_locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_inventory_balances_seller` ON `inventory_balances` (`sellerId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_inventory_balances_variant` ON `inventory_balances` (`variantId`);--> statement-breakpoint
CREATE INDEX `idx_inventory_balances_location` ON `inventory_balances` (`locationId`);--> statement-breakpoint
CREATE INDEX `idx_inventory_locations_seller_status` ON `inventory_locations` (`sellerId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_inventory_locations_type_status` ON `inventory_locations` (`type`,`status`);--> statement-breakpoint
CREATE INDEX `idx_inventory_movements_balance_created` ON `inventory_movements` (`sellerId`,`variantId`,`locationId`,`balanceType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_inventory_movements_actor_created` ON `inventory_movements` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_inventory_movements_reservation` ON `inventory_movements` (`reservationId`);--> statement-breakpoint
CREATE INDEX `idx_inventory_movements_reference` ON `inventory_movements` (`referenceType`,`referenceId`);--> statement-breakpoint
CREATE INDEX `idx_inventory_reservations_seller_status` ON `inventory_reservations` (`sellerId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_inventory_reservations_variant_location` ON `inventory_reservations` (`variantId`,`locationId`);--> statement-breakpoint
CREATE INDEX `idx_inventory_reservations_active_expiry` ON `inventory_reservations` (`status`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `idx_inventory_reservations_reference` ON `inventory_reservations` (`referenceType`,`referenceId`);