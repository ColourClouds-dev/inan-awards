# Employee Polls Feature - Implementation Plan

## Overview

Reinstate the Employee Poll feature to enable Staff of the Month voting and general opinion polling within the existing multi-tenant INAN Feedback platform, integrating seamlessly with the current employee import system and maintaining established authentication and UI patterns.

## Problem Statement

The Employee Poll feature was previously removed but is now needed to support:
- **Staff of the Month voting** with employee nomination capabilities
- **General opinion polls** for company-wide feedback and decision making
- **WhatsApp/Twitter-style voting** for simple, intuitive user experience
- **Integration with existing employee data** from the Firestore employee collection

## Requirements

### Functional Requirements
- **Mixed poll types**: Simple opinion polls (WhatsApp/Twitter style) + Staff of the Month voting with employee nomination
- **Universal permissions**: All authenticated users (owners and staff) can create polls and vote
- **Manual nominee selection**: Poll creators manually select which employees can be nominated for Staff of the Month
- **Simple visibility**: Active/inactive status with no complex scheduling initially
- **Integration**: Leverage existing employee import collection and follow current system patterns

### Technical Requirements
- Follow existing multi-tenant architecture patterns
- Use established authentication and role-based access control
- Maintain consistency with feedback form builder UI/UX
- Ensure proper tenant isolation and data security
- Support real-time voting updates
- Mobile-responsive design

## Architecture Overview

### Data Model
The polls system extends the existing feedback architecture with new collections:
- `polls` - Poll definitions and configuration
- `poll-responses` - Individual poll submissions
- `poll-votes` - Granular vote tracking

### Permission Model
Following the same pattern as feedback forms:
- **Create**: Any authenticated tenant member can create polls
- **Read**: Owners see all polls, staff see their own polls + can vote on all active polls
- **Update**: Creators can edit their own polls, owners can edit all polls in their tenant
- **Delete**: Creators can delete their own polls, owners can delete all polls in their tenant

### Integration Points
- **Navigation**: Add polls section under Feedback in dashboard
- **Employee Data**: Use existing employee collection for Staff of the Month nominations
- **Authentication**: Use existing TenantContext and role-based permissions
- **UI Components**: Extend existing form builder patterns

## Implementation Tasks

### Task 1: Data Models and TypeScript Interfaces ✅

**Objective**: Define type-safe interfaces for poll system

**Files to modify/create**:
- `src/types/index.ts` - Add poll-related interfaces

**Implementation details**:
```typescript
// Core poll interface extending form patterns
export interface Poll {
  id: string;
  title: string;
  description?: string;
  type: 'opinion' | 'staff_nomination';
  questions: PollQuestion[];
  nominees?: string[]; // Employee IDs for Staff of the Month
  createdAt: Date | Timestamp;
  isActive: boolean;
  allowMultipleVotes?: boolean;
  showResults: 'after_voting' | 'always' | 'never';
  endDate?: Date | Timestamp;
  createdBy: string; // UID of creator
  tenantId: string;
  slug?: string; // Optional URL slug
}

export interface PollQuestion {
  id: string;
  question: string;
  type: 'single_choice' | 'multiple_choice';
  options: string[];
  maxSelections?: number; // For multiple choice
  required: boolean;
}

export interface PollResponse {
  id: string;
  pollId: string;
  employeeId?: string; // If voting as employee
  voterUid: string; // Firebase Auth UID
  responses: {
    [questionId: string]: string | string[];
  };
  submittedAt: Date | Timestamp;
  tenantId: string;
}

export interface PollVote {
  id: string;
  pollId: string;
  questionId: string;
  optionId: string;
  voterUid: string;
  employeeId?: string;
  submittedAt: Date | Timestamp;
  tenantId: string;
}
```

**Acceptance criteria**:
- [ ] All poll interfaces defined with proper typing
- [ ] Extends existing patterns (tenantId, createdBy, timestamps)
- [ ] Supports both opinion polls and staff nomination voting
- [ ] Includes fields for result visibility and voting controls

---

### Task 2: Database Schema and Firestore Security Rules ✅

