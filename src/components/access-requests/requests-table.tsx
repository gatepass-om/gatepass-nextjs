
'use client'

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
import type { AccessRequest } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, Users, CalendarDays, Infinity, Trash2, ShieldCheck, Clock3, ShieldX } from 'lucide-react';
import { useState } from 'react';
import { RequestDetailsDialog } from './request-details-dialog';
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
} from '@/components/ui/alert-dialog';


interface RequestsTableProps {
  requests: AccessRequest[];
  title: string;
  description: string;
  showActions?: boolean;
  onApprove?: (request: AccessRequest) => void;
  onDeny?: (requestId: string) => void;
  onDelete?: (request: AccessRequest) => void | Promise<void>;
  isLoading?: boolean;
}

const statusVariant: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline'} = {
  Approved: 'default',
  Pending: 'secondary',
  Denied: 'destructive',
  Expired: 'outline',
}

const statusColorClasses = {
  Approved: 'bg-green-500/20 text-green-700 border-transparent hover:bg-green-500/30',
  Pending: 'bg-yellow-500/20 text-yellow-700 border-transparent hover:bg-yellow-500/30',
  Denied: 'bg-red-500/20 text-red-700 border-transparent hover:bg-red-500/30',
  Expired: 'bg-slate-500/15 text-slate-700 border-transparent hover:bg-slate-500/20',
}

const statusIcons = {
  Approved: ShieldCheck,
  Pending: Clock3,
  Denied: ShieldX,
  Expired: Clock3,
};

export function RequestsTable({
  requests,
  title,
  description,
  showActions = false,
  onApprove,
  onDeny,
  onDelete,
  isLoading = false,
}: RequestsTableProps) {
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);

  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return 'N/A';
    try {
      return format(parseISO(timestamp), 'dd MMM yyyy, HH:mm');
    } catch {
      return 'Invalid Date';
    }
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), 'dd MMM yyyy');
    } catch {
      return 'Invalid Date';
    }
  }

  const showActionColumn = showActions || Boolean(onDelete);
  const colSpan = showActionColumn ? 7 : 6;

  const handleRowClick = (request: AccessRequest) => {
    setSelectedRequest(request);
  };

  const getRequestedAtTime = (value: string | undefined) => {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request Details</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Requested At</TableHead>
                <TableHead>Access Dates</TableHead>
                <TableHead>On-Site</TableHead>
                <TableHead>Status</TableHead>
                {showActionColumn && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : requests.length > 0 ? (
                requests.sort((a,b) => {
                    const dateA = getRequestedAtTime(a.requestedAtUtc);
                    const dateB = getRequestedAtTime(b.requestedAtUtc);
                    return dateB - dateA;
                }).map((request) => (
                  <TableRow key={request.id} onClick={() => handleRowClick(request)} className="cursor-pointer">
                    <TableCell>
                      <div>
                          <div className="font-medium">{request.siteName}</div>
                          <div className="text-sm text-muted-foreground">{request.contractorName}</div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                          <Users className="h-4 w-4" /> 
                          <span>{request.workers.length} Workers</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium whitespace-nowrap">{request.supervisorName}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatTimestamp(request.requestedAtUtc)}
                    </TableCell>
                    <TableCell>
                      {request.status === 'Approved' ? (
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span>{formatDate(request.validFromUtc ?? undefined)}</span>
                            <span className="flex items-center gap-1">
                                to {request.isPermanent ? <Infinity className="h-4 w-4" /> : formatDate(request.expiresAtUtc ?? undefined)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {typeof request.currentOnSiteCount === 'number' ? (
                        <span className="text-sm font-medium">
                          {request.currentOnSiteCount}/{request.workers.length}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[request.status]} className={`gap-1.5 ${statusColorClasses[request.status as keyof typeof statusColorClasses]}`}>
                        {(() => {
                          const StatusIcon = statusIcons[request.status as keyof typeof statusIcons];
                          return StatusIcon ? <StatusIcon className="h-3 w-3" /> : null;
                        })()}
                        {request.status}
                      </Badge>
                    </TableCell>
                    {showActionColumn && (
                        <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                                {showActions && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onApprove?.(request);
                                      }}
                                    >
                                      <Check className="h-4 w-4 text-green-600" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeny?.(request.id);
                                      }}
                                    >
                                      <X className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </>
                                )}
                                {onDelete && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete access request?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will permanently remove the request for {request.siteName}. This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(request);
                                          }}
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                            </div>
                        </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                    <TableCell colSpan={colSpan} className="h-24 text-center">
                        No requests found.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    {selectedRequest && (
      <RequestDetailsDialog 
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRequest(null);
          }
        }}
        onDelete={onDelete}
        onApprove={showActions ? onApprove : undefined}
        onDeny={showActions ? onDeny : undefined}
      />
    )}
  </>
  );
}
