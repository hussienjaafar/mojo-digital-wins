/**
 * Feedback Buttons Component
 * 
 * Provides thumbs up/down and mute controls for opportunities and actions.
 * Records feedback events for the learning algorithm.
 */

import { useState } from "react";
import { ThumbsUp, ThumbsDown, VolumeX, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import {
  useRecordRelevantFeedback,
  useRecordIrrelevantFeedback,
  useMuteTopic,
  useMuteEntity,
  type FeedbackObjectType,
} from "@/queries/useOrgFeedbackMutation";
import { toast } from "sonner";

interface FeedbackButtonsProps {
  objectType: FeedbackObjectType;
  objectId: string;
  entityName?: string;
  topicTags?: string[];
  relevanceScore?: number;
  className?: string;
  size?: "sm" | "default";
  showLabels?: boolean;
}

export function FeedbackButtons({
  objectType,
  objectId,
  entityName,
  topicTags = [],
  relevanceScore,
  className,
  size = "sm",
  showLabels = false,
}: FeedbackButtonsProps) {
  const { organizationId } = useClientOrganization();
  const [feedbackGiven, setFeedbackGiven] = useState<'relevant' | 'irrelevant' | null>(null);

  const relevantMutation = useRecordRelevantFeedback(organizationId);
  const irrelevantMutation = useRecordIrrelevantFeedback(organizationId);
  const muteTopicMutation = useMuteTopic(organizationId);
  const muteEntityMutation = useMuteEntity(organizationId);

  const handleRelevant = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (feedbackGiven) return;

    try {
      await relevantMutation.mutateAsync({
        objectType,
        objectId,
        entityName,
        topicTags,
        relevanceScore,
      });
      setFeedbackGiven('relevant');
      toast.success("Thanks! We'll show you more like this.");
    } catch (err) {
      toast.error("Failed to record feedback");
    }
  };

  const handleIrrelevant = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (feedbackGiven) return;

    try {
      await irrelevantMutation.mutateAsync({
        objectType,
        objectId,
        entityName,
        topicTags,
        relevanceScore,
      });
      setFeedbackGiven('irrelevant');
      toast.success("Thanks! We'll show fewer like this.");
    } catch (err) {
      toast.error("Failed to record feedback");
    }
  };

  const handleMuteTopic = async (topic: string) => {
    try {
      await muteTopicMutation.mutateAsync({
        objectType,
        objectId,
        topic,
      });
      toast.success(`"${topic}" has been muted`);
    } catch (err) {
      toast.error("Failed to mute topic");
    }
  };

  const handleMuteEntity = async () => {
    if (!entityName) return;
    
    try {
      await muteEntityMutation.mutateAsync({
        objectType,
        objectId,
        entityName,
      });
      toast.success(`"${entityName}" has been muted`);
    } catch (err) {
      toast.error("Failed to mute entity");
    }
  };

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const buttonSize = size === "sm" ? "h-7 px-2" : "h-8 px-3";

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1", className)}>
        {/* Thumbs Up */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRelevant}
              disabled={feedbackGiven !== null || relevantMutation.isPending}
              className={cn(
                buttonSize,
                "gap-1",
                feedbackGiven === 'relevant'
                  ? "text-[hsl(var(--portal-success))] bg-[hsl(var(--portal-success)/0.1)]"
                  : "text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-success))] hover:bg-[hsl(var(--portal-success)/0.1)]"
              )}
            >
              <ThumbsUp className={iconSize} />
              {showLabels && <span className="hidden sm:inline">Relevant</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>This is relevant to me</p>
          </TooltipContent>
        </Tooltip>

        {/* Thumbs Down */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleIrrelevant}
              disabled={feedbackGiven !== null || irrelevantMutation.isPending}
              className={cn(
                buttonSize,
                "gap-1",
                feedbackGiven === 'irrelevant'
                  ? "text-[hsl(var(--portal-error))] bg-[hsl(var(--portal-error)/0.1)]"
                  : "text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.1)]"
              )}
            >
              <ThumbsDown className={iconSize} />
              {showLabels && <span className="hidden sm:inline">Not relevant</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Not relevant to me</p>
          </TooltipContent>
        </Tooltip>

        {/* More Options Dropdown */}
        {(topicTags.length > 0 || entityName) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  buttonSize,
                  "text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-secondary))]"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className={iconSize} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {entityName && (
                <DropdownMenuItem onClick={handleMuteEntity}>
                  <VolumeX className="h-4 w-4 mr-2" />
                  Mute "{entityName}"
                </DropdownMenuItem>
              )}
              {entityName && topicTags.length > 0 && <DropdownMenuSeparator />}
              {topicTags.slice(0, 3).map((topic) => (
                <DropdownMenuItem key={topic} onClick={() => handleMuteTopic(topic)}>
                  <VolumeX className="h-4 w-4 mr-2" />
                  Mute topic: "{topic}"
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </TooltipProvider>
  );
}
