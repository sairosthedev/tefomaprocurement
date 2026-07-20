# Business Requirements Document (BRD)

# OPN JRA — Enterprise Agile Project Management & Issue Tracking Platform

| | |
|---|---|
| **Version** | 1.1 |
| **Status** | Draft for Review |
| **Date** | 17 July 2026 |
| **Prepared For** | OPN JRA Product Development Team |
| **Prepared By** | Macdonald Sairos |

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | — | M. Sairos | Initial draft |
| 1.1 | 2026-07-17 | M. Sairos | Corrected epic numbering, detailed all 20 epics, added scope boundaries, data requirements, assumptions, roadmap, and glossary |

---

## 1. Executive Summary

OPN JRA is a cloud-based Agile project management and issue tracking platform designed to help organizations plan, build, monitor, and deliver software and business projects efficiently. The platform provides functionality comparable to leading enterprise tools (e.g., Jira) while introducing a modern user experience, deep extensibility, and intelligent automation.

The system supports Scrum, Kanban, Waterfall, and hybrid methodologies while allowing organizations to customize workflows, issue types, permissions, dashboards, and reports.

## 2. Business Problem

Many organizations struggle with:

- Poor project visibility across teams and portfolios
- Inefficient, fragmented issue tracking
- Weak collaboration between technical and business teams
- Manual, time-consuming reporting
- Poor sprint planning and estimation discipline
- Rigid, hard-to-customize workflows
- High licensing costs for incumbent enterprise tools

OPN JRA will provide an affordable, scalable, and highly customizable alternative.

## 3. Vision

To become the most flexible enterprise project management and issue tracking platform for software teams, businesses, government institutions, and educational organizations.

## 4. Objectives

The platform shall:

1. Manage unlimited organizations with strict data isolation.
2. Manage unlimited projects per organization.
3. Support Agile methodologies (Scrum, Kanban) and hybrid/waterfall delivery.
4. Track epics, stories, tasks, sub-tasks, bugs, and custom issue types.
5. Support fully customizable workflows per project and issue type.
6. Generate real-time dashboards and reports.
7. Provide enterprise-grade security (RBAC, MFA, SSO, audit logging, encryption).
8. Offer REST APIs and webhook integrations for extensibility.
9. Scale to millions of issues and 10,000+ concurrent users.

## 5. Scope

### 5.1 In Scope (Product)

- Multi-tenant SaaS platform (web application, responsive)
- All 20 functional epics defined in Section 8
- REST API (public, versioned) and outbound webhooks
- Email notifications and in-app notifications

### 5.2 Out of Scope (Version 1)

- Native mobile applications (iOS/Android)
- On-premise / self-hosted distribution
- Marketplace for third-party plugins
- Real-time document co-editing (Confluence-style wiki)
- AI-driven features beyond rule-based automation
- Data migration tooling from third-party platforms (planned post-v1)

## 6. Stakeholders

### Internal

| Stakeholder | Interest |
|---|---|
| Product Owner | Feature prioritization, release scope |
| Business Analysts | Requirements, acceptance criteria |
| UX Designers | User experience, accessibility |
| Software Architects | System design, scalability, security |
| Frontend / Backend Developers | Implementation |
| QA Engineers | Test strategy, quality gates |
| DevOps Engineers | CI/CD, infrastructure, uptime |
| Database Administrators | Data integrity, performance, backups |

### External

| Stakeholder | Interest |
|---|---|
| Organization Administrators | Tenant configuration, user management |
| Project Managers / Scrum Masters | Planning, ceremonies, delivery tracking |
| Product Owners (customer-side) | Backlog and roadmap management |
| Developers / QA Testers | Day-to-day issue work |
| Clients | Visibility into commissioned work |
| Executives | Portfolio reporting, ROI |

## 7. User Roles

Each role has configurable permissions through Role-Based Access Control (RBAC). Default roles:

