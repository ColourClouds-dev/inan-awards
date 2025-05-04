'use client';

import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import Input from './Input';
import Button from './Button';
import type { Questionnaire, QuestionnaireQuestion } from '../types';

interface QuestionnaireBuilderProps {
  onSave: (questionnaire: Questionnaire) => Promise<string | null>;
  initialQuestionnaire?: Questionnaire | null;
}

interface Section {
  id: string;
  title: string;
  description: string;
  questions: string[]; // Array of question IDs
}

const QuestionTypeInfo = {
  rating: {
    icon: '⭐',
    label: 'Rating',
    description: 'Collect ratings from 1-5 stars',
    placeholder: 'e.g., How would you rate your overall experience?'
  },
  text: {
    icon: '📝',
    label: 'Text Response',
    description: 'Collect detailed written feedback',
    placeholder: 'e.g., What could we improve?'
  },
  multiChoice: {
    icon: '☑️',
    label: 'Multiple Choice',
    description: 'Let users choose from predefined options',
    placeholder: 'e.g., Which amenities did you use during your stay?'
  },
  label: {
    icon: '🏷️',
    label: 'Text Label',
    description: 'Display text without requiring a response',
    placeholder: 'e.g., Please read the following instructions carefully.'
  }
};

const QuestionnaireBuilder: React.FC<QuestionnaireBuilderProps> = ({ onSave, initialQuestionnaire }) => {
  const [title, setTitle] = useState(initialQuestionnaire?.title || '');
  const [description, setDescription] = useState(initialQuestionnaire?.description || '');
  const [location, setLocation] = useState(initialQuestionnaire?.location || '');
  const [category, setCategory] = useState(initialQuestionnaire?.category || '');
  const [targetAudience, setTargetAudience] = useState(initialQuestionnaire?.targetAudience || '');
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>(initialQuestionnaire?.questions || []);
  const [showQR, setShowQR] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const [currentStep, setCurrentStep] = useState<'basics' | 'questions' | 'sections' | 'preview'>('basics');
  const [previewMode, setPreviewMode] = useState(false);
  const [isMultiSection, setIsMultiSection] = useState(initialQuestionnaire?.isMultiSection || false);
  const [sections, setSections] = useState<Section[]>([]);
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionDescription, setNewSectionDescription] = useState('');
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);

  const locations = [
    'Qaras Hotels: House 3',
    'Qaras Hotels: Bluxton',
    'Online',
    'Marketing',
    'Customer Service'
  ];

  const categories = [
    'Customer Satisfaction',
    'Employee Feedback',
    'Market Research',
    'Product Feedback',
    'Event Feedback',
    'Other'
  ];

  // Initialize sections from questions if questionnaire has sections
  React.useEffect(() => {
    if (initialQuestionnaire?.isMultiSection && initialQuestionnaire.questions.length > 0) {
      // Create a map of all sections
      const sectionsMap = new Map<string, Section>();
      
      // Extract sections from questions
      initialQuestionnaire.questions.forEach(question => {
        if (question.sectionMetadata) {
          const { sectionId, sectionTitle, sectionDescription } = question.sectionMetadata;
          
          if (!sectionsMap.has(sectionId)) {
            sectionsMap.set(sectionId, {
              id: sectionId,
              title: sectionTitle,
              description: sectionDescription,
              questions: []
            });
          }
          
          // Add the question to the section
          const section = sectionsMap.get(sectionId);
          if (section) {
            section.questions.push(question.id);
          }
        }
      });
      
      // Convert map to array
      const loadedSections = Array.from(sectionsMap.values());
      setSections(loadedSections);
      
      // Set current section if sections exist
      if (loadedSections.length > 0) {
        setCurrentSectionId(loadedSections[0].id);
      }
    }
  }, [initialQuestionnaire]);

  const addQuestion = (type: QuestionnaireQuestion['type']) => {
    const newQuestion: QuestionnaireQuestion = {
      id: uuidv4(),
      type,
      question: '',
      required: type !== 'label', // Labels are not required by default
      ...(type === 'multiChoice' ? { 
        options: [''],
        multipleSelect: false // Default to single selection (radio buttons)
      } : {}),
      sectionId: currentSectionId || undefined
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<QuestionnaireQuestion>) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, ...updates } : q
    ));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
    // Remove from sections if multi-section is enabled
    if (isMultiSection) {
      setSections(sections.map(section => ({
        ...section,
        questions: section.questions.filter(qId => qId !== id)
      })));
    }
  };

  const moveQuestion = (id: string, direction: 'up' | 'down') => {
    const index = questions.findIndex(q => q.id === id);
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === questions.length - 1)
    ) return;

    const newQuestions = [...questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setQuestions(newQuestions);
  };

  const addOption = (questionId: string) => {
    setQuestions(questions.map(q =>
      q.id === questionId ? {
        ...q,
        options: [...(q.options || []), '']
      } : q
    ));
  };

  const updateOption = (questionId: string, index: number, value: string) => {
    setQuestions(questions.map(q =>
      q.id === questionId ? {
        ...q,
        options: q.options?.map((opt, i) => i === index ? value : opt)
      } : q
    ));
  };

  const removeOption = (questionId: string, index: number) => {
    setQuestions(questions.map(q =>
      q.id === questionId ? {
        ...q,
        options: q.options?.filter((_, i) => i !== index)
      } : q
    ));
  };

  const addSection = () => {
    const newSection: Section = {
      id: uuidv4(),
      title: newSectionTitle,
      description: newSectionDescription,
      questions: []
    };
    setSections([...sections, newSection]);
    setCurrentSectionId(newSection.id);
    setShowSectionModal(false);
    setNewSectionTitle('');
    setNewSectionDescription('');
  };

  const updateSection = (id: string, updates: Partial<Section>) => {
    setSections(sections.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ));
  };

  const removeSection = (id: string) => {
    // Keep the questions but unassign them from this section
    setQuestions(questions.map(q => 
      q.sectionId === id ? { ...q, sectionId: undefined } : q
    ));
    setSections(sections.filter(s => s.id !== id));
    if (currentSectionId === id) {
      setCurrentSectionId(sections.length > 1 ? sections[0].id : null);
    }
  };

  const assignQuestionToSection = (questionId: string, sectionId: string) => {
    // Update the question's sectionId
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, sectionId } : q
    ));
    
    // Add question ID to the section
    setSections(sections.map(s => 
      s.id === sectionId 
        ? { ...s, questions: [...s.questions, questionId] } 
        : s
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitError(null);
    
    if (!navigator.onLine) {
      setFormSubmitError("You're offline. Please connect to the internet to save this questionnaire.");
      return;
    }

    if (!title || !location || questions.length === 0) {
      setFormSubmitError("Please fill in all required fields and add at least one question.");
      return;
    }

    let finalQuestions = [...questions];
    // If multi-section, ensure section metadata is properly set
    if (isMultiSection && sections.length > 0) {
      finalQuestions = questions.map(q => ({
        ...q,
        sectionMetadata: q.sectionId ? {
          sectionId: q.sectionId,
          sectionTitle: sections.find(s => s.id === q.sectionId)?.title || '',
          sectionDescription: sections.find(s => s.id === q.sectionId)?.description || ''
        } : undefined
      }));
    }

    const questionnaire: Questionnaire = {
      id: initialQuestionnaire?.id || uuidv4(),
      title,
      description,
      location,
      questions: finalQuestions,
      category,
      targetAudience,
      createdAt: initialQuestionnaire?.createdAt || new Date(),
      isActive: true,
      isMultiSection
    };

    try {
      const result = await onSave(questionnaire);
      if (result) {
        const formUrl = `${window.location.origin}/questionnaires/${result}`;
        setFormUrl(formUrl);
        setShowQR(true);
      } else {
        setFormSubmitError("Could not save the questionnaire. Please try again later.");
      }
    } catch (error: any) {
      console.error('Error saving questionnaire:', error);
      setFormSubmitError(`Failed to save questionnaire: ${error.message || 'Unknown error'}`);
    }
  };

  const QuestionPreview = ({ question }: { question: QuestionnaireQuestion }) => {
    return (
      <div key={question.id} className="mb-6">
        {question.type === 'label' ? (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-700">{question.question || "Text label content will appear here"}</p>
          </div>
        ) : (
          <>
            <label className="block mb-2 font-medium">
              {question.question || "Question text"}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            
            {question.type === 'rating' && (
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-blue-100"
                  >
                    {rating}
                  </button>
                ))}
              </div>
            )}
            
            {question.type === 'text' && (
              <textarea
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Your answer here..."
                disabled
              ></textarea>
            )}
            
            {question.type === 'multiChoice' && (
              <div className="space-y-2">
                {question.options?.map((option, idx) => (
                  <div key={idx} className="flex items-center">
                    {question.multipleSelect ? (
                      <input 
                        type="checkbox" 
                        disabled 
                        className="mr-2 h-4 w-4 text-blue-600" 
                      />
                    ) : (
                      <input 
                        type="radio" 
                        disabled 
                        name={`preview-${question.id}`} 
                        className="mr-2 h-4 w-4 text-blue-600" 
                      />
                    )}
                    <span>{option || `Option ${idx + 1}`}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  const renderBasicsStep = () => (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-6"
    >
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="space-y-4">
          <Input
            label="Questionnaire Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Customer Satisfaction Survey"
            required
          />
          
          <Input
            label="Description"
            as="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this questionnaire and its purpose"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Location"
              as="select"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            >
              <option value="">Select Location</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </Input>
            
            <Input
              label="Category"
              as="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Input>
          </div>
          
          <Input
            label="Target Audience"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="e.g., Hotel Guests, Employees, Customers"
          />
          
          <label className="block mt-6 cursor-pointer">
            <div className="flex items-center p-4 border rounded-lg border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors">
              <input
                type="checkbox"
                id="isMultiSection"
                checked={isMultiSection}
                onChange={(e) => setIsMultiSection(e.target.checked)}
                className="h-5 w-5 text-blue-600 rounded accent-blue-600"
              />
              <div className="ml-3 flex-1">
                <span className="font-medium text-blue-800 block">Create Multi-Section Questionnaire</span>
                <p className="text-sm text-blue-700 mt-1">Divide your questionnaire into sections with animated transitions</p>
              </div>
            </div>
          </label>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={() => setCurrentStep(isMultiSection ? 'sections' : 'questions')}
          disabled={!title || !location}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md flex items-center shadow-md"
        >
          {isMultiSection ? 'Next: Create Sections' : 'Next: Add Questions'} 
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </Button>
      </div>
    </motion.div>
  );

  const renderSectionsStep = () => (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-6"
    >
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Questionnaire Sections</h2>
          <Button 
            onClick={() => setShowSectionModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center shadow-sm"
          >
            <span className="mr-2">➕</span> Add Section
          </Button>
        </div>
        
        {sections.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <div className="text-5xl mb-3 text-gray-300">📋</div>
            <p className="text-gray-500">No sections created yet</p>
            <Button 
              onClick={() => setShowSectionModal(true)}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Create Your First Section
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map((section, index) => (
              <motion.div 
                key={section.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`border-2 p-4 rounded-lg transition-colors cursor-pointer hover:shadow-md ${
                  currentSectionId === section.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setCurrentSectionId(section.id)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-lg">{section.title}</h3>
                    <p className="text-gray-600">{section.description}</p>
                    <div className="mt-2 text-sm text-blue-600 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                        <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      </svg>
                      {section.questions.length} {section.questions.length === 1 ? 'question' : 'questions'}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const updatedTitle = prompt('Enter new section title', section.title);
                        if (updatedTitle) {
                          updateSection(section.id, { title: updatedTitle });
                        }
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this section?')) {
                          removeSection(section.id);
                        }
                      }}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-full"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {showSectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-lg p-6 max-w-md mx-auto shadow-xl"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Add New Section</h3>
              <button
                onClick={() => setShowSectionModal(false)}
                className="text-gray-500 hover:text-red-500 p-2 rounded-full hover:bg-gray-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <Input
                label="Section Title"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="e.g., Personal Information"
                required
              />
              <Input
                label="Section Description"
                as="textarea"
                value={newSectionDescription}
                onChange={(e) => setNewSectionDescription(e.target.value)}
                placeholder="Short description of this section"
              />
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <Button 
                onClick={() => setShowSectionModal(false)}
                variant="custom"
                className="text-red-500 hover:text-red-700 px-3 py-1 rounded-md text-sm hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                onClick={addSection}
                disabled={!newSectionTitle}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 text-sm rounded-md"
              >
                Add Section
              </Button>
            </div>
          </motion.div>
        </div>
      )}
      
      <div className="flex justify-between">
        <Button 
          onClick={() => setCurrentStep('basics')}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-md flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Back to Details
        </Button>
        <Button
          onClick={() => {
            if (sections.length === 0) {
              alert('Please create at least one section');
              return;
            }
            setCurrentStep('questions');
          }}
          disabled={sections.length === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md flex items-center"
        >
          Next: Add Questions
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </Button>
      </div>
    </motion.div>
  );

  const renderQuestionsStep = () => (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-6"
    >
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {isMultiSection && currentSectionId ? (
              <div className="flex items-center">
                <span>Questions for</span>
                <select 
                  value={currentSectionId}
                  onChange={(e) => setCurrentSectionId(e.target.value)}
                  className="ml-2 border rounded-md p-1"
                >
                  {sections.map(section => (
                    <option key={section.id} value={section.id}>
                      {section.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              'Questions'
            )}
          </h2>
          <div className="flex items-center space-x-2">
            <Button onClick={() => setPreviewMode(!previewMode)}>
              {previewMode ? 'Edit Mode' : 'Preview Mode'}
            </Button>
          </div>
        </div>

        {!previewMode && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {Object.entries(QuestionTypeInfo).map(([type, info]) => (
              <button
                key={type}
                onClick={() => addQuestion(type as QuestionnaireQuestion['type'])}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="text-2xl mb-2">{info.icon}</div>
                <h3 className="font-medium">{info.label}</h3>
                <p className="text-sm text-gray-600">{info.description}</p>
              </button>
            ))}
          </div>
        )}

        {previewMode ? (
          <div className="space-y-6">
            {(isMultiSection && currentSectionId
              ? questions.filter(q => q.sectionId === currentSectionId)
              : questions
            ).map(question => <QuestionPreview key={question.id} question={question} />)}
          </div>
        ) : (
          <div className="space-y-4">
            {(isMultiSection && currentSectionId 
              ? questions.filter(q => q.sectionId === currentSectionId)
              : questions
            ).map((question, index) => (
              <motion.div 
                key={question.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-50 p-4 rounded-lg"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{QuestionTypeInfo[question.type].icon}</span>
                    <span className="font-medium">{QuestionTypeInfo[question.type].label}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => moveQuestion(question.id, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveQuestion(question.id, 'down')}
                      disabled={index === questions.length - 1}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      ↓
                    </button>
                    <Button
                      onClick={() => removeQuestion(question.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <Input
                    value={question.question}
                    onChange={(e) => updateQuestion(question.id, { question: e.target.value })}
                    placeholder={QuestionTypeInfo[question.type].placeholder}
                    required
                  />

                  {question.type === 'multiChoice' && (
                    <div className="space-y-2 ml-4">
                      <div className="flex items-center mb-3">
                        <input
                          type="checkbox"
                          id={`multipleSelect-${question.id}`}
                          checked={question.multipleSelect}
                          onChange={(e) => updateQuestion(question.id, { multipleSelect: e.target.checked })}
                          className="h-4 w-4 text-blue-600"
                        />
                        <label htmlFor={`multipleSelect-${question.id}`} className="ml-2 text-sm text-gray-700">
                          Allow multiple selections (checkboxes)
                        </label>
                      </div>
                      
                      {question.options?.map((option, optIndex) => (
                        <div key={optIndex} className="flex items-center space-x-2">
                          <span className="text-gray-500">•</span>
                          <Input
                            value={option}
                            onChange={(e) => updateOption(question.id, optIndex, e.target.value)}
                            placeholder={`Option ${optIndex + 1}`}
                            required
                          />
                          <Button
                            onClick={() => removeOption(question.id, optIndex)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={() => addOption(question.id)}
                        className="ml-4"
                      >
                        Add Option
                      </Button>
                    </div>
                  )}

                  {question.type !== 'label' && (
                    <div className="flex items-center space-x-2 mt-2">
                      <input
                        type="checkbox"
                        checked={question.required}
                        onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-600">Required question</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between mt-6">
        <Button 
          onClick={() => setCurrentStep(isMultiSection ? 'sections' : 'basics')}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-1.5 text-sm rounded-md"
        >
          {isMultiSection ? '← Back to Sections' : '← Back to Details'}
        </Button>
        <div className="flex flex-col items-end">
          {formSubmitError && (
            <div className="text-red-500 text-sm mb-2">
              {formSubmitError}
            </div>
          )}
          <Button
            onClick={handleSubmit}
            disabled={questions.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 text-sm rounded-md"
          >
            Create Questionnaire
          </Button>
        </div>
      </div>
    </motion.div>
  );

  if (showQR) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-6 rounded-lg shadow text-center"
      >
        <h2 className="text-2xl font-bold mb-2">Questionnaire Created Successfully!</h2>
        <p className="text-gray-600 mb-6">Share this QR code or link with respondents</p>
        <div className="flex flex-col items-center space-y-4 mb-8">
          <QRCodeSVG value={formUrl} size={200} />
          <p className="text-sm text-gray-600 break-all">{formUrl}</p>
        </div>
        <Button onClick={() => window.location.reload()}>
          Create Another Questionnaire
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto relative">
      {/* Header section with progress indicators */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-lg shadow">
        <h1 className="text-2xl font-bold text-gray-800">Create Questionnaire</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div 
              className={`h-3 w-10 rounded-full ${currentStep === 'basics' ? 'bg-blue-600' : 'bg-gray-300'}`} 
            />
            {isMultiSection && (
              <div 
                className={`h-3 w-10 rounded-full ${currentStep === 'sections' ? 'bg-blue-600' : 'bg-gray-300'}`} 
              />
            )}
            <div 
              className={`h-3 w-10 rounded-full ${currentStep === 'questions' ? 'bg-blue-600' : 'bg-gray-300'}`} 
            />
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-gray-500 hover:text-red-500 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            title="Cancel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {currentStep === 'basics' && renderBasicsStep()}
        {currentStep === 'sections' && renderSectionsStep()}
        {currentStep === 'questions' && renderQuestionsStep()}
      </AnimatePresence>
    </div>
  );
};

export default QuestionnaireBuilder; 