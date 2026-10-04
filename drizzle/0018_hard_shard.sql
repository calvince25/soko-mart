CREATE TABLE `support_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`agentUserId` int,
	`team` varchar(80),
	`assignedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`actorUserId` int,
	`eventType` varchar(100) NOT NULL,
	`previousStatus` varchar(64),
	`newStatus` varchar(64),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`uploadedByUserId` int NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`url` varchar(700) NOT NULL,
	`fileName` varchar(240) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`sizeBytes` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_evidence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`authorUserId` int NOT NULL,
	`authorType` enum('customer','support','seller','system') NOT NULL,
	`body` text NOT NULL,
	`isInternal` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_sla_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`priority` enum('low','normal','high','urgent') NOT NULL,
	`firstResponseMinutes` int NOT NULL,
	`resolutionMinutes` int NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_sla_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_support_sla_priority` UNIQUE(`priority`)
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketNumber` varchar(40) NOT NULL,
	`customerId` int NOT NULL,
	`category` enum('order_issue','payment_issue','delivery_issue','product_issue','seller_issue','return_issue','refund_issue','account_issue','technical_issue','other') NOT NULL,
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`status` enum('open','pending_customer','pending_seller','in_progress','escalated','resolved','closed','reopened') NOT NULL DEFAULT 'open',
	`subject` varchar(240) NOT NULL,
	`description` text NOT NULL,
	`orderId` int,
	`sellerOrderId` int,
	`shipmentId` int,
	`returnRequestId` int,
	`refundId` int,
	`assignedAgentId` int,
	`assignedTeam` varchar(80),
	`idempotencyKey` varchar(180) NOT NULL,
	`dueAt` timestamp,
	`firstResponseAt` timestamp,
	`resolvedAt` timestamp,
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_support_ticket_number` UNIQUE(`ticketNumber`),
	CONSTRAINT `uq_support_ticket_customer_idem` UNIQUE(`customerId`,`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `support_assignments` ADD CONSTRAINT `fk_support_assignment_ticket` FOREIGN KEY (`ticketId`) REFERENCES `support_tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_assignments` ADD CONSTRAINT `fk_support_assignment_agent` FOREIGN KEY (`agentUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_assignments` ADD CONSTRAINT `fk_support_assignment_actor` FOREIGN KEY (`assignedByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_events` ADD CONSTRAINT `fk_support_event_ticket` FOREIGN KEY (`ticketId`) REFERENCES `support_tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_events` ADD CONSTRAINT `fk_support_event_actor` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_evidence` ADD CONSTRAINT `fk_support_evidence_ticket` FOREIGN KEY (`ticketId`) REFERENCES `support_tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_evidence` ADD CONSTRAINT `fk_support_evidence_uploader` FOREIGN KEY (`uploadedByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_messages` ADD CONSTRAINT `fk_support_message_ticket` FOREIGN KEY (`ticketId`) REFERENCES `support_tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_messages` ADD CONSTRAINT `fk_support_message_author` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `fk_support_ticket_customer` FOREIGN KEY (`customerId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `fk_support_ticket_order` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `fk_support_ticket_seller_order` FOREIGN KEY (`sellerOrderId`) REFERENCES `order_seller_orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `fk_support_ticket_shipment` FOREIGN KEY (`shipmentId`) REFERENCES `shipments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `fk_support_ticket_return` FOREIGN KEY (`returnRequestId`) REFERENCES `return_requests`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `fk_support_ticket_refund` FOREIGN KEY (`refundId`) REFERENCES `refunds`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `fk_support_ticket_agent` FOREIGN KEY (`assignedAgentId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_support_event_ticket` ON `support_events` (`ticketId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_support_evidence_ticket` ON `support_evidence` (`ticketId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_support_message_ticket` ON `support_messages` (`ticketId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_support_ticket_customer_status` ON `support_tickets` (`customerId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_support_ticket_queue` ON `support_tickets` (`status`,`priority`,`updatedAt`);