| Role | Scope | Summary |
|---|---|---|
| Super Administrator | Platform | Operates the SaaS platform itself; no access to tenant business data by default |
| Organization Owner | Organization | Full control of the tenant, billing, ownership transfer |
| Organization Administrator | Organization | User/team management, org settings; cannot remove owners |
| Project Administrator | Project | Project configuration, workflows, boards, permissions |
| Scrum Master | Project | Sprint management, ceremonies, board configuration |
| Product Owner | Project | Backlog prioritization, releases, epics |
| Developer | Project | Create/edit/transition issues, log work |
| QA Engineer | Project | Create/edit issues, manage test-related issue types |
| Business Analyst | Project | Create/edit issues, reports |
| Reporter | Project | Create issues and comment; cannot transition others' issues |
| Viewer | Project | Read-only access |
| Guest | Issue/Project | Limited, invitation-scoped read access |

## 8. Functional Requirements (Epics)

The platform comprises 20 functional epics:

| # | Epic | # | Epic |
|---|---|---|---|
| 01 | Authentication & Identity | 11 | Permissions |
| 02 | Organization Management | 12 | Dashboards |
| 03 | User Management | 13 | Reports |
| 04 | Teams | 14 | Notifications |
| 05 | Projects | 15 | Search |
| 06 | Boards | 16 | Automation |
| 07 | Backlogs | 17 | Time Tracking |
| 08 | Sprint Management | 18 | Releases |
| 09 | Issue Management | 19 | Integrations |
| 10 | Workflow Engine | 20 | Administration |

---

### EPIC 01 — Authentication & Identity

**Objective:** Provide secure access to the platform.

**Features**

- User registration with email verification
- Login / logout
- Forgot password / reset password
- Two-Factor Authentication (TOTP; recovery codes)
- Single Sign-On (SAML 2.0, OIDC)
- Session management (list, expire, revoke)
- Device management (trusted devices, sign out everywhere)

**User Story**

> As a user, I want to securely log into OPN JRA so that I can access my organization's projects.

**Acceptance Criteria**

- Email addresses are unique per platform account.
- Passwords are hashed with a modern algorithm (e.g., Argon2/bcrypt); plaintext is never stored or logged.
- Unverified accounts cannot access organization data.
- MFA can be enabled per user; organizations can enforce MFA for all members.
- Sessions expire after a configurable inactivity period (default 30 minutes idle, 30 days absolute).
- Failed login attempts are rate-limited and logged; accounts lock after N consecutive failures.
- Administrators can revoke any active session for users in their organization.

---

### EPIC 02 — Organization Management

**Objective:** Support isolated, self-managed tenants.

**Features**

- Create / update / delete organization
- Invite members (email invite with expiry)
- Suspend / reactivate organization
- Branding (logo, colors, custom subdomain)
- Subscription & billing management
- Usage analytics (seats, storage, API usage)

**User Story**

> As an organization owner, I want to manage my organization's settings, members, and subscription so that my tenant reflects my company's structure and brand.

**Business Rules**

- Organization names and subdomains are unique platform-wide.
- Each organization's data is fully isolated from other tenants.
- Owners can transfer ownership to another member; there must always be at least one owner.
- Administrators cannot remove or demote owners.
- Deleting an organization requires owner confirmation and enters a 30-day soft-delete grace period before permanent purge.
- Suspended organizations retain data but block all member access except owners viewing billing.

---

### EPIC 03 — User Management

**Objective:** Manage user profiles and membership within organizations.

**Features**

- User profile (name, avatar, timezone, locale, notification preferences)
- Organization membership management (add, deactivate, remove)
- Role assignment at organization and project level
- Bulk user import (CSV)
- User deactivation (retains history, blocks access)

**Acceptance Criteria**

- A user may belong to multiple organizations under one platform account.
- Deactivating a user preserves all their historical activity (comments, work logs, transitions).
- Deactivated users are excluded from assignee pickers and license counts.
- Removing a user from an organization does not delete issues they reported; the reporter reference is retained.

---

### EPIC 04 — Teams

**Objective:** Group users for assignment, boards, and reporting.

**Features**

- Create / edit / archive teams
- Team membership and team lead
- Team-based board filters and dashboards
- Team capacity settings (for sprint planning)

**Acceptance Criteria**

- A user can belong to multiple teams.
- Teams are organization-scoped and can be linked to one or more projects.
- Archived teams remain visible in historical reports.

---

