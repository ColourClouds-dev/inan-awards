'use client';

import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Employee } from '../types';
import Button from './Button';
import Input from './Input';

interface Nominations {
  [key: number]: string;
}

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
  const [nominations, setNominations] = useState<Nominations>({});
  const [submitted, setSubmitted] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const response = await fetch('/employees.json');
        const employeeList: Employee[] = await response.json();
        
        const sortedEmployees = employeeList
          .filter((emp: Employee) => emp.Status === 'Active')
          .sort((a: Employee, b: Employee) => a.Employee.localeCompare(b.Employee));
        
        setEmployees(sortedEmployees);
        setError(null);
      } catch (error) {
        console.error('Error loading employees:', error);
        setError('Failed to load employee data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadEmployees();

    const savedNominations = localStorage.getItem('nominations');
    if (savedNominations) {
      try {
        setNominations(JSON.parse(savedNominations));
      } catch (error) {
        console.error('Error parsing saved nominations:', error);
        localStorage.removeItem('nominations');
      }
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

  const triggerConfetti = useCallback(() => {
    const duration = 3000;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = duration;

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50;

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    // Cleanup interval after duration
    setTimeout(() => clearInterval(interval), duration);
  }, []);

  const handleSubmit = async () => {
    // Verify all nominations are complete
    const totalNominations = Object.keys(nominations).length;
    if (totalNominations < categories.length) {
      setError('Please complete all nominations before submitting.');
      return;
    }

    try {
      // Check if this email has already submitted nominations
      const docRef = doc(db, 'nominations', email);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setError('You have already submitted your nominations.');
        setSubmitted(true);
        return;
      }

      const submission = {
        nominations,
        email,
        timestamp: serverTimestamp()
      };

      // Save to Firestore using email as document ID
      await setDoc(docRef, submission);
      
      // Clear local storage and update state
      localStorage.removeItem('nominations');
      setSubmitted(true);
      
      // Trigger confetti celebration
      triggerConfetti();
    } catch (error: any) {
      console.error('Error submitting nominations:', error);
      setError('Failed to submit nominations. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card text-center w-full max-w-md mx-auto">
          <div className="animate-spin rounded-full h-14 w-14 border-b-3 border-purple-600 mx-auto"></div>
          <p className="mt-6 text-gray-600 text-xl">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card text-center w-full max-w-md mx-auto">
          <img src="/staff-awards.svg" alt="INAN Logo" className="h-32 mb-8 mx-auto drop-shadow-lg" />
          <h2 className="text-3xl font-bold text-red-600 mb-4">Already Submitted</h2>
          <p className="text-gray-600 text-lg">{error}</p>
          <p className="text-gray-500 mt-4">Thank you for your interest in the INAN Feedback!</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card text-center w-full max-w-md mx-auto relative">
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm rounded-lg -z-10"></div>
          <img src="/staff-awards.svg" alt="INAN Logo" className="h-32 mb-8 mx-auto drop-shadow-lg" />
          <h2 className="text-3xl font-bold text-green-600 mb-4">Thank you for your nominations!</h2>
          <p className="text-gray-600 text-lg">Your nominations have been successfully submitted.</p>
          <p className="text-gray-500 mt-4">We appreciate your participation in the INAN Feedback!</p>
        </div>
      </div>
    );
  }

  const currentCategory = categories[currentStep];
  const selectedNominee = nominations[currentCategory.id];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl mx-auto">
        {!emailVerified ? (
          <div className="card max-w-md mx-auto">
            <div className="flex flex-col items-center mb-10">
              <img src="/staff-awards.svg" alt="INAN Logo" className="h-32 mb-8 drop-shadow-xl" />
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Thank you for Your Service.</h3>
              <p className="text-gray-600 text-center text-xl leading-relaxed">
                Please enter your INAN company email to proceed with nominations.
              </p>
            </div>
            
            <form className="space-y-6" onSubmit={async (e) => {
              e.preventDefault();
              const employeeEmail = employees.find(emp => emp.Email.toLowerCase() === email.toLowerCase());
              if (!employeeEmail) {
                setEmailError('Email not found in employee records');
                return;
              }
              if (!email.endsWith('@inan.com.ng')) {
                setEmailError('Please use your INAN company email (@inan.com.ng)');
                return;
              }

              try {
                // Check if this email has already submitted nominations
                const docRef = doc(db, 'nominations', email);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                  setError('You have already submitted your nominations.');
                  setSubmitted(true);
                  return;
                }

                // If no previous submission, allow proceeding
                setEmailVerified(true);
                setEmailError(null);
              } catch (error) {
                console.error('Error checking previous submission:', error);
                setEmailError('Error verifying email. Please try again.');
              }
            }}>
              <div className="space-y-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(null);
                  }}
                  placeholder="Enter your @inan.com.ng email"
                  error={emailError}
                  required
                />
              </div>
              <Button type="submit">
                Verify Email
              </Button>
            </form>
          </div>
        ) : (
          <>
            <div className="space-y-8">
              <div>
                <div className="progress-bar">
                  <div 
                    className="progress-bar-fill"
                    style={{ width: `${((currentStep + 1) / categories.length) * 100}%` }}
                  />
                </div>
                <div className="mt-3 text-sm text-gray-600 text-right">
                  {currentStep + 1} of {categories.length}
                </div>
              </div>

              <div className="card">
                <h2 className="text-3xl font-bold mb-3">{currentCategory.title}</h2>
                <p className="text-gray-600 text-lg leading-relaxed mb-8">
                  {currentCategory.description}
                </p>

                <div className="space-y-8">
                  <Input
                    as="select"
                    value={selectedNominee || ''}
                    onChange={(e) => handleNomination(currentCategory.id, e.target.value)}
                  >
                    <option value="">Select an employee</option>
                    {employees
                      .filter(emp => {
                        // For Best Front Desk Staff category, only show front desk staff
                        if (currentCategory.id === 4) {
                          return emp.Role === 'Front Desk';
                        }
                        // For other categories, exclude wait staff
                        return emp.Role !== 'Wait Staff';
                      })
                      .map((emp) => (
                        <option key={emp['Employee ID']} value={emp.Employee}>
                          {emp.Employee} [{emp.Role}]
                        </option>
                      ))}
                  </Input>

                  <div className="flex justify-between items-center space-x-4">
                    {currentStep > 0 && (
                      <Button
                        onClick={() => setCurrentStep(prev => prev - 1)}
                        variant="secondary"
                      >
                        Back
                      </Button>
                    )}
                    {currentStep === categories.length - 1 ? (
                      <Button
                        onClick={handleSubmit}
                        disabled={!selectedNominee}
                        className="ml-auto"
                      >
                        Submit Nominations
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setCurrentStep(prev => prev + 1)}
                        disabled={!selectedNominee}
                        className="ml-auto"
                      >
                        Next Category
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AwardNominations;
