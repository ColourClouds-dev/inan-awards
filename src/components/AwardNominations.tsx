import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

const categories = [
  {
    id: 1,
    title: "Most Committed Staff of the Year",
    description: "Staff who demonstrated exceptional dedication and commitment"
  },
  {
    id: 2,
    title: "Most Customer-Oriented Staff of the Year",
    description: "Staff who provided exceptional customer service"
  },
  {
    id: 3,
    title: "Employee of the Year",
    description: "Outstanding staff member with significant contributions"
  },
  {
    id: 4,
    title: "Best Front Desk Staff of the Year",
    description: "Staff ensuring positive first impressions"
  },
  {
    id: 5,
    title: "Mr. Always Available",
    description: "Staff demonstrating strong work ethic and flexibility"
  },
  {
    id: 6,
    title: "Outstanding Performance",
    description: "Staff achieving exceptional results"
  },
  {
    id: 7,
    title: "Team Player",
    description: "Staff demonstrating exceptional teamwork"
  },
  {
    id: 8,
    title: "Innovation and Creativity",
    description: "Staff introducing new ideas and improvements"
  },
  {
    id: 9,
    title: "Years of Service",
    description: "Staff reaching significant milestones"
  },
  {
    id: 10,
    title: "Leadership and Mentorship",
    description: "Staff demonstrating exceptional leadership"
  }
];

const AwardNominations = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [nominations, setNominations] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const response = await window.fs.readFile('employees20250105164648.xlsx');
        const workbook = XLSX.read(response);
        const firstSheetName = workbook.SheetNames[0];
        const employeeList = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);
        
        // Sort employees by name
        const sortedEmployees = employeeList
          .filter(emp => emp.Status === 'Active')
          .sort((a, b) => a.Employee.localeCompare(b.Employee));
        
        setEmployees(sortedEmployees);
        setLoading(false);
      } catch (error) {
        console.error('Error loading employees:', error);
        setLoading(false);
      }
    };

    loadEmployees();

    // Load any existing nominations from localStorage
    const savedNominations = localStorage.getItem('nominations');
    if (savedNominations) {
      setNominations(JSON.parse(savedNominations));
    }
  }, []);

  const handleNomination = (categoryId: number, nomineeId: string) => {
    const updatedNominations = {
      ...nominations,
      [categoryId]: nomineeId
    };
    
    setNominations(updatedNominations);
    localStorage.setItem('nominations', JSON.stringify(updatedNominations));
    
    if (currentStep < categories.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSubmit = () => {
    // Store final submission in localStorage with timestamp
    const submission = {
      nominations,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('submittedNominations', JSON.stringify(submission));
    setSubmitted(true);
    
    // Clear the in-progress nominations
    localStorage.removeItem('nominations');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-green-600 mb-4">Thank you for your nominations!</h2>
          <p className="text-gray-600">Your responses have been recorded.</p>
        </div>
      </div>
    );
  }

  const currentCategory = categories[currentStep];
  const selectedNominee = nominations[currentCategory.id];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-2xl w-full p-8">
        <div className="mb-8">
          <div className="h-2 bg-gray-200 rounded-full">
            <div 
              className="h-2 bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / categories.length) * 100}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-gray-600 text-right">
            {currentStep + 1} of {categories.length}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-2">{currentCategory.title}</h2>
          <p className="text-gray-600 mb-6">{currentCategory.description}</p>

          <div className="space-y-4">
            <select
              value={selectedNominee || ''}
              onChange={(e) => handleNomination(currentCategory.id, e.target.value)}
              className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select an employee</option>
              {employees.map((emp) => (
                <option key={emp['Employee ID']} value={emp.Employee}>
                  {emp.Employee}
                </option>
              ))}
            </select>

            <div className="flex justify-between mt-6">
              {currentStep > 0 && (
                <button
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="px-6 py-2 text-gray-600 hover:text-gray-800"
                >
                  Back
                </button>
              )}
              {currentStep === categories.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  disabled={!selectedNominee}
                  className={`px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ml-auto ${
                    !selectedNominee ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Submit
                </button>
              ) : (
                <button
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  disabled={!selectedNominee}
                  className={`px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ml-auto ${
                    !selectedNominee ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AwardNominations;