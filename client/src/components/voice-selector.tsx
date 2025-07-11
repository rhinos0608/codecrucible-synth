import { Brain, Code, User, Star, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CODE_PERSPECTIVES, DEVELOPMENT_ROLES } from "@/types/voices";
import { useVoiceSelection } from "@/contexts/voice-selection-context";
import { useVoiceProfiles } from "@/hooks/use-voice-profiles";
import * as LucideIcons from "lucide-react";
import type { VoiceProfile } from "@shared/schema";

export function PerspectiveSelector() {
  const { 
    state, 
    togglePerspective, 
    toggleRole,
    applyVoiceProfile 
  } = useVoiceSelection();
  
  const { profiles, isLoading } = useVoiceProfiles();

  const renderIcon = (iconName: string, className: string) => {
    const IconComponent = (LucideIcons as any)[iconName.charAt(0).toUpperCase() + iconName.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase())];
    return IconComponent ? <IconComponent className={className} /> : null;
  };

  const handleApplyProfile = (profile: VoiceProfile) => {
    if (applyVoiceProfile) {
      applyVoiceProfile(profile);
    }
  };

  const renderUserProfileCard = (profile: VoiceProfile) => (
    <Card
      key={profile.id}
      className="p-3 cursor-pointer transition-all group border border-gray-600 bg-gray-700/50 hover:border-purple-500/40 hover:bg-purple-500/10"
      onClick={() => handleApplyProfile(profile)}
    >
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/20">
          <span className="text-sm">{profile.avatar || "🤖"}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm text-purple-300 flex items-center gap-2">
              {profile.name}
              {profile.isDefault && (
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              )}
            </h4>
            <Play className="w-3 h-3 text-gray-400 group-hover:text-purple-400" />
          </div>
          <div className="flex gap-1 mt-1 mb-1">
            {profile.selectedPerspectives?.slice(0, 2).map((perspectiveId: any) => {
              const perspective = CODE_PERSPECTIVES.find(p => p.id === perspectiveId);
              return perspective ? (
                <Badge key={perspectiveId} variant="outline" className="text-xs px-1 py-0">
                  {perspective.name}
                </Badge>
              ) : null;
            })}
            {profile.selectedRoles?.slice(0, 2).map((roleId: any) => {
              const role = DEVELOPMENT_ROLES.find(r => r.id === roleId);
              return role ? (
                <Badge key={roleId} variant="outline" className="text-xs px-1 py-0">
                  {role.name}
                </Badge>
              ) : null;
            })}
          </div>
          <p className="text-xs text-gray-400 truncate">{profile.description || profile.specialization}</p>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="p-4">
      <Tabs defaultValue="perspectives" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="perspectives" className="text-xs">
            <Brain className="w-3 h-3 mr-1" />
            Analysis
          </TabsTrigger>
          <TabsTrigger value="roles" className="text-xs">
            <Code className="w-3 h-3 mr-1" />
            Specialization
          </TabsTrigger>
          <TabsTrigger value="profiles" className="text-xs">
            <User className="w-3 h-3 mr-1" />
            My Profiles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perspectives" className="space-y-6 mt-0">
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center uppercase tracking-wider">
              <Brain className="w-4 h-4 mr-2 text-blue-400" />
              Code Analysis Engines
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
        </TabsContent>

        <TabsContent value="roles" className="space-y-6 mt-0">
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center uppercase tracking-wider">
              <Code className="w-4 h-4 mr-2 text-green-400" />
              Code Specialization Engines
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
        </TabsContent>

        <TabsContent value="profiles" className="space-y-6 mt-0">
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center uppercase tracking-wider">
              <User className="w-4 h-4 mr-2 text-purple-400" />
              My Voice Profiles
            </h3>
            <div className="space-y-2">
              {isLoading ? (
                <div className="text-center py-4">
                  <div className="text-sm text-gray-400">Loading profiles...</div>
                </div>
              ) : profiles.length === 0 ? (
                <div className="text-center py-6">
                  <User className="w-8 h-8 mx-auto text-gray-500 mb-2" />
                  <div className="text-sm text-gray-400 mb-2">No profiles yet</div>
                  <div className="text-xs text-gray-500">Create custom profiles in Settings</div>
                </div>
              ) : (
                profiles.map(renderUserProfileCard)
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}