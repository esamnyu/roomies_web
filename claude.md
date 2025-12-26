# Roomies - Project Guidelines

## Northstar Vision

**Roomies** is a full household management suite designed to make shared living pleasant and conflict-free. The app helps roommates coordinate expenses, chores, and communication with transparency and fairness at its core.

### Core Principles
1. **Fairness First** - Every feature should promote equitable sharing of costs and responsibilities
2. **Transparency** - All financial and chore data should be visible to household members
3. **Simplicity** - Keep the UX lean; avoid feature bloat that complicates the roommate experience
4. **Reliability** - Financial data must be accurate; use ledger-based accounting patterns
5. **Mobile-Ready** - Design all features to work seamlessly on mobile devices

### Target Scale
- Medium scale: 100-1,000 households
- Optimize for households of 2-6 members
- Balance feature development with performance considerations

---

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TailwindCSS
- **Backend**: Next.js API Routes, Supabase (PostgreSQL + Auth + Realtime)
- **Database**: PostgreSQL via Supabase with Row-Level Security (RLS)
- **AI/Embeddings**: pgvector for semantic search, OpenAI embeddings

### Directory Structure
```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Public auth pages (login, register)
│   ├── (dashboard)/       # Protected dashboard pages
│   └── api/               # API route handlers
├── components/            # React components by feature
│   ├── ui/               # Generic UI primitives
│   ├── dashboard/        # Dashboard-specific components
│   ├── expenses/         # Expense feature components
│   ├── tasks/            # Chore/task components
│   └── chat/             # Messaging components
├── lib/                   # Utilities and business logic
│   ├── services/         # API service layer
│   └── validation/       # Zod schemas
├── context/              # React Context providers
├── hooks/                # Custom React hooks (create as needed)
└── types/                # TypeScript type definitions
```

### Database Schema (27 tables)
| Domain | Tables |
|--------|--------|
| **Core** | profiles, households, household_members |
| **Financial** | expenses, expense_splits, settlements, ledger_entries, ledger_balances, recurring_expenses, expense_payments |
| **Chores** | household_chores, chore_assignments |
| **Messaging** | messages, conversations, conversation_participants |
| **Support** | notifications, invitations, embeddings, cache_household_stats |

---

## Security Requirements (HIGH PRIORITY)

### Critical Issues to Fix

#### 1. Enable RLS on All Public Tables
The following tables are exposed without RLS protection:
```sql
-- MUST enable RLS on these tables:
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chore_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_split_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_household_stats ENABLE ROW LEVEL SECURITY;
```

#### 2. Add RLS Policies to Tables with RLS Enabled
These tables have RLS enabled but no policies (effectively blocking all access):
- `invitations`, `conversations`, `conversation_participants`
- `embeddings`, `embedding_generation_logs`, `embedding_performance_metrics`
- `expense_idempotency`, `transaction_logs`, `chore_assignment_idempotency`

#### 3. Fix SECURITY_DEFINER Views
Convert these views to use SECURITY INVOKER or add proper security checks:
- `expense_categories`, `user_conversation_list`, `embedding_health_metrics`
- `user_balances`, `embedding_statistics`, `embedding_coverage_by_household`

#### 4. Set search_path on All Functions
90+ functions have mutable search_path. Fix with:
```sql
CREATE OR REPLACE FUNCTION function_name()
RETURNS ...
SECURITY INVOKER
SET search_path = public
AS $$
...
$$;
```

#### 5. Enable Leaked Password Protection
Enable in Supabase Dashboard: Authentication > Settings > Enable leaked password protection

### RLS Policy Patterns

Always use household membership checks:
```sql
-- Good: Check household membership
CREATE POLICY "Users can view household data"
ON public.table_name
FOR SELECT
USING (
  household_id IN (
    SELECT household_id FROM public.household_members
    WHERE user_id = (SELECT auth.uid())
  )
);

-- IMPORTANT: Use (SELECT auth.uid()) not auth.uid() for performance
-- This prevents re-evaluation per row
```

### API Route Security
```typescript
// Always use auth wrappers for protected routes
import { withAuth, withHouseholdAdmin } from '@/lib/auth';

// For authenticated routes
export const GET = withAuth(async (request, user) => {
  // user is guaranteed to be authenticated
});

// For admin-only routes
export const DELETE = withHouseholdAdmin(async (request, user, householdId) => {
  // user is guaranteed to be household admin
});
```

---

## Database Guidelines

### Ledger-Based Accounting
All financial operations MUST use the ledger system for audit trails:
```typescript
// Use atomic functions for financial operations
const { data } = await supabase.rpc('create_expense_atomic', {
  p_household_id: householdId,
  p_description: description,
  p_amount: amount,
  p_paid_by: userId,
  p_splits: splits
});
```

### Migration Best Practices
```sql
-- Always include rollback capability
-- Name migrations descriptively: YYYYMMDD_description

-- Good migration structure:
BEGIN;
  -- Forward migration
  CREATE TABLE ...;

  -- Add RLS immediately
  ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

  -- Add policies
  CREATE POLICY "policy_name" ON new_table ...;
COMMIT;
```