**Objective**: Set up secure, tenant-scoped poll collections

**Files to modify/create**:
- `firestore.rules` - Add poll security rules
- `firestore.indexes.json` - Add required composite indexes

**Implementation details**:

**Security Rules**:
```javascript
// ── Polls ────────────────────────────────────────────────────────────────────
// Similar access pattern to feedback forms:
// - Any tenant member can create polls
// - Owners can read/write all polls in their tenant
// - Staff can read all active polls + their own polls, write only their own
match /polls/{pollId} {
  allow read: if resource.data.isActive == true
              || isSuperAdmin()
              || isOwnerOf(resource.data.tenantId)
              || (isAuthenticated()
                  && request.auth.token.role == 'staff'
                  && request.auth.token.tenantId != null);

  allow create: if isSuperAdmin()
                || isOwnerOf(request.resource.data.tenantId)
                || (isStaffOf(request.resource.data.tenantId) && isSelfCreating());

  allow update: if isSuperAdmin()
                || isOwnerOf(resource.data.tenantId)
                || (isStaffOf(resource.data.tenantId) && isCreator());

  allow delete: if isSuperAdmin()
                || isOwnerOf(resource.data.tenantId)
                || (isStaffOf(resource.data.tenantId) && isCreator());
}

// ── Poll responses ───────────────────────────────────────────────────────────
match /poll-responses/{responseId} {
  allow create: if isMemberOf(request.resource.data.tenantId);
  allow read: if isSuperAdmin()
              || isOwnerOf(resource.data.tenantId)
              || (isAuthenticated() && request.auth.uid == resource.data.voterUid);
  allow list: if isSuperAdmin()
              || (isAuthenticated() && request.auth.token.tenantId != null);
}

// ── Poll votes ───────────────────────────────────────────────────────────────
match /poll-votes/{voteId} {
  allow create: if isMemberOf(request.resource.data.tenantId);
  allow read, list: if isSuperAdmin()
                    || (isAuthenticated() && request.auth.token.tenantId != null);
}
```

**Indexes**:
```json
{
  "fieldOverrides": [],
  "indexes": [
    {
      "collectionGroup": "polls",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "tenantId", "order": "ASCENDING"},
        {"fieldPath": "isActive", "order": "ASCENDING"},
        {"fieldPath": "createdAt", "order": "DESCENDING"}
      ]
    },
    {
      "collectionGroup": "polls", 
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "tenantId", "order": "ASCENDING"},
        {"fieldPath": "createdBy", "order": "ASCENDING"},
        {"fieldPath": "createdAt", "order": "DESCENDING"}
      ]
    },
    {
      "collectionGroup": "poll-responses",
      "queryScope": "COLLECTION", 
      "fields": [
        {"fieldPath": "tenantId", "order": "ASCENDING"},
        {"fieldPath": "pollId", "order": "ASCENDING"},
        {"fieldPath": "submittedAt", "order": "DESCENDING"}
      ]
    }
  ]
}
```

**Acceptance criteria**:
- [ ] Poll collections created with proper tenant scoping
- [ ] Security rules allow universal creation within tenant
- [ ] Creator ownership model implemented
- [ ] Composite indexes support efficient querying
- [ ] Public voting access for active polls

---

### Task 3: Employee Selection API and Utilities ✅

**Objective**: Create APIs for employee selection in Staff of the Month polls

**Files to modify/create**:
- `src/app/api/employees/route.ts` - Employee listing API
- `src/lib/pollsFirestore.ts` - Poll data access layer

**Implementation details**:

**Employee API**:
```typescript
// src/app/api/employees/route.ts
export async function GET(request: NextRequest) {
  try {
    const token = await verifyAuth(request);
    const tenantId = request.headers.get('x-tenant-id') || token.tenantId;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const employees = await getAllEmployees(tenantId);
    return NextResponse.json({ employees });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}
```

