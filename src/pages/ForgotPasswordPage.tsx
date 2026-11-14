import { Link } from 'react-router'
import officePhoto from '../assets/images/CrescentOfficesPhoto.webp'
import { XsollaLogo } from '../components/XsollaLogo'
import { useTheme } from '../hooks/useTheme'
import './AuthPage.css'

/** Where "Forgot password?" on the sign-in page leads: there is no e-mail reset, a mentor or an admin sets a new password. */
export default function ForgotPasswordPage() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div className="auth">
      <aside className="auth__hero" style={{ ['--hero-img' as string]: `url(${officePhoto})` }}>
        <div className="auth__brand">
          <XsollaLogo className="auth__logo" />
          <span className="auth__school">SCHOOL BAKU</span>
        </div>
      </aside>

      <button type="button" className="auth__theme" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === 'dark' ? '☀' : '☾'}
      </button>

      <main className="auth__main">
        <div className="auth__card">
          <h1 className="auth__title">Forgot your password?</h1>
          <p className="auth__note">To reset your password, please contact your mentor or the admin.</p>
          <Link to="/login" className="auth__link">
            Back to sign in
          </Link>
        </div>
      </main>
    </div>
  )
}