### Indexing Strategy
Add indexes for:
- Foreign keys used in JOINs
- Columns used in WHERE clauses
- Columns used in ORDER BY

Remove unused indexes periodically (check `pg_stat_user_indexes`).

### Performance Patterns
```sql
-- Use (SELECT auth.uid()) in RLS policies, not auth.uid()
-- This creates an InitPlan that evaluates once per query

-- Bad (evaluates per row):
CREATE POLICY "..." ON table USING (user_id = auth.uid());

-- Good (evaluates once):
CREATE POLICY "..." ON table USING (user_id = (SELECT auth.uid()));
```

---

## Frontend Patterns

### Component Organization
- **Keep components focused**: Max 200 lines per component
- **Split by concern**: Container (data) vs Presentational (UI)
- **Feature-based folders**: Group related components together

```typescript
// components/expenses/
├── ExpenseForm.tsx          # Form for creating/editing
├── ExpenseList.tsx          # List display
├── ExpenseCard.tsx          # Individual expense card
├── PaymentMatrix.tsx        # Balance visualization
└── index.ts                 # Barrel exports
```

### State Management
- Use React Context for global state (auth, household context)
- Use local state (`useState`) for component-specific state
- Consider React Query/SWR for server state (caching, revalidation)

```typescript
// Create household context for dashboard
const HouseholdContext = createContext<HouseholdContextType | null>(null);

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (!context) throw new Error('useHousehold must be used within HouseholdProvider');
  return context;
}
```

### Form Handling
- Use controlled components with validation
- Implement optimistic updates for better UX
- Always show loading states during async operations

```typescript
// Use Zod for validation
const expenseSchema = z.object({
  description: z.string().min(1, 'Description required'),
  amount: z.number().positive('Amount must be positive'),
  splits: z.array(splitSchema).min(1, 'At least one split required')
});
```

### Error Handling
```typescript
// Use error boundaries for component-level errors
// Show user-friendly error messages
// Log errors for debugging (consider Sentry)

try {
  await createExpense(data);
} catch (error) {
  if (error instanceof ValidationError) {
    setFieldErrors(error.fieldErrors);
  } else {
    toast.error('Failed to create expense. Please try again.');
    console.error('Expense creation failed:', error);
  }
}
```

---

## API & Data Fetching

### Service Layer Pattern
All API calls should go through service functions:
```typescript
// lib/services/expenseService.ts
export async function createExpense(data: CreateExpenseInput): Promise<Expense> {
  const response = await fetch('/api/expenses', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new ApiError(error.message, response.status);
  }

  return response.json();
}
```

### API Route Structure
```typescript
// Consistent response format
interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
}

// Use error handler for consistent error responses
import { handleApiError } from '@/lib/errorhandler';

export async function POST(request: Request) {
  try {
    // ... handler logic
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Supabase Client Usage
```typescript
// Server-side (API routes, Server Components)
import { createServerClient } from '@/lib/supabase-ssr';
const supabase = await createServerClient();

