# Territory Mapper

A Progressive Web App (PWA) for door-to-door ministry territory management. Built with offline-first architecture, accessibility features, and privacy-focused design.

## Features

### Phase 1: The Bedrock ✅
- ✅ Next.js 14 PWA with offline support
- ✅ Mapbox GL JS integration
- ✅ RxDB for local data storage
- ✅ Supabase Auth with congregation isolation
- ✅ High-contrast accessibility mode

### Phase 2: The Overseer Tools
- 🚧 Territory boundary editor
- 🚧 Assignment dashboard
- 🚧 QR code generation for checkouts

### Phase 3: The Publisher Experience
- 🚧 House-to-house tracking
- ✅ Big Mode UI for accessibility
- 🚧 Haptic feedback for DNC proximity
- 🚧 Voice-to-text notes

### Phase 4: Sync & Polish
- 🚧 Background sync
- ✅ Dark mode support
- 🚧 Glassmorphism UI
- 🚧 AES-256 encryption for DNC addresses

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: RxDB (client-side) + Supabase (server-side)
- **Auth**: Supabase Auth
- **Maps**: Mapbox GL JS
- **State**: Zustand
- **PWA**: next-pwa

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Mapbox account

### Environment Variables

Create a `.env.local` file:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token

# Encryption
DNC_ENCRYPTION_KEY=your_secure_key
```

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Development

### Project Structure

```
territory-mapper/
├── app/
│   ├── (auth)/           # Auth routes (login, register)
│   ├── (dashboard)/       # Protected dashboard routes
│   ├── api/               # API routes
│   ├── components/        # React components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities and configurations
│   └── types/             # TypeScript types
├── public/                # Static assets and PWA files
└── supabase/              # Database migrations
```

### Key Features

#### Offline-First Architecture
- RxDB stores all data locally in IndexedDB
- Automatic sync with Supabase when online
- Background sync queue for pending changes

#### Accessibility
- High contrast mode for low vision users
- Big Mode with enlarged touch targets (≥64dp)
- Haptic feedback for DNC proximity warnings
- Voice-to-text for notes
- Full keyboard navigation support

#### Privacy & Security
- Congregation-level data isolation via RLS
- AES-256 encryption for DNC addresses
- No tracking or analytics
- Local-first data storage

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

Built for the ministry. Thank you to all who serve.