**Poll Firestore utilities**:
```typescript
// src/lib/pollsFirestore.ts
export async function getAllPolls(tenantId: string, createdBy?: string): Promise<Poll[]> {
  const constraints = [where('tenantId', '==', tenantId)];
  
  if (createdBy) {
    constraints.push(where('createdBy', '==', createdBy));
  }
  
  constraints.push(orderBy('createdAt', 'desc'));
  
  const q = query(collection(db, 'polls'), ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Poll));
}

export async function createPoll(poll: Omit<Poll, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'polls'), {
    ...poll,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function validateEmployeeNominees(
  employeeIds: string[], 
  tenantId: string
): Promise<boolean> {
  const employees = await getAllEmployees(tenantId);
  const validIds = employees.map(emp => String(emp['Employee ID']));
  
  return employeeIds.every(id => validIds.includes(id));
}
```

**Acceptance criteria**:
- [ ] Employee API returns tenant-scoped employee list
- [ ] Poll data access functions follow existing patterns
- [ ] Employee validation prevents cross-tenant nominee selection
- [ ] Proper error handling and authentication

---

### Task 4: Poll Builder Component ✅

**Objective**: Create poll creation interface following FeedbackFormBuilder patterns

**Files to modify/create**:
- `src/components/PollBuilder.tsx` - Main poll builder component
- `src/components/EmployeeSelector.tsx` - Employee nomination interface
- `src/app/dashboard/feedback/polls/create/page.tsx` - Poll creation page

**Implementation details**:

**Poll Builder Structure**:
```typescript
// src/components/PollBuilder.tsx
type Step = 'basics' | 'questions' | 'nominees';

interface PollBuilderProps {
  onSave: (poll: Poll) => Promise<void>;
}

const PollBuilder = ({ onSave }: PollBuilderProps) => {
  const [step, setStep] = useState<Step>('basics');
  const [pollData, setPollData] = useState<Partial<Poll>>({
    type: 'opinion',
    questions: [],
    nominees: [],
    isActive: true,
    showResults: 'after_voting',
  });

  // Step-by-step creation flow
  const steps = [
    { id: 'basics', label: 'Poll Details' },
    { id: 'questions', label: 'Questions' },
    { id: 'nominees', label: 'Nominees' }, // Only for staff_nomination type
  ];

  // Implementation follows FeedbackFormBuilder patterns
};
```

**Employee Selector**:
```typescript
// src/components/EmployeeSelector.tsx
interface EmployeeSelectorProps {
  selectedEmployees: string[];
  onSelectionChange: (employeeIds: string[]) => void;
  tenantId: string;
}

const EmployeeSelector = ({ selectedEmployees, onSelectionChange, tenantId }: EmployeeSelectorProps) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch employees and provide selection interface
  // Include search, filtering, and multi-select capabilities
};
```

**Acceptance criteria**:
- [ ] Step-by-step poll creation matching feedback form UX
- [ ] Support for both opinion polls and staff nomination polls
- [ ] Employee nominee selection with search and filtering
- [ ] Real-time preview of poll structure
- [ ] Form validation and error handling

---

### Task 5: Poll Display and Voting Interface ✅

**Objective**: Create public poll voting pages with WhatsApp/Twitter-style UI

**Files to modify/create**:
- `src/app/poll/[pollId]/page.tsx` - Public poll voting page
- `src/components/PollVotingInterface.tsx` - Voting UI component
- `src/components/EmployeeNomineeCard.tsx` - Staff nominee display

**Implementation details**:

**Voting Interface**:
```typescript
// src/components/PollVotingInterface.tsx
interface PollVotingInterfaceProps {
  poll: Poll;
  employees?: Employee[]; // For staff nomination polls
}

const PollVotingInterface = ({ poll, employees }: PollVotingInterfaceProps) => {
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [hasVoted, setHasVoted] = useState(false);

  // WhatsApp/Twitter-style voting UI
  // - Clean, simple option selection
  // - Visual feedback on selection
  // - Progress indicators
  // - Vote confirmation
};
```

**Staff Nominee Cards**:
```typescript
// src/components/EmployeeNomineeCard.tsx
interface EmployeeNomineeCardProps {
  employee: Employee;
  isSelected: boolean;
  onSelect: () => void;
  showVoteCount?: boolean;
  voteCount?: number;
}

// Professional employee cards with photo, name, department
// Vote count display (if results are visible)
// Selection states and animations
```

