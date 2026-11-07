import { Outlet } from 'react-router'
import { CoursesProvider } from '../../../context/CoursesProvider'
import '../../../components/authoring/authoring.css'

/** One load of the course for the pages that need it: Modules (list and module page) and Calendar (the event form links modules). */
export default function AdminCoursesLayout() {
  return (
    <CoursesProvider>
      <Outlet />
    </CoursesProvider>
  )
}
