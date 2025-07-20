// Simple Voice Selector to replace the problematic StableVoiceSelector
// Minimal implementation to prevent infinite loops

import { Brain, Code } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CODE_PERSPECTIVES, DEVELOPMENT_ROLES } from "@/types/voices";

export function SimpleVoiceSelector() {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          Voice Selection (Temporary Fix)
        </h3>
        
        <div className="text-sm text-muted-foreground">
          Voice selector temporarily disabled to resolve infinite loop issue.
          Working on fix...
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">Perspectives</h4>
            <div className="space-y-1">
              {CODE_PERSPECTIVES.map((perspective) => (
                <Badge key={perspective.id} variant="outline" className="mr-2">
                  {perspective.name}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Roles</h4>
            <div className="space-y-1">
              {DEVELOPMENT_ROLES.map((role) => (
                <Badge key={role.id} variant="outline" className="mr-2">
                  {role.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <Button className="w-full" disabled>
          <Code className="h-4 w-4 mr-2" />
          Generate Solutions (Fixing...)
        </Button>
      </div>
    </Card>
  );
}