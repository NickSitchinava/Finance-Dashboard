# F-Dash

A personal dashboard for freelance web development work — track finances, clients, projects, invoices, and goals all in one place.

**Live app:** [f-dash.vercel.app](https://f-dash.vercel.app)

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** — build tool and dev server
- **Supabase** — auth, Postgres database (with Row Level Security), and file storage
- **React Router v7** — routing
- **Recharts** — charts and data visualization
- **Vercel** — deployment

## Features

- **Overview** — revenue trends, active projects, and GitHub activity at a glance
- **Finances** — income/expense tracking with category breakdowns
- **Clients** — client management with custom categories and tagging
- **Projects** — tech stack, progress, hours logged, and linked repos/sites
- **Invoices** — invoice creation, status tracking, and payment history
- **Analytics** — YTD revenue, top clients, and client acquisition trends
- **Goals** — goals and milestones with progress tracking
- **Settings** — profile, security, currency (USD/EUR/GEL), theme, and category management

## Getting Started

### Prerequisites

- Node.js
- A Supabase project (URL + anon key)

### Installation

```bash
git clone <repo-url>
cd nick-dashboard
npm install
```

### Running locally

```bash
npm run dev
```

### Other scripts

```bash
npm run build      # type-check and build for production
npm run lint        # run ESLint
npm run preview     # preview the production build
```

## Test Account

Use the credentials below to log in and explore the dashboard with sample data:

| Field    | Value                       |
|----------|-----------------------------|
| Email    | `nicksitchinava@gmail.com`  |
| Password | `Nick2009!`                 |

> For testing purposes only — please don't change the account details.

## Notes

- Soft deletes are used for clients (`active = false`) to preserve referential integrity in analytics.
- Currency settings only change the displayed symbol; they don't convert existing amounts.