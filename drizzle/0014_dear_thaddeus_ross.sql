CREATE TABLE `couriers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fullName` varchar(160) NOT NULL,
	`phone` varchar(40) NOT NULL,
	`email` varchar(320),
	`photoRef` varchar(512),
	`status` enum('pending','active','inactive','suspended','terminated') NOT NULL DEFAULT 'pending',
	`verificationStatus` enum('unverified','pending','verified','rejected') NOT NULL DEFAULT 'unverified',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `couriers_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_couriers_user` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `delivery_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shipmentId` int NOT NULL,
	`courierId` int NOT NULL,
	`attemptNumber` int NOT NULL,
	`outcome` enum('delivered','customer_unavailable','incorrect_address','customer_refused','damaged_package','other') NOT NULL,
	`failureReason` text,
	`notes` text,
	`verificationMethod` varchar(40),
	`proofRef` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `delivery_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_delivery_attempt_number` UNIQUE(`shipmentId`,`attemptNumber`)
);
--> statement-breakpoint
CREATE TABLE `shipment_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shipmentId` int NOT NULL,
	`courierId` int,
	`actorUserId` int NOT NULL,
	`eventType` varchar(80) NOT NULL,
	`previousState` varchar(64),
	`newState` varchar(64),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shipment_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipment_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shipmentId` int NOT NULL,
	`packageId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shipment_packages_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_shipment_package` UNIQUE(`shipmentId`,`packageId`),
	CONSTRAINT `uq_package_active_shipment` UNIQUE(`packageId`)
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackingNumber` varchar(40) NOT NULL,
	`parentOrderId` int NOT NULL,
	`sellerOrderId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`sortingBatchId` int,
	`courierId` int,
	`status` enum('shipment_created','awaiting_assignment','assigned','pickup_pending','picked_up','in_transit','out_for_delivery','delivery_attempted','delivered','assignment_failed','pickup_failed','delivery_failed','cancelled','returned_to_warehouse') NOT NULL DEFAULT 'shipment_created',
	`deliveryMethod` varchar(80),
	`destinationSnapshot` json NOT NULL,
	`packageCount` int NOT NULL DEFAULT 0,
	`deliveryNotes` text,
	`otpHash` varchar(128),
	`otpExpiresAt` timestamp,
	`assignedAt` timestamp,
	`pickedUpAt` timestamp,
	`deliveredAt` timestamp,
	`failedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipments_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_shipments_tracking` UNIQUE(`trackingNumber`)
);
--> statement-breakpoint
ALTER TABLE `couriers` ADD CONSTRAINT `fk_courier_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_attempts` ADD CONSTRAINT `fk_delivery_attempt_shipment` FOREIGN KEY (`shipmentId`) REFERENCES `shipments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_attempts` ADD CONSTRAINT `fk_delivery_attempt_courier` FOREIGN KEY (`courierId`) REFERENCES `couriers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipment_events` ADD CONSTRAINT `fk_shipment_event_shipment` FOREIGN KEY (`shipmentId`) REFERENCES `shipments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipment_events` ADD CONSTRAINT `fk_shipment_event_courier` FOREIGN KEY (`courierId`) REFERENCES `couriers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipment_events` ADD CONSTRAINT `fk_shipment_event_actor` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipment_packages` ADD CONSTRAINT `fk_shipment_package_shipment` FOREIGN KEY (`shipmentId`) REFERENCES `shipments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipment_packages` ADD CONSTRAINT `fk_shipment_package_package` FOREIGN KEY (`packageId`) REFERENCES `warehouse_packages`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipments` ADD CONSTRAINT `fk_shipment_parent` FOREIGN KEY (`parentOrderId`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipments` ADD CONSTRAINT `fk_shipment_seller_order` FOREIGN KEY (`sellerOrderId`) REFERENCES `order_seller_orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipments` ADD CONSTRAINT `fk_shipment_warehouse` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipments` ADD CONSTRAINT `fk_shipment_batch` FOREIGN KEY (`sortingBatchId`) REFERENCES `warehouse_sorting_batches`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipments` ADD CONSTRAINT `fk_shipment_courier` FOREIGN KEY (`courierId`) REFERENCES `couriers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_couriers_phone` ON `couriers` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_couriers_status` ON `couriers` (`status`);--> statement-breakpoint
CREATE INDEX `idx_delivery_attempts_shipment_created` ON `delivery_attempts` (`shipmentId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_shipment_events_shipment_created` ON `shipment_events` (`shipmentId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_shipment_events_courier_created` ON `shipment_events` (`courierId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_shipment_packages_shipment` ON `shipment_packages` (`shipmentId`);--> statement-breakpoint
CREATE INDEX `idx_shipments_seller_order` ON `shipments` (`sellerOrderId`);--> statement-breakpoint
CREATE INDEX `idx_shipments_parent_order` ON `shipments` (`parentOrderId`);--> statement-breakpoint
CREATE INDEX `idx_shipments_courier_status` ON `shipments` (`courierId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_shipments_status_created` ON `shipments` (`status`,`createdAt`);