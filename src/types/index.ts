import { Timestamp } from 'firebase/firestore';

export interface FeedbackForm {
  id: string;
  title: string;
  location: string;
  questions: FeedbackQuestion[];
  createdAt: Date | Timestamp;
  isActive: boolean;
  isMultiSection?: boolean;
}

interface SectionMetadata {
  sectionId: string;
  sectionTitle: string;
  sectionDescription: string;
}

export interface FeedbackQuestion {
  id: string;
  type: 'rating' | 'text' | 'multiChoice' | 'label';
  question: string;
  options?: string[];
  required: boolean;
  multipleSelect?: boolean;
  sectionId?: string;
  sectionMetadata?: SectionMetadata;
}

export interface FeedbackResponse {
  id: string;
  formId: string;
  location: string;
  responses: {
    [questionId: string]: string | number;
  };
  submittedAt: Date | Timestamp;
}

export interface Questionnaire {
  id: string;
  title: string;
  description: string;
  location: string;
  questions: QuestionnaireQuestion[];
  createdAt: Date | Timestamp;
  isActive: boolean;
  isMultiSection?: boolean;
  category?: string;
  targetAudience?: string;
}

export interface QuestionnaireQuestion {
  id: string;
  type: 'rating' | 'text' | 'multiChoice' | 'label';
  question: string;
  options?: string[];
  required: boolean;
  multipleSelect?: boolean;
  sectionId?: string;
  sectionMetadata?: SectionMetadata;
}

export interface QuestionnaireResponse {
  id: string;
  questionnaireId: string;
  respondent?: string;
  location: string;
  responses: {
    [questionId: string]: string | number | string[];
  };
  submittedAt: Date | Timestamp;
}

export interface SurveySettings {
  // Basic timing settings
  startDate: Date | Timestamp;
  endDate: Date | Timestamp;
  isActive: boolean;
  bannerImageUrl?: string;
  
  // Appearance settings
  appearance?: {
    primaryColor?: string;
    secondaryColor?: string; 
    logoUrl?: string;
    customCss?: string;
  };
  
  // Response management
  responseManagement?: {
    dataRetentionDays?: number; // How many days to keep responses
    autoArchiveAfterDays?: number; // Auto-archive forms after X days
    responseLimit?: number; // Max responses per form
  };
  
  // Notification settings
  notifications?: {
    emailNotifications?: boolean;
    notificationEmail?: string;
    alertThreshold?: number; // Notify after X responses
    dailyDigest?: boolean;
  };
  
  // Security settings
  security?: {
    enableRecaptcha?: boolean;
    allowedIpRanges?: string[];
    requireVerification?: boolean;
  };
  
  // Integration settings
  integrations?: {
    apiKeys?: Record<string, string>;
    webhookUrl?: string;
    exportFormat?: 'csv' | 'json' | 'excel';
  };
  
  // Default form values
  defaults?: {
    defaultExpiryDays?: number;
    footerText?: string;
    disclaimer?: string;
  };
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

export interface Nomination {
  categoryId: number;
  nominee: string;
  timestamp: Date;
}

export interface NominationResults {
  categoryId: number;
  nominations: {
    [key: string]: number;
  };
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

export interface Poll {
  id: string;
  title: string;
  question: string;
  description?: string;
  options: string[];
  location: string;
  createdAt: Date | Timestamp;
  endDate?: Date | Timestamp;
  isActive: boolean;
}

export interface PollResponse {
  id: string;
  pollId: string;
  respondent: string;
  selectedOption: string;
  location: string;
  submittedAt: Date | Timestamp;
}
