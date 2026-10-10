export type PaperStatus = 'LOCKED' | 'AWAITING_APPROVAL' | 'APPROVED' | 'READY_TO_UNLOCK' | 'UNLOCKED' | 'EXPIRED';
export type UserRole = 'Admin' | 'Exam Controller' | 'Manager 1' | 'Manager 2';

export interface Paper {
  id: string;
  examName: string;
  subject: string;
  course: string;
  examDate: string;
  startTime: string;
  unlockTime: string;
  expiryTime: string;
  status: PaperStatus;
  manager1: string;
  manager2: string;
  manager1Id?: string;
  manager2Id?: string;
  manager1Approved: boolean;
  manager2Approved: boolean;
  manager1ApprovedAt?: string;
  manager2ApprovedAt?: string;
  securityLevel: 'HIGH' | 'CRITICAL';
  encryptionId: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Exam {
  id: string;
  name: string;
  date: string;
  startTime: string;
  status: 'Upcoming' | 'In Progress' | 'Completed';
  course: string;
  papers: number;
  manager1: string;
  manager2: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  lastActive: string;
  department: string;
}

export interface AuditEntry {
  id: string;
  time: string;
  user: string;
  role: string;
  action: string;
  ip: string;
  device: string;
  status: 'Success' | 'Failed' | 'Warning';
  paperId?: string;
}

export interface SecurityAlert {
  id: string;
  type: string;
  message: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  time: string;
  resolved: boolean;
}

export const PAPERS: Paper[] = [
  {
    id: 'VX-2026-001',
    examName: 'Final Semester Examination',
    subject: 'Advanced Cryptography',
    course: 'M.Sc Computer Science',
    examDate: '2026-09-20',
    startTime: '10:00 AM',
    unlockTime: '09:30 AM',
    expiryTime: '01:00 PM',
    status: 'AWAITING_APPROVAL',
    manager1: 'Dr. Priya Sharma',
    manager2: 'Prof. Arun Kumar',
    manager1Approved: true,
    manager2Approved: false,
    manager1ApprovedAt: '09:20 AM, Sep 15',
    securityLevel: 'CRITICAL',
    encryptionId: 'AES256-a8f3c2d1e9b4',
    uploadedBy: 'Ravi Menon',
    uploadedAt: '09:05 AM, Sep 15',
  },
  {
    id: 'VX-2026-002',
    examName: 'Mid-Semester Examination',
    subject: 'Network Security',
    course: 'B.Tech CSE',
    examDate: '2026-09-22',
    startTime: '02:00 PM',
    unlockTime: '01:30 PM',
    expiryTime: '05:00 PM',
    status: 'LOCKED',
    manager1: 'Dr. Priya Sharma',
    manager2: 'Dr. Meena Pillai',
    manager1Approved: false,
    manager2Approved: false,
    securityLevel: 'HIGH',
    encryptionId: 'AES256-b7e4f1a2c8d5',
    uploadedBy: 'Ravi Menon',
    uploadedAt: '11:30 AM, Sep 14',
  },
  {
    id: 'VX-2026-003',
    examName: 'Final Semester Examination',
    subject: 'Operating Systems',
    course: 'B.Tech CSE',
    examDate: '2026-09-23',
    startTime: '10:00 AM',
    unlockTime: '09:30 AM',
    expiryTime: '01:00 PM',
    status: 'APPROVED',
    manager1: 'Prof. Arun Kumar',
    manager2: 'Dr. Meena Pillai',
    manager1Approved: true,
    manager2Approved: true,
    manager1ApprovedAt: '08:45 AM, Sep 15',
    manager2ApprovedAt: '08:52 AM, Sep 15',
    securityLevel: 'HIGH',
    encryptionId: 'AES256-c9f5a3b1d7e2',
    uploadedBy: 'Ravi Menon',
    uploadedAt: '10:00 AM, Sep 14',
  },
  {
    id: 'VX-2026-004',
    examName: 'Supplementary Examination',
    subject: 'Database Management Systems',
    course: 'B.Tech CSE',
    examDate: '2026-09-15',
    startTime: '10:00 AM',
    unlockTime: '09:30 AM',
    expiryTime: '01:00 PM',
    status: 'UNLOCKED',
    manager1: 'Dr. Priya Sharma',
    manager2: 'Prof. Arun Kumar',
    manager1Approved: true,
    manager2Approved: true,
    manager1ApprovedAt: '09:15 AM, Sep 15',
    manager2ApprovedAt: '09:22 AM, Sep 15',
    securityLevel: 'HIGH',
    encryptionId: 'AES256-d4c8b2f6e1a9',
    uploadedBy: 'Ravi Menon',
    uploadedAt: '09:00 AM, Sep 14',
  },
  {
    id: 'VX-2026-005',
    examName: 'Final Semester Examination',
    subject: 'Machine Learning',
    course: 'M.Tech AI',
    examDate: '2026-09-10',
    startTime: '02:00 PM',
    unlockTime: '01:30 PM',
    expiryTime: '05:00 PM',
    status: 'EXPIRED',
    manager1: 'Dr. Meena Pillai',
    manager2: 'Prof. Arun Kumar',
    manager1Approved: true,
    manager2Approved: true,
    securityLevel: 'CRITICAL',
    encryptionId: 'AES256-e2a7d3c5f8b1',
    uploadedBy: 'Ravi Menon',
    uploadedAt: '09:00 AM, Sep 09',
  },
  {
    id: 'VX-2026-006',
    examName: 'Final Semester Examination',
    subject: 'Computer Networks',
    course: 'B.Tech ECE',
    examDate: '2026-09-25',
    startTime: '10:00 AM',
    unlockTime: '09:30 AM',
    expiryTime: '01:00 PM',
    status: 'LOCKED',
    manager1: 'Dr. Priya Sharma',
    manager2: 'Dr. Meena Pillai',
    manager1Approved: false,
    manager2Approved: false,
    securityLevel: 'HIGH',
    encryptionId: 'AES256-f1b6e4c9a3d7',
    uploadedBy: 'Ravi Menon',
    uploadedAt: '02:30 PM, Sep 15',
  },
];

export const EXAMS: Exam[] = [
  { id: 'EX-001', name: 'Final Semester Examination — CS Dept', date: '2026-09-20', startTime: '10:00 AM', status: 'Upcoming', course: 'M.Sc Computer Science', papers: 3, manager1: 'Dr. Priya Sharma', manager2: 'Prof. Arun Kumar' },
  { id: 'EX-002', name: 'Mid-Semester Examination — IT Dept', date: '2026-09-22', startTime: '02:00 PM', status: 'Upcoming', course: 'B.Tech CSE', papers: 2, manager1: 'Dr. Priya Sharma', manager2: 'Dr. Meena Pillai' },
  { id: 'EX-003', name: 'Final Semester Examination — ECE Dept', date: '2026-09-25', startTime: '10:00 AM', status: 'Upcoming', course: 'B.Tech ECE', papers: 2, manager1: 'Prof. Arun Kumar', manager2: 'Dr. Meena Pillai' },
  { id: 'EX-004', name: 'Supplementary Examination', date: '2026-09-15', startTime: '10:00 AM', status: 'Completed', course: 'B.Tech CSE', papers: 1, manager1: 'Dr. Priya Sharma', manager2: 'Prof. Arun Kumar' },
  { id: 'EX-005', name: 'Final Semester — AI/ML Dept', date: '2026-09-10', startTime: '02:00 PM', status: 'Completed', course: 'M.Tech AI', papers: 1, manager1: 'Dr. Meena Pillai', manager2: 'Prof. Arun Kumar' },
];

export const USERS: AppUser[] = [
  { id: 'U-001', name: 'Admin Superuser', email: 'admin@vaultx.edu', role: 'Admin', status: 'Active', lastActive: '2 min ago', department: 'IT Administration' },
  { id: 'U-002', name: 'Ravi Menon', email: 'ravi.menon@vaultx.edu', role: 'Exam Controller', status: 'Active', lastActive: '15 min ago', department: 'Examination Cell' },
  { id: 'U-003', name: 'Dr. Priya Sharma', email: 'priya.sharma@vaultx.edu', role: 'Manager 1', status: 'Active', lastActive: '1 hour ago', department: 'Computer Science' },
  { id: 'U-004', name: 'Prof. Arun Kumar', email: 'arun.kumar@vaultx.edu', role: 'Manager 2', status: 'Active', lastActive: '3 hours ago', department: 'Information Technology' },
  { id: 'U-005', name: 'Dr. Meena Pillai', email: 'meena.pillai@vaultx.edu', role: 'Manager 1', status: 'Active', lastActive: '1 day ago', department: 'Electronics & Communication' },
  { id: 'U-006', name: 'Dr. Kiran Rao', email: 'kiran.rao@vaultx.edu', role: 'Manager 2', status: 'Inactive', lastActive: '5 days ago', department: 'Mathematics' },
];

export const AUDIT_LOGS: AuditEntry[] = [
  { id: 'AL-001', time: '09:05 AM · Sep 15, 2026', user: 'Ravi Menon', role: 'Exam Controller', action: 'Paper uploaded — Advanced Cryptography (VX-2026-001)', ip: '192.168.1.45', device: 'Chrome / Windows 11', status: 'Success', paperId: 'VX-2026-001' },
  { id: 'AL-002', time: '09:06 AM · Sep 15, 2026', user: 'System', role: 'System', action: 'AES-256 encryption completed — VX-2026-001', ip: '10.0.0.1', device: 'VaultX Server', status: 'Success', paperId: 'VX-2026-001' },
  { id: 'AL-003', time: '09:20 AM · Sep 15, 2026', user: 'Dr. Priya Sharma', role: 'Manager 1', action: 'Approval submitted — VX-2026-001 (OTP verified)', ip: '192.168.1.62', device: 'Safari / macOS', status: 'Success', paperId: 'VX-2026-001' },
  { id: 'AL-004', time: '09:22 AM · Sep 15, 2026', user: 'Unknown User', role: '—', action: 'Failed login attempt — 3 incorrect passwords', ip: '203.45.78.12', device: 'Firefox / Linux', status: 'Failed' },
  { id: 'AL-005', time: '09:25 AM · Sep 15, 2026', user: 'Prof. Arun Kumar', role: 'Manager 2', action: 'Approval submitted — VX-2026-003 (OTP verified)', ip: '192.168.1.88', device: 'Chrome / Windows 10', status: 'Success', paperId: 'VX-2026-003' },
  { id: 'AL-006', time: '09:30 AM · Sep 15, 2026', user: 'System', role: 'System', action: 'Paper unlocked — VX-2026-004 (scheduled time reached)', ip: '10.0.0.1', device: 'VaultX Server', status: 'Success', paperId: 'VX-2026-004' },
  { id: 'AL-007', time: '09:32 AM · Sep 15, 2026', user: 'Ravi Menon', role: 'Exam Controller', action: 'Paper accessed — VX-2026-004 opened in secure viewer', ip: '192.168.1.45', device: 'Chrome / Windows 11', status: 'Success', paperId: 'VX-2026-004' },
  { id: 'AL-008', time: '09:35 AM · Sep 15, 2026', user: 'Ravi Menon', role: 'Exam Controller', action: 'Paper printed — VX-2026-004 (2 copies, watermarked)', ip: '192.168.1.45', device: 'Chrome / Windows 11', status: 'Success', paperId: 'VX-2026-004' },
  { id: 'AL-009', time: '09:41 AM · Sep 15, 2026', user: 'Unknown User', role: '—', action: 'Unauthorized vault access attempt detected', ip: '203.45.78.12', device: 'cURL / Unknown', status: 'Failed' },
  { id: 'AL-010', time: '10:15 AM · Sep 15, 2026', user: 'Admin Superuser', role: 'Admin', action: 'New user added — Dr. Kiran Rao (Manager 2)', ip: '192.168.1.1', device: 'Chrome / Windows 11', status: 'Success' },
];

export const SECURITY_ALERTS: SecurityAlert[] = [
  { id: 'SA-001', type: 'Brute Force', message: 'Multiple failed login attempts from 203.45.78.12', severity: 'High', time: '09:22 AM · Sep 15, 2026', resolved: false },
  { id: 'SA-002', type: 'Unauthorized Access', message: 'Vault API called without valid session token', severity: 'Critical', time: '09:41 AM · Sep 15, 2026', resolved: false },
  { id: 'SA-003', type: 'Unknown Device', message: 'Login from unrecognized device — Dr. Priya Sharma', severity: 'Medium', time: '08:30 AM · Sep 15, 2026', resolved: true },
  { id: 'SA-004', type: 'Multiple Approval Attempts', message: 'Prof. Arun Kumar attempted double approval on VX-2026-001', severity: 'Medium', time: '09:28 AM · Sep 15, 2026', resolved: true },
  { id: 'SA-005', type: 'Session Anomaly', message: 'Concurrent sessions detected for Ravi Menon', severity: 'Low', time: '08:55 AM · Sep 15, 2026', resolved: true },
];
