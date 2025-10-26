# Priority Queue Feature - Local Testing Guide

## 🚀 Quick Start

### Prerequisites
- PostgreSQL database running
- Node.js 20.16.0
- pnpm 9.5.0

---

## 📋 Step-by-Step Testing Instructions

### **Step 1: Set Up Environment**

```bash
cd /home/user/dokploy/apps/dokploy

# Copy example environment file
cp .env.example .env

# Edit .env and ensure DATABASE_URL is correct
# DATABASE_URL should point to a running PostgreSQL instance
```

### **Step 2: Install Dependencies (if not done)**

```bash
cd /home/user/dokploy
pnpm install
```

### **Step 3: Run Database Migration**

This creates the `issue` table in your database:

```bash
cd /home/user/dokploy/apps/dokploy
pnpm migration:run
```

Expected output:
```
Migration complete
```

### **Step 4: Start Development Server**

```bash
cd /home/user/dokploy
pnpm dokploy:dev
```

Server should start at: `http://localhost:3000`

---

## 🧪 Manual Testing Checklist

### **Test 1: View Priority Queue**

1. ✅ Navigate to Projects page (`/dashboard/projects`)
2. ✅ Find any project card
3. ✅ Click the "..." (More) button on the project
4. ✅ Click "View Priority Queue"
5. ✅ Verify Sheet overlay opens from right side

**Expected Result:**
- Sheet opens with "Priority Queue" title
- Stats cards show: 0 Total, 0 Open, 0 In Progress, 0 Overdue
- Empty state message: "No active issues to display"
- "Create Your First Issue" button visible

---

### **Test 2: Create First Issue**

1. ✅ Click "Add Issue" or "Create Your First Issue"
2. ✅ Fill in the form:
   - **Title:** "Fix authentication bug"
   - **Description:** "Users cannot login with JWT tokens"
   - **Difficulty:** 4 - Hard
   - **Due Date:** Select tomorrow's date
   - **Status:** (auto-set to "Open")
3. ✅ Click "Create Issue"

**Expected Result:**
- Success toast: "Issue created successfully"
- Issue appears in the list with:
  - **Rank Badge:** #1
  - **Title & Description** displayed
  - **Difficulty Badge:** "Difficulty: 4/5" (red/destructive color)
  - **Due Date Badge:** "in 1 day" (or similar)
  - **Status Badge:** "Open"
  - **Priority Score:** A decimal number (e.g., 2.20)

---

### **Test 3: Create Second Issue (Higher Priority)**

1. ✅ Click "Add Issue" again
2. ✅ Fill in:
   - **Title:** "Security vulnerability - SQL injection"
   - **Description:** "Critical security flaw in user input"
   - **Difficulty:** 5 - Very Hard
   - **Due Date:** Select today's date (overdue by end of day)
   - **Status:** Open
3. ✅ Click "Create Issue"

**Expected Result:**
- New issue appears at **#1** (top of list)
- Previous issue moves to **#2**
- Stats update: 2 Total, 2 Open
- First issue has LOWER priority score than second

---

### **Test 4: Create Third Issue (Lower Priority)**

1. ✅ Click "Add Issue"
2. ✅ Fill in:
   - **Title:** "Update documentation"
   - **Description:** "Add API examples to README"
   - **Difficulty:** 2 - Easy
   - **Due Date:** 1 week from now
   - **Status:** Open
3. ✅ Click "Create Issue"

