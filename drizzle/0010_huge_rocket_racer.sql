CREATE TABLE `order_address_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`recipientName` varchar(160) NOT NULL,
	`recipientPhone` varchar(48) NOT NULL,
	`country` varchar(80) NOT NULL,
	`county` varchar(120) NOT NULL,
	`town` varchar(120) NOT NULL,
	`neighborhood` varchar(160) NOT NULL,
	`estateBuilding` varchar(160),
	`apartmentHouse` varchar(160),
	`streetRoad` varchar(160),
	`directions` text,
	`postalCode` varchar(32),
	`latitude` varchar(40),
	`longitude` varchar(40),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_address_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_order_address_snapshots_order` UNIQUE(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerOrderId` int NOT NULL,
	`productId` int NOT NULL,
	`variantId` int NOT NULL,
	`sellerId` int NOT NULL,
	`productName` varchar(240) NOT NULL,
	`variantName` varchar(180) NOT NULL,
	`sku` varchar(120) NOT NULL,
	`quantity` int NOT NULL,
	`unitPriceMinor` int NOT NULL,
	`lineSubtotalMinor` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_reservation_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`sellerOrderId` int NOT NULL,
	`orderItemId` int NOT NULL,
	`inventoryReservationId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_reservation_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_order_reservation_links_reservation` UNIQUE(`inventoryReservationId`)
);
--> statement-breakpoint
CREATE TABLE `order_seller_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parentOrderId` int NOT NULL,
	`sellerId` int NOT NULL,
	`sellerName` varchar(160) NOT NULL,
	`sellerSlug` varchar(180) NOT NULL,
	`sellerSubtotalMinor` int NOT NULL,
	`shippingMinor` int NOT NULL,
	`taxMinor` int NOT NULL,
	`feeMinor` int NOT NULL,
	`totalMinor` int NOT NULL,
	`status` enum('pending','confirmed','processing','ready_for_fulfilment','completed','cancelled') NOT NULL DEFAULT 'confirmed',
	`fulfilmentStatus` enum('unfulfilled','processing','ready','completed') NOT NULL DEFAULT 'unfulfilled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_seller_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_order_seller_orders_parent_seller` UNIQUE(`parentOrderId`,`sellerId`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(40) NOT NULL,
	`userId` int NOT NULL,
	`checkoutSessionId` int NOT NULL,
	`paymentAttemptId` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`subtotalMinor` int NOT NULL,
	`shippingMinor` int NOT NULL,
	`taxMinor` int NOT NULL,
	`feeMinor` int NOT NULL,
	`discountMinor` int NOT NULL DEFAULT 0,
	`totalMinor` int NOT NULL,
	`status` enum('pending','confirmed','processing','ready_for_fulfilment','completed','cancelled') NOT NULL DEFAULT 'confirmed',
	`paymentStatus` enum('paid','refunded','partially_refunded') NOT NULL DEFAULT 'paid',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_orders_order_number` UNIQUE(`orderNumber`),
	CONSTRAINT `uq_orders_payment_attempt` UNIQUE(`paymentAttemptId`),
	CONSTRAINT `uq_orders_checkout_session` UNIQUE(`checkoutSessionId`)
);
--> statement-breakpoint
ALTER TABLE `order_address_snapshots` ADD CONSTRAINT `order_address_snapshots_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_sellerOrderId_order_seller_orders_id_fk` FOREIGN KEY (`sellerOrderId`) REFERENCES `order_seller_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_productId_catalog_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `catalog_products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variantId_catalog_product_variants_id_fk` FOREIGN KEY (`variantId`) REFERENCES `catalog_product_variants`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_sellerId_sellers_id_fk` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_reservation_links` ADD CONSTRAINT `fk_order_reservation_order` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_reservation_links` ADD CONSTRAINT `fk_order_reservation_seller_order` FOREIGN KEY (`sellerOrderId`) REFERENCES `order_seller_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_reservation_links` ADD CONSTRAINT `fk_order_reservation_item` FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_reservation_links` ADD CONSTRAINT `fk_order_reservation_inventory` FOREIGN KEY (`inventoryReservationId`) REFERENCES `inventory_reservations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_seller_orders` ADD CONSTRAINT `order_seller_orders_parentOrderId_orders_id_fk` FOREIGN KEY (`parentOrderId`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_seller_orders` ADD CONSTRAINT `order_seller_orders_sellerId_sellers_id_fk` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_checkoutSessionId_checkout_sessions_id_fk` FOREIGN KEY (`checkoutSessionId`) REFERENCES `checkout_sessions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_paymentAttemptId_payment_attempts_id_fk` FOREIGN KEY (`paymentAttemptId`) REFERENCES `payment_attempts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_order_items_seller_order` ON `order_items` (`sellerOrderId`);--> statement-breakpoint
CREATE INDEX `idx_order_items_variant` ON `order_items` (`variantId`);--> statement-breakpoint
CREATE INDEX `idx_order_items_seller` ON `order_items` (`sellerId`);--> statement-breakpoint
CREATE INDEX `idx_order_reservation_links_item` ON `order_reservation_links` (`orderItemId`);--> statement-breakpoint
CREATE INDEX `idx_order_reservation_links_order` ON `order_reservation_links` (`orderId`);--> statement-breakpoint
CREATE INDEX `idx_order_seller_orders_seller_created` ON `order_seller_orders` (`sellerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_order_seller_orders_parent` ON `order_seller_orders` (`parentOrderId`);--> statement-breakpoint
CREATE INDEX `idx_orders_user_created` ON `orders` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_orders_status_created` ON `orders` (`status`,`createdAt`);