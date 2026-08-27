'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getAllEmployees } from '../lib/employeesFirestore';
import Input from './Input';
import type { Employee } from '../types';

interface EmployeeSelectorProps {
  selectedEmployees: string[];
  onSelectionChange: (employeeIds: string[]) => void;
  tenantId: string;
}

export default function EmployeeSelector({
  selectedEmployees,
  onSelectionChange,
  tenantId,
}: EmployeeSelectorProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const list = await getAllEmployees(tenantId);
        setEmployees(list);
      } catch (err) {
        console.error('Failed to load employees for selection:', err);
      } finally {
        setLoading(false);
      }
    }
    if (tenantId) load();
  }, [tenantId]);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return employees.filter(emp =>
      (emp.Employee || '').toLowerCase().includes(term) ||
      (emp.Role || '').toLowerCase().includes(term) ||
      String(emp['Employee ID'] || '').toLowerCase().includes(term)
    );
  }, [employees, searchTerm]);

  const handleToggle = (id: string) => {
    const isSelected = selectedEmployees.includes(id);
    if (isSelected) {
      onSelectionChange(selectedEmployees.filter(item => item !== id));
    } else {
      onSelectionChange([...selectedEmployees, id]);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Select Nominees
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Select the employees eligible for voting in this Staff of the Month poll.
        </p>
        <Input
          placeholder="Search employees by name, department, or ID..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 skeleton-shimmer rounded" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6 text-sm text-gray-400 border border-gray-200 rounded-lg bg-gray-50">
          No employees found matching query.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg max-h-72 overflow-y-auto divide-y divide-gray-100 p-1 sm:p-2">
          {filtered.map(emp => {
            const empIdStr = String(emp['Employee ID']);
            const isSelected = selectedEmployees.includes(empIdStr);
            return (
              <label
                key={empIdStr}
                className="flex items-start sm:items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(empIdStr)}
                  className="mt-0.5 sm:mt-0 rounded text-purple-600 focus:ring-purple-500 h-4 w-4 border-gray-300 shrink-0"
                />
                <div className="text-sm min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-semibold text-gray-900 break-words">{emp.Employee}</span>
                  {emp.Role && (
                    <span className="text-gray-500 text-xs break-words">({emp.Role})</span>
                  )}
                  <span className="text-gray-400 text-xs font-mono shrink-0">ID: {empIdStr}</span>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {selectedEmployees.length > 0 && (
        <div className="text-xs text-purple-700 bg-purple-50 px-3 py-2.5 rounded-lg font-medium break-words leading-relaxed">
          <strong>Selected nominees ({selectedEmployees.length}):</strong>{' '}
          {employees
            .filter(emp => selectedEmployees.includes(String(emp['Employee ID'])))
            .map(emp => emp.Employee)
            .join(', ')}
        </div>
      )}
    </div>
  );
}