**Acceptance criteria**:
- [ ] Clean, intuitive voting interface
- [ ] Support for single and multiple choice questions
- [ ] Employee nominee display with professional cards
- [ ] Vote confirmation and thank you screens
- [ ] Duplicate vote prevention
- [ ] Mobile-responsive design

---

### Task 6: Poll Management Dashboard ✅

**Objective**: Create comprehensive poll management interface

**Files to modify/create**:
- `src/app/dashboard/feedback/polls/page.tsx` - Poll listing page
- `src/app/dashboard/feedback/polls/[pollId]/page.tsx` - Poll details/results
- `src/components/PollResultsDisplay.tsx` - Results visualization
- `src/components/PollStatusToggle.tsx` - Active/inactive controls

**Implementation details**:

**Poll Listing**:
```typescript
// src/app/dashboard/feedback/polls/page.tsx
const PollsPage = () => {
  const { tenant, isOwner, currentUid } = useTenant();
  const [polls, setPolls] = useState<Poll[]>([]);

  // Load polls based on role:
  // - Owners: all polls in tenant
  // - Staff: only their own polls
  
  const loadPolls = async () => {
    const createdBy = isOwner ? undefined : currentUid;
    const pollList = await getAllPolls(tenant.id, createdBy);
    setPolls(pollList);
  };
};
```

**Results Display**:
```typescript
// src/components/PollResultsDisplay.tsx
interface PollResultsDisplayProps {
  poll: Poll;
  responses: PollResponse[];
  votes: PollVote[];
}

const PollResultsDisplay = ({ poll, responses, votes }: PollResultsDisplayProps) => {
  // Visualize results with:
  // - Vote count per option
  // - Percentage breakdowns
  // - Winner determination for staff nominations
  // - Export capabilities
  // - Charts and graphs
};
```

**Acceptance criteria**:
- [ ] Poll listing with proper role-based filtering
- [ ] Poll status management (active/inactive)
- [ ] Comprehensive results display with charts
- [ ] Winner determination for Staff of the Month
- [ ] Export functionality for results
- [ ] Poll editing and deletion controls

---

### Task 7: Navigation Integration and Real-time Results ✅

**Objective**: Integrate polls into dashboard navigation and add real-time features

**Files to modify/create**:
- `src/components/DashboardLayout.tsx` - Add polls navigation
- `src/hooks/usePollResults.ts` - Real-time results hook
- `src/lib/pollsRealtime.ts` - Firestore listeners

**Implementation details**:

**Navigation Update**:
```typescript
// In DashboardLayout.tsx allNavItems
{
  href: '/dashboard/feedback',
  label: 'Feedback',
  icon: IconFeedback,
  show: true,
  children: [
    { href: '/dashboard/feedback/forms', label: 'Forms' },
    { href: '/dashboard/feedback/polls', label: 'Polls' }, // NEW
    { href: '/dashboard/feedback/responses', label: 'Responses' },
    { href: '/dashboard/feedback/analytics', label: 'Analytics' },
  ],
}
```

**Real-time Results**:
```typescript
// src/hooks/usePollResults.ts
export const usePollResults = (pollId: string) => {
  const [results, setResults] = useState<PollResults | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'poll-votes'),
        where('pollId', '==', pollId)
      ),
      (snapshot) => {
        const votes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PollVote));
        setResults(calculatePollResults(votes));
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [pollId]);

  return { results, loading };
};
```

**Acceptance criteria**:
- [ ] Polls section visible in dashboard navigation
- [ ] Real-time vote count updates
- [ ] Live results display during active polls
- [ ] Proper loading states and error handling
- [ ] Mobile-responsive navigation

---

### Task 8: Testing, Polish, and Documentation ✅

**Objective**: Complete the feature with comprehensive testing and documentation