**Expected Result:**
- Issue appears at **#3** (bottom)
- Ranks: Security issue (#1), Auth bug (#2), Documentation (#3)
- Stats: 3 Total, 3 Open

---

### **Test 5: Edit Issue and Verify Re-ranking**

1. ✅ Click on the #3 Documentation issue card
2. ✅ Change:
   - **Difficulty:** 5 - Very Hard
   - **Due Date:** Yesterday (make it overdue)
3. ✅ Click "Update Issue"

**Expected Result:**
- Documentation issue moves to **#1** (highest priority)
- Other issues shift down
- Priority scores recalculated
- Due date badge shows "X days ago" in red (overdue)

---

### **Test 6: Change Issue Status**

1. ✅ Click on any issue
2. ✅ Change **Status** to "In Progress"
3. ✅ Click "Update Issue"

**Expected Result:**
- Status badge changes to "In Progress" (blue color)
- Stats update: 2 Open, 1 In Progress

---

### **Test 7: Close an Issue**

1. ✅ Click on any issue
2. ✅ Change **Status** to "Closed"
3. ✅ Click "Update Issue"

**Expected Result:**
- Issue disappears from the list (closed issues are hidden)
- Stats update accordingly
- Remaining issues re-rank

---

### **Test 8: Delete an Issue**

1. ✅ Click on any issue
2. ✅ Click the red "Delete" button
3. ✅ Confirm deletion

**Expected Result:**
- Issue removed from list
- Remaining issues re-rank automatically
- Stats update
- Success toast: "Issue deleted successfully"

---

### **Test 9: Verify Priority Algorithm**

Create these test issues and verify ranking:

| Title | Difficulty | Due Date | Expected Rank |
|-------|-----------|----------|---------------|
| Overdue + Hard | 5 | 2 days ago | **#1** |
| Overdue + Medium | 3 | 1 day ago | **#2** |
| Today + Hard | 5 | Today | **#3** |
| Tomorrow + Easy | 1 | Tomorrow | **#4** |

**Formula Check:**
```
Priority Score = (0.4 × Difficulty) + (0.6 × DaysUntilDue)
Lower Score = Higher Priority
```

---

## 🎯 What to Look For

### ✅ **Correct Behavior:**
- Issues auto-rank when created/updated
- Overdue issues have RED badges
- Difficulty badges color-coded (1-2: gray, 3: default, 4-5: red)
- Stats update in real-time
- Form validation works (required fields)
- Toast notifications appear
- Sheet closes after operations

### ❌ **Potential Issues to Debug:**
- Migration errors → Check DATABASE_URL in .env
- TypeScript errors → Run `pnpm typecheck`
- UI not loading → Check browser console for errors
- Data not saving → Check backend logs
- Ranks not updating → Check `recalculateProjectPriorities` logs

---

## 🔍 Advanced Testing

### **Test Priority Score Calculation**

Open browser DevTools Console and check the priority scores:

```javascript
// In browser console after viewing priority queue
// You should see issues with scores like:
// Overdue by 2 days, difficulty 5: (0.4 × 5) + (0.6 × -2) = 2.0 - 1.2 = 0.8
// Due in 5 days, difficulty 2: (0.4 × 2) + (0.6 × 5) = 0.8 + 3.0 = 3.8
```

### **Test Database Directly**

```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# Query issues
SELECT "issueId", title, difficulty, "dueDate", "priorityScore", "priorityRank"
FROM issue
ORDER BY "priorityRank";

# Should show issues sorted by rank
```

---

## 🐛 Troubleshooting

### **Problem: "Migration failed"**
```bash
# Check if database is running
psql $DATABASE_URL -c "SELECT version();"

# Drop and recreate issue table if needed
psql $DATABASE_URL -c "DROP TABLE IF EXISTS issue CASCADE;"
pnpm migration:run
```

### **Problem: "tRPC error - issue router not found"**
```bash
# Verify server is running
# Check terminal for build errors
# Restart dev server: Ctrl+C then pnpm dokploy:dev
```

### **Problem: "Sheet doesn't open"**
- Check browser console for React errors
- Verify Sheet component is imported correctly
- Check if `priorityQueueProjectId` state is updating

### **Problem: "Issues not ranking correctly"**
- Check if `recalculateProjectPriorities` is being called
- Verify date calculations (timezone issues?)
- Check database `priorityScore` and `priorityRank` columns

---

## 📊 Expected Database Schema

After migration, your `issue` table should have:

```sql
\d issue

-- Columns:
-- issueId         | text      | PRIMARY KEY
-- title           | text      | NOT NULL
-- description     | text      |
-- difficulty      | integer   | NOT NULL
-- dueDate         | timestamp | NOT NULL
-- priorityScore   | real      |
-- priorityRank    | integer   |
-- status          | text      | DEFAULT 'open'
-- projectId       | text      | FOREIGN KEY -> project
-- createdAt       | timestamp | DEFAULT now()
-- updatedAt       | timestamp | DEFAULT now()
```

---

## 🎉 Success Criteria

You've successfully tested the feature when:

- ✅ Can create issues from the UI
- ✅ Issues appear with correct ranking
- ✅ Updating difficulty/date causes re-ranking
- ✅ Stats update in real-time
- ✅ Can edit and delete issues
- ✅ Overdue issues show in red
- ✅ Closed issues are hidden from active list
- ✅ Priority scores follow the formula
- ✅ No console errors
- ✅ All CRUD operations work smoothly

---

## 🚀 Next Steps After Testing

1. **Code Review:** Review the implementation in:
   - `/packages/server/src/services/issue.ts` (business logic)
   - `/apps/dokploy/server/api/routers/issue.ts` (API)
   - `/apps/dokploy/components/dashboard/projects/priority-queue.tsx` (UI)

2. **Experiment:** Try modifying:
   - The priority weights (currently 0.4 difficulty, 0.6 urgency)
   - Add filtering by difficulty
   - Add sorting options
   - Change the UI styling

3. **Deploy:** Once tested locally, you can:
   - Create a pull request
   - Deploy to staging environment
   - Share with team for feedback

---

**Happy Testing! 🎊**

If you encounter any issues, check the browser console and server logs for error messages.
