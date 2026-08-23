'use client'

import React, { useMemo } from 'react';
import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Contractor, JobPosition, Operator, Site, UserRole } from '@/lib/types';
import type { CreateUserInput, RegistrationProfile } from '@/lib/api';
import { buildEmploymentPayload } from '@/components/compliance/compliance-model';

const roleValues = ['Admin', 'Operator Admin', 'Contractor Admin', 'Manager', 'Security', 'Visitor', 'Worker', 'Supervisor', 'Inspector'] as const;
const formSchema = z.object({
  name: z.string().trim().min(2, 'Enter the person’s full name.'),
  idNumber: z.string().trim().min(1, 'Enter the National ID number.').max(100, 'National ID number is too long.'),
  email: z.string().trim().email('Enter a valid email address.'),
  role: z.enum(roleValues),
  assignedSiteId: z.string().optional(),
  contractorId: z.string().optional(),
  operatorId: z.string().optional(),
  jobPositionId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface NewUserFormProps {
  onNewUser: (
    user: CreateUserInput,
    registration?: { profileId: string; entityType: string; values: Record<string, unknown> },
  ) => void;
  sites: Site[];
  contractors: Contractor[];
  operators: Operator[];
  isLoading: boolean;
  currentUserRole: UserRole;
  currentUserOperatorId?: string;
  currentUserContractorId?: string;
  registrationProfiles: RegistrationProfile[];
  jobPositions: JobPosition[];
}

export function NewUserForm({
  onNewUser,
  sites,
  contractors,
  operators,
  isLoading,
  currentUserRole,
  currentUserOperatorId,
  currentUserContractorId,
  registrationProfiles,
  jobPositions,
}: NewUserFormProps) {
  const availableRoles = useMemo<UserRole[]>(() => {
    if (currentUserRole === 'Admin') return ['Operator Admin', 'Contractor Admin'];
    if (currentUserRole === 'Operator Admin') return ['Manager', 'Security', 'Worker', 'Inspector'];
    if (currentUserRole === 'Contractor Admin') return ['Supervisor', 'Worker'];
    return [];
  }, [currentUserRole]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      idNumber: '',
      email: '',
      role: availableRoles[0] || 'Worker',
      assignedSiteId: '',
      contractorId: '',
      operatorId: '',
      jobPositionId: '',
    },
  });

  const selectedRole = useWatch({ control: form.control, name: 'role' });
  const isPersonnel = selectedRole === 'Worker' || selectedRole === 'Visitor';
  const [selectedProfileId, setSelectedProfileId] = React.useState('');
  const [customValues, setCustomValues] = React.useState<Record<string, unknown>>({});
  const [customError, setCustomError] = React.useState<string | null>(null);
  const availableProfiles = registrationProfiles.filter((profile) => profile.entityType === selectedRole);
  const selectedProfile = availableProfiles.find((profile) => profile.id === selectedProfileId);
  const operatorSites = useMemo(
    () => currentUserRole === 'Operator Admin'
      ? sites.filter((site) => site.operatorId === currentUserOperatorId)
      : sites,
    [sites, currentUserRole, currentUserOperatorId],
  );

  function onSubmit(values: FormValues) {
    if (selectedProfile) {
      const missing = selectedProfile.fields.filter((field) => {
        if (!field.required) return false;
        const value = customValues[field.key];
        return value === undefined || value === null || value === '';
      });
      if (missing.length > 0) {
        setCustomError(`Complete: ${missing.map((field) => field.label).join(', ')}.`);
        return;
      }
    }
    setCustomError(null);
    const contractorId = currentUserRole === 'Contractor Admin' ? currentUserContractorId : values.contractorId || undefined;
    const operatorId = currentUserRole === 'Operator Admin' ? currentUserOperatorId : values.operatorId || undefined;
    onNewUser({
      name: values.name,
      idNumber: values.idNumber,
      email: values.email,
      role: values.role,
      operatorId,
      contractorId,
      assignedSiteId: values.assignedSiteId || undefined,
      sendWelcomeEmail: true,
      interactiveAccountEnabled: true,
      registrationChannel: 'SelfService',
      employment: ['Worker', 'Supervisor'].includes(values.role)
        ? buildEmploymentPayload({ jobPositionId: values.jobPositionId, contractorId, operatorId })
        : undefined,
    }, selectedProfile ? {
      profileId: selectedProfile.id,
      entityType: selectedProfile.entityType,
      values: normalizeCustomValues(selectedProfile, customValues),
    } : undefined);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-2">
        <p className="text-sm text-muted-foreground">Enter the person’s identity and account details. All fields marked with * are required.</p>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-1 pr-4">
          <section className="space-y-4 rounded-xl border p-4">
            <div>
              <h3 className="font-semibold">Person details</h3>
              <p className="text-sm text-muted-foreground">These details identify the person and create their GatePass account.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Full legal name *</FormLabel><FormControl><Input autoComplete="name" required {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="idNumber" render={({ field }) => (
                <FormItem><FormLabel>National ID number *</FormLabel><FormControl><Input autoComplete="off" required {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email address *</FormLabel><FormControl><Input type="email" inputMode="email" autoComplete="email" required {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type of person *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{availableRoles.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {selectedRole === 'Contractor Admin' && currentUserRole === 'Admin' && (
              <SimpleSelect label="Contractor company" value={form.watch('contractorId')} onChange={(value) => form.setValue('contractorId', value)} options={contractors} disabled={isLoading} />
            )}
            {selectedRole === 'Operator Admin' && currentUserRole === 'Admin' && (
              <SimpleSelect label="Operator company" value={form.watch('operatorId')} onChange={(value) => form.setValue('operatorId', value)} options={operators} disabled={isLoading} />
            )}
            {(selectedRole === 'Worker' || selectedRole === 'Supervisor') && currentUserRole !== 'Contractor Admin' && currentUserRole !== 'Operator Admin' && (
              <SimpleSelect label="External company" value={form.watch('contractorId')} onChange={(value) => form.setValue('contractorId', value)} options={contractors} disabled={isLoading} />
            )}
            {(selectedRole === 'Worker' || selectedRole === 'Supervisor') && (
              <SimpleSelect label="Job position" value={form.watch('jobPositionId')} onChange={(value) => form.setValue('jobPositionId', value)} options={jobPositions} disabled={isLoading} />
            )}
            {(selectedRole === 'Security' || selectedRole === 'Inspector') && (
              <SimpleSelect label="Assigned site" value={form.watch('assignedSiteId')} onChange={(value) => form.setValue('assignedSiteId', value)} options={operatorSites} disabled={isLoading} />
            )}
          </section>

          {isPersonnel && availableProfiles.length > 0 && (
            <section className="space-y-4 rounded-xl border p-4">
              <div>
                <h3 className="font-semibold">Client-specific details</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a registration checklist only when it applies to this person.
                </p>
              </div>
              <SimpleSelect
                label="Registration checklist"
                value={selectedProfileId}
                onChange={(value) => {
                  setSelectedProfileId(value);
                  setCustomValues({});
                  setCustomError(null);
                }}
                options={availableProfiles}
                disabled={isLoading}
              />
              {selectedProfile && (
                <div className="grid gap-4 md:grid-cols-2">
                  {selectedProfile.fields.map((definition) => (
                    <DynamicRegistrationField
                      key={definition.id}
                      definition={definition}
                      value={customValues[definition.key]}
                      onChange={(value) => setCustomValues((current) => ({
                        ...current,
                        [definition.key]: value,
                      }))}
                    />
                  ))}
                </div>
              )}
              {customError && <p className="text-sm text-destructive">{customError}</p>}
            </section>
          )}
        </div>
        <div className="flex justify-end"><Button type="submit" disabled={isLoading}>{isLoading ? 'Saving…' : 'Save person'}</Button></div>
      </form>
    </Form>
  );
}

function DynamicRegistrationField({
  definition,
  value,
  onChange,
}: {
  definition: RegistrationProfile['fields'][number];
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = `${definition.label}${definition.required ? ' *' : ''}`;
  if (definition.fieldType === 'Boolean') {
    return (
      <label className="flex items-start gap-3 rounded-lg border p-3">
        <Checkbox checked={value === true} onCheckedChange={(checked) => onChange(checked === true)} className="mt-0.5" />
        <span>
          <span className="block text-sm font-medium">{label}</span>
          {definition.helpText && <span className="block text-xs text-muted-foreground">{definition.helpText}</span>}
        </span>
      </label>
    );
  }
  if (definition.fieldType === 'Choice') {
    return (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <Select onValueChange={onChange} value={typeof value === 'string' ? value : ''}>
          <FormControl><SelectTrigger><SelectValue placeholder="Choose one" /></SelectTrigger></FormControl>
          <SelectContent>{definition.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
        </Select>
        {definition.helpText && <FormDescription>{definition.helpText}</FormDescription>}
      </FormItem>
    );
  }
  if (definition.fieldType === 'LongText') {
    return (
      <FormItem className="md:col-span-2">
        <FormLabel>{label}</FormLabel>
        <Textarea value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} />
        {definition.helpText && <FormDescription>{definition.helpText}</FormDescription>}
      </FormItem>
    );
  }
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <Input
        type={definition.fieldType === 'Number' ? 'number' : definition.fieldType === 'Date' ? 'date' : definition.fieldType === 'DateTime' ? 'datetime-local' : definition.fieldType === 'Email' ? 'email' : 'text'}
        value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={definition.fieldType === 'MultiChoice' ? definition.options.join(', ') : undefined}
      />
      {definition.helpText && <FormDescription>{definition.helpText}</FormDescription>}
    </FormItem>
  );
}

function normalizeCustomValues(
  profile: RegistrationProfile,
  values: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(profile.fields.flatMap((field) => {
    const value = values[field.key];
    if (value === undefined || value === null || value === '') return [];
    if (field.fieldType === 'Number') return [[field.key, Number(value)]];
    if (field.fieldType === 'MultiChoice') {
      return [[field.key, String(value).split(',').map((item) => item.trim()).filter(Boolean)]];
    }
    return [[field.key, value]];
  }));
}

function SimpleSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
  disabled: boolean;
}) {
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <Select onValueChange={onChange} value={value} disabled={disabled}>
        <FormControl><SelectTrigger><SelectValue placeholder="Choose one" /></SelectTrigger></FormControl>
        <SelectContent>{options.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent>
      </Select>
    </FormItem>
  );
}
