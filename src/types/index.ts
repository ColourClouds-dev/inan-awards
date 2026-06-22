import { Timestamp } from 'firebase/firestore';

export interface TenantFeatures {
  feedbackForms: boolean;
  seoSettings: boolean;
  hidePoweredBy: boolean;
}

// Role within a tenant — 'owner' is the person who registered the organisation
export type TenantRole = 'owner' | 'staff';

export interface TenantAdmin {
  uid: string;
  tenantId: string;
  email: string;
  role: TenantRole;
  createdAt: Date | Timestamp;
  welcomeSent?: boolean;
  photoUrl?: string;
  formCount?: number;  // per-user form count
  formLimit?: number;  // per-user form limit (defaults to tenant formLimit)
  invitedBy?: string;  // UID of the owner who sent the invitation
  notificationEmails?: string[];  // personal emails for negative feedback alerts (staff only)
}

export interface TenantInvitation {
  id: string;
  tenantId: string;
  email: string;
  role: TenantRole;
  invitedBy: string;   // owner UID
  createdAt: Date | Timestamp;
  expiresAt: Date | Timestamp;
  used: boolean;
}

export interface Tenant {
  id: string; // slug e.g. "inan", "acme-corp"
  name: string; // display name e.g. "Inan Hotels"
  domain: string; // e.g. "feedback.inan.com.ng"
  emailDomain?: string; // e.g. "inan.com.ng" — used for email domain validation
  features: TenantFeatures;
  formLimit: number; // max feedback forms allowed
  formCount: number; // current count
  nominationFormLimit?: number; // kept for super-admin config compatibility
  nominationFormCount?: number; // kept for super-admin config compatibility
  status: 'active' | 'inactive' | 'trial';
  plan: 'trial' | 'basic' | 'pro';
  createdAt: Date | Timestamp;
  branding?: {
    primaryColor?: string;   // hex e.g. "#7C3AED"
    logoUrl?: string;        // Cloudinary URL
    emailDisplayName?: string; // e.g. "Acme Corp Feedback"
  };
}

export interface FeedbackForm {
  id: string;
  title: string;
  description?: string;
  location: string;
  questions: FeedbackQuestion[];
  createdAt: Date | Timestamp;
  isActive: boolean;
  stepByStep?: boolean;
  customTagRules?: CustomTagRule[];
  ogImageUrl?: string;
  createdBy?: string;  // UID of the user who created this form
  tenantId?: string;   // denormalised for query scoping
}

export interface FeedbackQuestion {
  id: string;
  type: 'rating' | 'text' | 'multiChoice';
  question: string;
  options?: string[];
  required: boolean;
  multiSelect?: boolean;      // true = checkboxes (multiple answers), false/undefined = radio (single answer)
  minSelections?: number;     // minimum number of selections required when multiSelect is true
}

export interface FeedbackResponse {
  id: string;
  formId: string;
  location: string;
  responses: {
    [questionId: string]: string | number;
  };
  submittedAt: Date | Timestamp;
  // Visitor metadata
  visitorIp?: string;
  visitorCity?: string;
  visitorRegion?: string;
  visitorCountry?: string;
  visitorIsp?: string;
  visitorAccessedAt?: string;
  // Logic tags
  timeSpentSeconds?: number;
  tags?: ResponseTag[];
}

export interface ResponseTag {
  label: string;
  type: 'time' | 'sentiment' | 'completion' | 'custom';
  color: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
}

export interface CustomTagRule {
  id: string;
  label: string;
  color: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
  // Multi-condition AND logic — all conditions must match
  conditions?: Array<{
    questionId: string;
    operator: 'contains' | 'equals' | 'less_than' | 'greater_than';
    value: string;
  }>;
  // Legacy single condition — kept for backward compatibility
  condition: {
    questionId: string;
    operator: 'contains' | 'equals' | 'less_than' | 'greater_than';
    value: string;
  };
}

export interface SeoSettings {
  siteUrl: string;
  siteName: string;
  defaultDescription: string;
  ogImageUrl?: string;
}

export interface SurveySettings {
  startDate: Date | Timestamp;
  endDate: Date | Timestamp;
  isActive: boolean;
  bannerImageUrl?: string;
}

export interface LocationSettings {
  locations: string[];
}

export interface NotificationSettings {
  emails: string[];
}

export interface Employee {
  '#': number;
  Id: number;
  'Employee ID': number | string;
  Employee: string;
  Email: string;
  'Reporting To': string;
  'Joining Date': string;
  Status: string;
  Role?: string;
  'Employment Type'?: string;
}

export interface User {
  uid: string;
  email: string;
  role: 'admin' | 'user';
}

export interface Category {
  id: number;
  title: string;
  description: string;
}
