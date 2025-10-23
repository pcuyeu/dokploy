import { db } from "@dokploy/server/db";
import {
	type apiCreateIssue,
	type apiUpdateIssue,
	issues,
	projects,
} from "@dokploy/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, sql } from "drizzle-orm";

export type Issue = typeof issues.$inferSelect;

// Priority calculation constants
const DIFFICULTY_WEIGHT = 0.4;
const URGENCY_WEIGHT = 0.6;

/**
 * Calculate priority score for an issue
 * Lower score = higher priority
 *
 * Formula: (DIFFICULTY_WEIGHT × difficulty) + (URGENCY_WEIGHT × daysUntilDue)
 *
 * @param difficulty - Issue difficulty (1-5, where 5 is hardest)
 * @param dueDate - When the issue is due
 * @returns Priority score (lower is more important)
 */
export const calculatePriorityScore = (
	difficulty: number,
	dueDate: Date,
): number => {
	const now = new Date();
	const daysUntilDue =
		(dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

	// If overdue (negative days), score will be lower = higher priority
	// If far in future (positive days), score will be higher = lower priority
	return DIFFICULTY_WEIGHT * difficulty + URGENCY_WEIGHT * daysUntilDue;
};

/**
 * Recalculate priority scores and ranks for all issues in a project
 * This should be called whenever an issue is created, updated, or deleted
 *
 * @param projectId - The project whose issues need recalculation
 */
export const recalculateProjectPriorities = async (projectId: string) => {
	// Get all open and in-progress issues for the project
	const projectIssues = await db.query.issues.findMany({
		where: and(
			eq(issues.projectId, projectId),
			sql`${issues.status} IN ('open', 'in_progress')`,
		),
	});

	if (projectIssues.length === 0) {
		return;
	}

	// Calculate scores for all issues
	const issuesWithScores = projectIssues.map((issue) => ({
		...issue,
		priorityScore: calculatePriorityScore(issue.difficulty, issue.dueDate),
	}));

	// Sort by score (lower = higher priority)
	issuesWithScores.sort((a, b) => a.priorityScore - b.priorityScore);

	// Assign ranks
	const updates = issuesWithScores.map((issue, index) => ({
		issueId: issue.issueId,
		priorityScore: issue.priorityScore,
		priorityRank: index + 1, // Rank starts at 1
	}));

	// Update all issues with new scores and ranks in a transaction
	await db.transaction(async (tx) => {
		for (const update of updates) {
			await tx
				.update(issues)
				.set({
					priorityScore: update.priorityScore,
					priorityRank: update.priorityRank,
					updatedAt: new Date(),
				})
				.where(eq(issues.issueId, update.issueId));
		}
	});
};

/**
 * Create a new issue
 */
export const createIssue = async (input: typeof apiCreateIssue._type) => {
	// Verify project exists
	const project = await db.query.projects.findFirst({
		where: eq(projects.projectId, input.projectId),
	});

	if (!project) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Project not found",
		});
	}

	// Calculate initial priority score
	const priorityScore = calculatePriorityScore(input.difficulty, input.dueDate);

	// Create the issue
	const newIssue = await db
		.insert(issues)
		.values({
			...input,
			priorityScore,
			status: "open",
		})
		.returning()
		.then((value) => value[0]);

	if (!newIssue) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error creating the issue",
		});
	}

	// Recalculate all priorities for the project
	await recalculateProjectPriorities(input.projectId);

	// Fetch and return the issue with updated rank
	const updatedIssue = await db.query.issues.findFirst({
		where: eq(issues.issueId, newIssue.issueId),
	});

	return updatedIssue || newIssue;
};

/**
 * Get all issues for a project, sorted by priority rank
 */
export const getIssuesByProject = async (projectId: string) => {
	const projectIssues = await db.query.issues.findMany({
		where: eq(issues.projectId, projectId),
		orderBy: [asc(issues.priorityRank)],
	});

	return projectIssues;
};

/**
 * Get a single issue by ID
 */
export const findIssueById = async (issueId: string) => {
	const issue = await db.query.issues.findFirst({
		where: eq(issues.issueId, issueId),
		with: {
			project: true,
		},
	});

	if (!issue) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Issue not found",
		});
	}

	return issue;
};

/**
 * Update an existing issue
 */
export const updateIssue = async (
	issueId: string,
	input: Partial<typeof apiUpdateIssue._type>,
) => {
	const existingIssue = await db.query.issues.findFirst({
		where: eq(issues.issueId, issueId),
	});

	if (!existingIssue) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Issue not found",
		});
	}

	// Prepare update data
	const updateData: Partial<Issue> = {
		...input,
		updatedAt: new Date(),
	};

	// If difficulty or dueDate changed, recalculate priority score
	if (input.difficulty !== undefined || input.dueDate !== undefined) {
		const difficulty = input.difficulty ?? existingIssue.difficulty;
		const dueDate = input.dueDate ?? existingIssue.dueDate;
		updateData.priorityScore = calculatePriorityScore(difficulty, dueDate);
	}

	// Update the issue
	const updatedIssue = await db
		.update(issues)
		.set(updateData)
		.where(eq(issues.issueId, issueId))
		.returning()
		.then((value) => value[0]);

	// Recalculate all priorities for the project
	await recalculateProjectPriorities(existingIssue.projectId);

	// Fetch and return the issue with updated rank
	const finalIssue = await db.query.issues.findFirst({
		where: eq(issues.issueId, issueId),
	});

	return finalIssue || updatedIssue;
};

/**
 * Delete an issue
 */
export const deleteIssue = async (issueId: string) => {
	const existingIssue = await db.query.issues.findFirst({
		where: eq(issues.issueId, issueId),
	});

	if (!existingIssue) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Issue not found",
		});
	}

	const deletedIssue = await db
		.delete(issues)
		.where(eq(issues.issueId, issueId))
		.returning()
		.then((value) => value[0]);

	// Recalculate priorities for remaining issues
	await recalculateProjectPriorities(existingIssue.projectId);

	return deletedIssue;
};

/**
 * Get statistics for issues in a project
 */
export const getProjectIssueStats = async (projectId: string) => {
	const projectIssues = await getIssuesByProject(projectId);

	return {
		total: projectIssues.length,
		open: projectIssues.filter((i) => i.status === "open").length,
		inProgress: projectIssues.filter((i) => i.status === "in_progress").length,
		closed: projectIssues.filter((i) => i.status === "closed").length,
		overdue: projectIssues.filter((i) => new Date(i.dueDate) < new Date())
			.length,
	};
};
