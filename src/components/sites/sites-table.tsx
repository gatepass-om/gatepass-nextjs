
'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Site, User, CertificateType, Operator, UserRole } from '@/lib/types';
import { Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { EditSiteForm } from './edit-site-form';

interface SitesTableProps {
  sites: Site[];
  users: User[];
  certificateTypes: CertificateType[];
  operators: Operator[];
  isLoading?: boolean;
  isLoadingOperators: boolean;
  currentUserRole: UserRole;
  onUpdateSite: (siteId: string, updatedData: Partial<Omit<Site, 'id'>>) => Promise<boolean>;
  onDeleteSite: (siteId: string, siteName: string) => void;
}

export function SitesTable({
  sites,
  users,
  certificateTypes,
  operators,
  isLoading = false,
  isLoadingOperators,
  currentUserRole,
  onUpdateSite,
  onDeleteSite,
}: SitesTableProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  const getManagerName = (userId: string) => {
    return users.find(u => u.id === userId)?.name || 'Unknown User';
  }

  const getManagerAvatar = (userId: string) => {
    return users.find(u => u.id === userId)?.avatarUrl || '';
  }

  const handleEditClick = (site: Site) => {
    setSelectedSite(site);
    setIsEditDialogOpen(true);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>All Sites</CardTitle>
          <CardDescription>A list of all registered sites in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site Name</TableHead>
                  <TableHead>Managers</TableHead>
                  <TableHead>Required Certificates</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                        </TableCell>
                    </TableRow>
                ) : sites.length > 0 ? (
                  sites.map((site) => (
                    <TableRow key={site.id}>
                      <TableCell className="font-medium whitespace-nowrap">{site.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center -space-x-2">
                          {site.managerIds.map(id => (
                             <TooltipProvider key={id} delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Avatar className="h-8 w-8 border-2 border-background">
                                    <AvatarImage src={getManagerAvatar(id)} />
                                    <AvatarFallback>{getManagerName(id).charAt(0)}</AvatarFallback>
                                  </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{getManagerName(id)}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(site.requiredCertificates || []).map((cert, index) => (
                            <Badge key={index} variant="secondary">{cert}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                      <span className="sr-only">More actions</span>
                                  </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                  <DropdownMenuItem onSelect={() => handleEditClick(site)}>
                                      <Pencil className="mr-2 h-4 w-4" /> Edit
                                  </DropdownMenuItem>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem
                                        onSelect={(event) => event.preventDefault()}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete site?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will remove {site.name} if it has no linked activity, requests, or assigned users.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDeleteSite(site.id, site.name)}>
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                              </DropdownMenuContent>
                          </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                          No sites found. Create one to get started.
                      </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setSelectedSite(null);
          }
        }}
      >
          <DialogContent className="sm:max-w-4xl">
              <DialogHeader>
                  <DialogTitle>Edit Site</DialogTitle>
                  <DialogDescription>Update the details for {selectedSite?.name}.</DialogDescription>
              </DialogHeader>
              {selectedSite && (
                  <EditSiteForm
                      site={selectedSite}
                      users={users}
                      certificateTypes={certificateTypes}
                      operators={operators}
                      isLoadingUsers={isLoading}
                      isLoadingCerts={isLoading}
                      isLoadingOperators={isLoadingOperators}
                      currentUserRole={currentUserRole}
                      onUpdateSite={onUpdateSite}
                      closeDialog={() => setIsEditDialogOpen(false)}
                  />
              )}
          </DialogContent>
      </Dialog>
    </>
  );
}
