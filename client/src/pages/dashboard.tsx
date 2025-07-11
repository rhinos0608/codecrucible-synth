import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { VoiceSelector } from "@/components/voice-selector";
import { PromptEngine } from "@/components/prompt-engine";
import { SolutionStack } from "@/components/solution-stack";
import { SynthesisPanel } from "@/components/synthesis-panel";
import { PhantomLedger } from "@/components/phantom-ledger";
import { useVoiceSelection } from "@/hooks/use-voice-selection";
import type { Solution } from "@shared/schema";

export default function Dashboard() {
  const [activeView, setActiveView] = useState("voices");
  const [showSolutionStack, setShowSolutionStack] = useState(false);
  const [showSynthesisPanel, setShowSynthesisPanel] = useState(false);
  const [showPhantomLedger, setShowPhantomLedger] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [currentSolutions, setCurrentSolutions] = useState<Solution[]>([]);
  
  const { getActiveVoiceCount } = useVoiceSelection();

  const handleSolutionsGenerated = (sessionId: number) => {
    setCurrentSessionId(sessionId);
    setShowSolutionStack(true);
  };

  const handleSynthesizeClick = (solutions: Solution[]) => {
    setCurrentSolutions(solutions);
    setShowSynthesisPanel(true);
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        onLedgerOpen={() => setShowPhantomLedger(true)}
      />

      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Voice Selection & Prompt Engine</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Configure your recursive coding synthesis</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Active Voices: <span className="font-medium">{getActiveVoiceCount()}</span>
              </span>
              <div className="w-2 h-2 bg-steward rounded-full"></div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex">
          <VoiceSelector />
          <PromptEngine onSolutionsGenerated={handleSolutionsGenerated} />
        </div>
      </main>

      {/* Modals */}
      <SolutionStack
        isOpen={showSolutionStack}
        onClose={() => setShowSolutionStack(false)}
        sessionId={currentSessionId}
        onSynthesizeClick={handleSynthesizeClick}
      />

      <SynthesisPanel
        isOpen={showSynthesisPanel}
        onClose={() => setShowSynthesisPanel(false)}
        solutions={currentSolutions}
        sessionId={currentSessionId || 0}
      />

      <PhantomLedger
        isOpen={showPhantomLedger}
        onClose={() => setShowPhantomLedger(false)}
      />
    </div>
  );
}
