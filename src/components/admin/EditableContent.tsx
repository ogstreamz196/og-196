import { useState, type ReactNode, type ElementType, type CSSProperties } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { useAdminEditMode } from "@/components/admin/AdminEditMode";
import { useRole } from "@/hooks/use-role";
import { useSiteContent, useSetSiteContent } from "@/hooks/use-site-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  /** Unique site-wide key, e.g. "dashboard.welcome.subtitle" */
  contentKey: string;
  /** Default text shown when no override is set */
  defaultValue: string;
  /** HTML element / component to render as. Defaults to <span>. */
  as?: ElementType;
  multiline?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Optional wrapper for the display text (e.g. gradient span) */
  renderDisplay?: (value: string) => ReactNode;
}

/**
 * Site-wide editable content. Boss with edit mode on can click any
 * instance to update the text; the change persists in `site_content`
 * and applies for every user.
 */
export function EditableContent({
  contentKey,
  defaultValue,
  as,
  multiline = false,
  className,
  style,
  renderDisplay,
}: Props) {
  const Tag = (as ?? "span") as ElementType;
  const { enabled } = useAdminEditMode();
  const { isAdmin } = useRole();
  const { get } = useSiteContent();
  const setMut = useSetSiteContent();

  const current = get(contentKey, defaultValue);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);

  const canEdit = enabled && isAdmin;

  function save() {
    const next = draft.trim() === "" ? defaultValue : draft;
    setMut.mutate(
      { key: contentKey, value: next },
      {
        onSuccess: () => {
          toast.success("Saved site-wide");
          setEditing(false);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  if (!canEdit) {
    return (
      <Tag className={className} style={style}>
        {renderDisplay ? renderDisplay(current) : current}
      </Tag>
    );
  }

  if (editing) {
    return (
      <Tag className={cn("inline-flex items-start gap-1.5 align-middle", className)} style={style}>
        {multiline ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setDraft(current); setEditing(false); }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
            }}
            rows={3}
            maxLength={5000}
            className="min-w-[260px] flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        ) : (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); save(); }
              if (e.key === "Escape") { setDraft(current); setEditing(false); }
            }}
            maxLength={500}
            className="h-8 min-w-[200px] text-sm"
          />
        )}
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0"
          disabled={setMut.isPending} onClick={save} title="Save site-wide">
          {setMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0"
          onClick={() => { setDraft(current); setEditing(false); }} title="Cancel">
          <X className="h-3.5 w-3.5" />
        </Button>
      </Tag>
    );
  }

  return (
    <Tag
      role="button"
      tabIndex={0}
      onClick={(e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        setDraft(current); setEditing(true);
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault(); e.stopPropagation();
          setDraft(current); setEditing(true);
        }
      }}
      className={cn(
        "group relative cursor-text rounded outline-dashed outline-1 outline-primary/40 hover:bg-primary/10",
        className,
      )}
      style={style}
      title="Edit site-wide (boss)"
    >
      {renderDisplay ? renderDisplay(current) : current}
      <Pencil className="ml-1 inline h-3 w-3 align-middle opacity-0 transition-opacity group-hover:opacity-100" />
    </Tag>
  );
}
