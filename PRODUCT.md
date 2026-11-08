# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The creator uses F-Dash to manage freelance web development work. The product may later serve other freelancers; that broader audience has not been defined yet.

## Product Purpose

Bring finances, clients, projects, invoices, and goals into one personal workspace so the user can track their work and its financial progress.

## Positioning

Open decision: the product's meaningful difference from other finance or project trackers has not been defined.

## Operating Context

The user reviews revenue and active projects, records income and expenses, manages clients and invoices, logs project hours and progress, and tracks goals and milestones.

## Capabilities and Constraints

- The current app has authenticated routes for Overview, Finances, Projects, Clients, Invoices, Analytics, Goals, and Settings.
- Data and authentication use Supabase. The README says the database uses Row Level Security; clients are soft deleted to preserve analytics history.
- The currency preference supports USD, EUR, and GEL. Finance summaries convert recorded transaction amounts using date-specific rates when available; invoices retain their issued currency.
- The existing implementation uses React, TypeScript, Vite, React Router, and Recharts, and is deployed on Vercel.
- Open decision: requirements for serving freelancers beyond the creator have not been defined.

## Brand Commitments

The current product name is F-Dash. Logo assets exist at `src/assets/F-Dash — Logo.png` and `src/assets/F-Dash — Logo v2.png`. The updated sidebar, Overview, Finances, Projects, Clients, and Invoices establish a violet and light-surface design direction.

## Evidence on Hand

- `README.md` documents the product, features, stack, deployment, and current behavior.
- The app contains working screens and a sample account for exploration. Sample account details are not product claims or content to reuse in public materials.
- No distinct market claim, customer proof, or target audience beyond the creator has been supplied.

## Product Principles

- Keep freelance work and finances connected in one workspace.
- Make the creator's day-to-day work easy to review and update.
- Preserve the accuracy of financial meaning, including transaction currencies, conversion rates, and invoice currencies.
- Let broader freelancer needs be defined by evidence before treating them as requirements.
