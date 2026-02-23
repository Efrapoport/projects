"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

/* ─── Google Identity Services type shim ─────────────────────────── */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
            }
          ) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

/* ─── Types ──────────────────────────────────────────────────────── */
export interface AuthUser {
  name: string;
  email: string;
  image?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  signIn: () => void;
  signOut: () => void;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  signIn: () => {},
  signOut: () => {},
  isReady: false,
});

const STORAGE_KEY = "sf-radar-user";

/* ─── Helpers ────────────────────────────────────────────────────── */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split(".")[1];
  const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json);
}

/* ─── Provider ───────────────────────────────────────────────────── */
export function AuthProvider({
  children,
  googleClientId,
}: {
  children: React.ReactNode;
  googleClientId?: string;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const googleInitRef = useRef(false);

  // Restore user from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setUser(JSON.parse(saved));
    } catch {
      /* ignore corrupt data */
    }
    setIsReady(true);
  }, []);

  // Google credential callback
  const handleGoogleCredential = useCallback(
    (response: { credential: string }) => {
      try {
        const payload = decodeJwtPayload(response.credential);
        const authUser: AuthUser = {
          name: payload.name as string,
          email: payload.email as string,
          image: payload.picture as string | undefined,
        };
        setUser(authUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
        setShowSignIn(false);
      } catch {
        /* JWT decode failed – keep modal open */
      }
    },
    []
  );

  // Initialize Google Identity Services when script loads
  useEffect(() => {
    if (!googleClientId || googleInitRef.current) return;

    const tryInit = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredential,
          auto_select: false,
        });
        googleInitRef.current = true;
        setGoogleLoaded(true);
        return true;
      }
      return false;
    };

    if (tryInit()) return;

    const interval = setInterval(() => {
      if (tryInit()) clearInterval(interval);
    }, 200);
    const timeout = setTimeout(() => clearInterval(interval), 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [googleClientId, handleGoogleCredential]);

  const signIn = useCallback(() => setShowSignIn(true), []);

  const signOut = useCallback(() => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const handleManualSubmit = useCallback((name: string, email: string) => {
    const authUser: AuthUser = { name, email };
    setUser(authUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    setShowSignIn(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, signIn, signOut, isReady }}>
      {children}
      {showSignIn && !user && (
        <SignInModal
          onSubmit={handleManualSubmit}
          onClose={() => setShowSignIn(false)}
          googleClientId={googleClientId}
          googleLoaded={googleLoaded}
        />
      )}
    </AuthContext.Provider>
  );
}

/* ─── Sign-in Modal ──────────────────────────────────────────────── */
function SignInModal({
  onSubmit,
  onClose,
  googleClientId,
  googleLoaded,
}: {
  onSubmit: (name: string, email: string) => void;
  onClose: () => void;
  googleClientId?: string;
  googleLoaded: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Render the official Google button inside the modal
  useEffect(() => {
    if (
      googleClientId &&
      googleLoaded &&
      googleBtnRef.current &&
      window.google?.accounts?.id
    ) {
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: 320,
      });
    }
  }, [googleClientId, googleLoaded]);

  const hasGoogle = !!(googleClientId && googleLoaded);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-in fade-in zoom-in-95">
        <h2 className="text-lg font-semibold text-gray-900 text-center mb-1">
          Sign in
        </h2>
        <p className="text-sm text-gray-500 text-center mb-5">
          Your identity is used to track pipeline updates
        </p>

        {/* Google Sign-In button (rendered by Google SDK) */}
        {hasGoogle && (
          <>
            <div ref={googleBtnRef} className="flex justify-center mb-4" />
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          </>
        )}

        {/* Manual name / email form (always available) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && email.trim()) onSubmit(name.trim(), email.trim());
          }}
          className="space-y-3"
        >
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus={!hasGoogle}
            required
          />
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <button
            type="submit"
            disabled={!name.trim() || !email.trim()}
            className="w-full py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </form>

        <button
          onClick={onClose}
          className="mt-3 w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── Hook ───────────────────────────────────────────────────────── */
export function useAuth() {
  return useContext(AuthContext);
}
