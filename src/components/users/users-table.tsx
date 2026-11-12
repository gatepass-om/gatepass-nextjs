
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
import type { User, Site, Contractor, Operator, JobPosition } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trash2,
  MoreHorizontal,
  Pencil,
  UserCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
import { Badge } from "../ui/badge";
import { canEditUserRecord, canImpersonateUser } from "./user-actions";
import { resolveUserCompanyName } from './user-company';

interface UsersTableProps {
  users: User[];
  sites?: Site[];
  contractors: Contractor[];
  operators: Operator[];
  jobPositions: JobPosition[];
  isLoading: boolean;
  onDeleteUser: (userId: string, userName: string) => void;
  currentUser: User;
  canMutateUsers: boolean;
  onImpersonateUser: (user: User) => void;
  onResendActivation: (user: User) => void;
}

export function UsersTable({
  users,
  contractors,
  operators,
  isLoading,
  onDeleteUser,
  currentUser,
  canMutateUsers,
  onImpersonateUser,
  onResendActivation,
}: UsersTableProps) {
  const router = useRouter();
  const openProfile = (user: User) => router.push(`/users/${user.id}`);
  const canEditUser = (user: User) => canEditUserRecord(canMutateUsers, user.role);

  const actions = (user: User) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">More actions for {user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEditUser(user) && (
          <DropdownMenuItem onSelect={() => openProfile(user)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </DropdownMenuItem>
        )}
        {canImpersonateUser(currentUser.role, currentUser.id, user.id) && (
          <DropdownMenuItem onSelect={() => onImpersonateUser(user)} disabled={user.status === "Inactive"}>
            <UserCheck className="mr-2 h-4 w-4" /> Impersonate
          </DropdownMenuItem>
        )}
        {canEditUser(user) && user.id !== currentUser.id && user.email && user.interactiveAccountEnabled !== false && user.status === 'Inactive' && (
          <DropdownMenuItem onSelect={() => onResendActivation(user)}>Resend activation link</DropdownMenuItem>
        )}
        {canEditUser(user) && user.id !== currentUser.id && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the user account for {user.name} and remove all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDeleteUser(user.id, user.name)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const company = (user: User) => resolveUserCompanyName(user, contractors, operators);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b px-4 py-3 sm:px-6 sm:py-4">
        <CardTitle>Personnel register</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : users.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">No personnel match.</p>
        ) : (
          <>
            {/* Laptop: one compact table. National ID and nationality live on the profile (and stay searchable). */}
            <div className="hidden md:block">
              <Table className="border-collapse text-sm">
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Job position</TableHead>
                    <TableHead aria-label="Row actions" className="w-14" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openProfile(user)}>
                      <TableCell className="py-2.5">
                        <button type="button" className="block text-left font-medium underline-offset-4 hover:underline" onClick={(event) => { event.stopPropagation(); openProfile(user); }}>{user.name}</button>
                        <span className="block text-xs text-muted-foreground">{user.email}</span>
                      </TableCell>
                      <TableCell className="py-2.5">{company(user)}</TableCell>
                      <TableCell className="py-2.5"><Badge variant="secondary">{user.role}</Badge></TableCell>
                      <TableCell className="py-2.5">{user.employment?.jobPositionName || '—'}</TableCell>
                      <TableCell className="py-2.5 text-right" onClick={(event) => event.stopPropagation()}>{actions(user)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Phone: one card per person — name, role, then a single line of context. */}
            <ul className="divide-y md:hidden">
              {users.map((user) => (
                <li key={user.id} className="flex items-start gap-2 px-4 py-3">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openProfile(user)}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{user.name}</span>
                      <Badge variant="secondary">{user.role}</Badge>
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">{user.email}</span>
                    <span className="block truncate text-sm text-muted-foreground">{[company(user), user.employment?.jobPositionName].filter(Boolean).join(' · ')}</span>
                  </button>
                  {actions(user)}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
