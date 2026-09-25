CREATE TABLE `warehouse_discrepancies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`packageId` int,
	`orderItemId` int,
	`type` enum('missing_item','excess_item','damaged_package','wrong_item','incomplete_shipment','packaging_problem') NOT NULL,
	`description` text NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`reportedByUserId` int NOT NULL,
	`resolutionStatus` enum('open','in_review','resolved','rejected') NOT NULL DEFAULT 'open',
	`resolutionNote` text,
	`resolvedByUserId` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouse_discrepancies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `warehouse_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`warehouseId` int NOT NULL,
	`entityType` enum('intake','package','batch') NOT NULL,
	`entityId` int NOT NULL,
	`eventType` varchar(80) NOT NULL,
	`previousState` varchar(64),
	`newState` varchar(64),
	`actorUserId` int NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouse_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `warehouse_intakes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerOrderId` int NOT NULL,
	`parentOrderId` int NOT NULL,
	`sellerId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`receivedByUserId` int,
	`status` enum('awaiting_intake','received','verification_required','verified','discrepancy','rejected') NOT NULL DEFAULT 'awaiting_intake',
	`expectedItemCount` int NOT NULL,
	`receivedItemCount` int NOT NULL DEFAULT 0,
	`packageCount` int NOT NULL DEFAULT 0,
	`discrepancySummary` text,
	`notes` text,
	`receivedAt` timestamp,
	`verifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouse_intakes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_warehouse_intakes_seller_order` UNIQUE(`sellerOrderId`)
);
--> statement-breakpoint
CREATE TABLE `warehouse_package_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int NOT NULL,
	`orderItemId` int NOT NULL,
	`quantity` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouse_package_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_warehouse_package_item` UNIQUE(`packageId`,`orderItemId`)
);
--> statement-breakpoint
CREATE TABLE `warehouse_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageReference` varchar(32) NOT NULL,
	`intakeId` int NOT NULL,
	`sellerOrderId` int NOT NULL,
	`parentOrderId` int NOT NULL,
	`sellerId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`status` enum('received','verification_required','verified','discrepancy','rejected','sorted','dispatch_ready') NOT NULL DEFAULT 'received',
	`destinationCountry` varchar(80) NOT NULL,
	`destinationCounty` varchar(120) NOT NULL,
	`destinationTown` varchar(120) NOT NULL,
	`destinationZone` varchar(120),
	`deliveryMethod` varchar(80),
	`pickup` int NOT NULL DEFAULT 0,
	`weightGrams` int,
	`lengthMm` int,
	`widthMm` int,
	`heightMm` int,
	`receivedAt` timestamp,
	`verifiedAt` timestamp,
	`sortedAt` timestamp,
	`dispatchReadyAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouse_packages_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_warehouse_packages_reference` UNIQUE(`packageReference`)
);
--> statement-breakpoint
CREATE TABLE `warehouse_sorting_batch_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`packageId` int NOT NULL,
	`addedByUserId` int NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouse_sorting_batch_packages_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_warehouse_batch_package` UNIQUE(`batchId`,`packageId`),
	CONSTRAINT `uq_warehouse_package_batch` UNIQUE(`packageId`)
);
--> statement-breakpoint
CREATE TABLE `warehouse_sorting_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchReference` varchar(32) NOT NULL,
	`warehouseId` int NOT NULL,
	`destinationCountry` varchar(80) NOT NULL,
	`destinationCounty` varchar(120) NOT NULL,
	`destinationTown` varchar(120) NOT NULL,
	`destinationZone` varchar(120),
	`deliveryMethod` varchar(80),
	`status` enum('open','sorting','sorted','dispatch_ready','closed') NOT NULL DEFAULT 'open',
	`createdByUserId` int NOT NULL,
	`readyAt` timestamp,
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouse_sorting_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_warehouse_sorting_batches_reference` UNIQUE(`batchReference`)
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`code` varchar(32) NOT NULL,
	`country` varchar(80) NOT NULL DEFAULT 'Kenya',
	`county` varchar(120) NOT NULL,
	`town` varchar(120) NOT NULL,
	`address` text NOT NULL,
	`status` enum('active','inactive','maintenance') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_warehouses_code` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `warehouse_discrepancies` ADD CONSTRAINT `fk_wh_discrepancy_intake` FOREIGN KEY (`intakeId`) REFERENCES `warehouse_intakes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_discrepancies` ADD CONSTRAINT `fk_wh_discrepancy_package` FOREIGN KEY (`packageId`) REFERENCES `warehouse_packages`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_discrepancies` ADD CONSTRAINT `fk_wh_discrepancy_item` FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_discrepancies` ADD CONSTRAINT `fk_wh_discrepancy_reporter` FOREIGN KEY (`reportedByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_discrepancies` ADD CONSTRAINT `fk_wh_discrepancy_resolver` FOREIGN KEY (`resolvedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_events` ADD CONSTRAINT `fk_wh_event_warehouse` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_events` ADD CONSTRAINT `fk_wh_event_actor` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_intakes` ADD CONSTRAINT `fk_wh_intake_seller_order` FOREIGN KEY (`sellerOrderId`) REFERENCES `order_seller_orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_intakes` ADD CONSTRAINT `fk_wh_intake_parent` FOREIGN KEY (`parentOrderId`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_intakes` ADD CONSTRAINT `fk_wh_intake_seller` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_intakes` ADD CONSTRAINT `fk_wh_intake_warehouse` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_intakes` ADD CONSTRAINT `fk_wh_intake_receiver` FOREIGN KEY (`receivedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_package_items` ADD CONSTRAINT `fk_wh_package_item_package` FOREIGN KEY (`packageId`) REFERENCES `warehouse_packages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_package_items` ADD CONSTRAINT `fk_wh_package_item_order` FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_packages` ADD CONSTRAINT `fk_wh_package_intake` FOREIGN KEY (`intakeId`) REFERENCES `warehouse_intakes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_packages` ADD CONSTRAINT `fk_wh_package_seller_order` FOREIGN KEY (`sellerOrderId`) REFERENCES `order_seller_orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_packages` ADD CONSTRAINT `fk_wh_package_parent` FOREIGN KEY (`parentOrderId`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_packages` ADD CONSTRAINT `fk_wh_package_seller` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_packages` ADD CONSTRAINT `fk_wh_package_warehouse` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_sorting_batch_packages` ADD CONSTRAINT `fk_wh_batch_package_batch` FOREIGN KEY (`batchId`) REFERENCES `warehouse_sorting_batches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_sorting_batch_packages` ADD CONSTRAINT `fk_wh_batch_package_package` FOREIGN KEY (`packageId`) REFERENCES `warehouse_packages`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_sorting_batch_packages` ADD CONSTRAINT `fk_wh_batch_package_actor` FOREIGN KEY (`addedByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_sorting_batches` ADD CONSTRAINT `fk_wh_batch_warehouse` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_sorting_batches` ADD CONSTRAINT `fk_wh_batch_creator` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_warehouse_discrepancies_intake` ON `warehouse_discrepancies` (`intakeId`,`resolutionStatus`);--> statement-breakpoint
CREATE INDEX `idx_warehouse_discrepancies_package` ON `warehouse_discrepancies` (`packageId`);--> statement-breakpoint
CREATE INDEX `idx_warehouse_discrepancies_status` ON `warehouse_discrepancies` (`resolutionStatus`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_warehouse_events_entity_created` ON `warehouse_events` (`entityType`,`entityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_warehouse_events_warehouse_created` ON `warehouse_events` (`warehouseId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_warehouse_intakes_warehouse_status` ON `warehouse_intakes` (`warehouseId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_warehouse_intakes_seller` ON `warehouse_intakes` (`sellerId`);--> statement-breakpoint
CREATE INDEX `idx_warehouse_package_items_order_item` ON `warehouse_package_items` (`orderItemId`);--> statement-breakpoint
CREATE INDEX `idx_warehouse_packages_intake` ON `warehouse_packages` (`intakeId`);--> statement-breakpoint
CREATE INDEX `idx_warehouse_packages_warehouse_status` ON `warehouse_packages` (`warehouseId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_warehouse_packages_seller_order` ON `warehouse_packages` (`sellerOrderId`);--> statement-breakpoint
CREATE INDEX `idx_warehouse_batch_packages_batch` ON `warehouse_sorting_batch_packages` (`batchId`);--> statement-breakpoint
CREATE INDEX `idx_warehouse_sorting_batches_warehouse_status` ON `warehouse_sorting_batches` (`warehouseId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_warehouses_status` ON `warehouses` (`status`);