CREATE TABLE `warehouse_user_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`warehouseId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`assignedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouse_user_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_warehouse_user_assignment` UNIQUE(`warehouseId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `warehouse_user_assignments` ADD CONSTRAINT `fk_wh_assignment_warehouse` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_user_assignments` ADD CONSTRAINT `fk_wh_assignment_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_user_assignments` ADD CONSTRAINT `fk_wh_assignment_actor` FOREIGN KEY (`assignedByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_warehouse_assignments_warehouse_status` ON `warehouse_user_assignments` (`warehouseId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_warehouse_assignments_user_status` ON `warehouse_user_assignments` (`userId`,`status`);