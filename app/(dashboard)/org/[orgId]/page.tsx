// app/(dashboard)/org/[orgId]/page.tsx
'use client';
import React from 'react';
import TruckCRUD from '../../../../components/TruckCRUD';
import TemplateCRUD from '../../../../components/TemplateCRUD';
import DocumentUpload from '../../../../components/DocumentUpload';
import ChecklistRun from '../../../../components/ChecklistRun';
import { useSearchParams, useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export default function OrgDashboardWrapper({ params }: { params: { orgId: string } }) {
  const orgId = params.orgId;
  // You may pass a profileId from auth; for MVP use seeded profile id or current session later
  // For now assume seeded manager id exists; replace with real session-based uid later
  const seededProfileId = '33333333-3333-3333-3333-333333333333';

  // Load templates list for selection
  const { data: templates } = useQuery(['templates', orgId], async () => {
    const res = await fetch(`/api/templates?orgId=${orgId}`);
    return res.json();
  });

  const [selectedTemplate, setSelectedTemplate] = useState<any>(templates?.[0] ?? null);
  const [templateItems, setTemplateItems] = useState<any[]>([]);

  const loadTemplateItems = async (templateId: string) => {
    const res = await fetch(`/api/template-items?templateId=${templateId}`);
    const json = await res.json();
    setTemplateItems(json);
  };

  // handle selecting a template
  React.useEffect(() => {
    if (templates && templates.length && !selectedTemplate) {
      const t = templates[0];
      setSelectedTemplate(t);
      loadTemplateItems(t.id);
    }
  }, [templates]);

  const onSelectTemplate = (t: any) => {
    setSelectedTemplate(t);
    loadTemplateItems(t.id);
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Org Dashboard</h1>
        <p className="text-sm text-muted">Org: {orgId}</p>
      </header>

      <section className="mb-6">
        <h2 className="text-lg font-medium mb-2">Templates</h2>
        <TemplateCRUD orgId={orgId} onSelect={onSelectTemplate} />
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium mb-2">Trucks</h2>
        <TruckCRUD orgId={orgId} />
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium mb-2">Run Checklist</h2>
        {selectedTemplate ? (
          <ChecklistRun
            orgId={orgId}
            template={selectedTemplate}
            templateItems={templateItems}
            truckId={null}
            profileId={seededProfileId}
          />
        ) : (
          <div className="p-4 bg-white rounded-xl shadow-sm">No template selected</div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-medium mb-2">Documents</h2>
        <DocumentUpload orgId={orgId} truckId={null} profileId={seededProfileId} />
      </section>
    </div>
  );
}
