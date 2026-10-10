Design a complete modern web application called:

“VaultX – Secure Question Paper Management System”

VaultX is a cybersecurity-focused software platform designed to prevent examination question paper leaks. It securely stores encrypted question papers and prevents a single person from accessing them. Two authorized officials must independently approve access, and the paper can only be unlocked during the predefined time window before the examination.

IMPORTANT:
This is NOT a normal college website or landing page. Design it as a realistic working SaaS web application/prototype that could later be converted directly into a functional React/Next.js application.

DESIGN STYLE:
- Modern cybersecurity product
- Clean, premium and professional
- Minimal but visually impressive
- Dark navy/black + white interface with a blue security accent
- Subtle gradients and glass effects only where useful
- Clean typography
- Rounded cards
- Clear status indicators
- Use Lucide-style icons
- Responsive desktop and tablet layouts
- Avoid unnecessary animations and excessive visual effects
- The interface should feel like a real security product, not a generic admin template

CORE USERS:
1. Admin
2. Exam Controller
3. Manager 1
4. Manager 2

MAIN SECURITY CONCEPT:

Question Paper Upload
→ AES-256 Encryption
→ Encrypted Storage
→ Scheduled Time Lock
→ Manager 1 Approval
→ Manager 2 Approval
→ Decryption
→ Secure Paper Access
→ Audit Log

A single manager must NEVER be able to unlock a paper alone.

CREATE THESE COMPLETE SCREENS:

1. LOGIN PAGE
- VaultX logo
- Email
- Password
- Remember me
- Login button
- Forgot password
- OTP verification flow
- Security-focused visual design

2. ADMIN DASHBOARD
Show:
- Total Question Papers
- Locked Papers
- Papers Awaiting Approval
- Today's Exams
- Security Alerts
- Recent Activity
- Upcoming Exams
- System security status

3. EXAM CONTROLLER DASHBOARD
Show:
- Upcoming examinations
- Question papers
- Upload new paper button
- Pending approvals
- Paper status
- Exam date/time
- Recent activity

4. UPLOAD QUESTION PAPER PAGE
Fields:
- Exam name
- Subject
- Course/Class
- Exam date
- Exam start time
- Paper unlock time
- Access expiry time
- Upload PDF
- Authorized Manager 1
- Authorized Manager 2

Show a confirmation step before encryption.

5. ENCRYPTION PROCESS SCREEN
After upload, visually show:
PDF uploaded
→ Encrypting
→ AES-256 encryption
→ Encryption successful
→ Secure storage

Display:
“Your question paper is now encrypted and locked.”

6. QUESTION PAPER VAULT
Create a secure vault interface showing paper cards/table.

Each paper should show:
- Subject
- Exam date
- Unlock time
- Current status
- Manager 1 approval
- Manager 2 approval
- Security level

Statuses:
LOCKED
AWAITING APPROVAL
APPROVED
READY TO UNLOCK
UNLOCKED
EXPIRED

7. PAPER DETAILS PAGE
Show:
- Exam information
- Encryption status
- Scheduled unlock time
- Manager 1 status
- Manager 2 status
- Access status
- Audit history
- Security information

8. DUAL AUTHORIZATION SCREEN
This is the most important screen.

Show:

Manager 1
✓ Approved

Manager 2
✕ Pending

Question Paper:
🔒 LOCKED

Exam starts:
10:00 AM

Paper unlocks:
09:30 AM

Clearly explain:
“Two authorized approvals are required to unlock this paper.”

Create separate approval interfaces for Manager 1 and Manager 2.

9. APPROVAL CONFIRMATION
When a manager approves:
- OTP verification
- Confirmation message
- Timestamp
- User identity
- Approval recorded

Do NOT make the approval automatically unlock the paper.

10. TIME LOCK SCREEN
Show a large countdown:

“Question Paper Locked”

“Available in:
00:14:32”

Explain:
“The required approvals have been completed, but the paper will remain encrypted until the scheduled unlock time.”

11. UNLOCK SCREEN
When:
- Manager 1 approved
- Manager 2 approved
- Correct time reached

Show:

✓ Manager 1 Approved
✓ Manager 2 Approved
✓ Scheduled Time Reached

Then:

🔓 PAPER READY

Button:
“Open Secure Paper”

12. SECURE PDF VIEWER
Create a realistic secure question paper viewer.

Include:
- PDF pages
- VaultX watermark
- User name
- Date/time
- Paper ID
- Secure viewing indicator
- Print button

Do NOT make downloading the primary option.

13. PRINT CONFIRMATION
Before printing show:
- User
- Paper ID
- Timestamp
- Number of copies
- Watermark information

Button:
“Confirm Secure Print”

14. AUDIT LOGS
Create a detailed audit log page.

Example:

09:05 AM — Paper uploaded
09:06 AM — AES-256 encryption completed
09:20 AM — Manager 1 approved
09:25 AM — Manager 2 approved
09:30 AM — Paper unlocked
09:32 AM — Paper accessed
09:35 AM — Paper printed

Show:
- Timestamp
- User
- Action
- IP/device
- Status

15. SECURITY MONITORING DASHBOARD
Show:
- Failed login attempts
- Suspicious access attempts
- Unknown device login
- Multiple approval attempts
- Security alerts
- Risk score

Use realistic security alerts.

16. USER MANAGEMENT
Admin can:
- Add user
- Remove user
- Assign role
- Activate/deactivate user
- View user activity

17. EXAM MANAGEMENT
Show:
- Upcoming exams
- Completed exams
- Exam status
- Assigned managers
- Paper status

18. NOTIFICATION CENTER
Notifications for:
- Paper uploaded
- Approval required
- Approval completed
- Exam approaching
- Suspicious login
- Paper unlocked
- Paper expired

19. SETTINGS
Include:
- Profile
- Security
- Password
- OTP/MFA
- Notification settings
- Session management

20. RESPONSIVE MOBILE VIEW
Create responsive versions of the most important screens:
- Login
- Dashboard
- Vault
- Approval
- Audit logs

IMPORTANT FUNCTIONAL UX RULES:

- The UI must clearly communicate LOCKED vs UNLOCKED states.
- A paper must never appear accessible before its unlock time.
- One manager approval must not unlock the paper.
- Two independent approvals are required.
- Time condition must also be satisfied.
- Every important action should appear in the audit log.
- Use realistic sample data.
- Create empty states, loading states, success states and error states.
- Create confirmation dialogs for sensitive actions.
- Create security warning dialogs where appropriate.

NAVIGATION:

Sidebar:

Dashboard
Question Papers
Examinations
Approvals
Vault
Audit Logs
Security
Users
Notifications
Settings

Top bar:
Search
Notifications
User profile
Role

Create a consistent design system across all screens.

COMPONENTS TO DESIGN:
- Buttons
- Inputs
- Dropdowns
- Modal dialogs
- Status badges
- Tables
- Cards
- Approval cards
- Security alerts
- Countdown timer
- Timeline
- PDF viewer
- Navigation sidebar
- Header
- Toast notifications
- Confirmation dialogs

Use realistic content and data instead of placeholder text such as Lorem Ipsum.

The final design should look like a complete, production-ready cybersecurity application called VaultX that a developer can use as the visual and UX reference for implementing the actual software.