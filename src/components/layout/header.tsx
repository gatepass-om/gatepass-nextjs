
'use client';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Search, Bell, LifeBuoy, LogOut, Settings, User as UserIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/providers/session-provider';

export function Header() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, logout } = useSession();

  const handleLogout = () => {
    logout();
    toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    router.push('/login');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
      <SidebarTrigger className="md:hidden" />
      <div className="flex w-full items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-full rounded-lg bg-secondary pl-8 md:w-[200px] lg:w-[320px]"
          />
        </div>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Toggle notifications</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
               <div className="h-8 w-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold">
                  {user ? getInitials(user.name) : <UserIcon />}
               </div>
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name || 'Loading...'}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email || ''}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile"><UserIcon className="mr-2 h-4 w-4" /><span>Profile</span></Link>
            </DropdownMenuItem>
            <DropdownMenuItem><Settings className="mr-2 h-4 w-4" /><span>Settings</span></DropdownMenuItem>
            <DropdownMenuItem><LifeBuoy className="mr-2 h-4 w-4" /><span>Support</span></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" /><span>Log out</span></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
