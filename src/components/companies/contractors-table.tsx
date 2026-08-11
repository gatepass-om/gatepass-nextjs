
'use client';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import type { Contractor, User, AccessRequest } from '@/lib/types';
import { Loader2, ClipboardList, User as UserIcon, MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { useState } from 'react';

interface ContractorsTableProps {
  contractors: Contractor[];
  users: User[];
  accessRequests: AccessRequest[];
  isLoading?: boolean;
  onRenameContractor?: (contractorId: string, name: string) => void;
  onDeleteContractor?: (contractorId: string, name: string) => void;
  canManage?: boolean;
}

export function ContractorsTable({ contractors, users, accessRequests, isLoading = false, onRenameContractor, onDeleteContractor, canManage = true }: ContractorsTableProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [editedName, setEditedName] = useState('');
  
  const getContractorPersonnelCount = (contractorId: string) => {
    return users.filter(u => u.contractorId === contractorId && (u.role === 'Worker' || u.role === 'Supervisor')).length;
  }

  const getActiveRequestCount = (contractorId: string) => {
    return accessRequests.filter(req => req.contractorId === contractorId && (req.status === 'Pending' || req.status === 'Approved')).length;
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Contractors</CardTitle>
        <CardDescription>A list of all contractor companies in the system.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contractor Name</TableHead>
                <TableHead>Personnel</TableHead>
                <TableHead>Active Requests</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
              ) : contractors.length > 0 ? (
		                contractors.map((contractor) => (
	                  <TableRow key={contractor.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      <Link href={`/companies/contractors/${contractor.id}`} className="hover:underline">
                        {contractor.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{getContractorPersonnelCount(contractor.id)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{getActiveRequestCount(contractor.id)}</span>
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
                            <DropdownMenuItem asChild>
                              <Link href={`/companies/contractors/${contractor.id}`}>
                                <Eye className="mr-2 h-4 w-4" /> View details
                              </Link>
                            </DropdownMenuItem>
	                          {canManage && (
                            <DropdownMenuItem
                            onSelect={() => {
                              setEditingContractor(contractor);
                              setEditedName(contractor.name);
                              setIsEditOpen(true);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Rename
                          </DropdownMenuItem>
                          )}
                          {canManage && (
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
                                <AlertDialogTitle>Delete contractor?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove {contractor.name} if it has no linked users or requests.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDeleteContractor?.(contractor.id, contractor.name)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
	                  </TableRow>
                  ))
              ) : (
                <TableRow><TableCell colSpan={4} className="h-24 text-center">No contractors found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setEditingContractor(null);
            setEditedName('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Contractor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editedName}
              onChange={(event) => setEditedName(event.target.value)}
              placeholder="Contractor name"
            />
            <Button
              onClick={() => {
                if (!editingContractor) return;
                onRenameContractor?.(editingContractor.id, editedName.trim());
                setIsEditOpen(false);
              }}
              disabled={!editedName.trim()}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
