import { relations } from "drizzle-orm";
import { integer, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { projects } from "./project";

// Main issues table - stores all project issues with priority data
export const issues = pgTable("issue", {
	// Primary Key - auto-generated unique ID
	issueId: text("issueId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),

	// Issue Details
	title: text("title").notNull(),
	description: text("description"),

	// Priority Calculation Factors
	difficulty: integer("difficulty").notNull(), // 1 (easy) to 5 (hard)
	dueDate: timestamp("dueDate").notNull(),

	// Computed Priority Fields
	priorityScore: real("priorityScore"), // Lower = higher priority
	priorityRank: integer("priorityRank"), // 1 = most important

	// Issue Status
	status: text("status").notNull().default("open"), // open, in_progress, closed

	// Foreign Key - links to project
	projectId: text("projectId")
		.notNull()
		.references(() => projects.projectId, { onDelete: "cascade" }),

	// Timestamps
	createdAt: timestamp("createdAt").notNull().defaultNow(),
	updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// Define relationships - tells Drizzle how tables connect
export const issuesRelations = relations(issues, ({ one }) => ({
	project: one(projects, {
		fields: [issues.projectId],
		references: [projects.projectId],
	}),
}));

// Zod validation schemas for API endpoints

// Base schema generated from table definition
const createSchema = createInsertSchema(issues, {
	issueId: z.string().min(1),
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	difficulty: z.number().min(1).max(5),
	dueDate: z.date(),
	status: z.enum(["open", "in_progress", "closed"]),
});

// Schema for creating a new issue (used in API)
export const apiCreateIssue = createSchema.pick({
	projectId: true,
	title: true,
	description: true,
	difficulty: true,
	dueDate: true,
});

// Schema for updating an existing issue (all fields optional except ID)
export const apiUpdateIssue = createSchema
	.partial()
	.extend({
		issueId: z.string().min(1),
	})
	.omit({
		priorityScore: true, // These are computed, not user-provided
		priorityRank: true,
		createdAt: true,
	});

// Schema for finding one issue by ID
export const apiFindOneIssue = createSchema
	.pick({
		issueId: true,
	})
	.required();

// Schema for deleting an issue
export const apiRemoveIssue = createSchema
	.pick({
		issueId: true,
	})
	.required();

// Schema for getting all issues by project
export const apiGetIssuesByProject = z.object({
	projectId: z.string().min(1),
});
