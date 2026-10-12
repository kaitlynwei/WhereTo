import { LogOut, Search, UserRound } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { useAuth } from '../context/AuthContext';

export function SiteLayout({ children, active = 'explore', savedCount = 0 }) {
  const { user, displayName, loading, signOut } = useAuth();
  const accountLabel = displayName || user?.email || 'Account';

  const handleNavSignOut = async () => {
    try {
      await signOut();
      window.location.hash = 'home';
    } catch {
      window.location.hash = 'account';
    }
  };

  return (
    <div className="site-shell">
      <header className={`navbar${user ? ' navbar--signed-in' : ''}`}>
        <BrandMark />
        <nav aria-label="Primary navigation">
          <a className={`nav-link${active === 'explore' ? ' nav-link--active' : ''}`} href="#home">Explore</a>
          <a className={`nav-link${active === 'advisor' ? ' nav-link--active' : ''}`} href="#advisor">Ask WhereTo</a>
          <a className={`nav-link${active === 'trip' || active === 'saved' ? ' nav-link--active' : ''}`} href="#trip">
            My Trip{savedCount > 0 ? <sup>{savedCount}</sup> : null}
          </a>
          <a className={`nav-link nav-link--search${active === 'search' ? ' nav-link--active' : ''}`} href="#search" aria-label="Search destinations">
            <Search size={20} strokeWidth={1.6} aria-hidden="true" />
          </a>
          {!loading && !user ? (
            <a className={`nav-link nav-link--auth${active === 'account' ? ' nav-link--active' : ''}`} href="#auth">
              <span>Sign in <span className="nav-link__signup">/ Sign up</span></span>
            </a>
          ) : null}
          {!loading && user ? (
            <>
              <a className={`nav-link nav-link--account${active === 'account' ? ' nav-link--active' : ''}`} href="#account" title={accountLabel}>
                <UserRound size={18} aria-hidden="true" /><span className="nav-account__email">{accountLabel}</span><span className="nav-account__mobile">Account</span>
              </a>
              <button className="nav-signout" type="button" onClick={handleNavSignOut} aria-label="Sign out" title="Sign out"><LogOut size={17} aria-hidden="true" /><span>Sign out</span></button>
            </>
          ) : null}
        </nav>
      </header>
      <main>{children}</main>
      <footer>
        <BrandMark />
        <p>Go somewhere worth remembering.</p>
        <span>© {new Date().getFullYear()} WhereTo</span>
      </footer>
    </div>
  );
}
