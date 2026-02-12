# Territory Mapper - Developer Guide

## Project Overview
Offline-first PWA for door-to-door ministry territory management. Built with Next.js 16, React 19, TypeScript, Tailwind CSS v4, RxDB, and Supabase.

## Development Standards

### TypeScript Guidelines

#### Avoid `any` Types
- Use specific types from `@/app/types` or define new interfaces
- For RxDB documents, use the `RxDocument` type from `@/app/hooks/useRxDB`
- For API updates, use `Partial<T> & { updated_at: string }` pattern

```typescript
// ❌ Bad
const updates: Record<string, any> = {}

// ✅ Good
const updates: Partial<Territory> & { updated_at: string } = {
  updated_at: new Date().toISOString()
}
```

#### Type-Safe API Routes
All API routes should use proper typing:

```typescript
// Use types from @/app/types
import type { Territory, House, Assignment } from '@/app/types';

// For update objects
const updates: Partial<Territory> & { updated_at: string } = { ... }
```

### Logging Standards

#### Use the Logger Utility
Always use the centralized logger instead of console statements:

```typescript
import { logger } from '@/app/lib/utils/logger';

// ❌ Bad
console.log('Debug info', data);
console.error('Error occurred', err);

// ✅ Good
logger.debug('Debug info', data);
logger.error('Error occurred', err);
```

The logger automatically:
- Filters based on log level (error-only in production)
- Adds prefixes for easier filtering
- Handles server vs client environments

### React Compiler Compatibility

#### Avoid Impure Functions in Render
Don't call `Date.now()`, `Math.random()`, or `new Date()` directly in render or useMemo:

```typescript
// ❌ Bad - React Compiler error
const daysOverdue = Math.ceil((Date.now() - new Date(dueDate).getTime()) / 86400000);

// ✅ Good - Use useRef for stability
const now = useRef(Date.now()).current;
const daysOverdue = useMemo(() => {
  return Math.ceil((now - new Date(dueDate).getTime()) / 86400000);
}, [dueDate, now]);
```

#### Avoid setState in useEffect Sync
Don't call `setState` synchronously at the start of useEffect:

```typescript
// ❌ Bad - React Compiler warning
useEffect(() => {
  setMounted(true); // This is synchronous
}, []);

// ✅ Good - Use useSyncExternalStore for hydration
const [isDark, setIsDark] = useState(() => {
  // Initialize from localStorage if available
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
  }
  return false;
});
```

### Unused Variables

#### Clean Up Imports and Variables
Remove unused imports and variables:

```typescript
// ❌ Bad
import { MapPin, Users, CheckCircle2, AlertCircle } from 'lucide-react';
// Only MapPin is used

// ✅ Good
import { MapPin } from 'lucide-react';
```

ESLint is configured to warn on unused variables with `_` prefix as an exception for intentional unused params.

## Project Structure

```
app/
├── (dashboard)/          # Route groups
│   ├── overseer/         # Overseer dashboard
│   └── publisher/        # Publisher dashboard
├── api/                  # API routes
├── components/           # Shared components
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and services
│   ├── db/
│   │   ├── rxdb/         # RxDB configuration
│   │   ├── supabase/     # Supabase client/server
│   │   └── replication/  # Sync logic
│   ├── encryption/       # DNC encryption
│   └── utils/            # Helper functions
├── types/                # TypeScript interfaces
└── ...
```

## Build and Deployment

### Pre-build Checklist
- Run `npm run build` locally before pushing
- Check for TypeScript errors
- Verify no console.log statements remain (except in logger.ts)

### Environment Variables
Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=
DNC_ENCRYPTION_KEY=
```

## Key Files

- `app/lib/db/rxdb/index.ts` - Database initialization
- `app/lib/db/replication/supabase.ts` - Sync logic
- `app/lib/utils/logger.ts` - Logging utility
- `app/types/index.ts` - Core TypeScript types
- `proxy.ts` - Next.js proxy (formerly middleware.ts)
