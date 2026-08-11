
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
import type { Operator, User, Site } from '@/lib/types';
import { Loader2, Building2, User as UserIcon, MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-react';
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

interface OperatorsTableProps {
  operators: Operator[];
  users: User[];
  sites: Site[];
  isLoading?: boolean;
  onRenameOperator?: (operatorId: string, name: string) => void;
  onDeleteOperator?: (operatorId: string, name: string) => void;
  canManage?: boolean;
}

export function OperatorsTable({ operators, users, sites, isLoading = false, onRenameOperator, onDeleteOperator, canManage = true }: OperatorsTableProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [editedName, setEditedName] = useState('');
  
  const getOperatorPersonnel = (operatorId: string) => {
    return users.filter(u => (u.role === 'Admin' || u.role === 'Manager' || u.role === 'Operator Admin') && u.operatorId === operatorId);
  }

  const getSiteCount = (operatorId: string) => {
    return sites.filter(s => s.operatorId === operatorId).length;
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Operators</CardTitle>
        <CardDescription>A list of all operator companies in the system.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operator Name</TableHead>
                <TableHead>Personnel</TableHead>
                <TableHead>Sites</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
              ) : operators.length > 0 ? (
                operators.map((operator) => {
                  const personnel = getOperatorPersonnel(operator.id);
                  return (
                    <TableRow key={operator.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        <Link href={`/companies/operators/${operator.id}`} className="hover:underline">
                          {operator.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                           <UserIcon className="h-4 w-4 text-muted-foreground" />
                           <span className="font-semibold">{personnel.length}</span>
                        </div>
                      </TableCell>
                       <TableCell>
                        <div className="flex items-center gap-2">
                           <Building2 className="h-4 w-4 text-muted-foreground" />
                           <span className="font-semibold">{getSiteCount(operator.id)}</span>
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
                                <Link href={`/companies/operators/${operator.id}`}>
                                  <Eye className="mr-2 h-4 w-4" /> View details
                                </Link>
                              </DropdownMenuItem>
	                            {canManage && (
                              <DropdownMenuItem
	                              onSelect={() => {
                                setEditingOperator(operator);
                                setEditedName(operator.name);
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
                                  <AlertDialogTitle>Delete operator?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will remove {operator.name} if it has no linked sites, users, or requests.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => onDeleteOperator?.(operator.id, operator.name)}
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
                  );
                })
              ) : (
                <TableRow><TableCell colSpan={4} className="h-24 text-center">No operators found.</TableCell></TableRow>
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
            setEditingOperator(null);
            setEditedName('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Operator</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editedName}
              onChange={(event) => setEditedName(event.target.value)}
              placeholder="Operator name"
            />
            <Button
              onClick={() => {
                if (!editingOperator) return;
                onRenameOperator?.(editingOperator.id, editedName.trim());
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
