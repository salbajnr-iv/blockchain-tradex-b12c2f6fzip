import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useUnreadAdminMessages } from '@/hooks/useUnreadAdminMessages';
import { Button } from '@/components/ui/button';

export default function AdminMessageBadge() {
  const { unreadCount } = useUnreadAdminMessages();

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative text-muted-foreground hover:text-foreground"
      title={unreadCount > 0 ? `${unreadCount} new message${unreadCount === 1 ? '' : 's'} from BlockTrade` : 'Messages from BlockTrade'}
    >
      <Link to="/messages" aria-label="BlockTrade messages">
        <Mail className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none flex items-center justify-center ring-2 ring-card"
            aria-label={`${unreadCount} unread`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Link>
    </Button>
  );
}
