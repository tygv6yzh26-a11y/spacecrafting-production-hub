# Spacecrafting Production Hub

Build a complete, production-ready internal web application called **Spacecrafting Video Production Dashboard**.

### PURPOSE
This application will replace our existing Google Sheets workflow used by the Spacecrafting Video Department. Our team currently uses Google Sheets every morning to manage video production jobs, editing, quality control, revisions, and delivery.

I want to eliminate the need to use Google Sheets for this workflow.

I have uploaded our existing spreadsheet. Carefully inspect the spreadsheet, including:
- All worksheets and tabs
- Column headers
- Existing data
- Dropdown values
- Status categories
- Formulas and dependencies
- Production categories and workflows

**The spreadsheet is the source of truth. Do not invent a new workflow or remove existing functionality.**

I'm ok if we just use the last 5 months as reference (the Jul 2026 – Nov 2026 tabs: VE/SVV/AI JUL, AUG, SEP, OCT, NOV 2026, plus Social Cut Projects, Ongoing Projects, Client Info, and Agent + Staff Info; ignore older month tabs).

### DESIGN
Create a modern, professional production management interface inspired by Linear, Monday.com, and premium SaaS dashboards.

Use:
- A clean, light interface
- Dark charcoal sidebar
- White cards and content areas
- Subtle borders and shadows
- Professional typography
- Minimal unnecessary decoration
- Clear status indicators
- Responsive desktop-first design

This is an internal professional tool, not a public-facing website.

### MAIN DASHBOARD

Create a dashboard with the following sections:

1. Morning Overview
   - Total active jobs
   - Jobs currently being edited
   - Jobs awaiting QC
   - Jobs requiring revisions
   - Jobs overdue
   - Jobs delivered

2. Today's Attention
   Display a prioritized list of jobs that need attention this morning:
   - Overdue jobs
   - Jobs due today
   - Jobs waiting on footage
   - Jobs awaiting QC
   - Jobs needing revisions
   - Jobs at risk of missing delivery

3. Production Overview
   Provide a visual summary of production status and workload.

4. Editor Workload
   Display active jobs assigned to each editor and their upcoming deadlines.

### PRODUCTION TABLE

Create a central searchable and sortable production table that accurately reflects the columns and categories in the uploaded spreadsheet.

Requirements:
- Preserve existing spreadsheet fields.
- Allow users to add new jobs.
- Allow users to edit existing jobs.
- Allow users to update statuses directly within the table.
- Support dropdowns for existing status fields.
- Allow sorting by shoot date, editor, deadline, status, and priority where applicable.
- Include filters for production category, editor, status, shoot date, and delivery date.
- Include a global search for property address, client, agent, and job ID.
- Make the table easy to use when managing a large number of jobs.
- Use color-coded status badges.
- Make overdue jobs visually obvious.

### PRODUCTION WORKFLOW

Preserve the existing workflow for:
- Video production categories
- Shoot tracking
- Footage received
- Editing
- Edit completion
- Quality control
- Revisions
- Final delivery

Implement appropriate automatic status calculations and date logic based on the spreadsheet's existing formulas.

Do not create duplicate tracking fields if the spreadsheet already contains equivalent fields.

### NAVIGATION

Create a sidebar with:
- Dashboard
- Production Jobs
- Editing
- Quality Control
- Revisions
- Delivery
- Editor Workload

Only include views that are relevant to the actual spreadsheet workflow.

### DATABASE AND FUNCTIONALITY

Use Supabase for the database, authentication, and persistent data storage.

Requirements:
- Data must persist after refreshing the browser.
- Implement proper authentication.
- Restrict access to authorized internal team members.
- Implement role-based access control where appropriate.
- Use Supabase Row Level Security policies.
- Never expose service-role keys or sensitive credentials in frontend code.
- Include proper loading states, error handling, and confirmation dialogs.
- Do not use mock data as the permanent database.
- Do not rely on browser local storage for production records.

### DATA IMPORT

Create a way to import our existing spreadsheet data into the application.

The import process should:
- Preserve existing records.
- Map spreadsheet columns to database fields.
- Preserve production categories and statuses.
- Avoid creating duplicate jobs.
- Show a preview before importing.
- Provide an import summary.

The attached .xlsx is the actual master spreadsheet to inspect and the source for the import (the PDF is a partial screenshot export of it, for reference only).

### IMPORTANT

Build the actual functioning application, not just a visual prototype.

Prioritize accurately replacing our existing Google Sheets workflow over adding new features.

Do not build StudioFlow. This is a separate product called Spacecrafting Video.

Start by inspecting the uploaded spreadsheet and then build the entire application with a working dashboard, database, production table, navigation, and import functionality.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/711d272c-a8a8-463b-9ae1-1a9e971b09b6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
