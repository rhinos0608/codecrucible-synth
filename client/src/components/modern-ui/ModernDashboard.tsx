import { ModernLayout } from "./ModernLayout";
// import { OnboardingTour } from "../onboarding-tour"; // Temporarily disabled for layout testing
import { useState, useEffect } from "react";

export function ModernDashboard() {
  const [shouldShowTour, setShouldShowTour] = useState(false);

  // Simple tour detection
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenOnboardingTour');
    if (!hasSeenTour) {
      setShouldShowTour(true);
    }
  }, []);

  const handleTourComplete = () => {
    setShouldShowTour(false);
    localStorage.setItem('hasSeenOnboardingTour', 'true');
  };

  const handleTourSkip = () => {
    setShouldShowTour(false);
    localStorage.setItem('hasSeenOnboardingTour', 'true');
  };

  return (
    <div className="h-screen bg-white dark:bg-gray-950">
      {/* Onboarding Tour - Temporarily disabled for layout testing */}
      {/* {shouldShowTour && (
        <OnboardingTour
          isActive={true}
          onComplete={handleTourComplete}
          onSkip={handleTourSkip}
        />
      )} */}

      {/* Modern Layout */}
      <ModernLayout />
    </div>
  );
}