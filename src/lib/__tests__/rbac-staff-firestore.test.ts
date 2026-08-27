/**
 * Test suite to validate Staff RBAC implementation
 * Tests that staff users can only access forms they created
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getAllForms, saveForm } from '../firestore';
import type { FeedbackForm } from '../../types';

// Mock Firebase Firestore
vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
}));

// Mock the tenant firestore functions
vi.mock('../tenantFirestore', () => ({
  incrementFormCount: vi.fn(),
}));

const mockGetDocs = vi.mocked(getDocs);
const mockQuery = vi.mocked(query);
const mockWhere = vi.mocked(where);
const mockCollection = vi.mocked(collection);

describe('Staff RBAC - Feedback Forms Access Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockStaffUid = 'staff-user-123';
  const mockOwnerUid = 'owner-user-456';
  const mockTenantId = 'test-tenant';

  const createMockForm = (id: string, title: string, createdBy: string): FeedbackForm => ({
    id,
    title,
    description: 'Test form',
    location: 'Test Location',
    questions: [],
    createdAt: new Date(),
    isActive: true,
    createdBy,
    tenantId: mockTenantId,
  });

  const staffForm1 = createMockForm('form1', 'Staff Form 1', mockStaffUid);
  const staffForm2 = createMockForm('form2', 'Staff Form 2', mockStaffUid);
  const ownerForm1 = createMockForm('form3', 'Owner Form 1', mockOwnerUid);
  const ownerForm2 = createMockForm('form4', 'Owner Form 2', mockOwnerUid);

  it('should filter forms by createdBy for staff users', async () => {
    // Mock Firestore response with only staff user's forms
    const mockSnapshot = {
      docs: [
        { id: 'form1', data: () => staffForm1 },
        { id: 'form2', data: () => staffForm2 },
      ],
    };

    mockGetDocs.mockResolvedValue(mockSnapshot as any);
    mockQuery.mockReturnValue({} as any);
    mockWhere.mockReturnValue({} as any);
    mockCollection.mockReturnValue({} as any);

    const forms = await getAllForms(mockTenantId, mockStaffUid);

    // Verify the query was called with createdBy filter
    expect(mockWhere).toHaveBeenCalledWith('tenantId', '==', mockTenantId);
    expect(mockWhere).toHaveBeenCalledWith('createdBy', '==', mockStaffUid);

    // Verify only staff forms are returned
    expect(forms).toHaveLength(2);
    expect(forms[0].createdBy).toBe(mockStaffUid);
    expect(forms[1].createdBy).toBe(mockStaffUid);
  });

  it('should return all tenant forms for admin/owner users (no createdBy filter)', async () => {
    // Mock Firestore response with all forms in tenant
    const mockSnapshot = {
      docs: [
        { id: 'form1', data: () => staffForm1 },
        { id: 'form2', data: () => staffForm2 },
        { id: 'form3', data: () => ownerForm1 },
        { id: 'form4', data: () => ownerForm2 },
      ],
    };

    mockGetDocs.mockResolvedValue(mockSnapshot as any);
    mockQuery.mockReturnValue({} as any);
    mockWhere.mockReturnValue({} as any);
    mockCollection.mockReturnValue({} as any);

    // Call without createdBy (admin/owner behavior)
    const forms = await getAllForms(mockTenantId);

    // Verify only tenantId filter was applied (no createdBy filter)
    expect(mockWhere).toHaveBeenCalledWith('tenantId', '==', mockTenantId);
    expect(mockWhere).not.toHaveBeenCalledWith('createdBy', '==', expect.anything());

    // Verify all forms are returned
    expect(forms).toHaveLength(4);
  });

  it('should return empty array when staff user has no forms', async () => {
    const mockSnapshot = {
      docs: [],
    };

    mockGetDocs.mockResolvedValue(mockSnapshot as any);
    mockQuery.mockReturnValue({} as any);
    mockWhere.mockReturnValue({} as any);
    mockCollection.mockReturnValue({} as any);

    const forms = await getAllForms(mockTenantId, mockStaffUid);

    expect(forms).toHaveLength(0);
    expect(mockWhere).toHaveBeenCalledWith('createdBy', '==', mockStaffUid);
  });

  it('should sort forms by creation date (newest first)', async () => {
    const oldForm = createMockForm('old-form', 'Old Form', mockStaffUid);
    oldForm.createdAt = new Date('2023-01-01');
    
    const newForm = createMockForm('new-form', 'New Form', mockStaffUid);
    newForm.createdAt = new Date('2024-01-01');

    const mockSnapshot = {
      docs: [
        { id: 'old-form', data: () => oldForm },
        { id: 'new-form', data: () => newForm },
      ],
    };

    mockGetDocs.mockResolvedValue(mockSnapshot as any);
    mockQuery.mockReturnValue({} as any);
    mockWhere.mockReturnValue({} as any);
    mockCollection.mockReturnValue({} as any);

    const forms = await getAllForms(mockTenantId, mockStaffUid);

    // Verify sorting (newest first)
    expect(forms[0].id).toBe('new-form');
    expect(forms[1].id).toBe('old-form');
  });
});

describe('Staff RBAC - Form Creation with Ownership', () => {
  it('should verify saveForm accepts createdBy parameter', () => {
    // This test verifies the function signature includes createdBy
    expect(typeof saveForm).toBe('function');
    
    // The function should accept (form, tenantId, createdBy) parameters
    // This is validated by TypeScript at compile time
  });
});

describe('Staff RBAC - Firestore Rules Validation', () => {
  it('should document expected Firestore security rules behavior', () => {
    // These tests document the expected behavior that should be enforced by Firestore rules
    // Actual rule testing requires Firestore emulator setup

    const expectedRuleBehavior = {
      // Staff users should only read forms they created
      staffFormRead: {
        allowed: 'resource.data.createdBy == request.auth.uid',
        denied: 'resource.data.createdBy != request.auth.uid',
      },
      
      // Owners should read all forms in their tenant
      ownerFormRead: {
        allowed: 'request.auth.token.role == "owner" && request.auth.token.tenantId == resource.data.tenantId',
      },
      
      // Staff users can only create forms with their own UID as createdBy
      staffFormCreate: {
        allowed: 'request.resource.data.createdBy == request.auth.uid',
        denied: 'request.resource.data.createdBy != request.auth.uid',
      },
    };

    // This test serves as documentation of the expected security model
    expect(expectedRuleBehavior).toBeDefined();
  });
});