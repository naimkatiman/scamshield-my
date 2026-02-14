# ScamShield MY

A comprehensive scam detection and reporting platform built for Malaysia, leveraging Cloudflare Workers for global scalability and real-time threat intelligence.

## 🎯 Mission

**"Stop scams before they spread, empower victims with instant recovery tools."**

ScamShield MY provides real-time scam verification, community-driven reporting, and automated incident response tools specifically designed for the Malaysian ecosystem.

## 🚀 Features

### Core Capabilities
- **Real-time Verdict Engine** - Multi-provider risk assessment for contracts, wallets, and social handles
- **Community Reporting System** - Crowd-sourced scam intelligence with gamification
- **Automated Warning Cards** - Shareable visual warnings for social media containment
- **AI-Powered Report Generation** - Instant incident reports for banks, police, and platforms
- **Emergency Recovery Playbook** - Step-by-step victim assistance tools

### Advanced Features
- **Gamification System** - Points, streaks, leaderboards, and monthly competitions
- **Bounty System** - Community rewards for scam identification
- **Brand Partnerships** - Corporate sponsorship for prize pools
- **Multi-language Support** - English and Bahasa Malaysia
- **Rate Limiting & Quotas** - Fair usage with premium tiers

## 🏗️ Architecture

### Tech Stack
- **Runtime**: Cloudflare Workers (Edge computing)
- **Framework**: Hono.js (TypeScript web framework)
- **Database**: Cloudflare D1 (SQLite at edge)
- **Storage**: Cloudflare R2 (Object storage)
- **Cache**: Cloudflare KV (Global key-value store)
- **Queues**: Cloudflare Queues (Background processing)
- **Analytics**: Cloudflare Analytics Engine

### Key Components
```
src/
├── index.ts              # Worker entrypoint + shared middleware
├── types.ts              # TypeScript type definitions
├── routes/               # Route modules by domain
│   ├── auth.ts           # OAuth/session + quota endpoints
│   ├── reporting.ts      # Report submission + AI report generation
│   └── gamification.ts   # Bounties, prizes, partnerships, referrals
├── core/                 # Business logic modules
│   ├── auth.ts          # Authentication & session management
│   ├── verdictService.ts # Risk assessment engine
│   ├── validation.ts    # Input validation & sanitization
│   ├── playbook.ts      # Emergency recovery procedures
│   └── warningCard.ts   # Warning card generation
├── db/                   # Database operations
│   ├── repository.ts    # Core data access layer
│   └── gamification.ts # User engagement system
├── providers/            # External integrations
│   ├── communityProvider.ts
│   └── liveProviders.ts
└── server/              # Server-side rendering
    └── pages.ts         # Dashboard & report pages
```

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- Cloudflare account
- Wrangler CLI installed

### Installation
```bash
# Clone repository
git clone <repository-url>
cd scamshield-my

# Install dependencies
npm install

# Set up environment variables
cp wrangler.toml.example wrangler.toml
# Edit wrangler.toml with your credentials
```

### Environment Variables
```toml
[env.production.vars]
APP_NAME = "ScamShield MY"
REGION = "malaysia"
PROVIDER_MODE = "live" # or "mock" for development

# Authentication
JWT_SECRET = "your-jwt-secret"
GOOGLE_CLIENT_ID = "your-google-client-id"
GOOGLE_CLIENT_SECRET = "your-google-client-secret"
GOOGLE_REDIRECT_URI = "https://your-domain.com/api/auth/callback"

# External APIs (optional)
OPENROUTER_API_KEY = "your-openrouter-key"
COINGECKO_API_KEY = "your-coingecko-key"
GOPLUS_APP_KEY = "your-goplus-key"
GOPLUS_APP_SECRET = "your-goplus-secret"

# Cloudflare Services
DATABASE_ID = "your-d1-database-id"
KV_NAMESPACE_ID = "your-kv-namespace-id"
R2_BUCKET_NAME = "your-r2-bucket-name"
```

### Database Setup
```bash
# Run migrations (local)
npm run d1:migrate:local

# Run migrations (production)
npm run d1:migrate:remote
```

### Development Commands
```bash
# Start development server
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Deploy to production
npm run deploy
```

## 📊 API Documentation

### Core Endpoints

#### Verdict Engine
```http
POST /api/verdict
Content-Type: application/json

{
  "type": "contract|wallet|handle",
  "value": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b",
  "chain": "ethereum" // optional
}
```

