CREATE TABLE `user_prefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`prefs` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_prefs_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_prefs_openId_unique` UNIQUE(`openId`)
);
