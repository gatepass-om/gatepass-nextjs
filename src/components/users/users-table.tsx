
"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import type { User, Site, UserStatus, Contractor, Operator, JobPosition } from "@/lib/types";
import type { UpdateUserInput } from '@/lib/api';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Paperclip,
  ShieldCheck,
  AlertTriangle,
  Contact,
  Building,
  Trash2,
  MoreHorizontal,
  Pencil,
  Briefcase,
  CreditCard,
  User as UserIcon,
  UserCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Image from "next/image";
import { Badge } from "../ui/badge";
import { EditUserForm } from "./edit-user-form";
import { canEditUserRecord, canImpersonateUser, canIssuePersonnelCard } from "./user-actions";
import { WorkerDocuments } from "@/components/workers/worker-documents";
import { WorkerTimeline } from "@/components/workers/worker-timeline";
import { WorkerCards } from "@/components/workers/worker-cards";
import { WorkerPositionCompliancePanel } from '@/components/compliance/worker-position-compliance';
import { resolveUserCompanyName } from './user-company';

interface UsersTableProps {
  users: User[];
  sites: Site[];
  contractors: Contractor[];
  operators: Operator[];
  jobPositions: JobPosition[];
  isLoading: boolean;
  onDeleteUser: (userId: string, userName: string) => void;
  onUpdateUser: (
    userId: string,
    originalUser: User,
    updatedData: UpdateUserInput
  ) => Promise<boolean>;
  currentUser: User;
  canMutateUsers: boolean;
  onImpersonateUser: (user: User) => void;
}

export function UsersTable({
  users,
  sites,
  contractors,
  operators,
  jobPositions,
  isLoading,
  onDeleteUser,
  onUpdateUser,
  currentUser,
  canMutateUsers,
  onImpersonateUser,
}: UsersTableProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [complianceUser, setComplianceUser] = useState<User | null>(null);
  const [cardUser, setCardUser] = useState<User | null>(null);

  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };

  const getSiteName = (siteId?: string) => {
    if (!siteId) return "N/A";
    return sites.find((s) => s.id === siteId)?.name || "Unknown Site";
  };
  
  const statusColors: Record<UserStatus, string> = {
    Active: "bg-green-100 text-green-800",
    Inactive: "bg-yellow-100 text-yellow-800",
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  const canEditUser = (user: User) => {
    return canEditUserRecord(canMutateUsers, user.role);
  };

  const canReviewCompliance = (user: User) => {
    return user.role === 'Worker'
      && ['Admin', 'Operator Admin', 'Manager'].includes(currentUser.role);
  };

  const canManageWorkerCard = (user: User) => {
    return user.status === 'Active' && canIssuePersonnelCard(currentUser.role);
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="border-b py-4">
          <CardTitle>Personnel register</CardTitle>
          <CardDescription>Searchable personnel records with identity, affiliation, role, and status.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <Table className="min-w-[1180px] border-collapse text-sm">
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead className="border-r">Name</TableHead>
                    <TableHead className="border-r">National ID</TableHead>
                    <TableHead className="border-r">Email</TableHead>
                    <TableHead className="border-r">Company</TableHead>
                    <TableHead className="border-r">Nationality</TableHead>
                    <TableHead className="border-r">Job position</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? [...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                          {[0, 1, 2, 3, 4, 5, 6, 7].map((cell) => <TableCell key={cell} className="border-r py-2"><Skeleton className="h-5 w-24" /></TableCell>)}
                          <TableCell className="text-right">
                            <Skeleton className="h-9 w-9 ml-auto" />
                          </TableCell>
                        </TableRow>
                      ))
                    : users.map((user) => (
                        <TableRow key={user.id} className="hover:bg-muted/30">
                          <TableCell className="border-r py-2 font-medium whitespace-nowrap">
                            {canEditUser(user) ? <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => handleEditClick(user)}>{user.name}</button> : user.name}
                          </TableCell>
                          <TableCell className="border-r py-2 font-mono text-xs">{user.idNumber || '—'}</TableCell>
                          <TableCell className="border-r py-2">{user.email}</TableCell>
                          <TableCell className="border-r py-2">{resolveUserCompanyName(user, contractors, operators)}</TableCell>
                          <TableCell className="border-r py-2">{user.nationality || '—'}</TableCell>
                          <TableCell className="border-r py-2">{user.employment?.jobPositionName || '—'}</TableCell>
                          <TableCell className="py-2">
                            <Badge variant="secondary">{user.role}</Badge>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge
                              className={
                                statusColors[user.status || "Inactive"]
                              }
                            >
                              {user.status || "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">More actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canEditUser(user) && (
                                  <DropdownMenuItem
                                    onSelect={() => handleEditClick(user)}
                                  >
                                    <Pencil className="mr-2 h-4 w-4" /> Edit
                                  </DropdownMenuItem>
                                )}
                                {canImpersonateUser(currentUser.role, currentUser.id, user.id) && (
                                  <DropdownMenuItem
                                    onSelect={() => onImpersonateUser(user)}
                                    disabled={user.status === "Inactive"}
                                  >
                                    <UserCheck className="mr-2 h-4 w-4" /> Impersonate
                                  </DropdownMenuItem>
                                )}
                                {canManageWorkerCard(user) && (
                                  <DropdownMenuItem onSelect={() => setCardUser(user)}>
                                    <CreditCard className="mr-2 h-4 w-4" /> Issue QR card
                                  </DropdownMenuItem>
                                )}
                                {!canEditUser(user) && canReviewCompliance(user) && (
                                  <DropdownMenuItem onSelect={() => setComplianceUser(user)}>
                                    <ShieldCheck className="mr-2 h-4 w-4" /> Review compliance
                                  </DropdownMenuItem>
                                )}
                                {canEditUser(user) && user.id !== currentUser.id && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem
                                        onSelect={(e) => e.preventDefault()}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>
                                          Delete
                                        </span>
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          Are you absolutely sure?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This action cannot be undone. This will
                                          permanently delete the user account for{" "}
                                          {user.name} and remove all associated
                                          data.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>
                                          Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() =>
                                            onDeleteUser(user.id, user.name)
                                          }
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
                      ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-full sm:max-w-3xl w-[95vw] sm:w-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>
              Update the details for {selectedUser?.name}.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <EditUserForm
              user={selectedUser}
              currentUser={currentUser}
              onUpdateUser={onUpdateUser}
              sites={sites}
              contractors={contractors}
              operators={operators}
              jobPositions={jobPositions}
              isLoading={isLoading}
              closeDialog={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={complianceUser !== null} onOpenChange={(open) => !open && setComplianceUser(null)}>
        <DialogContent className="max-w-full sm:max-w-3xl w-[95vw] sm:w-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Worker Compliance Review</DialogTitle>
            <DialogDescription>
              Review credentials and evidence for {complianceUser?.name} without editing their profile.
            </DialogDescription>
          </DialogHeader>
          {complianceUser && (
            <div className="space-y-4">
              <WorkerPositionCompliancePanel workerId={complianceUser.id} />
              <WorkerDocuments workerId={complianceUser.id} canManage={false} />
              <WorkerTimeline workerId={complianceUser.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={cardUser !== null} onOpenChange={(open) => !open && setCardUser(null)}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Issue QR card</DialogTitle>
            <DialogDescription>
              Select a verified photo and manage the card for {cardUser?.name}.
            </DialogDescription>
          </DialogHeader>
          {cardUser ? <WorkerCards workerId={cardUser.id} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
