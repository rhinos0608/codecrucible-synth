import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Star } from "lucide-react";
import type { VoiceProfile } from "@shared/schema";

interface VoiceProfileCardProps {
  profile: VoiceProfile;
  onEdit: (profile: VoiceProfile) => void;
  onDelete: (id: number) => void;
  onSetDefault: (id: number) => void;
}

export function VoiceProfileCard({ profile, onEdit, onDelete, onSetDefault }: VoiceProfileCardProps) {
  return (
    <Card className="bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{profile.avatar || "🤖"}</div>
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {profile.name}
                {profile.isDefault && (
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                )}
              </CardTitle>
              <p className="text-xs text-gray-400">{profile.specialization}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(profile)}
              className="h-8 w-8 p-0 hover:bg-gray-600/50"
            >
              <Edit className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(profile.id)}
              className="h-8 w-8 p-0 hover:bg-red-500/20"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">
              {profile.perspective}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {profile.role}
            </Badge>
          </div>
          <p className="text-xs text-gray-300 line-clamp-2">
            {profile.personality}
          </p>
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>{profile.chatStyle} style</span>
            {!profile.isDefault && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSetDefault(profile.id)}
                className="h-6 px-2 text-xs hover:bg-yellow-500/20"
              >
                Set Default
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}