"use client";

import { useState, useTransition } from "react";
import { Save, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import {
  GEMINI_MODELS,
  type GeminiConfigStatus,
  type GeminiModel,
} from "@/lib/admin/data/secrets-types";
import {
  updateGeminiConfigAction,
  clearGeminiKeyAction,
} from "@/app/[locale]/(admin)/admin/integrations/_actions";

export function AiTranslationSettings({ initial }: { initial: GeminiConfigStatus }) {
  const [status, setStatus] = useState<GeminiConfigStatus>(initial);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<GeminiModel>(initial.model);
  const [pending, startTransition] = useTransition();

  const dirty =
    apiKey.trim().length > 0 || model !== status.model;

  function save() {
    startTransition(async () => {
      const res = await updateGeminiConfigAction({
        apiKey: apiKey.trim() || undefined,
        model,
      });
      if (res.ok) {
        setStatus(res.status);
        setApiKey("");
        toast.success("AI translation settings saved");
      } else {
        toast.error("Failed to save AI translation settings");
      }
    });
  }

  function clearKey() {
    if (!confirm("Remove the stored Gemini API key? AI translate buttons will be disabled until a new key is added.")) return;
    startTransition(async () => {
      const res = await clearGeminiKeyAction();
      if (res.ok) {
        setStatus(res.status);
        toast.success("Gemini key removed");
      } else {
        toast.error("Failed to remove key");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" /> AI translation
        </CardTitle>
        <CardDescription>
          Configure a Google Gemini API key to enable per-hadith AI translation
          buttons in the admin editor. The key is stored server-side only and
          never sent back to the browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
          <span className="font-medium">Status:</span>{" "}
          {status.configured ? (
            <span className="text-success">
              Key configured ({status.maskedKey})
            </span>
          ) : (
            <span className="text-warning">No key configured</span>
          )}
          {status.updatedAt && (
            <span className="ml-2 text-xs text-muted-foreground">
              · last updated {new Date(status.updatedAt).toLocaleString()}
              {status.updatedBy ? ` by ${status.updatedBy}` : ""}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gemini-key">
            Gemini API key {status.configured && <span className="text-xs text-muted-foreground">(leave empty to keep current)</span>}
          </Label>
          <Input
            id="gemini-key"
            type="password"
            autoComplete="off"
            placeholder={status.configured ? "Enter a new key to rotate" : "AIza…"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Create a key at{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              aistudio.google.com/apikey
            </a>
            .
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gemini-model">Model</Label>
          <select
            id="gemini-model"
            value={model}
            onChange={(e) => setModel(e.target.value as GeminiModel)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {GEMINI_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={!dirty || pending}>
            <Save /> {pending ? "Saving…" : "Save"}
          </Button>
          {status.configured && (
            <Button
              variant="ghost"
              onClick={clearKey}
              disabled={pending}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 /> Remove key
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
