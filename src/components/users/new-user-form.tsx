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
const interactionModes = ['Web', 'MobileApp', 'PrintedCard', 'Kiosk', 'Sms', 'SupervisorAssisted'] as const;

const formSchema = z.object({
  name: z.string().trim().min(2, 'Enter the person’s full name.'),
  preferredName: z.string().trim().optional(),
  nameInOriginalScript: z.string().trim().optional(),
  email: z.string().trim().optional(),
  role: z.enum(roleValues),
  assignedSiteId: z.string().optional(),
  contractorId: z.string().optional(),
  operatorId: z.string().optional(),
  jobPositionId: z.string().optional(),
  interactiveAccountEnabled: z.boolean(),
  preferredLanguage: z.string().min(2),
  secondaryLanguages: z.string().optional(),
  preferredInteractionMode: z.enum(interactionModes),
  needsAssistedWorkflow: z.boolean(),
  personalDeviceAvailable: z.boolean(),
  canReceiveSms: z.boolean(),
  offlineCardRequired: z.boolean(),
  audioInstructionsPreferred: z.boolean(),
  largeTextPreferred: z.boolean(),
  interpreterRequired: z.boolean(),
  accessibilitySupportNotes: z.string().max(1000).optional(),
}).superRefine((values, context) => {
  if (values.interactiveAccountEnabled && !z.string().email().safeParse(values.email).success) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['email'],
      message: 'Add an email for direct sign-in, or turn off direct sign-in for a managed worker record.',
    });
  }
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
  currentUserId: string;
  currentUserOperatorId?: string;
  currentUserContractorId?: string;
  registrationProfiles: RegistrationProfile[];
  jobPositions: JobPosition[];
}

