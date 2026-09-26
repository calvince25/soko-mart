CREATE TABLE `refunds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`refundNumber` varchar(40) NOT NULL,
	`returnRequestId` int NOT NULL,
	`paymentAttemptId` int NOT NULL,
	`customerId` int NOT NULL,
	`amountMinor` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`status` enum('approved','processing','successful','failed','cancelled') NOT NULL DEFAULT 'approved',
	`provider` enum('mpesa','card','other') NOT NULL,
	`providerReference` varchar(200),
	`failureReason` text,
	`idempotencyKey` varchar(180) NOT NULL,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `refunds_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_refunds_number` UNIQUE(`refundNumber`),
	CONSTRAINT `uq_refunds_idempotency` UNIQUE(`idempotencyKey`),
	CONSTRAINT `uq_refunds_return_request` UNIQUE(`returnRequestId`)
);
--> statement-breakpoint
CREATE TABLE `return_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`returnRequestId` int NOT NULL,
	`actorUserId` int,
	`eventType` varchar(100) NOT NULL,
	`previousState` varchar(64),
	`newState` varchar(64),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `return_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `return_inspections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`returnRequestId` int NOT NULL,
	`inspectedByUserId` int NOT NULL,
	`outcome` enum('approved','partial','rejected') NOT NULL,
	`condition` enum('resalable','damaged','defective','incomplete','wrong_item','unusable') NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `return_inspections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `return_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`returnRequestId` int NOT NULL,
	`orderItemId` int NOT NULL,
	`orderedQuantity` int NOT NULL,
	`requestedQuantity` int NOT NULL,
	`approvedQuantity` int NOT NULL DEFAULT 0,
	`receivedQuantity` int NOT NULL DEFAULT 0,
	`refundedQuantity` int NOT NULL DEFAULT 0,
	`disposition` enum('pending','restock','damaged','quarantine','discard') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `return_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_return_items_request_item` UNIQUE(`returnRequestId`,`orderItemId`)
);
--> statement-breakpoint
CREATE TABLE `return_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int,
	`returnWindowDays` int NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `return_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_return_policy_seller_scope` UNIQUE(`sellerId`)
);
--> statement-breakpoint
CREATE TABLE `return_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`returnNumber` varchar(40) NOT NULL,
	`customerId` int NOT NULL,
	`orderId` int NOT NULL,
	`sellerOrderId` int NOT NULL,
	`status` enum('requested','approved','rejected','in_transit','received','inspected','refund_approved','refund_processing','refunded','closed','cancelled') NOT NULL DEFAULT 'requested',
	`reason` enum('wrong_item','wrong_size','damaged','defective','not_as_described','missing_parts','changed_mind','duplicate_order','other') NOT NULL,
	`customerNote` text,
	`rejectionReason` text,
	`instructions` text,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`approvedAt` timestamp,
	`rejectedAt` timestamp,
	`receivedAt` timestamp,
	`inspectedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `return_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_return_requests_number` UNIQUE(`returnNumber`)
);
--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `fk_refund_return_request` FOREIGN KEY (`returnRequestId`) REFERENCES `return_requests`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `fk_refund_payment_attempt` FOREIGN KEY (`paymentAttemptId`) REFERENCES `payment_attempts`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `fk_refund_customer` FOREIGN KEY (`customerId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `return_events` ADD CONSTRAINT `fk_return_event_request` FOREIGN KEY (`returnRequestId`) REFERENCES `return_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `return_events` ADD CONSTRAINT `fk_return_event_actor` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `return_inspections` ADD CONSTRAINT `fk_return_inspection_request` FOREIGN KEY (`returnRequestId`) REFERENCES `return_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `return_inspections` ADD CONSTRAINT `fk_return_inspection_user` FOREIGN KEY (`inspectedByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `return_items` ADD CONSTRAINT `fk_return_item_request` FOREIGN KEY (`returnRequestId`) REFERENCES `return_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `return_items` ADD CONSTRAINT `fk_return_item_order_item` FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `return_policies` ADD CONSTRAINT `fk_return_policy_seller` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `return_requests` ADD CONSTRAINT `fk_return_request_customer` FOREIGN KEY (`customerId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `return_requests` ADD CONSTRAINT `fk_return_request_order` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `return_requests` ADD CONSTRAINT `fk_return_request_seller_order` FOREIGN KEY (`sellerOrderId`) REFERENCES `order_seller_orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_refunds_status_created` ON `refunds` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_return_events_request_created` ON `return_events` (`returnRequestId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_return_inspections_request_created` ON `return_inspections` (`returnRequestId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_return_items_order_item` ON `return_items` (`orderItemId`);--> statement-breakpoint
CREATE INDEX `idx_return_requests_customer_created` ON `return_requests` (`customerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_return_requests_seller_status` ON `return_requests` (`sellerOrderId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_return_requests_order` ON `return_requests` (`orderId`);