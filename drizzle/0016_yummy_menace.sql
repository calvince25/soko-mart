CREATE TABLE `review_media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewId` int NOT NULL,
	`storageKey` varchar(1024) NOT NULL,
	`mediaType` enum('image','video') NOT NULL DEFAULT 'image',
	`originalFilename` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`fileSize` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`targetType` enum('product','seller') NOT NULL,
	`productId` int,
	`sellerId` int NOT NULL,
	`orderId` int NOT NULL,
	`sellerOrderId` int NOT NULL,
	`orderItemId` int,
	`purchaseKey` varchar(180) NOT NULL,
	`rating` int NOT NULL,
	`title` varchar(180),
	`reviewText` text NOT NULL,
	`status` enum('pending','published','rejected','hidden','removed') NOT NULL DEFAULT 'pending',
	`verifiedPurchase` int NOT NULL DEFAULT 1,
	`publishedAt` timestamp,
	`moderatedAt` timestamp,
	`moderatedBy` int,
	`moderationReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_reviews_purchase_key` UNIQUE(`purchaseKey`)
);
--> statement-breakpoint
ALTER TABLE `review_media` ADD CONSTRAINT `fk_review_media_review` FOREIGN KEY (`reviewId`) REFERENCES `reviews`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `fk_review_customer` FOREIGN KEY (`customerId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `fk_review_product` FOREIGN KEY (`productId`) REFERENCES `catalog_products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `fk_review_seller` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `fk_review_order` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `fk_review_seller_order` FOREIGN KEY (`sellerOrderId`) REFERENCES `order_seller_orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `fk_review_order_item` FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `fk_review_moderator` FOREIGN KEY (`moderatedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_review_media_review` ON `review_media` (`reviewId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_reviews_customer_created` ON `reviews` (`customerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_reviews_product_status_created` ON `reviews` (`productId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_reviews_seller_status_created` ON `reviews` (`sellerId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_reviews_order_item` ON `reviews` (`orderId`,`orderItemId`);