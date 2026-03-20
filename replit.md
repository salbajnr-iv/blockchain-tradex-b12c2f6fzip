# Blockchain Tradex - Project Documentation

## Project Summary

**Blockchain Tradex** is a cryptocurrency trading dashboard and portfolio management application built with React, Vite, and Tailwind CSS. The app integrates with Base44 for authentication and provides real-time crypto market data, trading capabilities, and portfolio analytics.

## Current Status

### ✅ Complete
- **Frontend Framework**: React 18 + Vite configured on port 5000
- **Styling**: Tailwind CSS with custom dark theme
- **UI Components**: Radix UI + shadcn/ui component library
- **Authentication**: Base44 SDK integrated
- **API Aggregation**: CoinGecko API for live pricing
- **Routing**: React Router with 7 main pages
- **State Management**: TanStack Query (React Query)
- **Development Workflow**: npm run dev (configured and running)

### ⏳ In Progress / Planned

#### Phase 1: Database Setup (Supabase)
- [ ] Create Supabase project
- [ ] Create PostgreSQL schema (users, portfolios, holdings, trades, alerts)
- [ ] Set up Row Level Security (RLS)
- [ ] Enable real-time publications

#### Phase 2: Backend API (Node.js + Express)
- [ ] Initialize backend server project
- [ ] Implement auth APIs
- [ ] Implement portfolio APIs
- [ ] Implement trading APIs
- [ ] Implement market data APIs
- [ ] Implement alerts APIs
- [ ] Deploy backend

#### Phase 3: Real-time Integration
- [ ] Set up Supabase real-time subscriptions
- [ ] Create WebSocket server for price streaming
- [ ] Build React hooks for real-time data
- [ ] Integrate into components

#### Phase 4: UI/UX Enhancements
- [ ] Improve dashboard components
- [ ] Enhance trade execution interface
- [ ] Add analytics dashboard
- [ ] Optimize mobile responsiveness

## Project Structure

```
├── .env.local                      # Environment variables (Supabase config)
├── vite.config.js                  # Vite config (port 5000 configured)
├── src/
│   ├── App.jsx                     # Root component with routing
│   ├── main.jsx                    # App entry point
│   ├── pages/                      # Page components
│   │   ├── Dashboard.jsx           # Portfolio overview
│   │   ├── Trade.jsx               # Trading interface
│   │   ├── Markets.jsx             # Market explorer
│   │   ├── Alerts.jsx              # Price alerts
│   │   ├── Card.jsx                # Payment methods
│   │   ├── Transactions.jsx        # Transaction history
│   │   └── Analytics.jsx           # Performance analytics
│   ├── components/                 # Reusable components
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── crypto/                 # Business components
│   │   ├── dashboard/              # Dashboard-specific components
│   │   ├── Layout.jsx              # Main layout wrapper
│   │   └── UserNotRegisteredError.jsx
│   ├── hooks/                      # Custom React hooks
│   │   └── useLivePrices.js        # Live price data hook
│   ├── lib/                        # Utilities and contexts
│   │   ├── AuthContext.jsx         # Auth provider
│   │   ├── query-client.js         # TanStack Query config
│   │   └── PageNotFound.jsx
│   └── api/                        # API clients
│       └── base44Client.js         # Base44 SDK setup
├── index.html                      # HTML template
├── package.json                    # Dependencies
├── tailwind.config.js              # Tailwind customization
├── .replit                         # Replit config
└── .local/
    └── IMPLEMENTATION_PLAN.md      # Detailed implementation roadmap
```

## Dependencies

### Core
- **react**: 18.2.0 - UI library
- **react-dom**: 18.2.0 - React DOM rendering
- **react-router-dom**: 6.26.0 - Client-side routing
- **vite**: 6.1.0 - Build tool and dev server

### State & Data
- **@tanstack/react-query**: 5.84.1 - Data fetching and caching
- **react-hook-form**: 7.54.2 - Form state management
- **zod**: 3.24.2 - Schema validation

