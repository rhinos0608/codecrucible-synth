import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useErrorTracking } from "@/hooks/use-error-tracking";

export default function NotFound() {
  const [location, navigate] = useLocation();
  const { track404Error } = useErrorTracking();

  useEffect(() => {
    // Track 404 error for monitoring
    track404Error(location, document.referrer);
  }, [location, track404Error]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                404 Page Not Found
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                The page you're looking for doesn't exist
              </p>
            </div>
          </div>

          <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Path: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{location}</code>
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={() => navigate(-1)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
            <Button 
              onClick={() => navigate('/')}
              size="sm"
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Go Home
            </Button>
          </div>

          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Error ID: {Date.now().toString(36)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
