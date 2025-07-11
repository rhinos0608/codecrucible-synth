import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X, Eye, EyeOff, Download } from "lucide-react";
import { useErrorTracking } from "@/hooks/use-error-tracking";

interface ErrorMonitorProps {
  isVisible: boolean;
  onToggle: () => void;
}

export function ErrorMonitor({ isVisible, onToggle }: ErrorMonitorProps) {
  const { getLocalErrors, clearLocalErrors } = useErrorTracking();
  const [errors, setErrors] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (isVisible) {
      const localErrors = getLocalErrors();
      setErrors(localErrors);
    }
  }, [isVisible, refreshKey, getLocalErrors]);

  const handleClearErrors = () => {
    clearLocalErrors();
    setErrors([]);
    setRefreshKey(prev => prev + 1);
  };

  const handleExportErrors = () => {
    const dataStr = JSON.stringify(errors, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `error-log-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  if (!isVisible) {
    return (
      <Button
        onClick={onToggle}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50 bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
      >
        <AlertTriangle className="w-4 h-4 mr-1" />
        Errors ({errors.length})
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96 bg-background border rounded-lg shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Error Monitor ({errors.length})
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={handleExportErrors}
              variant="ghost"
              size="sm"
              disabled={errors.length === 0}
            >
              <Download className="w-3 h-3" />
            </Button>
            <Button
              onClick={handleClearErrors}
              variant="ghost"
              size="sm"
              disabled={errors.length === 0}
            >
              Clear
            </Button>
            <Button
              onClick={onToggle}
              variant="ghost"
              size="sm"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-64 overflow-y-auto text-xs">
        {errors.length === 0 ? (
          <p className="text-muted-foreground">No errors recorded</p>
        ) : (
          <div className="space-y-2">
            {errors.slice(-10).reverse().map((error, index) => (
              <div key={index} className="border rounded p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <Badge className={`${getSeverityColor(error.severity)} text-white`}>
                    {error.errorType}
                  </Badge>
                  <span className="text-muted-foreground">
                    {new Date(error.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="font-mono text-xs break-all">
                  {error.errorMessage}
                </div>
                {error.metadata && (
                  <div className="text-muted-foreground">
                    {error.metadata.endpoint && (
                      <div>Endpoint: {error.metadata.endpoint}</div>
                    )}
                    {error.metadata.componentName && (
                      <div>Component: {error.metadata.componentName}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </div>
  );
}

export default ErrorMonitor;