// Client-side (Client Components)
import { supabaseClient } from '@/lib/supabase';
```

---

## Real-time Features

### Supabase Subscriptions
```typescript
// Subscribe to household updates
useEffect(() => {
  const channel = supabase
    .channel(`household:${householdId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'expenses',
      filter: `household_id=eq.${householdId}`
    }, (payload) => {
      // Handle real-time update
      handleExpenseChange(payload);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [householdId]);
```

### Real-time Patterns
- Subscribe at the page/layout level, not individual components
- Use optimistic updates for user actions
- Handle reconnection gracefully
- Unsubscribe on unmount to prevent memory leaks

---

## AI/Embeddings Integration

### Vector Search Architecture
The app uses pgvector for semantic search across:
- Expense descriptions (pattern matching)
- Chat conversations (context retrieval)
- Household rules/context

### Embedding Patterns
```typescript
// Queue embeddings asynchronously - don't block user actions
await supabase.rpc('queue_unified_embedding', {
  p_entity_type: 'expense',
  p_entity_id: expenseId,
  p_content: description,
  p_household_id: householdId
});

// Search with hybrid approach (vector + text)
const results = await supabase.rpc('hybrid_search_embeddings', {
  p_query_text: searchQuery,
  p_query_embedding: embedding,
  p_household_id: householdId,
  p_match_count: 10
});
```

### RAG Context Retrieval
```typescript
// Use for AI-powered features
const context = await supabase.rpc('get_unified_rag_context', {
  p_household_id: householdId,
  p_query_embedding: embedding,
  p_entity_types: ['expense', 'conversation', 'household_context']
});
```

---

## Mobile Considerations

### Responsive Design
- Mobile-first CSS approach
- Touch-friendly tap targets (min 44x44px)
- Swipe gestures for common actions
- Bottom navigation for primary actions

### Performance
- Lazy load images and heavy components
- Minimize bundle size (code splitting)
- Use skeleton loaders for perceived performance
- Cache aggressively for offline support

### Future React Native
Structure code to share:
- Types and interfaces
- Validation schemas
- API service layer
- Business logic utilities

---

## Testing Strategy

### Testing Pyramid
1. **Unit Tests** (70%) - Utilities, services, business logic
2. **Integration Tests** (20%) - API routes, database operations
3. **E2E Tests** (10%) - Critical user flows

### Setup (TODO)
```bash
# Install testing dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D playwright  # For E2E
```

### Test Patterns
```typescript
// Unit test example
describe('calculateBalance', () => {
  it('should correctly sum credits and debits', () => {
    const entries = [
      { amount: 100, entry_type: 'credit' },
      { amount: 50, entry_type: 'debit' }
    ];
    expect(calculateBalance(entries)).toBe(50);
  });
});

// API integration test
describe('POST /api/expenses', () => {
  it('should create expense with splits', async () => {
    const response = await request(app)
      .post('/api/expenses')
      .send(validExpenseData);
    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty('id');
  });
});
```

### Critical Flows to Test
- [ ] User registration and login
- [ ] Expense creation with splits
- [ ] Settlement recording
- [ ] Chore assignment rotation
- [ ] Invitation acceptance
- [ ] Real-time message delivery

---

## Performance Guidelines

### Database Optimization
1. **Index foreign keys** used in RLS policies
2. **Use (SELECT auth.uid())** pattern in all RLS policies
3. **Batch operations** when possible
4. **Use database functions** for complex operations

### Frontend Optimization
1. **Memoize expensive calculations** with useMemo
2. **Debounce search inputs** (300ms)
3. **Virtual scroll** for long lists (>50 items)
4. **Image optimization** via next/image

### API Optimization
1. **Select only needed columns** in Supabase queries
2. **Use RPC functions** for complex queries
3. **Implement pagination** for list endpoints
4. **Cache frequently accessed data**

---

## Code Style & Conventions

### TypeScript
- Enable strict mode (already configured)
- Define explicit types for function parameters and returns
- Use branded types for IDs: `type UserId = string & { readonly __brand: 'UserId' }`
- Centralize types in `src/types/`

### Naming Conventions
```typescript
// Components: PascalCase
export function ExpenseCard() {}

// Hooks: camelCase with 'use' prefix
export function useHousehold() {}

// Utilities: camelCase
export function calculateBalance() {}

// Constants: SCREAMING_SNAKE_CASE
export const MAX_HOUSEHOLD_MEMBERS = 10;

// Types: PascalCase
interface Expense {}
type ExpenseStatus = 'pending' | 'settled';
```

### File Organization
- One component per file
- Colocate tests with source files (`Component.test.tsx`)
- Use barrel exports (`index.ts`) for cleaner imports

---

## Technical Debt Tracker

### Priority 1: Security (Block before new features)
- [x] Enable RLS on 8 unprotected tables *(completed: migration applied)*
- [ ] Add policies to 9 tables with RLS but no policies
- [ ] Fix 6 SECURITY_DEFINER views
- [ ] Enable leaked password protection
- [ ] Remove temporary admin bypass in `/api/households/[id]/members`

### Priority 2: Performance (Fix within 2 sprints)
- [x] Fix 29 RLS policies using `auth.uid()` instead of `(SELECT auth.uid())` *(completed)*
- [x] Add indexes to 9 unindexed foreign keys *(completed)*
- [ ] Remove 20+ unused indexes
- [x] Consolidate duplicate RLS policies on expense_splits and profiles *(completed)*

### Priority 3: Code Quality (Ongoing)
- [x] Remove unused AuthProvider.tsx *(completed: deleted)*
- [x] Remove Prisma dependency *(completed: deleted prisma/ dir and package)*
- [x] Clean up test endpoints *(completed: deleted test-auth, test-supabase, debug-cookies)*
- [ ] **Standardize server-side auth** - Currently mixed pattern:
  - Some routes use `getServerSession(authOptions)` (NextAuth)
  - Some routes use `supabase.auth.getSession()` (Supabase direct)
  - Consider migrating all to Supabase Auth to remove NextAuth dependency
- [ ] Split large components (TasksClientPage: 390+ lines)
- [ ] Centralize type definitions
- [ ] Standardize data fetching (choose service layer OR direct Supabase)
- [ ] Add testing infrastructure

### Priority 4: Database Cleanup
- [ ] Move extensions to dedicated schema (vector, pg_trgm, fuzzystrmatch)
- [ ] Set search_path on 90+ functions
- [ ] Review and secure materialized views

---

## Quick Reference

### Common Commands
```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # Run ESLint
```

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```

### Useful Supabase RPC Functions
| Function | Purpose |
|----------|---------|
| `create_expense_atomic` | Create expense with ledger entries |
| `create_settlement` | Record settlement between users |
| `get_household_balances` | Get all member balances |
| `get_household_data` | Fetch complete household data |
| `rotate_chore_assignments` | Rotate chores to next cycle |

---

*Last updated: December 2024*
*Audit performed: Comprehensive database and codebase review*
