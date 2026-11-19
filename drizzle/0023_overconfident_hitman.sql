CREATE TABLE `rate_limit_buckets` (
	`bucketKey` varchar(320) NOT NULL,
	`count` int NOT NULL,
	`resetAt` bigint NOT NULL,
	CONSTRAINT `rate_limit_buckets_bucketKey` PRIMARY KEY(`bucketKey`)
);
