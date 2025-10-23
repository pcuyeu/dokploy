import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/utils/api";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Calendar, Loader2, PlusIcon, TrendingUp } from "lucide-react";
import { useState } from "react";
import { HandleIssue } from "./handle-issue";

interface PriorityQueueProps {
	projectId: string;
}

export const PriorityQueue: React.FC<PriorityQueueProps> = ({ projectId }) => {
	const { data: issues, isLoading } = api.issue.getAllByProject.useQuery({
		projectId,
	});
	const { data: stats } = api.issue.getStats.useQuery({ projectId });
	const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[200px]">
				<Loader2 className="animate-spin size-6 text-muted-foreground" />
			</div>
		);
	}

	const selectedIssue = issues?.find((i) => i.issueId === selectedIssueId);

	// Filter to only show open and in-progress issues
	const activeIssues = issues?.filter(
		(issue) => issue.status === "open" || issue.status === "in_progress",
	);

	return (
		<div className="space-y-4">
			{/* Header with Stats */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-semibold">Priority Queue</h3>
					<p className="text-sm text-muted-foreground">
						Issues ranked by urgency and difficulty
					</p>
				</div>

				<Button onClick={() => setIsCreateOpen(true)} size="sm">
					<PlusIcon className="size-4 mr-2" />
					Add Issue
				</Button>
			</div>

			{/* Stats Cards */}
			{stats && (
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
					<Card>
						<CardContent className="p-4">
							<div className="text-2xl font-bold">{stats.total}</div>
							<div className="text-xs text-muted-foreground">Total</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4">
							<div className="text-2xl font-bold text-yellow-500">
								{stats.open}
							</div>
							<div className="text-xs text-muted-foreground">Open</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4">
							<div className="text-2xl font-bold text-blue-500">
								{stats.inProgress}
							</div>
							<div className="text-xs text-muted-foreground">In Progress</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4">
							<div className="text-2xl font-bold text-red-500">
								{stats.overdue}
							</div>
							<div className="text-xs text-muted-foreground">Overdue</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Issues List */}
			{!activeIssues || activeIssues.length === 0 ? (
				<Card>
					<CardContent className="p-8 text-center">
						<AlertCircle className="size-12 mx-auto mb-4 text-muted-foreground" />
						<p className="text-sm text-muted-foreground">
							No active issues to display
						</p>
						<Button
							onClick={() => setIsCreateOpen(true)}
							variant="outline"
							className="mt-4"
						>
							<PlusIcon className="size-4 mr-2" />
							Create Your First Issue
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-3">
					{activeIssues.map((issue) => {
						const isOverdue = new Date(issue.dueDate) < new Date();
						const difficultyColor =
							issue.difficulty >= 4
								? "destructive"
								: issue.difficulty >= 3
									? "default"
									: "secondary";

						return (
							<Card
								key={issue.issueId}
								className="hover:shadow-md transition-shadow cursor-pointer"
								onClick={() => setSelectedIssueId(issue.issueId)}
							>
								<CardContent className="p-4">
									<div className="flex items-start gap-4">
										{/* Rank Badge */}
										<div className="flex-shrink-0">
											<Badge
												variant="outline"
												className="text-lg font-bold px-3 py-1"
											>
												#{issue.priorityRank}
											</Badge>
										</div>

										{/* Content */}
										<div className="flex-1 min-w-0">
											<div className="flex items-start justify-between gap-2">
												<div className="flex-1">
													<h4 className="font-medium text-base leading-tight mb-1">
														{issue.title}
													</h4>
													{issue.description && (
														<p className="text-sm text-muted-foreground line-clamp-2">
															{issue.description}
														</p>
													)}
												</div>

												{/* Priority Score */}
												<div className="text-right flex-shrink-0">
													<div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
														<TrendingUp className="size-3" />
														<span>Score</span>
													</div>
													<div className="font-mono font-semibold text-sm">
														{issue.priorityScore?.toFixed(2) ?? "N/A"}
													</div>
												</div>
											</div>

											{/* Metadata Row */}
											<div className="flex flex-wrap gap-2 mt-3">
												{/* Difficulty */}
												<Badge variant={difficultyColor} className="text-xs">
													Difficulty: {issue.difficulty}/5
												</Badge>

												{/* Due Date */}
												<Badge
													variant={isOverdue ? "destructive" : "outline"}
													className="text-xs flex items-center gap-1"
												>
													<Calendar className="size-3" />
													{formatDistanceToNow(new Date(issue.dueDate), {
														addSuffix: true,
													})}
												</Badge>

												{/* Status */}
												<Badge
													variant={
														issue.status === "in_progress" ? "default" : "secondary"
													}
													className="text-xs"
												>
													{issue.status === "in_progress"
														? "In Progress"
														: "Open"}
												</Badge>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}

			{/* Create/Edit Dialog */}
			{isCreateOpen && (
				<HandleIssue
					projectId={projectId}
					onClose={() => setIsCreateOpen(false)}
				/>
			)}

			{selectedIssue && (
				<HandleIssue
					projectId={projectId}
					issue={selectedIssue}
					onClose={() => setSelectedIssueId(null)}
				/>
			)}
		</div>
	);
};
