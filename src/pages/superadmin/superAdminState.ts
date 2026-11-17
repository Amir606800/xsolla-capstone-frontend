/**
 * Demo data and rules of the Super Admin dashboard. It is a front-end mock: nothing here talks to a server, and what
 * you change is gone when the page is reloaded.
 *
 * The LMS we built is one cohort (Xsolla School Baku), and its admin accounts are that school's COORDINATORS. Xsolla has
 * schools in many countries, so a super admin manages the coordinators and the cohorts, and says which coordinators
 * run which cohort (a cohort has many coordinators; a coordinator may run more than one cohort).
 */
import bakuOffice from '../../assets/images/CrescentOfficesPhoto2.webp'
import californiaOffice from '../../assets/images/CaliforniaOffice.png'
import kualaLumpurOffice from '../../assets/images/KualaLumpurOffice.png'

export interface Coordinator {
  id: string
  name: string
  email: string
}

export interface Cohort {
  id: string
  name: string
  country: string
  city: string
  coordinatorIds: string[]
  /** A line about the school. */
  note?: string
  /** The picture of the cohort's office (from src/assets/images); none shows the city's name instead. */
  photo?: string
  /** Where in the picture to look when it is cropped to the card (CSS object-position). */
  photoPosition?: string
  /** The cohort's own page. Only Baku has one so far (its admin sign-in); a cohort without one is not a link. */
  path?: string
}

export interface SuperAdminState {
  coordinators: Coordinator[]
  cohorts: Cohort[]
  nextId: number
}

export type SuperAdminAction =
  | { type: 'addCoordinator'; name: string; email: string; cohortIds: string[] }
  | { type: 'removeCoordinator'; id: string }
  | { type: 'addCohort'; name: string; country: string; city: string; coordinatorIds: string[] }
  | { type: 'removeCohort'; id: string }
  | { type: 'assign'; cohortId: string; coordinatorIds: string[] }

export const initialState: SuperAdminState = {
  coordinators: [
    { id: 'c1', name: 'School Admin', email: 'admin@xsolla.school' },
    { id: 'c2', name: 'Nigar Mammadova', email: 'nigar.mammadova@xsolla.school' },
    { id: 'c3', name: 'Aiman Hakim', email: 'aiman.hakim@xsolla.school' },
    { id: 'c4', name: 'Jordan Rivera', email: 'jordan.rivera@xsolla.school' },
    { id: 'c5', name: 'Aidana Sarsenova', email: 'aidana.sarsenova@xsolla.school' },
  ],
  cohorts: [
    {
      id: 'h1',
      name: 'Xsolla School Baku',
      country: 'Azerbaijan',
      city: 'Baku',
      coordinatorIds: ['c1', 'c2'],
      note: '12 to 16 week program for university students and graduates, and the StarNest Academy for local developers.',
      photo: bakuOffice,
      photoPosition: 'center 40%',
      path: '/login',
    },
    {
      id: 'h2',
      name: 'Xsolla School Kuala Lumpur',
      country: 'Malaysia',
      city: 'Kuala Lumpur',
      coordinatorIds: ['c3'],
      note: 'Xsolla School KL, and the Curine Academy: a 4,000 m² campus with 1 to 12 month tracks in game design, 3D art, Unreal and Unity.',
      photo: kualaLumpurOffice,
    },
    {
      id: 'h3',
      name: 'Xsolla School California',
      country: 'United States',
      city: 'Mountain View, Los Angeles',
      coordinatorIds: ['c4'],
      note: 'Student cohorts tied to the Mountain View office and the headquarters in Los Angeles.',
      photo: californiaOffice,
      photoPosition: 'center 25%',
    },
  ],
  nextId: 6,
}

const unique = (ids: string[]) => [...new Set(ids)]

export function superAdminReducer(state: SuperAdminState, action: SuperAdminAction): SuperAdminState {
  switch (action.type) {
    case 'addCoordinator': {
      const id = `c${state.nextId}`
      return {
        ...state,
        nextId: state.nextId + 1,
        coordinators: [...state.coordinators, { id, name: action.name, email: action.email }],
        cohorts: state.cohorts.map((h) => (action.cohortIds.includes(h.id) ? { ...h, coordinatorIds: [...h.coordinatorIds, id] } : h)),
      }
    }
    case 'removeCoordinator':
      return {
        ...state,
        coordinators: state.coordinators.filter((c) => c.id !== action.id),
        cohorts: state.cohorts.map((h) => ({ ...h, coordinatorIds: h.coordinatorIds.filter((id) => id !== action.id) })),
      }
    case 'addCohort': {
      const id = `h${state.nextId}`
      return {
        ...state,
        nextId: state.nextId + 1,
        cohorts: [...state.cohorts, { id, name: action.name, country: action.country, city: action.city, coordinatorIds: unique(action.coordinatorIds) }],
      }
    }
    case 'removeCohort':
      return { ...state, cohorts: state.cohorts.filter((h) => h.id !== action.id) }
    case 'assign':
      return {
        ...state,
        cohorts: state.cohorts.map((h) => (h.id === action.cohortId ? { ...h, coordinatorIds: unique(action.coordinatorIds) } : h)),
      }
  }
}

/** The cohorts a coordinator runs. */
export const cohortsOf = (state: SuperAdminState, coordinatorId: string) =>
  state.cohorts.filter((h) => h.coordinatorIds.includes(coordinatorId))

/** The coordinators who run no cohort yet. */
export const unassigned = (state: SuperAdminState) => state.coordinators.filter((c) => cohortsOf(state, c.id).length === 0)
