
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UserAvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null; // Added email prop
  className?: string;
  fallbackClassName?: string;
}

function getInitials(firstName?: string | null, lastName?: string | null, fullName?: string | null): string {
  const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : "";
  const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : "";
  
  if (firstInitial && lastInitial) {
    return `${firstInitial}${lastInitial}`;
  }
  if (firstInitial) {
    return firstInitial;
  }
  if (fullName) {
    const names = fullName.split(' ');
    const first = names[0] ? names[0].charAt(0).toUpperCase() : "";
    const last = names.length > 1 && names[names.length - 1] ? names[names.length - 1].charAt(0).toUpperCase() : "";
    if (first && last) return `${first}${last}`;
    if (first) return first;
  }
  return "??";
}

export function UserAvatar({ firstName, lastName, fullName, email, className, fallbackClassName }: UserAvatarProps) {
  const initials = getInitials(firstName, lastName, fullName);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar className={cn("h-8 w-8", className)}>
            {/* AvatarImage can be used if you ever decide to add image URLs */}
            {/* <AvatarImage src={user.imageUrl} alt={`${firstName} ${lastName}`} /> */}
            <AvatarFallback className={cn("bg-primary text-primary-foreground font-semibold", fallbackClassName)}>
              {initials}
            </AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        {(fullName || email) && (
          <TooltipContent>
            {fullName && <p className="font-medium">{fullName}</p>}
            {email && <p className="text-xs text-muted-foreground">{email}</p>}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
