'use client';

import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import QuestionnaireForm from '../../../components/QuestionnaireForm';
import type { Questionnaire } from '../../../types';

export default function QuestionnairePage({ params }: { params: { questionnaireId: string } }) {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuestionnaire = async () => {
      try {
        const questionnaireRef = doc(db, 'questionnaires', params.questionnaireId);
        const questionnaireDoc = await getDoc(questionnaireRef);
        
        if (!questionnaireDoc.exists()) {
          setError("Questionnaire not found");
          setLoading(false);
          return;
        }
        
        const questionnaireData = questionnaireDoc.data();
        
        // Check if questionnaire is active
        if (!questionnaireData.isActive) {
          setError("This questionnaire is no longer active");
          setLoading(false);
          return;
        }
        
        setQuestionnaire({
          id: questionnaireDoc.id,
          ...questionnaireData,
          createdAt: questionnaireData.createdAt?.toDate() || new Date(),
        } as Questionnaire);
        
      } catch (error) {
        console.error("Error fetching questionnaire:", error);
        setError("Failed to load questionnaire. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchQuestionnaire();
  }, [params.questionnaireId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 max-w-md w-full">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return questionnaire ? <QuestionnaireForm questionnaire={questionnaire} /> : null;
} 