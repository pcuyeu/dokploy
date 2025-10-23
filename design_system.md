# Priority Queue Feature - System Design Document

## 📋 Feature Overview

### Purpose
Implement a priority queue system that ranks project issues based on **difficulty** and **due date**, displaying them in ascending order (1 = most important) within the Dokploy projects tab.

### User Story
*As a developer, I want to see my project issues ranked by priority so that I can focus on the most important and urgent tasks first.*

---

## 🏗️ System Architecture Overview

### Tech Stack Context
- **Frontend**: Next.js 15.2.4 (React 18 + TypeScript)
- **Backend**: tRPC v10.43.6 (Type-safe RPC API)
- **Database**: PostgreSQL with Drizzle ORM v0.39.1
- **UI**: Radix UI + TailwindCSS 3.4.1

### Architecture Pattern
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Database   │ ──▶ │   Service    │ ──▶ │  tRPC API   │ ──▶ │   Frontend   │
│   Schema    │     │   Layer      │     │   Router    │     │  Components  │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
    (Drizzle)         (Business Logic)      (Type-safe)         (React/Next.js)
```

---

## 📊 Data Model Design

### New Database Schema

We need to add an **`issues`** table to track project issues:

```typescript
// Location: /packages/server/src/db/schema/issue.ts

export const issues = pgTable("issue", {
  // Primary Key
  issueId: text("issueId")
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),

  // Issue Details
  title: text("title").notNull(),
  description: text("description"),

  // Priority Factors
  difficulty: integer("difficulty").notNull(), // 1 (easy) to 5 (hard)
  dueDate: timestamp("dueDate").notNull(),

  // Computed Priority Score
  priorityScore: real("priorityScore"), // Calculated field
  priorityRank: integer("priorityRank"), // 1 = most important

  // Status
  status: text("status").notNull().default("open"), // open, in_progress, closed

  // Relationships
  projectId: text("projectId")
    .notNull()
    .references(() => projects.projectId, { onDelete: "cascade" }),

  // Metadata
  createdAt: timestamp("createdAt")
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt")
    .notNull()
    .defaultNow(),
});

// Relations
export const issuesRelations = relations(issues, ({ one }) => ({
  project: one(projects, {
    fields: [issues.projectId],
    references: [projects.projectId],
  }),
}));
```

### Priority Calculation Algorithm

**Formula:**
```
Priority Score = (Difficulty Weight × Difficulty) + (Urgency Weight × Days Until Due)

Where:
- Difficulty Weight = 0.4
- Urgency Weight = 0.6
- Days Until Due = (dueDate - currentDate) in days
  - Negative if overdue (higher priority)
  - Positive if future (lower priority)

Lower Score = Higher Priority (Rank 1)
```

**Example Calculation:**
```javascript
// Issue A: Difficulty 5, Due in 2 days
scoreA = (0.4 × 5) + (0.6 × 2) = 2.0 + 1.2 = 3.2

// Issue B: Difficulty 3, Due in -1 days (overdue)
scoreB = (0.4 × 3) + (0.6 × -1) = 1.2 + (-0.6) = 0.6

// Result: Issue B (0.6) ranks #1, Issue A (3.2) ranks #2
```

---

## 🔧 Implementation Steps

### Step 1: Database Schema Migration

**Files to Create/Modify:**
1. `/packages/server/src/db/schema/issue.ts` - New schema
2. `/packages/server/src/db/schema/index.ts` - Export new schema
3. Generate migration: `pnpm drizzle-kit generate`

**Learning Checkpoint Questions:**
- ❓ Why do we use `pgTable` instead of a regular TypeScript interface?
- ❓ What does `onDelete: "cascade"` mean for the `projectId` foreign key?
- ❓ Why is `priorityScore` a computed field and not user-input?

---

### Step 2: Service Layer Functions

**File to Create:** `/packages/server/src/services/issue.ts`

**Functions to Implement:**

```typescript
// 1. Calculate priority score for an issue
export const calculatePriorityScore = (
  difficulty: number,
  dueDate: Date
): number => {
  const DIFFICULTY_WEIGHT = 0.4;
  const URGENCY_WEIGHT = 0.6;

  const now = new Date();
  const daysUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  return (DIFFICULTY_WEIGHT * difficulty) + (URGENCY_WEIGHT * daysUntilDue);
};

// 2. Calculate ranks for all issues in a project
export const calculateIssueRanks = async (projectId: string) => {
  // Fetch all issues, calculate scores, sort, assign ranks
};

