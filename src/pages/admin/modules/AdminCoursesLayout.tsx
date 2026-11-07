import { Outlet } from 'react-router'
import { CoursesProvider } from '../../../context/CoursesProvider'
import '../../../components/authoring/authoring.css'

/** The Modules list and a module's page share one load of the course. */
export default function AdminCoursesLayout() {
  return (
    <CoursesProvider>
      <Outlet />
    </CoursesProvider>
  )
}