### EPIC 05 — Projects

**Objective:** Provide the primary container for work.

**Project Types:** Scrum, Kanban, Business, Service Desk, Custom.

**Project Attributes:** name, key, description, category, visibility (private/organization/public-link), status, lead, avatar, default workflow, default board.

**Features**

- Create / edit / archive / delete projects
- Project templates per type
- Project categories
- Components (sub-areas of a project with default assignees)
- Project-level settings: issue types, workflows, permissions, notifications

**Acceptance Criteria**

- Project key is unique within an organization, uppercase, 2–10 characters; it prefixes all issue keys (e.g., `OPN-142`).
- Changing a project key is not permitted after creation (v1).
- Archived projects are read-only but fully searchable.
- Deleting a project requires typed confirmation and is soft-deleted for 30 days.

---

### EPIC 06 — Boards

**Objective:** Visualize and manage work in progress.

**Features**

- Scrum boards (sprint-scoped) and Kanban boards (continuous flow)
- Configurable columns mapped to workflow statuses
- Swimlanes (by assignee, epic, priority, or query)
- WIP limits per column with visual violation indicators
- Card layout configuration (visible fields, colors by priority/type)
- Quick filters and board-level query filters
- Drag-and-drop transitions between columns

**Acceptance Criteria**

- Dragging a card to a column executes the mapped workflow transition; invalid transitions are rejected with the card returning to its origin.
- A board can source issues from one or more projects via a saved filter.
- WIP limit breaches highlight the column but do not block the move (advisory in v1).
- Board state updates propagate to concurrent viewers in near-real-time (< 5 seconds).

---

### EPIC 07 — Backlogs

**Objective:** Maintain the prioritized list of upcoming work.

**Features**

- Ranked backlog with drag-and-drop ordering
- Inline issue creation and editing
- Epic panel (filter backlog by epic; assign issues to epics)
- Version panel (assign issues to releases)
- Bulk actions (move to sprint, change priority, assign)
- Backlog grooming indicators (missing estimate, no acceptance criteria)

**Acceptance Criteria**

- Backlog rank is a stable, per-board global ordering independent of priority field.
- Issues can be dragged directly from backlog into a planned sprint.
- Sub-tasks never appear as top-level backlog items.

---

### EPIC 08 — Sprint Management

**Objective:** Plan and run time-boxed iterations.

**Features**

- Create, edit, start, and complete sprints
- Sprint goal, start/end dates, capacity
- Parallel future sprint planning (multiple planned sprints)
- Sprint completion flow: incomplete issues move to backlog or next sprint
- Sprint reports (burndown, committed vs. completed)

**User Story**

> As a Scrum Master, I want to start a sprint with a defined goal and scope so that the team has a clear, time-boxed commitment.

**Acceptance Criteria**

- Only one active sprint per Scrum board (v1).
- Starting a sprint requires start and end dates; issues in the sprint are snapshotted as the sprint commitment.
- Issues added or removed after sprint start are flagged as scope change in reports.
- Completing a sprint prompts the user to choose a destination for unfinished issues.
- Completed sprints are immutable.

---

### EPIC 09 — Issue Management

**Objective:** Create and track all units of work. This is the core entity of the platform.

**Supported Issue Types:** Epic, Story, Task, Sub-task, Bug, Incident, Change Request, Feature, Spike, Risk, Improvement, and organization-defined custom types.

**Issue Fields**

| Category | Fields |
|---|---|
| Identity | Key (auto), summary, description (rich text), type |
| People | Reporter, assignee, watchers |
| Classification | Priority, status, resolution, labels, components |
| Agile | Sprint, epic link, story points |
| Planning | Due date, original estimate, remaining estimate, time spent |
| Content | Attachments, comments, linked issues, sub-tasks |
| System | Created/updated timestamps, activity history |

**Features**

- Create / edit / clone / move / delete issues
- Rich-text description and comments with @mentions
- File attachments (configurable size limit, virus scanning)
- Issue linking (blocks / is blocked by, relates to, duplicates)
- Sub-task management
- Watchers and voting
- Full activity/audit history per issue
- Bulk edit and bulk transition
- Custom fields (text, number, date, select, multi-select, user picker)

