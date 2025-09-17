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
    // When a template is selected, fetch its items
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
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TemplateForm>({ resolver: zodResolver(templateSchema), defaultValues: { name: '', frequency: 'daily' } });

  const createTemplate = useMutation({
    mutationFn: async (payload: TemplateForm) => {
      const { data, error } = await supabase
        .from('templates')
        .insert([{ org_id: orgId, name: payload.name, frequency: payload.frequency, active: true }])
        .select()
        .single();
      if (error) throw error;
      return data as Template;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates', orgId] });
      reset({ name: '', frequency: 'daily' });
    },
  });

  // ---- Update Template Name/Frequency ----
  const updateTemplate = useMutation({
    mutationFn: async (patch: Partial<Template> & { id: string }) => {
      const { error } = await supabase.from('templates').update(patch).eq('id', patch.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates', orgId] });
    },
  });

  // ---- Delete Template ----
  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      // Optionally delete items first
      const { error: itemsErr } = await supabase.from('items').delete().eq('template_id', id);
      if (itemsErr && itemsErr.code !== 'PGRST116') {
        // ignore "no rows" error
        throw itemsErr;
      }
      const { error } = await supabase.from('templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates', orgId] });
      setEditingTemplate(null);
    },
  });

  // ---- Item Mutations ----
  const addItem = useMutation({
    mutationFn: async (payload: ItemForm & { template_id: string }) => {
      // find next sort_order
      const { data: maxData, error: maxErr } = await supabase
        .from('items')
        .select('sort_order')
        .eq('template_id', payload.template_id)
        .order('sort_order', { ascending: false })
        .limit(1);
      if (maxErr) throw maxErr;
      const nextOrder = (maxData?.[0]?.sort_order ?? 0) + 1;

      const { error } = await supabase.from('items').insert([
        {
          template_id: payload.template_id,
          label: payload.label,
          help_text: payload.help_text ?? null,
          required: payload.required ?? false,
          sort_order: nextOrder,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-items', editingTemplate?.id] });
    },
  });

  const updateItem = useMutation({
    mutationFn: async (patch: Partial<Item> & { id: string }) => {
      const { error } = await supabase.from('items').update(patch).eq('id', patch.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-items', editingTemplate?.id] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-items', editingTemplate?.id] });
    },
  });

  // ---- UI ----
  const onCreate = (data: TemplateForm) => createTemplate.mutate(data);

  return (
    <div className="space-y-6">
      {/* Create */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-[22px]">Create Checklist Template</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Template name</Label>
            <Input id="name" placeholder="Daily Opening Checklist" {...register('name')} />
            {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="frequency">Frequency</Label>
            <select id="frequency" className="border rounded-md h-10 px-3" {...register('frequency')}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={handleSubmit(onCreate)} disabled={isSubmitting || createTemplate.isPending}>
            Add Template
          </Button>
        </CardFooter>
      </Card>

      <Separator />

      {/* List */}
      <div className="space-y-3">
        <h2 className="text-[18px] font-medium">Templates</h2>
        {templatesQ.isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : templatesQ.isError ? (
          <p className="text-red-600">Error: {(templatesQ.error as any)?.message ?? 'Failed to load templates'}</p>
        ) : templatesQ.data.length === 0 ? (
          <p className="text-muted-foreground">No templates yet.</p>
        ) : (
          <div className="grid gap-3">
            {templatesQ.data.map((t) => (
              <Card key={t.id} className="rounded-2xl">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.frequency ?? 'daily'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={() => setEditingTemplate(t)}>
                        Edit
                      </Button>
                      <Button variant="destructive" onClick={() => deleteTemplate.mutate(t.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Inline editor for the selected template */}
                  {editingTemplate?.id === t.id && (
                    <div className="mt-6 space-y-4">
                      {/* Template fields */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 grid gap-2">
                          <Label>Template name</Label>
                          <Input
                            defaultValue={editingTemplate.name}
                            onBlur={(e) =>
                              updateTemplate.mutate({ id: editingTemplate.id, name: e.currentTarget.value })
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Frequency</Label>
                          <select
                            className="border rounded-md h-10 px-3"
                            defaultValue={editingTemplate.frequency ?? 'daily'}
                            onChange={(e) =>
                              updateTemplate.mutate({
                                id: editingTemplate.id,
                                frequency: e.currentTarget.value as Template['frequency'],
                              })
                            }
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>
                      </div>

                      <Separator />

                      {/* Items */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[16px] font-medium">Items</h3>
                          <AddItemRow
                            onAdd={(payload) => addItem.mutate({ ...payload, template_id: editingTemplate.id })}
                          />
                        </div>
                        {itemsQ.isLoading ? (
                          <p className="text-muted-foreground">Loading items…</p>
                        ) : itemsQ.isError ? (
                          <p className="text-red-600">Error loading items</p>
                        ) : itemsQ.data.length === 0 ? (
                          <p className="text-muted-foreground">No items yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {itemsQ.data.map((it) => (
                              <div
                                key={it.id}
                                className="flex items-start sm:items-center gap-3 p-3 rounded-xl border bg-white"
                              >
                                <div className="flex items-center gap-2 pt-1">
                                  <Checkbox
                                    checked={!!it.required}
                                    onCheckedChange={(checked) =>
                                      updateItem.mutate({ id: it.id, required: Boolean(checked) })
                                    }
                                  />
                                  <span className="text-xs text-muted-foreground">Required</span>
                                </div>
                                <div className="flex-1 grid gap-2">
                                  <Input
                                    defaultValue={it.label}
                                    onBlur={(e) => updateItem.mutate({ id: it.id, label: e.currentTarget.value })}
                                  />
                                  <Textarea
                                    placeholder="Help text (optional)"
                                    defaultValue={it.help_text ?? ''}
                                    onBlur={(e) =>
                                      updateItem.mutate({ id: it.id, help_text: e.currentTarget.value || null })
                                    }
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button variant="destructive" onClick={() => deleteItem.mutate(it.id)}>
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddItemRow({ onAdd }: { onAdd: (payload: ItemForm) => void }) {
  const form = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: { label: '', help_text: '', required: false },
  });
  const { register, handleSubmit, reset, formState, setValue, watch } = form;

  const submit = (data: ItemForm) => {
    onAdd(data);
    reset({ label: '', help_text: '', required: false });
  };

  return (
    <form className="flex flex-col sm:flex-row gap-2" onSubmit={handleSubmit(submit)}>
      <Input className="sm:w-64" placeholder="Add item label…" {...register('label')} />
      <Input className="sm:w-80" placeholder="Help text (optional)" {...register('help_text')} />
      <div className="flex items-center gap-2">
        <Checkbox
          id="required"
          checked={!!watch('required')}
          onCheckedChange={(checked) => setValue('required', Boolean(checked))}
        />
        <Label htmlFor="required" className="text-sm">
          Required
        </Label>
      </div>
      <Button type="submit" disabled={formState.isSubmitting}>
        Add
      </Button>
    </form>
  );
}

export default TemplateCRUD;
