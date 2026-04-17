import { useLocation } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-7xl font-light text-muted-foreground/40">404</h1>
            <div className="h-0.5 w-16 bg-border mx-auto" />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-medium text-foreground">Page Not Found</h2>
            <p className="text-muted-foreground leading-relaxed">
              The page <span className="font-medium text-foreground">"{pageName}"</span> could not be found in this application.
            </p>
          </div>

          <div className="pt-6">
            <button
              onClick={() => window.location.href = '/'}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