**Acceptance Criteria**

- Issue keys are sequential per project and never reused, even after deletion.
- Every field change is recorded in the issue history with actor and timestamp.
- @mentioning a user notifies them and adds context linking back to the issue.
- Moving an issue between projects assigns a new key; the old key redirects.
- Deleting an issue requires the Delete Issues permission and confirmation; sub-tasks are deleted with their parent.
- Attachments respect per-organization storage quotas.

---

### EPIC 10 — Workflow Engine

**Objective:** Model each organization's process as configurable state machines.

**Features**

- Visual workflow editor (statuses, transitions)
- Status categories: To Do, In Progress, Done
- Transition rules: conditions (who may execute), validators (required fields), post-functions (assign, update field, fire webhook)
- Per-project, per-issue-type workflow assignment
- Workflow versioning; safe migration of issues when a workflow changes
- Default workflow templates (Simple, Software, Service Desk)

**Acceptance Criteria**

- Every workflow has exactly one initial status; every status must be reachable.
- An issue can only move along defined transitions; the API enforces the same rules as the UI.
- Editing a live workflow requires mapping any removed statuses to replacement statuses before publishing.
- Transition post-functions execute atomically with the transition; failures roll back the transition.

---

### EPIC 11 — Permissions

**Objective:** Enforce least-privilege access at every level.

**Features**

- Global (platform) permissions
- Organization-level roles and permissions
- Project permission schemes (reusable across projects)
- Issue-level security (restrict visibility to roles/users)
- Permission helper ("why can't this user do X?")

**Acceptance Criteria**

- Every API endpoint and UI action is gated by an explicit permission check; deny by default.
- Permission schemes are reusable: one scheme can serve many projects, and changes propagate immediately.
- Issue security levels hide restricted issues from search, boards, and reports for unauthorized users.
- Permission changes take effect without re-login.

---

### EPIC 12 — Dashboards

**Objective:** Give each user and team a configurable at-a-glance view.

**Features**

- Personal and shared dashboards
- Drag-and-drop gadget grid
- Gadgets: assigned to me, sprint burndown, filter results, pie/bar charts, activity stream, sprint health, velocity
- Dashboard sharing (private, team, project, organization)
- Wallboard/TV mode

**Acceptance Criteria**

- Gadget data respects the viewer's permissions (two viewers of the same dashboard may see different data).
- Dashboards load within the performance targets in Section 9.
- A default dashboard is provisioned for each new user.

---

### EPIC 13 — Reports

**Objective:** Provide real-time, exportable insight into delivery.

**Reports (v1)**

- Sprint Burndown / Burnup
- Velocity chart (last N sprints)
- Cumulative Flow Diagram
- Control chart (cycle time / lead time)
- Epic and release progress reports
- Created vs. Resolved issues
- Time tracking report
- User workload report

**Acceptance Criteria**

- Reports reflect current data or clearly display the as-of timestamp.
- All reports export to CSV; charts export to PNG.
- Reports respect project and issue-level permissions.

---

### EPIC 14 — Notifications

**Objective:** Keep users informed without overwhelming them.

**Features**

- In-app notification center (unread badge, mark all read)
- Email notifications with per-event granularity
- Notification schemes per project (who is notified on which events)
- User-level preferences and digest mode (instant / hourly / daily)
- @mention, assignment, watcher, and transition notifications

**Acceptance Criteria**

- Users never receive notifications for their own actions (configurable).
- Notification delivery is asynchronous and does not block the triggering action.
- Unsubscribing from a thread stops further emails for that issue.

---

### EPIC 15 — Search

**Objective:** Find any issue instantly.

**Features**

- Quick search (keys, summaries, recent items) from the global header
- Advanced search with a structured query language (OQL — OPN Query Language), modeled on JQL
- Saved filters with sharing and subscriptions
- Filter-driven boards, dashboards, and reports
- Full-text search across summaries, descriptions, and comments

**Acceptance Criteria**

- Quick search returns results in < 500 ms for typical queries.
- OQL supports fields, operators (`=`, `!=`, `IN`, `~`, `>`, `<`), `AND`/`OR`/`NOT`, and `ORDER BY`.
- Search results enforce permissions.
- Saved filters can be shared to users, teams, projects, or the organization.