### UI & Styling
- **tailwindcss**: 3.4.17 - Utility-first CSS
- **@radix-ui/***: Various - Headless UI components
- **lucide-react**: 0.475.0 - Icon library
- **framer-motion**: 11.16.4 - Animation library
- **next-themes**: 0.4.4 - Theme management

### Visualization
- **recharts**: 2.15.4 - Charting library
- **react-leaflet**: 4.2.1 - Map component
- **three**: 0.171.0 - 3D graphics

### Utilities
- **lodash**: 4.17.21 - Utility functions
- **moment**: 2.30.1 - Date manipulation
- **date-fns**: 3.6.0 - Modern date utilities
- **react-hot-toast**: 2.6.0 - Toast notifications
- **sonner**: 2.0.1 - Better toast component

### External APIs
- **@base44/sdk**: 0.8.0 - Base44 authentication
- **@base44/vite-plugin**: 1.0.0 - Vite integration
- **@stripe/react-stripe-js**: 3.0.0 - Stripe payments

## Running the Application

### Development Mode
```bash
npm run dev
# App runs on http://localhost:5000
# Vite dev server with hot module replacement enabled
```

### Build for Production
```bash
npm run build
# Creates optimized build in dist/
```

### Linting
```bash
npm run lint              # Check for issues
npm run lint:fix         # Auto-fix issues
```

### Type Checking
```bash
npm run typecheck        # Run JSConfig type checks
```

## Environment Configuration

The app is configured to connect to Supabase (when credentials are added).

**Required Environment Variables** (.env.local):
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3000
VITE_COINGEEK_API_URL=https://api.coingecko.com/api/v3
BASE44_LEGACY_SDK_IMPORTS=false
```

## Key Features

### Implemented
✅ Authentication with Base44 SDK
✅ Portfolio dashboard with key metrics
✅ Live cryptocurrency price data (CoinGecko API)
✅ Trading interface with simulated execution
✅ Market explorer with searchable crypto list
✅ Price alerts management
✅ Transaction history
✅ Responsive UI with dark theme
✅ Real-time price charts

### Planned (In Implementation Plan)
⏳ Backend API for trade persistence
⏳ Supabase PostgreSQL database
⏳ Real-time WebSocket updates
⏳ Enhanced analytics dashboard
⏳ Payment method management
⏳ Advanced order types (limit, stop-loss)
⏳ Technical analysis tools
⏳ Tax reporting features

## Development Notes

### Architecture Decisions
- **Vite** for fast dev server and optimized builds
- **Radix UI** for accessible, unstyled component primitives
- **Tailwind CSS** for consistent styling at scale
- **TanStack Query** for powerful data fetching and caching
- **React Router** for nested routing and layouts
- **React Hook Form** for performant form handling

### Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires ES2020+ JavaScript support
- No IE11 support

### Performance Optimizations
- Code splitting via Vite
- Lazy component loading with React.lazy
- Image optimization where applicable
- CSS purging via Tailwind production builds

## Next Steps for Development

1. **Read the Implementation Plan**
   - See `.local/IMPLEMENTATION_PLAN.md` for detailed roadmap
   - Covers database schema, API endpoints, real-time architecture

2. **Set Up Supabase**
   - Create free project at supabase.com
   - Create database tables using provided SQL schemas
   - Add credentials to .env.local

3. **Build Backend Server**
   - Node.js + Express
   - API endpoints for trading, portfolio, markets
   - Integration with Supabase

4. **Implement Real-time Features**
   - Supabase real-time subscriptions
   - WebSocket for live price feeds
   - React hooks for real-time data

5. **Enhance UI/UX**
   - Improve dashboard components
   - Add animations and transitions
   - Optimize for mobile

## Resources

- **Implementation Plan**: `.local/IMPLEMENTATION_PLAN.md`
- **Supabase Documentation**: https://supabase.com/docs
- **React Documentation**: https://react.dev
- **Vite Documentation**: https://vite.dev
- **Tailwind CSS**: https://tailwindcss.com
- **Base44 SDK**: https://docs.base44.io
- **CoinGecko API**: https://docs.coingecko.com

## Workflow Configuration

**Running Workflow:**
- Name: `Start application`
- Command: `npm run dev`
- Port: 5000
- Status: ✅ Running

The Vite development server is configured to:
- Listen on port 5000
- Allow all hosts (for iframe proxy)
- Enable hot module replacement
- Serve with proper CORS headers

## Last Updated
March 20, 2026

---

**Ready to start development!** Follow the Implementation Plan in `.local/IMPLEMENTATION_PLAN.md` for the next steps.
