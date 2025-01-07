import { Timestamp } from 'firebase/firestore';

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