CREATE TABLE "issue" (
	"issueId" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"difficulty" integer NOT NULL,
	"dueDate" timestamp NOT NULL,
	"priorityScore" real,
	"priorityRank" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"projectId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_projectId_project_projectId_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("projectId") ON DELETE cascade ON UPDATE no action;