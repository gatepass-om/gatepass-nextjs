'use client';

import { useEffect, useRef, useState } from 'react';
import type Modeler from 'bpmn-js/lib/Modeler';
import { CheckCircle2, Download, Loader2, Rocket, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deployBpmnRequest, validateBpmnRequest } from '@/lib/workflow-api';

const STARTER_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:operaton="http://operaton.org/schema/1.0/bpmn" id="Definitions_AccessApproval" targetNamespace="https://gatepass.app/workflows">
  <bpmn:process id="access-request-approval" name="Access Request Approval" isExecutable="true" operaton:historyTimeToLive="180">
    <bpmn:startEvent id="request-submitted" name="Request submitted"><bpmn:outgoing>flow-review</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="review-request" name="Review access request"><bpmn:incoming>flow-review</bpmn:incoming><bpmn:outgoing>flow-end</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="decision-recorded" name="Decision recorded"><bpmn:incoming>flow-end</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="flow-review" sourceRef="request-submitted" targetRef="review-request" />
    <bpmn:sequenceFlow id="flow-end" sourceRef="review-request" targetRef="decision-recorded" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_AccessApproval"><bpmndi:BPMNPlane id="Plane_AccessApproval" bpmnElement="access-request-approval">
    <bpmndi:BPMNShape id="Shape_Start" bpmnElement="request-submitted"><dc:Bounds x="150" y="182" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Shape_Review" bpmnElement="review-request"><dc:Bounds x="260" y="160" width="160" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Shape_End" bpmnElement="decision-recorded"><dc:Bounds x="500" y="182" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="Edge_Review" bpmnElement="flow-review"><di:waypoint x="186" y="200" /><di:waypoint x="260" y="200" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Edge_End" bpmnElement="flow-end"><di:waypoint x="420" y="200" /><di:waypoint x="500" y="200" /></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

type Status =
  | { kind: 'idle'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export function WorkflowDesigner({ token, tenantId }: { token: string; tenantId: string }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<Modeler | null>(null);
  const [workflowName, setWorkflowName] = useState('Access Request Approval');
  const [fileName, setFileName] = useState('access-request-approval.bpmn');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: 'Edit the flow, validate it, then deploy it to the selected client.' });

  useEffect(() => {
    let disposed = false;
    let modeler: Modeler | null = null;

    void import('bpmn-js/lib/Modeler').then(async ({ default: BpmnModeler }) => {
      if (disposed || !canvasRef.current) return;
      modeler = new BpmnModeler({ container: canvasRef.current });
      modelerRef.current = modeler;
      await modeler.importXML(STARTER_BPMN);
      modeler.get<{ zoom: (mode: string) => void }>('canvas').zoom('fit-viewport');
      setReady(true);
    }).catch((error: unknown) => {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load the BPMN designer.' });
    });

    return () => {
      disposed = true;
      modeler?.destroy();
      modelerRef.current = null;
    };
  }, []);

  async function exportXml() {
    const result = await modelerRef.current?.saveXML({ format: true });
    if (!result?.xml) throw new Error('The BPMN model is not ready.');
    return result.xml;
  }

  async function handleValidate() {
    setBusy(true);
    try {
      const result = await validateBpmnRequest(token, await exportXml());
      setStatus(result.isValid
        ? { kind: 'success', message: `Portable BPMN is valid. Process key: ${result.processKey}.` }
        : { kind: 'error', message: result.errors.join(' ') });
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Validation failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeploy() {
    if (!tenantId) {
      setStatus({ kind: 'error', message: 'Select a client before deployment.' });
      return;
    }
    setBusy(true);
    try {
      const bpmnXml = await exportXml();
      const validation = await validateBpmnRequest(token, bpmnXml);
      if (!validation.isValid) {
        setStatus({ kind: 'error', message: validation.errors.join(' ') });
        return;
      }
      const result = await deployBpmnRequest(token, { name: workflowName, tenantId, fileName, bpmnXml });
      setStatus({ kind: 'success', message: `Deployed to this client. Deployment ID: ${result.deploymentId}.` });
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Deployment failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    try {
      const blob = new Blob([await exportXml()], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName || 'workflow.bpmn';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Export failed.' });
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="grid gap-4 border-b bg-muted/30 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="workflow-name">Workflow name</Label>
          <Input id="workflow-name" value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workflow-file">BPMN file</Label>
          <Input id="workflow-file" value={fileName} onChange={(event) => setFileName(event.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={!ready || busy}><Download />Save BPMN</Button>
          <Button variant="outline" onClick={handleValidate} disabled={!ready || busy}><ShieldCheck />Validate</Button>
          <Button onClick={handleDeploy} disabled={!ready || busy || !tenantId}>{busy ? <Loader2 className="animate-spin" /> : <Rocket />}Deploy workflow</Button>
        </div>
      </div>

      <div className="relative min-h-[560px] bg-white">
        {!ready && <div className="absolute inset-0 z-10 grid place-items-center bg-white/90 text-sm text-slate-600"><Loader2 className="mr-2 inline size-4 animate-spin" />Loading visual designer…</div>}
        <div ref={canvasRef} className="h-[min(68vh,720px)] min-h-[560px] w-full" aria-label="BPMN workflow canvas" />
      </div>

      <div className={`flex items-start gap-2 border-t px-4 py-3 text-sm ${status.kind === 'error' ? 'bg-red-50 text-red-900' : status.kind === 'success' ? 'bg-emerald-50 text-emerald-900' : 'bg-muted/30 text-muted-foreground'}`} role="status">
        {status.kind === 'error' ? <TriangleAlert className="mt-0.5 size-4 shrink-0" /> : status.kind === 'success' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <ShieldCheck className="mt-0.5 size-4 shrink-0" />}
        <span>{status.message}</span>
      </div>
    </div>
  );
}