**Files to modify/create**:
- `docs/04-features.md` - Add polls documentation
- `src/components/PollShareButton.tsx` - QR codes and sharing
- `src/lib/pollsExport.ts` - Export utilities
- Error handling improvements across all components

**Implementation details**:

**Documentation Update**:
```markdown
## Polls

The Polls feature enables staff recognition voting and company-wide opinion gathering.

### Poll Types
- **Opinion Polls**: Simple single or multiple-choice questions for general feedback
- **Staff Nomination**: Employee recognition with nominee selection and voting

### Creating Polls
1. Navigate to Dashboard > Feedback > Polls
2. Click "Create Poll"
3. Follow the step-by-step wizard:
   - Poll Details: Title, description, type, and settings
   - Questions: Add voting questions with options
   - Nominees: Select employees for Staff of the Month (if applicable)

### Voting
- All authenticated tenant members can vote on active polls
- Duplicate voting prevention via user authentication
- Real-time results display (based on poll settings)

### Results and Analytics
- Live vote counting and percentage breakdowns
- Winner determination for staff nominations
- Export capabilities for further analysis
```

**Share and Export**:
```typescript
// src/components/PollShareButton.tsx
interface PollShareButtonProps {
  poll: Poll;
  tenantDomain: string;
}

const PollShareButton = ({ poll, tenantDomain }: PollShareButtonProps) => {
  const pollUrl = `https://${tenantDomain}/poll/${poll.id}`;
  
  // QR code generation
  // Social sharing links
  // Copy URL functionality
};
```

**Acceptance criteria**:
- [ ] Comprehensive error handling throughout
- [ ] Loading states for all async operations
- [ ] QR code sharing for polls
- [ ] Results export in multiple formats
- [ ] Complete feature documentation
- [ ] User guide and help text

---

## Success Metrics

### Technical Metrics
- [ ] All Firestore security rules pass validation
- [ ] No security vulnerabilities in poll creation or voting
- [ ] Page load times under 2 seconds
- [ ] Mobile responsiveness across all screens
- [ ] Real-time updates work reliably

### User Experience Metrics
- [ ] Poll creation flow completed in under 3 minutes
- [ ] Voting experience intuitive and fast
- [ ] Results display clear and actionable
- [ ] Zero authentication or permission errors

### Integration Metrics
- [ ] Seamless navigation integration
- [ ] Consistent UI/UX with existing features
- [ ] Proper tenant isolation maintained
- [ ] Employee data integration working correctly

## Deployment Plan

### Phase 1: Core Infrastructure
1. Deploy data models and security rules
2. Set up API endpoints and utilities
3. Test authentication and permissions

### Phase 2: User Interface
1. Deploy poll builder component
2. Create voting interface
3. Add management dashboard

### Phase 3: Integration & Polish
1. Add navigation integration
2. Implement real-time features
3. Add sharing and export capabilities
4. Complete documentation

### Rollback Plan
- All new collections can be safely removed
- No changes to existing feedback functionality
- Navigation changes can be reverted via feature flag

## Post-Launch

### Monitoring
- Track poll creation and voting rates
- Monitor API performance and errors
- Gather user feedback on interface usability

### Future Enhancements
- Advanced poll scheduling (start/end dates)
- Department-based poll targeting
- Anonymous voting options
- Poll templates and categories
- Advanced analytics and reporting

---

## Risk Mitigation

### Security Risks
- **Cross-tenant data leakage**: Mitigated by consistent tenant scoping in all queries
- **Unauthorized poll access**: Prevented by Firestore security rules validation
- **Vote manipulation**: Protected by Firebase Auth integration and duplicate prevention

### Performance Risks
- **Large tenant polling**: Indexed queries and pagination for scale
- **Real-time updates**: Optimized listeners and result caching
- **Employee list loading**: Lazy loading and search optimization

### User Experience Risks
- **Complex poll creation**: Step-by-step wizard with clear guidance
- **Voting confusion**: WhatsApp-style simple interface
- **Results interpretation**: Clear visualizations and winner highlighting

---

*This implementation plan maintains consistency with the existing INAN Feedback architecture while adding comprehensive polling capabilities for employee engagement and recognition.*