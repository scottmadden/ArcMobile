// components/TemplateCRUD.tsx
'use client';

import * as React from 'react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../lib/supabase/client';

// local UI (no shadcn dependency)
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';

type Template = {
  id: string;
  org_id: string;
  name: string;
  frequency?: 'daily' | 'weekly' | 'monthly' | null;
  active?: boolean | null;
  created_at?: string;
};

type Item = {
  id: string;
  template_id: string;
  label: string;
  help_text?: string | null;
  sort_order?: number | null;
  required?: boolean | null;
};

const templateSchema = z.object({
  name: z.string().min(2, 'Template name is required'),
  frequency: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
});

const itemSchema = z.object({
  label: z.string().min(2, 'Item label is required'),
  help_text: z.string().optional(),
  required: z.boolean().default(false),
});

type TemplateForm = z.infer<typeof templateSchema>;
type ItemForm = z.infer<typeof itemSchema>;

export function TemplateCRUD({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // ---- Queries ----
  const templatesQ = useQuery({
    queryKey: ['templates', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('id, org_id, name, frequency, active, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const itemsQ = useQuery({
    queryKey: ['template-items', editingTemplate?.id],
    queryFn: async () => {
      if (!editingTemplate?.id) return [] as Item[];
      const { data, error } = await supabase
        .from('items')
        .select('id, template_id, label, help_text, sort_order, required')
        .eq('template_id', editingTemplate.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
    enabled: !!editingTemplate?.id,
  });

  // ---- Create Template ----
  const {
    register
