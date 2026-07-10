CREATE TABLE `audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`mobileResponsive` text,
	`ctaClarity` text,
	`testimonials` text,
	`brokenAssets` text,
	`overallScore` int,
	`findings` json,
	`suggestions` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`businessName` varchar(255) NOT NULL,
	`industry` varchar(128) NOT NULL,
	`websiteUrl` varchar(512) NOT NULL,
	`googleRating` decimal(3,2),
	`googleReviews` int,
	`status` enum('New','Contacted','Responded','Converted') NOT NULL DEFAULT 'New',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outreachMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`channel` enum('WhatsApp','Instagram','Email') NOT NULL,
	`hook` text NOT NULL,
	`valueGap` text NOT NULL,
	`offer` text NOT NULL,
	`fullMessage` text NOT NULL,
	`wordCount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outreachMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `statusHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`previousStatus` enum('New','Contacted','Responded','Converted'),
	`newStatus` enum('New','Contacted','Responded','Converted') NOT NULL,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `statusHistory_id` PRIMARY KEY(`id`)
);