// 3. Create new issue
export const createIssue = async (input: CreateIssueInput) => {
  // Insert issue, recalculate all ranks for project
};

// 4. Update existing issue
export const updateIssue = async (issueId: string, input: UpdateIssueInput) => {
  // Update issue, recalculate all ranks for project
};

// 5. Get all issues for a project (sorted by rank)
export const getIssuesByProject = async (projectId: string) => {
  // Query with sorting
};
```

**Learning Checkpoint Questions:**
- ❓ Why do we separate business logic into a "service layer" instead of putting it directly in the API router?
- ❓ Why do we recalculate ALL ranks when one issue changes?
- ❓ What happens if two issues have the same priority score?

---

### Step 3: API Router (tRPC Endpoints)

**File to Create:** `/apps/dokploy/server/api/routers/issue.ts`

**Endpoints to Implement:**

```typescript
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

export const issueRouter = createTRPCRouter({
  // Create new issue
  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      difficulty: z.number().min(1).max(5),
      dueDate: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await createIssue(input);
    }),

  // Get all issues for a project (with rankings)
  getAllByProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return await getIssuesByProject(input.projectId);
    }),

  // Update issue
  update: protectedProcedure
    .input(z.object({
      issueId: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      difficulty: z.number().min(1).max(5).optional(),
      dueDate: z.date().optional(),
      status: z.enum(["open", "in_progress", "closed"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { issueId, ...data } = input;
      return await updateIssue(issueId, data);
    }),

  // Delete issue
  delete: protectedProcedure
    .input(z.object({ issueId: z.string() }))
    .mutation(async ({ input }) => {
      return await deleteIssue(input.issueId);
    }),
});
```

**Don't forget to register in root router:**
```typescript
// File: /apps/dokploy/server/api/root.ts
import { issueRouter } from "./routers/issue";

export const appRouter = createTRPCRouter({
  // ... existing routers
  issue: issueRouter, // ADD THIS LINE
});
```

**Learning Checkpoint Questions:**
- ❓ What is tRPC and why is it called "type-safe"?
- ❓ What's the difference between `.query()` and `.mutation()` in tRPC?
- ❓ Why do we use Zod schemas for input validation?

---

### Step 4: Frontend - React Hooks

**File to Create:** `/apps/dokploy/hooks/use-issues.ts`

```typescript
import { api } from "@/utils/api";

export const useIssues = (projectId: string) => {
  return api.issue.getAllByProject.useQuery(
    { projectId },
    {
      enabled: !!projectId, // Only fetch if projectId exists
      refetchOnWindowFocus: false,
    }
  );
};

export const useCreateIssue = () => {
  const utils = api.useContext();

  return api.issue.create.useMutation({
    onSuccess: (data) => {
      // Invalidate cache to refetch issues
      utils.issue.getAllByProject.invalidate({ projectId: data.projectId });
    },
  });
};

export const useUpdateIssue = () => {
  const utils = api.useContext();

  return api.issue.update.useMutation({
    onSuccess: (data) => {
      utils.issue.getAllByProject.invalidate({ projectId: data.projectId });
    },
  });
};
```

**Learning Checkpoint Questions:**
- ❓ What is the purpose of React hooks in this context?
- ❓ Why do we need to "invalidate cache" after mutations?
- ❓ What does `enabled: !!projectId` do?

---

### Step 5: UI Component - Priority Queue Display

**File to Create:** `/apps/dokploy/components/dashboard/projects/priority-queue.tsx`

**Component Structure:**

```tsx
import React from "react";
import { useIssues } from "@/hooks/use-issues";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

interface PriorityQueueProps {
  projectId: string;
}

export const PriorityQueue: React.FC<PriorityQueueProps> = ({ projectId }) => {
  const { data: issues, isLoading } = useIssues(projectId);

  if (isLoading) return <div>Loading priority queue...</div>;
  if (!issues || issues.length === 0) {
    return <div>No issues to display</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Priority Queue</h3>

      <div className="grid gap-3">
        {issues.map((issue) => (
          <Card key={issue.issueId} className="p-4">
            <div className="flex items-start justify-between">
              {/* Rank Badge */}
              <Badge variant="outline" className="mr-3">
                #{issue.priorityRank}
              </Badge>

              <div className="flex-1">
                {/* Issue Title */}
                <h4 className="font-medium">{issue.title}</h4>

                {/* Issue Description */}
                {issue.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {issue.description}
                  </p>
                )}

                {/* Metadata Row */}
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  {/* Difficulty */}
                  <span>
                    Difficulty: {issue.difficulty}/5
                  </span>

                  {/* Due Date */}
                  <span>
                    Due: {formatDistanceToNow(new Date(issue.dueDate), { addSuffix: true })}
                  </span>

                  {/* Status */}
                  <Badge variant={issue.status === "open" ? "default" : "secondary"}>
                    {issue.status}
                  </Badge>
                </div>
              </div>

              {/* Priority Score */}
              <div className="text-right text-sm">
                <div className="text-muted-foreground">Score</div>
                <div className="font-mono font-semibold">
                  {issue.priorityScore.toFixed(2)}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
```

**Learning Checkpoint Questions:**
- ❓ What is the purpose of the `key` prop in the `.map()` function?
- ❓ Why do we check `isLoading` before rendering the issues?
- ❓ What does `formatDistanceToNow` do?

---

### Step 6: Integrate into Projects Tab

**File to Modify:** `/apps/dokploy/components/dashboard/projects/show.tsx`

**Add a clickable label/button:**

```tsx
// Inside the project card mapping (around line 200)

{/* Add this button next to existing actions */}
<Button
  variant="ghost"
  size="sm"
  onClick={() => setSelectedProjectId(project.projectId)}
>
  View Priority Queue
</Button>

{/* Add dialog/sheet to show priority queue */}
<Sheet open={!!selectedProjectId} onOpenChange={() => setSelectedProjectId(null)}>
  <SheetContent className="w-[600px] sm:w-[800px]">
    <SheetHeader>
      <SheetTitle>Priority Queue</SheetTitle>
    </SheetHeader>
    {selectedProjectId && <PriorityQueue projectId={selectedProjectId} />}
  </SheetContent>
</Sheet>
```

**Learning Checkpoint Questions:**
- ❓ What's the difference between a Dialog and a Sheet component?
- ❓ Why do we use `!!selectedProjectId` as the `open` prop value?
- ❓ How does clicking the button trigger the sheet to open?

---

## 🎨 UI/UX Design Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  Priority Queue for Project: "E-Commerce Backend"          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │ #1  Fix authentication bug                Score  │      │
│  │     User login fails with JWT token errors  0.60 │      │
│  │     Difficulty: 3/5  |  Due: 1 day overdue      │      │
│  │     Status: [open]                                │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │ #2  Optimize database queries               2.80 │      │
│  │     Slow response times on product listings       │      │
│  │     Difficulty: 4/5  |  Due: in 3 days           │      │
│  │     Status: [in_progress]                         │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │ #3  Add email notifications                 4.20 │      │
│  │     Send order confirmation emails                │      │
│  │     Difficulty: 2/5  |  Due: in 7 days           │      │
│  │     Status: [open]                                │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
│  [+ Add New Issue]                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing Strategy

### Unit Tests

**File:** `/apps/dokploy/__tests__/services/issue.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { calculatePriorityScore } from "@/services/issue";

describe("Priority Score Calculation", () => {
  it("should give higher priority to overdue issues", () => {
    const overdue = new Date(Date.now() - 86400000); // 1 day ago
    const future = new Date(Date.now() + 86400000);  // 1 day from now

    const overdueScore = calculatePriorityScore(3, overdue);
    const futureScore = calculatePriorityScore(3, future);

    expect(overdueScore).toBeLessThan(futureScore);
  });

  it("should give higher priority to difficult issues (same due date)", () => {
    const dueDate = new Date(Date.now() + 172800000); // 2 days

    const easyScore = calculatePriorityScore(1, dueDate);
    const hardScore = calculatePriorityScore(5, dueDate);

    expect(hardScore).toBeGreaterThan(easyScore);
  });
});
```

### Integration Tests

**File:** `/apps/dokploy/__tests__/api/issue.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { appRouter } from "@/server/api/root";

describe("Issue API Router", () => {
  it("should create an issue and assign correct rank", async () => {
    // Test implementation
  });

  it("should recalculate ranks when issue is updated", async () => {
    // Test implementation
  });
});
```

---

## 📈 Performance Considerations

### Database Indexing

```sql
-- Add indexes for faster queries
CREATE INDEX idx_issues_project_rank ON issue(projectId, priorityRank);
CREATE INDEX idx_issues_due_date ON issue(dueDate);
CREATE INDEX idx_issues_status ON issue(status);
```

### Caching Strategy

- Use tRPC's built-in React Query caching
- Set reasonable `staleTime` (e.g., 5 minutes)
- Invalidate cache only when mutations occur

### Optimization Tips

1. **Batch Rank Calculations**: Update all ranks in a single transaction
2. **Debounce UI Updates**: Avoid recalculating on every keystroke
3. **Pagination**: Show top 50 issues, add "Load More" button
4. **Background Jobs**: Use a cron job to recalculate all ranks daily

---

## 🚀 Deployment Checklist

- [ ] Database migration applied to production
- [ ] Environment variables configured (if any)
- [ ] API endpoints tested in staging
- [ ] UI components tested across browsers
- [ ] Performance metrics validated (< 200ms response time)
- [ ] Error handling and edge cases covered
- [ ] User permissions verified
- [ ] Documentation updated

---

## 🔄 Future Enhancements

### Phase 2 Features
1. **Custom Weights**: Allow users to adjust difficulty/urgency weights
2. **Issue Tags**: Add labels/categories for filtering
3. **Assignees**: Track who's working on each issue
4. **GitHub Integration**: Sync with GitHub Issues API
5. **Notifications**: Alert users when high-priority issues are due soon
6. **Analytics Dashboard**: Show issue completion trends

### Phase 3 Features
1. **AI-Powered Difficulty Estimation**: Use ML to suggest difficulty levels
2. **Dependency Tracking**: Link related issues
3. **Time Tracking**: Log hours spent on each issue
4. **Sprint Planning**: Group issues into sprints

---

## 📚 Learning Resources

### Recommended Reading Order

1. **Drizzle ORM Documentation**: https://orm.drizzle.team/docs/overview
2. **tRPC Documentation**: https://trpc.io/docs/quickstart
3. **React Query (TanStack Query)**: https://tanstack.com/query/latest
4. **Next.js App Router**: https://nextjs.org/docs/app
5. **Radix UI Components**: https://www.radix-ui.com/primitives

### Key Concepts to Understand

- **Type Safety**: How TypeScript flows from database → API → frontend
- **Server Components vs Client Components** in Next.js
- **Optimistic Updates** in React Query
- **Database Transactions** in Drizzle ORM
- **Component Composition** in React

---

## ❓ Comprehensive Learning Questions

### Database Layer
1. What is an ORM and why does Dokploy use Drizzle instead of raw SQL?
2. How does `onDelete: "cascade"` affect data integrity?
3. Why use `timestamp` for dates instead of `text`?

### API Layer
4. What makes tRPC "type-safe" compared to REST APIs?
5. When should you use `.query()` vs `.mutation()` in tRPC?
6. How does Zod validation protect against invalid data?

### Business Logic
7. Why calculate priority scores instead of letting users manually rank issues?
8. What are the trade-offs of using a weighted formula vs simple sorting?
9. How would you handle ties in priority scores?

### Frontend Layer
10. What is React Query and how does it manage server state?
11. Why use `useCallback` and `useMemo` in React components?
12. What's the difference between controlled and uncontrolled form inputs?

### Architecture
13. Why separate concerns into schema → service → router → component layers?
14. What are the benefits of colocation (keeping related files together)?
15. How does type inference work from backend to frontend in this stack?

---

## 🎯 Implementation Timeline

### Week 1: Foundation
- Day 1-2: Database schema and migrations
- Day 3-4: Service layer functions
- Day 5: Write unit tests

### Week 2: API & Integration
- Day 1-2: tRPC router endpoints
- Day 3-4: React hooks and data fetching
- Day 5: Write integration tests

### Week 3: UI & Polish
- Day 1-3: Build UI components
- Day 4: Integrate into projects tab
- Day 5: User testing and bug fixes

### Week 4: Deployment & Documentation
- Day 1-2: Staging deployment and testing
- Day 3: Production deployment
- Day 4-5: Documentation and knowledge transfer

---

## 📝 Code Review Checklist

Before submitting your code for review, ensure:

- [ ] All TypeScript types are properly defined (no `any`)
- [ ] Error handling covers edge cases (empty data, network failures)
- [ ] Loading states and error states are shown in UI
- [ ] Accessibility: keyboard navigation works, ARIA labels present
- [ ] Mobile responsive design tested
- [ ] Database queries are optimized (no N+1 queries)
- [ ] Security: user permissions enforced at API level
- [ ] Tests achieve >80% code coverage
- [ ] Code follows existing project conventions
- [ ] Git commits are atomic and well-described

---

## 🏁 Next Steps

1. **Read through this entire design document**
2. **Answer the learning checkpoint questions** (write them down!)
3. **Set up your development environment**
4. **Start with Step 1: Database Schema**
5. **Work through each step sequentially**
6. **Ask questions when stuck!**

Remember: **Understanding WHY is more important than memorizing HOW.**

Good luck with your implementation! 🚀
