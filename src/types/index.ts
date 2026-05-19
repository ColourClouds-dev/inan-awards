import { Timestamp } from 'firebase/firestore';

export interface TenantFeatures {
  feedbackForms: boolean;
  employeeRecords: boolean;
  seoSettings: boolean;
  hidePoweredBy: boolean;
}

export interface Tenant {
  id: string; // slug e.g. "inan", "acme-corp"
  name: string; // display name e.g. "Inan Hotels"
  domain: string; // e.g. "feedback.inan.com.ng"
  features: TenantFeatures;
  formLimit: number; // max feedback forms allowed
  formCount: number; // current count
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
