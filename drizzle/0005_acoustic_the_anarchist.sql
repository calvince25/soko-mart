CREATE TABLE `catalog_attribute_values` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attributeId` int NOT NULL,
	`value` varchar(160) NOT NULL,
	`label` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `catalog_attribute_values_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_catalog_attribute_value` UNIQUE(`attributeId`,`value`)
);
--> statement-breakpoint
CREATE TABLE `catalog_attributes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`code` varchar(100) NOT NULL,
	`type` enum('text','number','boolean','select','multi_select') NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalog_attributes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_catalog_attributes_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `catalog_brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`description` text,
	`logoKey` varchar(1024),
	`status` enum('active','inactive','archived') NOT NULL DEFAULT 'active',
	`seoTitle` varchar(180),
	`seoDescription` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalog_brands_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_catalog_brands_slug` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `catalog_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parentId` int,
	`name` varchar(160) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`description` text,
	`imageKey` varchar(1024),
	`displayOrder` int NOT NULL DEFAULT 0,
	`status` enum('active','inactive','archived') NOT NULL DEFAULT 'active',
	`seoTitle` varchar(180),
	`seoDescription` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalog_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_catalog_categories_slug` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `catalog_category_attributes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`attributeId` int NOT NULL,
	`required` int NOT NULL DEFAULT 0,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `catalog_category_attributes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_catalog_category_attribute` UNIQUE(`categoryId`,`attributeId`)
);
--> statement-breakpoint
CREATE TABLE `catalog_product_media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`variantId` int,
	`storageKey` varchar(1024) NOT NULL,
	`mediaType` enum('image','video') NOT NULL DEFAULT 'image',
	`originalFilename` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`fileSize` int NOT NULL,
	`altText` varchar(240),
	`displayOrder` int NOT NULL DEFAULT 0,
	`isPrimary` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `catalog_product_media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `catalog_product_slug_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`slug` varchar(220) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `catalog_product_slug_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_catalog_product_slug_history` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `catalog_product_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`sku` varchar(120) NOT NULL,
	`name` varchar(180) NOT NULL,
	`priceMinor` int NOT NULL,
	`compareAtPriceMinor` int,
	`currency` varchar(3) NOT NULL DEFAULT 'KES',
	`status` enum('active','inactive','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalog_product_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_catalog_variants_sku` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `catalog_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int NOT NULL,
	`categoryId` int NOT NULL,
	`brandId` int,
	`name` varchar(240) NOT NULL,
	`slug` varchar(220) NOT NULL,
	`shortDescription` varchar(500),
	`fullDescription` text,
	`status` enum('draft','pending_review','approved','published','rejected','suspended','archived') NOT NULL DEFAULT 'draft',
	`moderationStatus` enum('not_submitted','pending','approved','rejected') NOT NULL DEFAULT 'not_submitted',
	`rejectionReason` text,
	`metaTitle` varchar(180),
	`metaDescription` varchar(320),
	`publishedAt` timestamp,
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalog_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_catalog_products_slug` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `catalog_variant_attribute_values` (
	`id` int AUTO_INCREMENT NOT NULL,
	`variantId` int NOT NULL,
	`attributeId` int NOT NULL,
	`attributeValueId` int,
	`valueText` varchar(240),
	`valueNumber` varchar(64),
	`valueBoolean` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `catalog_variant_attribute_values_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_catalog_variant_attribute` UNIQUE(`variantId`,`attributeId`)
);
--> statement-breakpoint
ALTER TABLE `catalog_attribute_values` ADD CONSTRAINT `catalog_attribute_values_attributeId_catalog_attributes_id_fk` FOREIGN KEY (`attributeId`) REFERENCES `catalog_attributes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalog_category_attributes` ADD CONSTRAINT `catalog_category_attributes_categoryId_catalog_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `catalog_categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalog_category_attributes` ADD CONSTRAINT `catalog_category_attributes_attributeId_catalog_attributes_id_fk` FOREIGN KEY (`attributeId`) REFERENCES `catalog_attributes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalog_product_media` ADD CONSTRAINT `catalog_product_media_productId_catalog_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `catalog_products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalog_product_media` ADD CONSTRAINT `catalog_product_media_variantId_catalog_product_variants_id_fk` FOREIGN KEY (`variantId`) REFERENCES `catalog_product_variants`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalog_product_slug_history` ADD CONSTRAINT `catalog_product_slug_history_productId_catalog_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `catalog_products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalog_product_variants` ADD CONSTRAINT `catalog_product_variants_productId_catalog_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `catalog_products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalog_products` ADD CONSTRAINT `catalog_products_sellerId_sellers_id_fk` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalog_products` ADD CONSTRAINT `catalog_products_categoryId_catalog_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `catalog_categories`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalog_products` ADD CONSTRAINT `catalog_products_brandId_catalog_brands_id_fk` FOREIGN KEY (`brandId`) REFERENCES `catalog_brands`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalog_variant_attribute_values` ADD CONSTRAINT `catalog_variant_values_variant_fk` FOREIGN KEY (`variantId`) REFERENCES `catalog_product_variants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalog_variant_attribute_values` ADD CONSTRAINT `catalog_variant_values_attribute_fk` FOREIGN KEY (`attributeId`) REFERENCES `catalog_attributes`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalog_variant_attribute_values` ADD CONSTRAINT `catalog_variant_values_value_fk` FOREIGN KEY (`attributeValueId`) REFERENCES `catalog_attribute_values`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_catalog_attribute_values_attribute` ON `catalog_attribute_values` (`attributeId`);--> statement-breakpoint
CREATE INDEX `idx_catalog_brands_status` ON `catalog_brands` (`status`);--> statement-breakpoint
CREATE INDEX `idx_catalog_categories_parent_status` ON `catalog_categories` (`parentId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_catalog_categories_order` ON `catalog_categories` (`displayOrder`);--> statement-breakpoint
CREATE INDEX `idx_catalog_product_media_product_order` ON `catalog_product_media` (`productId`,`displayOrder`);--> statement-breakpoint
CREATE INDEX `idx_catalog_product_media_variant` ON `catalog_product_media` (`variantId`);--> statement-breakpoint
CREATE INDEX `idx_catalog_product_slug_history_product` ON `catalog_product_slug_history` (`productId`);--> statement-breakpoint
CREATE INDEX `idx_catalog_variants_product_status` ON `catalog_product_variants` (`productId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_catalog_products_seller_status` ON `catalog_products` (`sellerId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_catalog_products_category_status` ON `catalog_products` (`categoryId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_catalog_products_brand_status` ON `catalog_products` (`brandId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_catalog_products_public` ON `catalog_products` (`status`,`moderationStatus`);--> statement-breakpoint
CREATE INDEX `idx_catalog_variant_attributes_variant` ON `catalog_variant_attribute_values` (`variantId`);
