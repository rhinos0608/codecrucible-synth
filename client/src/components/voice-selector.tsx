import { Brain, Code } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CODE_PERSPECTIVES, DEVELOPMENT_ROLES } from "@/types/voices";
import { useVoiceSelection } from "@/contexts/voice-selection-context";
import * as LucideIcons from "lucide-react";

export function PerspectiveSelector() {
  const { 
    state, 
    togglePerspective, 
    toggleRole 
  } = useVoiceSelection();

  const renderIcon = (iconName: string, className: string) => {
    const IconComponent = (LucideIcons as any)[iconName.charAt(0).toUpperCase() + iconName.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase())];
    return IconComponent ? <IconComponent className={className} /> : null;
  };

  return (
    <div className="p-4 space-y-6">
      {/* Code Perspectives */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center uppercase tracking-wider">
          <Brain className="w-4 h-4 mr-2 text-blue-400" />
          Transisthesis Archetypes
        </h3>
        <div className="space-y-2">
          {CODE_PERSPECTIVES.map((perspective) => {
            const isSelected = state.selectedPerspectives.includes(perspective.id);
            
            const handlePerspectiveClick = () => {
              console.log("Perspective Toggle Debug:", {
                id: perspective.id,
                currentlySelected: isSelected,
                currentPerspectives: state.selectedPerspectives,
                willBecome: isSelected ? "deselected" : "selected"
              });
              togglePerspective(perspective.id);
            };
            
            return (
              <Card
                key={perspective.id}
                className={`p-3 cursor-pointer transition-all group border ${
                  isSelected 
                    ? `border-blue-500/40 bg-blue-500/10` 
                    : `border-gray-600 bg-gray-700/50 hover:border-gray-500`
                }`}
                onClick={handlePerspectiveClick}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isSelected ? 'bg-blue-500/20' : 'bg-gray-600/50'
                  }`}>
                    {renderIcon(perspective.icon, `w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-gray-400'}`)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className={`font-medium text-sm ${isSelected ? 'text-blue-300' : 'text-gray-200'}`}>
                        {perspective.name}
                      </h4>
                      <div className={`w-3 h-3 border rounded-sm transition-colors ${
                        isSelected ? 'border-blue-400 bg-blue-400' : 'border-gray-500'
                      }`} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{perspective.function}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Development Roles */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center uppercase tracking-wider">
          <Code className="w-4 h-4 mr-2 text-green-400" />
          Enhanced Coding Voices
        </h3>
        <div className="space-y-2">
          {DEVELOPMENT_ROLES.map((role) => {
            const isSelected = state.selectedRoles.includes(role.id);
            
            const handleRoleClick = () => {
              console.log("Role Toggle Debug:", {
                id: role.id,
                currentlySelected: isSelected,
                currentRoles: state.selectedRoles,
                willBecome: isSelected ? "deselected" : "selected"
              });
              toggleRole(role.id);
            };
            
            return (
              <Card
                key={role.id}
                className={`p-3 cursor-pointer transition-all group border ${
                  isSelected
                    ? `border-green-500/40 bg-green-500/10`
                    : `border-gray-600 bg-gray-700/50 hover:border-gray-500`
                }`}
                onClick={handleRoleClick}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isSelected ? 'bg-green-500/20' : 'bg-gray-600/50'
                  }`}>
                    {renderIcon(role.icon, `w-4 h-4 ${isSelected ? 'text-green-400' : 'text-gray-400'}`)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h5 className={`font-medium text-sm ${isSelected ? 'text-green-300' : 'text-gray-200'}`}>
                        {role.name}
                      </h5>
                      <div className={`w-3 h-3 border rounded-sm transition-colors ${
                        isSelected ? 'border-green-400 bg-green-400' : 'border-gray-500'
                      }`} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{role.domain}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