---

### EPIC 16 — Automation

**Objective:** Eliminate repetitive manual work via no-code rules.

**Features**

- Rule builder: trigger → conditions → actions
- Triggers: issue created/updated/transitioned, comment added, scheduled (cron), sprint started/completed, webhook received
- Actions: transition issue, edit fields, assign, comment, send notification, create issue/sub-tasks, call outbound webhook
- Rule scoping (single project, multiple projects, organization)
- Execution audit log with success/failure detail
- Loop protection and per-organization execution limits

**Acceptance Criteria**

- Rules execute within 60 seconds of their trigger.
- A rule cannot trigger itself recursively (loop guard with configurable depth).
- Failed executions are logged with error detail and are retryable.
- Rule authors require project admin (project scope) or org admin (org scope) permission.

---

### EPIC 17 — Time Tracking

**Objective:** Capture effort for planning and billing.

**Features**

- Original estimate, remaining estimate, time spent per issue
- Work log entries (duration, date, description, author)
- Editing/deleting own work logs; admins may edit any
- Time tracking report by project, user, and period
- Configurable working hours per day / days per week

**Acceptance Criteria**

- Logging work automatically reduces the remaining estimate (user-adjustable).
- Work logs are included in the issue history.
- Time values accept flexible input (`2w 3d 4h 30m`).

---

### EPIC 18 — Releases

**Objective:** Plan and track versions of a product.

**Features**

- Create / edit / release / archive versions
- Assign issues to fix version(s) and affected version(s)
- Release hub: progress bar (done / in progress / to do), release date, description
- Release notes generation from resolved issues
- Warning on release when unresolved issues remain

**Acceptance Criteria**

- Releasing a version with open issues prompts the user to move or ignore them.
- Released versions are immutable except for archiving.
- Release notes export to Markdown and HTML.

---

### EPIC 19 — Integrations

**Objective:** Connect OPN JRA to the surrounding toolchain.

**Features (v1)**

- Public REST API (versioned, token and OAuth 2.0 auth, rate-limited)
- Outbound webhooks (issue, sprint, project, and comment events; HMAC-signed payloads)
- Git integration: link commits/branches/PRs to issues via issue key in commit messages (GitHub, GitLab)
- Smart commits: transition and comment on issues from commit messages
- Slack / Microsoft Teams notification connectors
- CSV import/export of issues

**Acceptance Criteria**

- Every UI capability required by v1 integrations is available via the REST API.
- API rate limits are per-token with clear limit headers and 429 responses.
- Webhook deliveries retry with exponential backoff and are inspectable in a delivery log.

---

### EPIC 20 — Administration

**Objective:** Operate and govern the platform and each tenant.

**Features**

- Organization admin console: users, teams, roles, security policies, custom fields, issue types, workflows, automation, storage
- Audit log (admin-visible, filterable, exportable) covering security-relevant events
- Data export (full organization export to JSON/CSV)
- Announcement banners
- Platform (super admin) console: tenant management, feature flags, system health

**Acceptance Criteria**

- All administrative actions are captured in the audit log with actor, timestamp, IP, and before/after values.
- Audit logs are immutable and retained for a configurable period (default 12 months).
- Organization export completes asynchronously with email notification and secure download link.

---

## 9. Non-Functional Requirements

### Performance

- Page load < 2 seconds at the 95th percentile under normal load.
- API responses < 500 ms at the 95th percentile for standard reads.
- Support at least 10,000 concurrent users.
- Boards and backlogs remain responsive with 5,000+ issues per project.

### Security

- Role-Based Access Control on every endpoint; deny by default.
- MFA (TOTP) and SSO (SAML 2.0 / OIDC).
- Encryption in transit (TLS 1.2+) and at rest (AES-256).
- Full audit logging of security-relevant events.
- Secure session management (httpOnly cookies or signed tokens, rotation on privilege change).
- OWASP Top 10 mitigations verified before each release; annual third-party penetration test.
- Tenant data isolation enforced at the data-access layer.

### Availability & Reliability

