'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import BookTutoringCTA from '@/components/BookTutoringCTA';
import SaveProgressModal from '@/components/SaveProgressModal';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { isTeacherLikeRole, isMasterRole } from '@/lib/auth/roles';

type NavProfile = {
  username: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

export default function TopNav() {
  const pathname = usePathname() || '';
  const router = useRouter();

  const [saveOpen, setSaveOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfile] = useState<NavProfile | null>(null);

  const showBack = pathname !== '/dashboard' && pathname !== '/';
  const showSave = pathname !== '/resume' && !pathname.startsWith('/resume/');
  const isTeacher = isTeacherLikeRole(profile?.role);
  const isMaster = isMasterRole(profile?.role);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function loadAuthState() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          setIsAuthenticated(false);
          setProfile(null);
          return;
        }

        setIsAuthenticated(true);

        const { data } = await supabase
          .from('profiles')
          .select('username, full_name, email, role')
          .eq('id', user.id)
          .maybeSingle();

        const profileData = (data ?? null) as NavProfile | null;

        setProfile({
          username: profileData?.username ?? null,
          full_name:
            profileData?.full_name ??
            user.user_metadata?.full_name ??
            null,
          email: profileData?.email ?? user.email ?? null,
          role: profileData?.role ?? null,
        });
      } catch (err) {
        console.warn('No active auth session in TopNav:', err);
        setIsAuthenticated(false);
        setProfile(null);
      }
    }

    loadAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadAuthState();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const welcomeName = useMemo(() => {
    if (profile?.username?.trim()) return profile.username.trim();

    if (profile?.full_name?.trim()) {
      return profile.full_name.trim().split(' ')[0];
    }

    if (profile?.email?.trim()) {
      return profile.email.trim().split('@')[0];
    }

    return 'Student';
  }, [profile]);

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();

    await supabase.auth.signOut();

    setIsAuthenticated(false);
    setProfile(null);

    router.push('/login');
    router.refresh();
  }

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <header className="om-header">
        <div className="om-topbar">
          <div className="om-topbar-inner">

            <div className="flex items-center gap-3 min-w-0">
              <Link href="/dashboard" className="om-brand">
                OrlandoMath <span className="om-brand-sub">Regents Tutor</span>
              </Link>

              <span className="hidden sm:inline-block om-pill">
                Algebra 1
              </span>
            </div>

            <nav className="flex min-w-0 flex-1 items-center justify-end gap-2 lg:gap-4 xl:gap-5">

              <div className="hidden md:flex items-center justify-end gap-3 lg:gap-4 xl:gap-5">

                <BookTutoringCTA
                  variant="secondary"
                  className="!px-5 !py-3 !text-lg !font-bold shadow-lg"
                />

                {isAuthenticated && (
                  <span className="om-navlink whitespace-nowrap">
                    Welcome {welcomeName}
                  </span>
                )}

                <Link href="/dashboard" className="om-navlink">
                  Dashboard
                </Link>

                {isAuthenticated && !isTeacher && (
                  <Link href="/join-class" className="om-navlink">
                    Join Classroom
                  </Link>
                )}

                {isAuthenticated && isTeacher && (
                  <Link href="/teacher/classrooms" className="om-navlink">
                    My Classrooms
                  </Link>
                )}

                {isAuthenticated && isMaster && (
                  <Link href="/master" className="om-navlink">
                    Master Dashboard
                  </Link>
                )}

                {!isAuthenticated ? (
                  <>
                    <Link href="/signup" className="om-navlink">
                      Signup
                    </Link>

                    <Link href="/login" className="om-navlink">
                      Login
                    </Link>

                    {showSave && (
                      <button
                        type="button"
                        onClick={() => setSaveOpen(true)}
                        className="om-navlink"
                        title="Save your progress and get a resume link"
                      >
                        Save My Progress
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="om-navlink"
                  >
                    Sign Out
                  </button>
                )}

                {showBack && (
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="om-navlink"
                  >
                    Back
                  </button>
                )}

              </div>

              <div className="flex md:hidden items-center gap-2">

                <BookTutoringCTA
                  variant="secondary"
                  className="!px-4 !py-2.5 !text-sm !font-bold shadow-lg whitespace-nowrap"
                />

                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="inline-flex items-center justify-center rounded-full bg-white text-blue-700 hover:bg-blue-50 ring-1 ring-blue-200 px-4 py-2.5 text-sm font-bold shadow-lg"
                >
                  Menu
                </button>

              </div>

            </nav>
          </div>
        </div>

        <div className="om-rainbowline" />

        {menuOpen && (
          <div className="md:hidden border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-2 px-4 py-4">

              {isAuthenticated && (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900">
                  Welcome {welcomeName}
                </div>
              )}

              <Link
                href="/dashboard"
                onClick={closeMenu}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50"
              >
                Dashboard
              </Link>

              {isAuthenticated && !isTeacher && (
                <Link
                  href="/join-class"
                  onClick={closeMenu}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Join Classroom
                </Link>
              )}

              {isAuthenticated && isTeacher && (
                <Link
                  href="/teacher/classrooms"
                  onClick={closeMenu}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50"
                >
                  My Classrooms
                </Link>
              )}

              {isAuthenticated && isMaster && (
                <Link
                  href="/master"
                  onClick={closeMenu}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Master Dashboard
                </Link>
              )}

              {!isAuthenticated ? (
                <>
                  <Link
                    href="/signup"
                    onClick={closeMenu}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Signup
                  </Link>

                  <Link
                    href="/login"
                    onClick={closeMenu}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Login
                  </Link>

                  {showSave && (
                    <button
                      type="button"
                      onClick={() => {
                        closeMenu();
                        setSaveOpen(true);
                      }}
                      className="rounded-xl bg-blue-600 px-4 py-3 text-left text-base font-semibold text-white hover:bg-blue-700"
                    >
                      Save My Progress
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    handleSignOut();
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-base font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Sign Out
                </button>
              )}

              {showBack && (
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    router.back();
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-base font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Back
                </button>
              )}

            </div>
          </div>
        )}
      </header>

      {!isAuthenticated && (
        <SaveProgressModal
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
        />
      )}
    </>
  );
}