import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
	apiCreateIssue,
	apiFindOneIssue,
	apiGetIssuesByProject,
	apiRemoveIssue,
	apiUpdateIssue,
} from "@/server/db/schema";
import {
	createIssue,
	deleteIssue,
	findIssueById,
	getIssuesByProject,
	getProjectIssueStats,
	updateIssue,
} from "@dokploy/server";
import { TRPCError } from "@trpc/server";

export const issueRouter = createTRPCRouter({
	/**
	 * Create a new issue
	 */
	create: protectedProcedure
		.input(apiCreateIssue)
		.mutation(async ({ input }) => {
			try {
				return await createIssue(input);
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Error creating issue: ${error instanceof Error ? error.message : error}`,
					cause: error,
				});
			}
		}),

	/**
	 * Get all issues for a project (sorted by priority rank)
	 */
	getAllByProject: protectedProcedure
		.input(apiGetIssuesByProject)
		.query(async ({ input }) => {
			try {
				return await getIssuesByProject(input.projectId);
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Error fetching issues: ${error instanceof Error ? error.message : error}`,
					cause: error,
				});
			}
		}),

	/**
	 * Get a single issue by ID
	 */
	one: protectedProcedure.input(apiFindOneIssue).query(async ({ input }) => {
		try {
			return await findIssueById(input.issueId);
		} catch (error) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: `Issue not found: ${error instanceof Error ? error.message : error}`,
				cause: error,
			});
		}
	}),

	/**
	 * Update an existing issue
	 */
	update: protectedProcedure
		.input(apiUpdateIssue)
		.mutation(async ({ input }) => {
			try {
				const { issueId, ...updateData } = input;
				return await updateIssue(issueId, updateData);
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Error updating issue: ${error instanceof Error ? error.message : error}`,
					cause: error,
				});
			}
		}),

	/**
	 * Delete an issue
	 */
	remove: protectedProcedure
		.input(apiRemoveIssue)
		.mutation(async ({ input }) => {
			try {
				return await deleteIssue(input.issueId);
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Error deleting issue: ${error instanceof Error ? error.message : error}`,
					cause: error,
				});
			}
		}),

	/**
	 * Get statistics for project issues
	 */
	getStats: protectedProcedure
		.input(apiGetIssuesByProject)
		.query(async ({ input }) => {
			try {
				return await getProjectIssueStats(input.projectId);
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Error fetching issue stats: ${error instanceof Error ? error.message : error}`,
					cause: error,
				});
			}
		}),
});
