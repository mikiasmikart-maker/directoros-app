export interface Operator {
  id: string;
  name: string;
  initials: string;
  color: string; // Tailored HSL or hex for presence
}

export type PresenceActivityType = 'viewing' | 'touched' | 'reviewing' | 'comparing' | 'preparing_commit' | 'retrying';

export interface Conflict {
  operatorId: string;
  peerIntent: PresenceActivityType;
  myIntent: PresenceActivityType;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface PresenceActivity {
  operatorId: string;
  targetId: string; // LineageRootId or JobId
  type: PresenceActivityType;
  timestamp: number;
  lastAction?: string;
}

export interface PresenceState {
  activeOperators: Operator[];
  activities: PresenceActivity[];
}

export const MOCK_OPERATORS: Operator[] = [
  { id: 'op_alpha', name: 'Alpha', initials: 'AX', color: '#4da3ff' }, // Cyan (Current User)
  { id: 'op_bravo', name: 'Bravo', initials: 'BK', color: '#a78bfa' }, // violet
  { id: 'op_charlie', name: 'Charlie', initials: 'CR', color: '#fb923c' }, // orange
];
