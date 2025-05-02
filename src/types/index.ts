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

export interface SurveySettings {
  startDate: Date | Timestamp;
  endDate: Date | Timestamp;
  isActive: boolean;
  bannerImageUrl?: string;
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
