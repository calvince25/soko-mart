CREATE TABLE `seller_order_fulfilment_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerOrderId` int NOT NULL,
	`previousState` enum('pending','accepted','processing','packed','ready_for_handoff','handed_to_logistics','rejected','cancelled','failed'),
	`newState` enum('pending','accepted','processing','packed','ready_for_handoff','handed_to_logistics','rejected','cancelled','failed') NOT NULL,
	`actorUserId` int,
	`reason` text,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seller_order_fulfilment_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seller_order_fulfilment_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerOrderId` int NOT NULL,
	`actorUserId` int NOT NULL,
	`note` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seller_order_fulfilment_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `order_seller_orders` ADD `fulfilmentState` enum('pending','accepted','processing','packed','ready_for_handoff','handed_to_logistics','rejected','cancelled','failed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_seller_orders` ADD `acceptedAt` timestamp;--> statement-breakpoint
ALTER TABLE `order_seller_orders` ADD `processingAt` timestamp;--> statement-breakpoint
ALTER TABLE `order_seller_orders` ADD `packedAt` timestamp;--> statement-breakpoint
ALTER TABLE `order_seller_orders` ADD `readyForHandoffAt` timestamp;--> statement-breakpoint
ALTER TABLE `order_seller_orders` ADD `handedToLogisticsAt` timestamp;--> statement-breakpoint
ALTER TABLE `order_seller_orders` ADD `cancellationReason` text;--> statement-breakpoint
ALTER TABLE `order_seller_orders` ADD `cancelledByUserId` int;--> statement-breakpoint
ALTER TABLE `order_seller_orders` ADD `cancelledAt` timestamp;--> statement-breakpoint
ALTER TABLE `order_seller_orders` ADD `refundRequired` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `fulfilmentStatus` enum('unfulfilled','accepted','processing','packed','ready_for_handoff','handed_to_logistics','partially_fulfilled','exception') DEFAULT 'unfulfilled' NOT NULL;--> statement-breakpoint
ALTER TABLE `seller_order_fulfilment_events` ADD CONSTRAINT `fk_fulfilment_event_seller_order` FOREIGN KEY (`sellerOrderId`) REFERENCES `order_seller_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_order_fulfilment_events` ADD CONSTRAINT `fk_fulfilment_event_actor` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_order_fulfilment_notes` ADD CONSTRAINT `fk_fulfilment_note_seller_order` FOREIGN KEY (`sellerOrderId`) REFERENCES `order_seller_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `seller_order_fulfilment_notes` ADD CONSTRAINT `fk_fulfilment_note_actor` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_seller_order_fulfilment_events_order_created` ON `seller_order_fulfilment_events` (`sellerOrderId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_seller_order_fulfilment_events_state` ON `seller_order_fulfilment_events` (`newState`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_seller_order_fulfilment_notes_order_created` ON `seller_order_fulfilment_notes` (`sellerOrderId`,`createdAt`);--> statement-breakpoint
ALTER TABLE `order_seller_orders` ADD CONSTRAINT `fk_order_seller_cancelled_by` FOREIGN KEY (`cancelledByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_order_seller_orders_seller_fulfilment` ON `order_seller_orders` (`sellerId`,`fulfilmentState`,`createdAt`);