function PreferenceCheckbox({
  checked,
  onCheckedChange,
  label,
  description,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}

export function NewUserForm({
  onNewUser,
  sites,
  contractors,
  operators,
  isLoading,
  currentUserRole,
  currentUserId,
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
      preferredName: '',
      nameInOriginalScript: '',
      email: '',
      role: availableRoles[0] || 'Worker',
      assignedSiteId: '',
      contractorId: '',
      operatorId: '',
      jobPositionId: '',
      interactiveAccountEnabled: true,
      preferredLanguage: 'en',
      secondaryLanguages: '',
      preferredInteractionMode: 'Web',
      needsAssistedWorkflow: false,
      personalDeviceAvailable: true,
      canReceiveSms: true,
      offlineCardRequired: false,
      audioInstructionsPreferred: false,
      largeTextPreferred: false,
      interpreterRequired: false,
      accessibilitySupportNotes: '',
    },
  });

  const selectedRole = useWatch({ control: form.control, name: 'role' });
  const interactiveAccountEnabled = useWatch({ control: form.control, name: 'interactiveAccountEnabled' });
  const needsAssistedWorkflow = useWatch({ control: form.control, name: 'needsAssistedWorkflow' });
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
      email: values.email || undefined,
      role: values.role,
      operatorId,
      contractorId,
      assignedSiteId: values.assignedSiteId || undefined,
      sendWelcomeEmail: values.interactiveAccountEnabled && Boolean(values.email),
      interactiveAccountEnabled: values.interactiveAccountEnabled,
      preferredName: values.preferredName || undefined,
      nameInOriginalScript: values.nameInOriginalScript || undefined,
      preferredLanguage: values.preferredLanguage,
      secondaryLanguages: values.secondaryLanguages?.split(',').map((language) => language.trim()).filter(Boolean),
      preferredInteractionMode: values.preferredInteractionMode,
      needsAssistedWorkflow: values.needsAssistedWorkflow,
      personalDeviceAvailable: values.personalDeviceAvailable,
      canReceiveSms: values.canReceiveSms,
      offlineCardRequired: values.offlineCardRequired,
      audioInstructionsPreferred: values.audioInstructionsPreferred,
      largeTextPreferred: values.largeTextPreferred,
      interpreterRequired: values.interpreterRequired,
      accessibilitySupportNotes: values.accessibilitySupportNotes || undefined,
      registrationChannel: values.needsAssistedWorkflow ? 'Assisted' : 'SelfService',
      assistedByUserId: values.needsAssistedWorkflow ? currentUserId : undefined,
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
        <p className="text-sm text-muted-foreground">
          Start with what is known. Optional details can be completed later by the person,
          a supervisor, or registration staff.
        </p>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-1 pr-4">
          <section className="space-y-4 rounded-xl border p-4">
            <div>
              <h3 className="font-semibold">1. Who is this person?</h3>
              <p className="text-sm text-muted-foreground">Use the name they want staff to call them.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Full legal name</FormLabel><FormControl><Input autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="preferredName" render={({ field }) => (
                <FormItem><FormLabel>Preferred name <span className="font-normal text-muted-foreground">(optional)</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="nameInOriginalScript" render={({ field }) => (
                <FormItem><FormLabel>Name in their own writing <span className="font-normal text-muted-foreground">(optional)</span></FormLabel><FormControl><Input dir="auto" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type of person</FormLabel>
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
            {(selectedRole === 'Worker' || selectedRole === 'Supervisor') && currentUserRole !== 'Contractor Admin' && (
              <SimpleSelect label="External company" value={form.watch('contractorId')} onChange={(value) => form.setValue('contractorId', value)} options={contractors} disabled={isLoading} />
            )}
            {(selectedRole === 'Worker' || selectedRole === 'Supervisor') && (
              <SimpleSelect label="Job position" value={form.watch('jobPositionId')} onChange={(value) => form.setValue('jobPositionId', value)} options={jobPositions} disabled={isLoading} />
            )}
            {(selectedRole === 'Security' || selectedRole === 'Inspector') && (
              <SimpleSelect label="Assigned site" value={form.watch('assignedSiteId')} onChange={(value) => form.setValue('assignedSiteId', value)} options={operatorSites} disabled={isLoading} />
            )}
          </section>

          <section className="space-y-4 rounded-xl border p-4">
            <div>
              <h3 className="font-semibold">2. How will they use GatePass?</h3>
              <p className="text-sm text-muted-foreground">A login is optional. Printed cards, kiosks, and supervisor help remain available.</p>
            </div>
            <FormField control={form.control} name="interactiveAccountEnabled" render={({ field }) => (
              <PreferenceCheckbox checked={field.value} onCheckedChange={field.onChange} label="This person will sign in to GatePass" description="Turn this off for a record-only worker, visitor, or printed-card user." />
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email address {interactiveAccountEnabled ? '' : '(optional)'}</FormLabel>
                <FormControl><Input type="email" inputMode="email" autoComplete="email" {...field} /></FormControl>
                <FormDescription>
                  {interactiveAccountEnabled
                    ? 'Required for direct sign-in and account recovery in this registration flow.'
                    : 'Leave blank when the person has no email. GatePass will not generate a fake address.'}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            {isPersonnel && (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField control={form.control} name="preferredInteractionMode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Easiest way for them to use the system</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Web">Web browser</SelectItem>
                        <SelectItem value="MobileApp">Mobile app</SelectItem>
                        <SelectItem value="PrintedCard">Printed QR card</SelectItem>
                        <SelectItem value="Kiosk">Shared kiosk</SelectItem>
                        <SelectItem value="Sms">Text message</SelectItem>
                        <SelectItem value="SupervisorAssisted">Supervisor helps</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="preferredLanguage" render={({ field }) => (
                  <FormItem><FormLabel>Preferred language code</FormLabel><FormControl><Input placeholder="en, ar, hi, ur…" maxLength={20} {...field} /></FormControl><FormDescription>Use a short language code.</FormDescription><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="secondaryLanguages" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>Other languages <span className="font-normal text-muted-foreground">(optional)</span></FormLabel><FormControl><Input placeholder="en, ur" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            )}
          </section>

          {isPersonnel && (
            <section className="space-y-4 rounded-xl border p-4">
              <div>
                <h3 className="font-semibold">3. What help is useful?</h3>
                <p className="text-sm text-muted-foreground">These choices only change how help is provided. They do not approve or deny access.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {([
                  ['needsAssistedWorkflow', 'A staff member will help', 'Useful when the person is not comfortable with apps.'],
                  ['personalDeviceAvailable', 'Has a personal phone or device', undefined],
                  ['canReceiveSms', 'Can receive text messages', undefined],
                  ['offlineCardRequired', 'Needs a printed card that works offline', undefined],
                  ['audioInstructionsPreferred', 'Audio instructions would help', undefined],
                  ['largeTextPreferred', 'Large text would help', undefined],
                  ['interpreterRequired', 'Interpreter support is needed', undefined],
                ] as const).map(([name, label, description]) => (
                  <FormField key={name} control={form.control} name={name} render={({ field }) => (
                    <PreferenceCheckbox checked={field.value} onCheckedChange={field.onChange} label={label} description={description} />
                  )} />
                ))}
              </div>
              {needsAssistedWorkflow && (
                <FormField control={form.control} name="accessibilitySupportNotes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions for the person helping</FormLabel>
                    <FormControl><Textarea placeholder="For example: explain each step verbally; contact the supervisor for confirmation." {...field} /></FormControl>
                    <FormDescription>Do not add medical details unless they are necessary and authorized.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </section>
          )}

          {isPersonnel && availableProfiles.length > 0 && (
            <section className="space-y-4 rounded-xl border p-4">
              <div>
                <h3 className="font-semibold">4. Client-specific details</h3>
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
