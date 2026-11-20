# NEXUS — Business Operations Platform

NEXUS is a modular business operations platform uniting real-time analytics, CRM, Kanban project management, financial ledger & P&L reporting, notifications, `Ctrl+K` global search, Firebase synchronization, and an AI Operations Copilot.

---

## Architecture Overview

- **Frontend**: React 19, TypeScript, Tailwind CSS v4 (system-matched dark/light themes), and Chart.js (`chart.js/auto`) organized into modular UI primitives, layout shell components, and domain views.
- **Data & Authentication**: Firebase Authentication (Google Sign-In + Email/Password handlers), Cloud Firestore real-time `onSnapshot` listeners scoped by `ownerId`, and Firebase Storage for receipt attachments. When unauthenticated, NEXUS runs in a clearly labeled **Local Demo Sandbox** backed by `localStorage` so users can explore without misleading security claims.
- **Backend Proxy (`server.ts`)**: Express server running on port `3000` that mounts Vite in development, serves `dist/` in production, and securely proxies all `@google/genai` SDK calls (`/api/gemini/chat`, `/api/gemini/analyze-image`, `/api/gemini/tts`) using `process.env.GEMINI_API_KEY`.

---

## Setup Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Environment Variables**:
   Copy `.env.example` to configure `GEMINI_API_KEY` and `APP_URL` via your server secrets panel. Never expose `GEMINI_API_KEY` in client bundles.
3. **Firebase Configuration**:
   - Ensure `firebase-applet-config.json` (see `firebase.config.example.json` for schema) points to your Firebase project and Firestore database ID.
   - Google Sign-In is enabled by default. To enable Email/Password login and password reset, activate the **Email/Password** sign-in provider in Firebase Console -> Authentication -> Sign-in method.
   - Deploy `firestore.rules` (linted via `npx eslint firestore.rules`). Please review and audit `firestore.rules` before sharing your project broadly.
4. **Run Development Server**:
   ```bash
   npm run dev
   ```
5. **Production Build & Start**:
   ```bash
   npm run build
   npm start
   ```

---

## Verification & Test Checklist

- [x] **Financial Calculations (`tests/nexus.test.ts`)**: Verified revenue, expense, net profit, profit margin, MoM growth, category budgets, and CSV formula-injection escaping.
- [x] **Validation & Security (`firestore.rules` + `src/utils/validation.ts`)**: Synchronized `firebase-blueprint.json` constraints, passed `@firebase/eslint-plugin-security-rules` with 0 errors, and deployed rules to Firestore.
- [x] **TypeScript & Bundle Compilation**: Verified via `tsc --noEmit` and `vite build`.
- [ ] **Interactive Runtime Check**: Verify Google Sign-In, Kanban drag-and-drop, Receipt Scanner, and TTS Voice Briefing in the live preview.
