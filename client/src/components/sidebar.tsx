import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Code2, Users, Layers3, BarChart3, BookOpen, Moon, Sun } from "lucide-react";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onLedgerOpen: () => void;
}

export function Sidebar({ activeView, onViewChange, onLedgerOpen }: SidebarProps) {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-seeker to-witness rounded-lg flex items-center justify-center">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Arkane Technologies</h1>
            <p className="text-xs text-gray-400">Multi-Voice AI Platform</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <div className="space-y-2">
          <Button
            variant={activeView === "voices" ? "default" : "ghost"}
            className={`w-full justify-start ${
              activeView === "voices" 
                ? "bg-blue-900/20 text-seeker border border-blue-800" 
                : ""
            }`}
            onClick={() => onViewChange("voices")}
          >
            <Users className="w-4 h-4 mr-3" />
            Code Engine Selection
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => onViewChange("synthesis")}
          >
            <Layers3 className="w-4 h-4 mr-3" />
            Code Synthesis
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => onViewChange("analytics")}
          >
            <BarChart3 className="w-4 h-4 mr-3" />
            Analytics
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={onLedgerOpen}
          >
            <BookOpen className="w-4 h-4 mr-3" />
            Decision History
          </Button>
        </div>

        {/* Performance Metrics */}
        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">System Metrics</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Generation Speed</span>
              <span className="font-medium">2.3s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Success Rate</span>
              <span className="font-medium text-steward">94%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Ethical Score</span>
              <span className="font-medium text-steward">96%</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Theme Toggle */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={toggleTheme}
        >
          {isDark ? <Sun className="w-4 h-4 mr-3" /> : <Moon className="w-4 h-4 mr-3" />}
          <span className="text-sm">Toggle Theme</span>
        </Button>
      </div>
    </aside>
  );
}
