import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/utils/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const IssueSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	difficulty: z.coerce.number().min(1).max(5),
	dueDate: z.string().min(1, "Due date is required"),
	status: z.enum(["open", "in_progress", "closed"]).optional(),
});

type IssueFormData = z.infer<typeof IssueSchema>;

interface HandleIssueProps {
	projectId: string;
	issue?: {
		issueId: string;
		title: string;
		description: string | null;
		difficulty: number;
		dueDate: Date;
		status: string;
	};
	onClose: () => void;
}

export const HandleIssue = ({
	projectId,
	issue,
	onClose,
}: HandleIssueProps) => {
	const utils = api.useUtils();
	const isEditing = !!issue;

	const { mutateAsync: createMutation, isLoading: isCreating } =
		api.issue.create.useMutation();
	const { mutateAsync: updateMutation, isLoading: isUpdating } =
		api.issue.update.useMutation();
	const { mutateAsync: deleteMutation, isLoading: isDeleting } =
		api.issue.remove.useMutation();

	const form = useForm<IssueFormData>({
		resolver: zodResolver(IssueSchema),
		defaultValues: {
			title: issue?.title ?? "",
			description: issue?.description ?? "",
			difficulty: issue?.difficulty ?? 3,
			dueDate: issue?.dueDate
				? new Date(issue.dueDate).toISOString().split("T")[0]
				: "",
			status: (issue?.status as "open" | "in_progress" | "closed") ?? "open",
		},
	});

	useEffect(() => {
		if (issue) {
			form.reset({
				title: issue.title,
				description: issue.description ?? "",
				difficulty: issue.difficulty,
				dueDate: new Date(issue.dueDate).toISOString().split("T")[0],
				status: issue.status as "open" | "in_progress" | "closed",
			});
		}
	}, [issue, form]);

	const onSubmit = async (data: IssueFormData) => {
		try {
			if (isEditing) {
				await updateMutation({
					issueId: issue.issueId,
					title: data.title,
					description: data.description,
					difficulty: data.difficulty,
					dueDate: new Date(data.dueDate),
					status: data.status,
				});
				toast.success("Issue updated successfully");
			} else {
				await createMutation({
					projectId,
					title: data.title,
					description: data.description,
					difficulty: data.difficulty,
					dueDate: new Date(data.dueDate),
				});
				toast.success("Issue created successfully");
			}

			await utils.issue.getAllByProject.invalidate({ projectId });
			await utils.issue.getStats.invalidate({ projectId });
			onClose();
		} catch (error) {
			toast.error(
				isEditing ? "Failed to update issue" : "Failed to create issue",
			);
		}
	};

	const handleDelete = async () => {
		if (!issue) return;

		try {
			await deleteMutation({ issueId: issue.issueId });
			await utils.issue.getAllByProject.invalidate({ projectId });
			await utils.issue.getStats.invalidate({ projectId });
			toast.success("Issue deleted successfully");
			onClose();
		} catch (error) {
			toast.error("Failed to delete issue");
		}
	};

	const isLoading = isCreating || isUpdating || isDeleting;

	return (
		<Dialog open={true} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>
						{isEditing ? "Edit Issue" : "Create New Issue"}
					</DialogTitle>
					<DialogDescription>
						{isEditing
							? "Update issue details. Priority rank will be recalculated automatically."
							: "Add a new issue to the priority queue. It will be automatically ranked based on difficulty and due date."}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						{/* Title */}
						<FormField
							control={form.control}
							name="title"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Title</FormLabel>
									<FormControl>
										<Input
											placeholder="Fix authentication bug"
											{...field}
											disabled={isLoading}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Description */}
						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description (Optional)</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Detailed description of the issue..."
											rows={3}
											{...field}
											disabled={isLoading}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Difficulty and Due Date Row */}
						<div className="grid grid-cols-2 gap-4">
							{/* Difficulty */}
							<FormField
								control={form.control}
								name="difficulty"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Difficulty</FormLabel>
										<Select
											onValueChange={(value) =>
												field.onChange(Number.parseInt(value))
											}
											value={field.value?.toString()}
											disabled={isLoading}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select difficulty" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="1">1 - Very Easy</SelectItem>
												<SelectItem value="2">2 - Easy</SelectItem>
												<SelectItem value="3">3 - Medium</SelectItem>
												<SelectItem value="4">4 - Hard</SelectItem>
												<SelectItem value="5">5 - Very Hard</SelectItem>
											</SelectContent>
										</Select>
										<FormDescription>How complex is this issue?</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* Due Date */}
							<FormField
								control={form.control}
								name="dueDate"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Due Date</FormLabel>
										<FormControl>
											<Input
												type="date"
												{...field}
												disabled={isLoading}
												min={new Date().toISOString().split("T")[0]}
											/>
										</FormControl>
										<FormDescription>When should this be done?</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* Status (only show when editing) */}
						{isEditing && (
							<FormField
								control={form.control}
								name="status"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Status</FormLabel>
										<Select
											onValueChange={field.onChange}
											value={field.value}
											disabled={isLoading}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select status" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="open">Open</SelectItem>
												<SelectItem value="in_progress">In Progress</SelectItem>
												<SelectItem value="closed">Closed</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						<DialogFooter className="gap-2">
							{isEditing && (
								<Button
									type="button"
									variant="destructive"
									onClick={handleDelete}
									disabled={isLoading}
								>
									{isDeleting ? (
										<>
											<Loader2 className="mr-2 size-4 animate-spin" />
											Deleting...
										</>
									) : (
										<>
											<Trash2 className="mr-2 size-4" />
											Delete
										</>
									)}
								</Button>
							)}

							<Button
								type="button"
								variant="outline"
								onClick={onClose}
								disabled={isLoading}
							>
								Cancel
							</Button>

							<Button type="submit" disabled={isLoading}>
								{isLoading ? (
									<>
										<Loader2 className="mr-2 size-4 animate-spin" />
										{isEditing ? "Updating..." : "Creating..."}
									</>
								) : isEditing ? (
									"Update Issue"
								) : (
									"Create Issue"
								)}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