- 99.9% monthly uptime target.
- Automated backups (point-in-time recovery); RPO ≤ 1 hour, RTO ≤ 4 hours.
- Documented and rehearsed disaster recovery procedures.

### Scalability

- Horizontal scaling of stateless application tier.
- Database read scaling and partitioning strategy supporting millions of issues.
- Asynchronous processing (notifications, automation, exports) via queues.

### Usability & Accessibility

- WCAG 2.1 AA compliance.
- Responsive layout (desktop-first; usable on tablet).
- Keyboard shortcuts for high-frequency actions (create issue, search, board navigation).
- Localization-ready (externalized strings); English at launch.

### Compliance & Data

- GDPR-aligned data handling: export, rectification, and deletion of personal data.
- Data residency: single region at launch; architecture must not preclude multi-region.

## 10. Data Requirements (High-Level)

Core entities and key relationships:

- **Organization** 1—N **Users** (via Membership), 1—N **Projects**, 1—N **Teams**
- **Project** 1—N **Issues**, 1—N **Boards**, 1—N **Sprints**, 1—N **Versions**, 1—N **Components**
- **Issue** N—1 **Issue Type**, N—1 **Status**, N—1 **Priority**, N—M **Labels**, N—M **Versions**, 1—N **Comments / Attachments / Work Logs / History Entries**, self-referencing **Links** and **Parent/Sub-task**
- **Workflow** 1—N **Statuses**, 1—N **Transitions**; assigned per project + issue type
- **Permission Scheme** N—M **Projects**

Retention: soft-deleted organizations/projects purge after 30 days; audit logs retained 12 months (configurable); attachments count against tenant storage quotas.

## 11. Assumptions, Constraints & Dependencies

**Assumptions**

- Users have modern evergreen browsers (last 2 major versions of Chrome, Edge, Firefox, Safari).
- Email delivery is available via a third-party transactional email provider.
- v1 launches in English, single cloud region.

**Constraints**

- Cloud-only SaaS in v1 (no self-hosting).
- Budget requires a single product team for MVP; scope is phased accordingly (Section 13).

**Dependencies**

- Identity provider metadata from customers for SSO.
- Third-party services: email delivery, object storage, virus scanning for attachments.

## 12. Success Metrics

| Metric | Target |
|---|---|
| Monthly uptime | ≥ 99.9% |
| Average page response | < 2 seconds |
| User satisfaction (CSAT) | ≥ 95% |
| Reduction in manual reporting effort | ≥ 50% |
| Critical security vulnerabilities in production | 0 |
| Trial-to-paid conversion (post-launch) | Baseline in first quarter, then +10% QoQ |

## 13. Release Plan

### Phase 1 — MVP

Authentication (excl. SSO), Organizations, Users, Teams, Projects, Scrum & Kanban Boards, Backlogs, Sprints, Issues (core fields, comments, attachments, history), Basic Workflows (template-based), Permissions (default roles), Dashboards (core gadgets), Notifications (in-app + email), Quick Search, Core Reports (burndown, velocity, CFD), Administration (org console, audit log).

### Phase 2 — Enterprise Readiness

SSO (SAML/OIDC), custom workflows (visual editor), custom fields & issue types, OQL advanced search & saved filters, permission schemes, issue-level security, releases, time tracking.

### Phase 3 — Extensibility & Automation

Automation rules, public REST API GA, webhooks, Git/Slack/Teams integrations, CSV import/export, wallboards, remaining reports.

## 14. Glossary

| Term | Definition |
|---|---|
| Backlog | Ranked list of work not yet scheduled into a sprint |
| Board | Visual representation of work as cards in status columns |
| Epic | Large body of work grouping related stories/tasks |
| Issue | Any tracked unit of work (story, task, bug, etc.) |
| OQL | OPN Query Language — the platform's structured search language |
| RBAC | Role-Based Access Control |
| Sprint | Fixed time-box in which a team completes a committed scope |
| Swimlane | Horizontal grouping of cards on a board |
| Velocity | Story points completed per sprint, averaged over time |
| WIP Limit | Maximum number of issues allowed in a board column |
| Workflow | State machine of statuses and transitions for an issue type |
