'use client';

import React, { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useTenant } from '../contexts/TenantContext';
import {
  getAllEmployees,
  saveEmployee,
  updateEmployee,
  deleteEmployee,
  bulkSaveEmployees,
} from '../lib/employeesFirestore';
import Button from './Button';
import Input from './Input';
import Modal from './Modal';
import PaginationBar from './PaginationBar';
import { usePagination } from '../hooks/usePagination';
import type { Employee } from '../types';

interface Props {
  tenantId: string;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const Section = ({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <div className="bg-white shadow rounded-lg p-4 sm:p-6 space-y-4">
    <div className="border-b pb-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
    </div>
    {children}
  </div>
);

export default function EmployeeManagementSection({ tenantId, showToast }: Props) {
  const [employees, setEmployees] = useState<(Employee & { firestoreDocId?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form states for Add/Edit
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<(Employee & { firestoreDocId?: string }) | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [reportingTo, setReportingTo] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [status, setStatus] = useState('Active');
  const [role, setRole] = useState('');
  const [employmentType, setEmploymentType] = useState('Full-time');
  const [saving, setSaving] = useState(false);

  // Delete modal states
  const [deleteTarget, setDeleteTarget] = useState<(Employee & { firestoreDocId?: string }) | null>(null);
  const [deleting, setDeleting] = useState(false);

  // File Import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const loadEmployees = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await getAllEmployees(tenantId);
      setEmployees(data);
    } catch (err) {
      console.error('Failed to load employees:', err);
      showToast('Failed to load employee directory.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, showToast]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Search filter
  const filteredEmployees = employees.filter(emp => {
    const term = searchTerm.toLowerCase();
    return (
      (emp.Employee || '').toLowerCase().includes(term) ||
      (emp.Email || '').toLowerCase().includes(term) ||
      String(emp['Employee ID'] || '').toLowerCase().includes(term) ||
      (emp.Role || '').toLowerCase().includes(term)
    );
  });

  const { page, pageCount, paginated: paginatedEmployees, goTo, next, prev } = usePagination(filteredEmployees, 10);

  const openAddForm = () => {
    setEditingEmployee(null);
    setEmployeeId('');
    setEmployeeName('');
    setEmployeeEmail('');
    setReportingTo('');
    setJoiningDate('');
    setStatus('Active');
    setRole('');
    setEmploymentType('Full-time');
    setFormOpen(true);
  };

  const openEditForm = (emp: Employee & { firestoreDocId?: string }) => {
    setEditingEmployee(emp);
    setEmployeeId(String(emp['Employee ID']));
    setEmployeeName(emp.Employee || '');
    setEmployeeEmail(emp.Email || '');
    setReportingTo(emp['Reporting To'] || '');
    setJoiningDate(emp['Joining Date'] || '');
    setStatus(emp.Status || 'Active');
    setRole(emp.Role || '');
    setEmploymentType(emp['Employment Type'] || 'Full-time');
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim() || !employeeName.trim() || !employeeEmail.trim()) {
      showToast('Employee ID, Name and Email are required.', 'error');
      return;
    }
    
    // Check if ID is unique when adding new employee
    if (!editingEmployee) {
      const idExists = employees.some(emp => String(emp['Employee ID']).toLowerCase() === employeeId.trim().toLowerCase());
      if (idExists) {
        showToast(`Employee ID "${employeeId}" already exists in directory.`, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const employeePayload: Employee & { firestoreDocId?: string } = {
        '#': editingEmployee ? editingEmployee['#'] : employees.length + 1,
        Id: editingEmployee ? editingEmployee.Id : Date.now(),
        'Employee ID': employeeId.trim(),
        Employee: employeeName.trim(),
        Email: employeeEmail.trim().toLowerCase(),
        'Reporting To': reportingTo.trim() || '—',
        'Joining Date': joiningDate || new Date().toISOString().split('T')[0],
        Status: status,
        Role: role.trim() || 'Staff',
        'Employment Type': employmentType,
      };

      if (editingEmployee && editingEmployee.firestoreDocId) {
        employeePayload.firestoreDocId = editingEmployee.firestoreDocId;
        await saveEmployee(employeePayload, tenantId);
        showToast('Employee updated successfully.', 'success');
      } else {
        await saveEmployee(employeePayload, tenantId);
        showToast('Employee added successfully.', 'success');
      }
      
      setFormOpen(false);
      await loadEmployees();
    } catch (err) {
      console.error('Save employee error:', err);
      showToast('Failed to save employee details.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !deleteTarget.firestoreDocId) return;
    setDeleting(true);
    try {
      await deleteEmployee(deleteTarget.firestoreDocId);
      showToast(`${deleteTarget.Employee} removed from directory.`, 'success');
      setDeleteTarget(null);
      await loadEmployees();
    } catch (err) {
      console.error('Delete employee error:', err);
      showToast('Failed to delete employee.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleFileImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);

    try {
      const fileExtension = importFile.name.toLowerCase().split('.').pop();
      let parsedEmployees: Employee[] = [];

      if (fileExtension === 'csv') {
        // Handle CSV file
        parsedEmployees = await parseCsvFile(importFile);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        // Handle Excel file
        parsedEmployees = await parseExcelFile(importFile);
      } else {
        showToast('Unsupported file format. Please upload a CSV or Excel file.', 'error');
        setImporting(false);
        return;
      }

      if (parsedEmployees.length === 0) {
        showToast('No valid employee records found in the file.', 'error');
        setImporting(false);
        return;
      }

      await bulkSaveEmployees(parsedEmployees, tenantId);
      showToast(`Successfully imported ${parsedEmployees.length} employees.`, 'success');
      setImportFile(null);
      await loadEmployees();
    } catch (err) {
      console.error('File import error:', err);
      showToast('Error processing the file.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const parseCsvFile = (file: File): Promise<Employee[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          if (!text) {
            reject(new Error('Failed to read file content'));
            return;
          }

          const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
          if (lines.length < 2) {
            reject(new Error('CSV file is empty or missing headers'));
            return;
          }

          // Parse headers
          const headers = lines[0].split(',').map(h => h.replace(/^["']|["']$/g, '').trim());
          const empIndex = headers.indexOf('Employee');
          const emailIndex = headers.indexOf('Email');
          const idIndex = headers.indexOf('Employee ID');

          if (empIndex === -1 || emailIndex === -1) {
            reject(new Error('CSV must contain "Employee" (Name) and "Email" columns'));
            return;
          }

          const parsedEmployees: Employee[] = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.replace(/^["']|["']$/g, '').trim());
            if (cols.length < headers.length) continue;

            const name = cols[empIndex];
            const email = cols[emailIndex];
            const rawId = idIndex !== -1 ? cols[idIndex] : `EMP-${Date.now()}-${i}`;

            if (!name || !email) continue;

            const newEmp: Employee = {
              '#': employees.length + i,
              Id: Date.now() + i,
              'Employee ID': rawId,
              Employee: name,
              Email: email.toLowerCase(),
              'Reporting To': headers.indexOf('Reporting To') !== -1 ? cols[headers.indexOf('Reporting To')] : '—',
              'Joining Date': headers.indexOf('Joining Date') !== -1 ? cols[headers.indexOf('Joining Date')] : new Date().toISOString().split('T')[0],
              Status: headers.indexOf('Status') !== -1 ? cols[headers.indexOf('Status')] : 'Active',
              Role: headers.indexOf('Role') !== -1 ? cols[headers.indexOf('Role')] : 'Staff',
              'Employment Type': headers.indexOf('Employment Type') !== -1 ? cols[headers.indexOf('Employment Type')] : 'Full-time',
            };
            parsedEmployees.push(newEmp);
          }

          resolve(parsedEmployees);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const parseExcelFile = (file: File): Promise<Employee[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          if (!data) {
            reject(new Error('Failed to read file content'));
            return;
          }

          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            reject(new Error('Excel file contains no worksheets'));
            return;
          }

          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          if (jsonData.length < 2) {
            reject(new Error('Excel file is empty or missing headers'));
            return;
          }

          // Get headers from first row
          const headers = jsonData[0].map((h: any) => String(h || '').trim());
          const empIndex = headers.indexOf('Employee');
          const emailIndex = headers.indexOf('Email');
          const idIndex = headers.indexOf('Employee ID');

          if (empIndex === -1 || emailIndex === -1) {
            reject(new Error('Excel file must contain "Employee" (Name) and "Email" columns'));
            return;
          }

          const parsedEmployees: Employee[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            const name = String(row[empIndex] || '').trim();
            const email = String(row[emailIndex] || '').trim();
            const rawId = idIndex !== -1 ? String(row[idIndex] || '') : `EMP-${Date.now()}-${i}`;

            if (!name || !email) continue;

            const newEmp: Employee = {
              '#': employees.length + i,
              Id: Date.now() + i,
              'Employee ID': rawId.trim(),
              Employee: name,
              Email: email.toLowerCase(),
              'Reporting To': headers.indexOf('Reporting To') !== -1 && row[headers.indexOf('Reporting To')] 
                ? String(row[headers.indexOf('Reporting To')]).trim() : '—',
              'Joining Date': headers.indexOf('Joining Date') !== -1 && row[headers.indexOf('Joining Date')] 
                ? String(row[headers.indexOf('Joining Date')]).trim() : new Date().toISOString().split('T')[0],
              Status: headers.indexOf('Status') !== -1 && row[headers.indexOf('Status')] 
                ? String(row[headers.indexOf('Status')]).trim() : 'Active',
              Role: headers.indexOf('Role') !== -1 && row[headers.indexOf('Role')] 
                ? String(row[headers.indexOf('Role')]).trim() : 'Staff',
              'Employment Type': headers.indexOf('Employment Type') !== -1 && row[headers.indexOf('Employment Type')] 
                ? String(row[headers.indexOf('Employment Type')]).trim() : 'Full-time',
            };
            parsedEmployees.push(newEmp);
          }

          resolve(parsedEmployees);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  return (
    <>
      <Section
        title="Employee Directory"
        description="Add, edit, or remove employee details for Staff of the Month nominations and email verification mappings. Import from CSV or Excel files for bulk uploads."
      >
        {/* File Import / Control Row */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 border-b pb-4">
          <div className="flex-1 w-full sm:max-w-xs md:max-w-md">
            <Input
              placeholder="Search by ID, name, email, or role..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <form onSubmit={handleFileImport} className="flex items-center gap-2 border p-1 rounded-lg bg-gray-50">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                id="file-input"
                className="hidden"
                onChange={e => setImportFile(e.target.files?.[0] || null)}
              />
              <label
                htmlFor="file-input"
                className="cursor-pointer text-xs font-semibold px-3 py-2 border rounded bg-white hover:bg-gray-50 truncate max-w-[140px] flex items-center gap-1.5"
                title="Upload CSV or Excel file"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {importFile ? importFile.name : 'Select File'}
              </label>
              <Button
                type="submit"
                disabled={!importFile || importing}
                isLoading={importing}
                loadingText="Importing..."
                fullWidth={false}
                className="!text-xs !py-1.5 !px-3"
              >
                Import
              </Button>
            </form>
            
            <Button onClick={openAddForm} fullWidth={false}>
              Add Employee
            </Button>
          </div>
        </div>

        {/* Import Instructions */}
        {importFile && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium text-blue-800 mb-1">File Format Requirements:</p>
                <ul className="text-blue-700 text-xs space-y-1 list-disc list-inside">
                  <li>Required columns: <strong>Employee</strong> (Name) and <strong>Email</strong></li>
                  <li>Optional columns: Employee ID, Role, Status, Reporting To, Joining Date, Employment Type</li>
                  <li>Supported formats: CSV (.csv), Excel (.xlsx, .xls)</li>
                  <li>Headers should be in the first row</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Directory List */}
        {loading ? (
          <div className="space-y-2 mt-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 skeleton-shimmer rounded-lg" />)}
          </div>
        ) : filteredEmployees.length === 0 ? (
          <p className="text-sm text-gray-400 italic mt-2 text-center py-8 bg-gray-50 rounded-lg">
            No employees found in directory.
          </p>
        ) : (
          <>
            {/* Mobile Card-Based List Layout */}
            <div className="block md:hidden space-y-3">
              {paginatedEmployees.map(emp => (
                <div
                  key={emp.firestoreDocId || String(emp['Employee ID'])}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm break-words">
                          {emp.Employee}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-semibold ${emp.Status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {emp.Status || 'Active'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">
                        ID: {emp['Employee ID']}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditForm(emp)}
                        className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Edit employee details"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(emp)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove employee"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400 block text-xxs uppercase font-semibold">Email</span>
                      <span className="text-gray-700 break-all font-medium">{emp.Email}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-xxs uppercase font-semibold">Role</span>
                      <span className="text-gray-700 break-words font-medium">{emp.Role || 'Staff'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-gray-700 font-medium uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {paginatedEmployees.map(emp => (
                    <tr key={emp.firestoreDocId || String(emp['Employee ID'])} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-medium text-xs text-gray-600 whitespace-nowrap">{emp['Employee ID']}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900 break-words">{emp.Employee}</td>
                      <td className="px-4 py-3 text-gray-500 break-all">{emp.Email}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.Role || 'Staff'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${emp.Status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {emp.Status || 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => openEditForm(emp)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                            title="Edit employee details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(emp)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Remove employee"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationBar page={page} pageCount={pageCount} onPrev={prev} onNext={next} onGoTo={goTo} />
          </>
        )}
      </Section>

      {/* Add/Edit Modal Form */}
      <Modal
        isOpen={formOpen}
        title={editingEmployee ? 'Edit Employee details' : 'Add Employee to Directory'}
        onCancel={() => setFormOpen(false)}
        hideFooter={true}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Employee ID"
            value={employeeId}
            onChange={e => setEmployeeId(e.target.value)}
            placeholder="e.g. 102 or EMP09"
            required
            disabled={!!editingEmployee}
          />
          <Input
            label="Employee Name"
            value={employeeName}
            onChange={e => setEmployeeName(e.target.value)}
            placeholder="e.g. Jane Doe"
            required
          />
          <Input
            label="Email Address"
            type="email"
            value={employeeEmail}
            onChange={e => setEmployeeEmail(e.target.value)}
            placeholder="e.g. jane.doe@company.com"
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Role"
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="e.g. Receptionist"
            />
            <Input
              label="Reporting To"
              value={reportingTo}
              onChange={e => setReportingTo(e.target.value)}
              placeholder="Manager's Name"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
              <select
                value={employmentType}
                onChange={e => setEmploymentType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
              </select>
            </div>
            <Input
              label="Joining Date"
              type="date"
              value={joiningDate}
              onChange={e => setJoiningDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 border-t pt-4 mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFormOpen(false)}
              disabled={saving}
              fullWidth={false}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              isLoading={saving}
              loadingText="Saving..."
              fullWidth={false}
            >
              Save details
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        variant="danger"
        title="Remove employee from directory?"
        message={deleteTarget ? `Are you sure you want to remove ${deleteTarget.Employee} (${deleteTarget.Email})? They will no longer be available for Staff of the Month nominations.` : ''}
        confirmLabel={deleting ? 'Removing...' : 'Yes, remove'}
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