#### Community Reporting
```http
POST /api/report
Content-Type: application/json

{
  "reporterSession": "session-id",
  "platform": "telegram",
  "category": "investment",
  "severity": "high",
  "identifiers": {
    "phone": "+60123456789",
    "telegram": "@scammer123"
  },
  "narrative": "Detailed description of the scam...",
  "evidenceKeys": ["screenshot1.png", "chat_log.txt"]
}
```

#### AI Report Generation
```http
POST /api/report/generate-ai
Content-Type: application/json

{
  "incidentTitle": "Telegram Investment Scam",
  "scamType": "Ponzi Scheme",
  "occurredAt": "2024-01-15 14:30",
  "channel": "Telegram",
  "suspects": ["@scammer123", "+60123456789"],
  "losses": "RM 5,000",
  "actionsTaken": ["Blocked user", "Reported to Telegram"]
}
```

#### Warning Card Creation
```http
POST /api/warning-card
Content-Type: application/json

{
  "verdict": "HIGH_RISK",
  "headline": "Fake Investment Scheme Detected",
  "identifiers": {
    "phone": "+60123456789",
    "telegram": "@scammer123"
  },
  "reasons": [
    "Multiple victim reports filed",
    "Promises unrealistic returns",
    "Uses high-pressure tactics"
  ]
}
```

### Authentication
All protected endpoints require JWT authentication:
```http
Authorization: Bearer <jwt-token>
```

## 🎮 Gamification System

### Points System
- **Report Submission**: 50 points + streak bonus
- **Daily Check-in**: 10 points
- **Bounty Completion**: Variable (100-1000 points)
- **Achievement Unlocks**: 25-200 points

### Streaks & Rewards
- **Daily Streak**: Consecutive days of activity
- **Monthly Competitions**: Leaderboard prizes
- **Premium Unlock**: 1000 points unlocks premium features

### Bounty System
- Community-funded rewards for scam identification
- Priority-based bounties (low, medium, high, critical)
- Automatic reward distribution upon completion

## 🔒 Security Features

### Rate Limiting
- **Free Tier**: 20 requests/hour
- **Authenticated**: 50 requests/hour
- **Premium**: Unlimited requests

### Input Validation
- Comprehensive schema validation using Zod
- SQL injection prevention
- XSS protection
- Payload size limits (64KB max)

### Data Protection
- Encrypted sessions with JWT
- Secure cookie handling
- GDPR-compliant data handling
- Regular security audits

## 🌍 Deployment

### Production Deployment
```bash
# Deploy to Cloudflare Workers
npm run deploy

# Set up custom domain
wrangler custom-domains add scamshield.my
```

### Environment Configuration
- **Development**: Mock providers, local D1 database
- **Staging**: Live providers, staging database
- **Production**: Full live configuration

## 📈 Monitoring & Analytics

### Key Metrics
- **Verdict Response Time**: <200ms target
- **Report Processing Time**: <500ms target
- **User Engagement**: Daily active users, retention
- **Scam Detection Accuracy**: Provider signal correlation

### Observability
- Structured logging with correlation IDs
- Performance metrics via Analytics Engine
- Error tracking and alerting
- Health check endpoints

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Code Standards
- TypeScript strict mode enabled
- ESLint configuration for code quality (`npm run lint`)
- Vitest for unit testing
- 100% test coverage for critical paths

### Testing
```bash
# Run all tests
npm test

# Run lint checks
npm run lint

# Run specific test file
npm test gamification.test.ts

# Generate coverage report
npm run test:coverage
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Resources

### Emergency Contacts
- **NSRC (National Scam Response Center)**: 997
- **CCID (Commercial Crime Investigation Department)**: +603-2266 3333
- **Bank Negara Malaysia**: 1-300-88-5465

### Online Resources
- [semakmule.rmp.gov.my](https://semakmule.rmp.gov.my) - PDRM scam checker
- [bnm.my](https://www.bnm.my) - Bank Negara consumer alerts
- [scamalert.sg](https://www.scamalert.sg) - Regional scam database

### Community
- Discord: [Join our community](https://discord.gg/scamshield)
- Twitter: [@ScamShieldMY](https://twitter.com/scamshieldmy)
- GitHub Issues: [Report bugs & features](https://github.com/naimkatiman/scamshield-my/issues)

---

**Built with ❤️ for Malaysia by the Malaysian tech community**

*"Stop scams before they spread, empower victims with instant recovery tools."*
