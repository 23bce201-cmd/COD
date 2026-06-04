import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  Archive,
  CalendarDays,
  Check,
  Clock,
  Flag,
  GripVertical,
  Plus,
  RefreshCw,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../context/AuthContext";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "../../ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../ui/sheet";
import { Switch } from "../../ui/switch";

type StageId = "backlog" | "qualified" | "proposal" | "negotiation" | "closedWon" | "closedLost";
type Priority = "High" | "Medium" | "Low";
type DueFilter = "all" | "week" | "month" | "overdue" | "custom";

type ActivityEntry = {
  id: string;
  at: string;
  actor: string;
  text: string;
};

type Deal = {
  id: string;
  clientId: string;
  campaignId?: string | null;
  ownerId?: string | null;
  title: string;
  company: string;
  segment: string;
  campaignName?: string;
  owner: string;
  priority: Priority;
  value: number;
  dueDate: string;
  tags: string[];
  stage: StageId;
  contactName: string;
  contactEmail: string;
  probability: number;
  lastActivityDate: string;
  lastActivityNote: string;
  notes: string;
  blocker?: string;
  activityLog: ActivityEntry[];
};

type OwnerOption = {
  id: string;
  name: string;
  email?: string;
};

type ClientOption = {
  id: string;
  name: string;
  segment?: string | null;
};

type CampaignOption = {
  id: string;
  name: string;
  client_id: string;
  client_name: string;
  status?: string;
  budget?: number | string | null;
};

type DealPatch = {
  campaign_id?: string | null;
  owner_id?: string | null;
  priority?: Priority;
  due_date?: string;
  stage?: StageId;
  tags?: string[];
  blocker?: string | null;
  is_archived?: boolean;
};

type FilterState = {
  owner: string;
  priorities: Priority[];
  tags: string[];
  dueDate: DueFilter;
  customFrom: string;
  customTo: string;
  showBlockedOnly: boolean;
  showStaleOnly: boolean;
  showLost: boolean;
};

type PendingMove = {
  dealId: string;
  targetStage: StageId;
};

type NewDealDraft = {
  stage: StageId;
  clientId: string;
  campaignId: string;
  ownerId: string;
  title: string;
  priority: Priority;
  dueDate: string;
};

const STAGES: Array<{ id: StageId; title: string; description: string }> = [
  { id: "backlog", title: "Backlog", description: "Parked or future pipeline" },
  { id: "qualified", title: "Qualified", description: "Budget and need confirmed" },
  { id: "proposal", title: "Proposal", description: "Quote sent, awaiting response" },
  { id: "negotiation", title: "Negotiation", description: "Terms in discussion" },
  { id: "closedWon", title: "Closed Won", description: "Deal signed" },
  { id: "closedLost", title: "Closed Lost", description: "Deal lost" },
];

const DEFAULT_FILTERS: FilterState = {
  owner: "all",
  priorities: [],
  tags: [],
  dueDate: "all",
  customFrom: "",
  customTo: "",
  showBlockedOnly: false,
  showStaleOnly: false,
  showLost: false,
};

const PRIORITIES: Priority[] = ["High", "Medium", "Low"];
const TAG_CHOICES = ["New Business", "Renewal", "Upsell", "Enterprise", "Pilot", "Expansion"];
const CARD_LIMIT = 20;
const FILTER_STORAGE_KEY = "cloudcrm-kanban-filters";
const DAY_MS = 24 * 60 * 60 * 1000;

const priorityColors: Record<Priority, { bg: string; text: string }> = {
  High: { bg: "#FAECE7", text: "#993C1D" },
  Medium: { bg: "#FAEEDA", text: "#854F0B" },
  Low: { bg: "#EAF3DE", text: "#3B6D11" },
};

const statusColors = {
  blocked: { bg: "#FCEBEB", text: "#A32D2D" },
  overdue: { bg: "#FAEEDA", text: "#854F0B" },
  stale: { bg: "#F1EFE8", text: "#5F5E5A" },
};

const avatarColors = ["#0F766E", "#0369A1", "#9333EA", "#BE123C", "#B45309", "#4338CA", "#15803D"];

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function relativeDate(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return dateInput(date);
}

function daysFromToday(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

function isClosed(stage: StageId) {
  return stage === "closedWon" || stage === "closedLost";
}

function isOverdue(deal: Deal) {
  return daysFromToday(deal.dueDate) < 0 && !isClosed(deal.stage);
}

function isStale(deal: Deal) {
  return daysFromToday(deal.lastActivityDate) <= -14 && !isClosed(deal.stage);
}

function isHistoryDeal(deal: Deal) {
  return isClosed(deal.stage) && daysFromToday(deal.dueDate) <= -90;
}

function dueLabel(date: string) {
  const days = daysFromToday(date);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "1 day overdue";
  if (days > 1 && days <= 7) return `in ${days} days`;
  if (days < -1 && days >= -7) return `${Math.abs(days)} days overdue`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: Math.abs(value) >= 100000 ? "compact" : "standard",
  }).format(value);
}

function ownerInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "NA";
}

function ownerColor(name: string) {
  const hash = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

function stageLabel(stage: StageId) {
  return STAGES.find((item) => item.id === stage)?.title || "Backlog";
}

function safeParseFilters(value: string | null): FilterState {
  if (!value) return DEFAULT_FILTERS;
  try {
    return { ...DEFAULT_FILTERS, ...JSON.parse(value) };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function OwnerAvatar({ name }: { name: string }) {
  return (
    <span
      title={name}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white font-bold"
      style={{ background: ownerColor(name), fontSize: 10 }}
      aria-label={`Owner ${name}`}
    >
      {ownerInitials(name)}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const colors = priorityColors[priority];
  return (
    <Badge className="border-0 rounded px-2 py-0.5" style={{ background: colors.bg, color: colors.text, fontSize: 10 }} aria-label={`Priority ${priority}`}>
      {priority}
    </Badge>
  );
}

function StatusBadge({ label, colors }: { label: string; colors: { bg: string; text: string } }) {
  return (
    <Badge className="border-0 rounded px-2 py-0.5 font-bold" style={{ background: colors.bg, color: colors.text, fontSize: 10 }} aria-label={label}>
      {label}
    </Badge>
  );
}

export function KanbanBoard({ search = "" }: { search?: string }) {
  const { apiFetch } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newDealDraft, setNewDealDraft] = useState<NewDealDraft | null>(null);
  const [filters, setFilters] = useState<FilterState>(() => {
    if (typeof window === "undefined") return DEFAULT_FILTERS;
    return safeParseFilters(window.sessionStorage.getItem(FILTER_STORAGE_KEY));
  });
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [focusedStage, setFocusedStage] = useState<StageId>("backlog");
  const [focusedDealId, setFocusedDealId] = useState<string | null>(null);
  const [visibleLimits, setVisibleLimits] = useState<Record<StageId, number>>({
    backlog: CARD_LIMIT,
    qualified: CARD_LIMIT,
    proposal: CARD_LIMIT,
    negotiation: CARD_LIMIT,
    closedWon: CARD_LIMIT,
    closedLost: CARD_LIMIT,
  });
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const loadDeals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/kanban/deals");
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to load Kanban deals");
      }
      const data = await response.json();
      setDeals(data.deals || []);
      setOwners(data.owners || []);
      setClients(data.clients || []);
      setCampaigns(data.campaigns || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load Kanban deals";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  useEffect(() => {
    window.sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  const activeDeals = useMemo(() => deals.filter((deal) => !isHistoryDeal(deal)), [deals]);
  const tags = useMemo(() => Array.from(new Set([...TAG_CHOICES, ...activeDeals.flatMap((deal) => deal.tags)])).sort(), [activeDeals]);

  const filteredDeals = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeDeals.filter((deal) => {
      if (query && !`${deal.title} ${deal.company} ${deal.segment} ${deal.owner} ${deal.tags.join(" ")}`.toLowerCase().includes(query)) return false;
      if (filters.owner !== "all" && deal.ownerId !== filters.owner) return false;
      if (filters.priorities.length > 0 && !filters.priorities.includes(deal.priority)) return false;
      if (filters.tags.length > 0 && !filters.tags.some((tagValue) => deal.tags.includes(tagValue))) return false;
      if (filters.showBlockedOnly && !deal.blocker) return false;
      if (filters.showStaleOnly && !isStale(deal)) return false;
      if (filters.dueDate === "week") {
        const days = daysFromToday(deal.dueDate);
        if (days < 0 || days > 7) return false;
      }
      if (filters.dueDate === "month") {
        const days = daysFromToday(deal.dueDate);
        if (days < 0 || days > 31) return false;
      }
      if (filters.dueDate === "overdue" && !isOverdue(deal)) return false;
      if (filters.dueDate === "custom") {
        if (filters.customFrom && deal.dueDate < filters.customFrom) return false;
        if (filters.customTo && deal.dueDate > filters.customTo) return false;
      }
      return true;
    });
  }, [activeDeals, filters, search]);

  const visibleStages = useMemo(() => STAGES.filter((stage) => filters.showLost || stage.id !== "closedLost"), [filters.showLost]);

  const stageCards = useMemo(() => {
    return STAGES.reduce<Record<StageId, Deal[]>>((acc, stage) => {
      acc[stage.id] = filteredDeals.filter((deal) => deal.stage === stage.id);
      return acc;
    }, { backlog: [], qualified: [], proposal: [], negotiation: [], closedWon: [], closedLost: [] });
  }, [filteredDeals]);

  const selectedDeal = selectedDealId ? deals.find((deal) => deal.id === selectedDealId) || null : null;
  const moveDeal = pendingMove ? deals.find((deal) => deal.id === pendingMove.dealId) || null : null;
  const activeFilterPills = getActiveFilterPills(filters, owners);

  function patchFilters(update: Partial<FilterState>) {
    setFilters((current) => ({ ...current, ...update }));
  }

  function replaceDeal(nextDeal: Deal) {
    setDeals((current) => current.map((deal) => (deal.id === nextDeal.id ? nextDeal : deal)));
  }

  async function patchDeal(dealId: string, patch: DealPatch, successMessage?: string) {
    setSaving(true);
    try {
      const response = await apiFetch(`/api/kanban/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to update deal");
      if (data.deal) replaceDeal(data.deal);
      if (successMessage) toast.success(successMessage);
      return data.deal as Deal | undefined;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update deal");
      return undefined;
    } finally {
      setSaving(false);
    }
  }

  function requestStageMove(dealId: string, targetStage: StageId) {
    const deal = deals.find((item) => item.id === dealId);
    if (!deal || deal.stage === targetStage) return;
    setPendingMove({ dealId, targetStage });
  }

  async function confirmStageMove() {
    if (!pendingMove) return;
    const targetLabel = stageLabel(pendingMove.targetStage);
    const updated = await patchDeal(pendingMove.dealId, { stage: pendingMove.targetStage }, `Deal moved to ${targetLabel}.`);
    if (updated) {
      setFocusedStage(pendingMove.targetStage);
      setPendingMove(null);
    }
  }

  function openNewDeal(stage: StageId = focusedStage) {
    const firstClient = clients[0];
    const firstCampaign = firstClient ? campaigns.find((campaign) => campaign.client_id === firstClient.id) : undefined;
    setNewDealDraft({
      stage,
      clientId: firstClient?.id || "",
      campaignId: firstCampaign?.id || "none",
      ownerId: owners[0]?.id || "none",
      title: "",
      priority: "Medium",
      dueDate: relativeDate(14),
    });
  }

  async function submitNewDeal(draft: NewDealDraft) {
    if (!draft.clientId && draft.campaignId === "none") {
      toast.error("Select a client or campaign.");
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch("/api/kanban/deals", {
        method: "POST",
        body: JSON.stringify({
          stage: draft.stage,
          client_id: draft.clientId || undefined,
          campaign_id: draft.campaignId === "none" ? null : draft.campaignId,
          owner_id: draft.ownerId === "none" ? null : draft.ownerId,
          title: draft.title.trim() || undefined,
          priority: draft.priority,
          due_date: draft.dueDate,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to create deal");
      const nextDeal = data.deal as Deal;
      setDeals((current) => [nextDeal, ...current.filter((deal) => deal.id !== nextDeal.id)]);
      setFocusedStage(draft.stage);
      setFocusedDealId(nextDeal.id);
      setSelectedDealId(nextDeal.id);
      setNewDealDraft(null);
      toast.success(`Deal created in ${stageLabel(draft.stage)}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create deal");
    } finally {
      setSaving(false);
    }
  }

  async function archiveDeal(dealId: string) {
    const deal = deals.find((item) => item.id === dealId);
    setSaving(true);
    try {
      const response = await apiFetch(`/api/kanban/deals/${dealId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to archive deal");
      setDeals((current) => current.filter((item) => item.id !== dealId));
      if (selectedDealId === dealId) setSelectedDealId(null);
      toast.success(`${deal?.title || "Deal"} archived.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to archive deal");
    } finally {
      setSaving(false);
    }
  }

  function focusDeal(dealId: string | undefined) {
    if (!dealId) return;
    requestAnimationFrame(() => cardRefs.current[dealId]?.focus());
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLButtonElement>, deal: Deal) {
    if (event.key === "Enter" || event.key.toLowerCase() === "e") {
      event.preventDefault();
      setSelectedDealId(deal.id);
      return;
    }
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;

    event.preventDefault();
    const currentStageIndex = visibleStages.findIndex((stage) => stage.id === deal.stage);
    const cards = stageCards[deal.stage].slice(0, visibleLimits[deal.stage]);
    const cardIndex = cards.findIndex((item) => item.id === deal.id);

    if (event.key === "ArrowUp") focusDeal(cards[Math.max(0, cardIndex - 1)]?.id);
    if (event.key === "ArrowDown") focusDeal(cards[Math.min(cards.length - 1, cardIndex + 1)]?.id);
    if (event.key === "ArrowLeft") {
      const previousStage = visibleStages[Math.max(0, currentStageIndex - 1)]?.id;
      focusDeal(previousStage ? stageCards[previousStage][Math.min(cardIndex, stageCards[previousStage].length - 1)]?.id : undefined);
    }
    if (event.key === "ArrowRight") {
      const nextStage = visibleStages[Math.min(visibleStages.length - 1, currentStageIndex + 1)]?.id;
      focusDeal(nextStage ? stageCards[nextStage][Math.min(cardIndex, stageCards[nextStage].length - 1)]?.id : undefined);
    }
  }

  function handleBoardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      openNewDeal(focusedStage);
    }
    if (event.key.toLowerCase() === "e" && focusedDealId) {
      event.preventDefault();
      setSelectedDealId(focusedDealId);
    }
  }

  function togglePriority(priority: Priority) {
    patchFilters({
      priorities: filters.priorities.includes(priority)
        ? filters.priorities.filter((item) => item !== priority)
        : [...filters.priorities, priority],
    });
  }

  function toggleTag(tagValue: string) {
    patchFilters({
      tags: filters.tags.includes(tagValue)
        ? filters.tags.filter((item) => item !== tagValue)
        : [...filters.tags, tagValue],
    });
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center rounded-xl bg-white text-slate-500" style={{ border: "1px solid #E2E8F0", fontSize: 13 }}>
        Loading Kanban board
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[520px] flex-col items-center justify-center gap-3 rounded-xl bg-white text-center" style={{ border: "1px solid #E2E8F0" }}>
        <p className="text-slate-800 font-semibold" style={{ fontSize: 14 }}>Kanban data could not load</p>
        <p className="max-w-md text-slate-500" style={{ fontSize: 12 }}>{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={loadDeals}>
          <RefreshCw size={14} />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 data-enter" onKeyDown={handleBoardKeyDown} tabIndex={-1}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>Kanban Board</h1>
          <p className="text-slate-500" style={{ fontSize: 12 }}>
            {filteredDeals.length} visible deals across {visibleStages.length} stages
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-slate-600" style={{ fontSize: 12 }}>
            <Switch
              checked={filters.showLost}
              onCheckedChange={(checked) => patchFilters({ showLost: checked })}
              aria-label="Show closed lost deals"
            />
            Show lost
          </label>
          <Button type="button" size="sm" onClick={() => openNewDeal()} disabled={clients.length === 0} className="bg-indigo-500 text-white hover:bg-indigo-600">
            <Plus size={14} />
            New deal
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-white p-3 shadow-sm" style={{ border: "1px solid #E2E8F0" }}>
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(160px,1fr)_minmax(220px,1.4fr)_minmax(160px,1fr)_auto_auto_auto] xl:items-center">
          <Select value={filters.owner} onValueChange={(value) => patchFilters({ owner: value })}>
            <SelectTrigger className="h-9 bg-white border-slate-200" style={{ fontSize: 12 }} aria-label="Owner filter">
              <SelectValue placeholder="All owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {owners.map((owner) => <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map((priority) => {
              const active = filters.priorities.includes(priority);
              return (
                <button
                  key={priority}
                  type="button"
                  onClick={() => togglePriority(priority)}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 font-semibold transition-colors"
                  style={{
                    borderColor: active ? priorityColors[priority].text : "#E2E8F0",
                    background: active ? priorityColors[priority].bg : "#FFFFFF",
                    color: active ? priorityColors[priority].text : "#475569",
                    fontSize: 11,
                  }}
                >
                  {active && <Check size={12} />}
                  {priority}
                </button>
              );
            })}
          </div>

          <Select value={filters.dueDate} onValueChange={(value) => patchFilters({ dueDate: value as DueFilter })}>
            <SelectTrigger className="h-9 bg-white border-slate-200" style={{ fontSize: 12 }} aria-label="Due date filter">
              <SelectValue placeholder="Due date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any due date</SelectItem>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>

          <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600" style={{ fontSize: 11 }}>
            <Switch checked={filters.showBlockedOnly} onCheckedChange={(checked) => patchFilters({ showBlockedOnly: checked })} aria-label="Show only blocked deals" />
            Blocked
          </label>

          <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600" style={{ fontSize: 11 }}>
            <Switch checked={filters.showStaleOnly} onCheckedChange={(checked) => patchFilters({ showStaleOnly: checked })} aria-label="Show only stale deals" />
            Stale
          </label>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            disabled={activeFilterPills.length === 0}
            className="h-9 border-slate-200 text-slate-600"
          >
            Clear all
          </Button>
        </div>

        {filters.dueDate === "custom" && (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:max-w-md">
            <Input type="date" value={filters.customFrom} onChange={(event) => patchFilters({ customFrom: event.target.value })} className="h-9 bg-white border-slate-200" aria-label="Custom due date from" />
            <Input type="date" value={filters.customTo} onChange={(event) => patchFilters({ customTo: event.target.value })} className="h-9 bg-white border-slate-200" aria-label="Custom due date to" />
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.slice(0, 10).map((tagValue) => {
            const active = filters.tags.includes(tagValue);
            return (
              <button
                key={tagValue}
                type="button"
                onClick={() => toggleTag(tagValue)}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-slate-600 transition-colors"
                style={{ borderColor: active ? "#6366F1" : "#E2E8F0", background: active ? "#EEF2FF" : "#FFFFFF", color: active ? "#4338CA" : "#475569", fontSize: 10 }}
              >
                <Tag size={10} />
                {tagValue}
              </button>
            );
          })}
        </div>

        {activeFilterPills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeFilterPills.map((pill) => (
              <button
                key={pill.key}
                type="button"
                onClick={() => clearFilter(pill.key, filters, setFilters)}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600 hover:bg-slate-200"
                style={{ fontSize: 10 }}
              >
                {pill.label}
                <X size={10} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="grid min-h-0 flex-1 gap-3 overflow-y-auto pb-2"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
      >
        {visibleStages.map((stage) => {
          const cards = stageCards[stage.id];
          const visibleCards = cards.slice(0, visibleLimits[stage.id]);
          const totalValue = cards.reduce((sum, deal) => sum + deal.value, 0);

          return (
            <section
              key={stage.id}
              className="flex min-h-[520px] min-w-0 flex-col rounded-xl"
              style={{ background: "#F6F4EF", border: "1px solid #E6E0D6" }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const dealId = event.dataTransfer.getData("text/plain") || draggedDealId;
                if (dealId) requestStageMove(dealId, stage.id);
                setDraggedDealId(null);
              }}
              onFocus={() => setFocusedStage(stage.id)}
              tabIndex={-1}
              aria-label={`${stage.title} column with ${cards.length} cards`}
            >
              <div className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-slate-800 font-bold" style={{ fontSize: 13 }}>{stage.title}</h2>
                    <Badge className="rounded-full border-0 bg-white text-slate-500" style={{ fontSize: 10 }} aria-label={`${cards.length} cards in ${stage.title}`}>
                      {cards.length}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-slate-500" style={{ fontSize: 10 }}>{stage.description}</p>
                </div>
                <button type="button" onClick={() => openNewDeal(stage.id)} disabled={clients.length === 0} className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-40" aria-label={`Add deal to ${stage.title}`}>
                  <Plus size={14} />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {visibleCards.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    owners={owners}
                    setRef={(node) => {
                      cardRefs.current[deal.id] = node;
                    }}
                    onOpen={() => setSelectedDealId(deal.id)}
                    onFocus={() => {
                      setFocusedStage(deal.stage);
                      setFocusedDealId(deal.id);
                    }}
                    onKeyDown={(event) => handleCardKeyDown(event, deal)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", deal.id);
                      setDraggedDealId(deal.id);
                    }}
                    onMove={requestStageMove}
                    onPatch={(patch) => patchDeal(deal.id, patch)}
                    onArchive={() => archiveDeal(deal.id)}
                  />
                ))}

                {cards.length === 0 && (
                  <button
                    type="button"
                    onClick={() => stage.id === "backlog" && openNewDeal(stage.id)}
                    disabled={clients.length === 0}
                    className="flex min-h-[112px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/40 text-slate-400 disabled:opacity-50"
                    style={{ fontSize: 12 }}
                  >
                    {stage.id === "backlog" ? "+ Add deal" : "No deals here"}
                  </button>
                )}

                {visibleCards.length < cards.length && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-slate-200 bg-white text-slate-600"
                    onClick={() => setVisibleLimits((current) => ({ ...current, [stage.id]: current[stage.id] + CARD_LIMIT }))}
                  >
                    Load more
                  </Button>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-slate-200 px-3 py-2 text-slate-500" style={{ fontSize: 11 }}>
                <span>{fmtMoney(totalValue)}</span>
                <span>{cards.length} cards</span>
              </div>
            </section>
          );
        })}
      </div>

      <NewDealDialog
        draft={newDealDraft}
        clients={clients}
        campaigns={campaigns}
        owners={owners}
        saving={saving}
        onChange={setNewDealDraft}
        onClose={() => setNewDealDraft(null)}
        onSubmit={submitNewDeal}
      />

      <DealDetailSheet
        deal={selectedDeal}
        owners={owners}
        onClose={() => setSelectedDealId(null)}
        onPatch={patchDeal}
        onMove={(dealId, stage) => requestStageMove(dealId, stage)}
      />

      <Dialog open={Boolean(pendingMove)} onOpenChange={(open) => !open && setPendingMove(null)}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Move deal</DialogTitle>
            <DialogDescription>
              {moveDeal && pendingMove ? `Move ${moveDeal.title} to ${stageLabel(pendingMove.targetStage)}?` : "Move this deal?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingMove(null)}>Cancel</Button>
            <Button type="button" onClick={confirmStageMove} disabled={saving} className="bg-indigo-500 text-white hover:bg-indigo-600">Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DealCard({
  deal,
  owners,
  setRef,
  onOpen,
  onFocus,
  onKeyDown,
  onDragStart,
  onMove,
  onPatch,
  onArchive,
}: {
  deal: Deal;
  owners: OwnerOption[];
  setRef: (node: HTMLButtonElement | null) => void;
  onOpen: () => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onMove: (dealId: string, stage: StageId) => void;
  onPatch: (patch: DealPatch) => void;
  onArchive: () => void;
}) {
  const overdue = isOverdue(deal);
  const stale = isStale(deal);
  const blocked = Boolean(deal.blocker);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          ref={setRef}
          type="button"
          draggable
          onDragStart={onDragStart}
          onClick={onOpen}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          className="group relative w-full rounded-lg bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-indigo-300"
          style={{
            border: blocked ? "0.5px solid #F09595" : "0.5px solid #D8DDE6",
            borderLeft: blocked ? "2px solid #F09595" : "0.5px solid #D8DDE6",
          }}
          aria-label={`${deal.title}, ${deal.company}, ${deal.priority} priority`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-2 text-slate-900 font-bold" style={{ fontSize: 13 }}>
                {deal.title.length > 60 ? `${deal.title.slice(0, 57)}...` : deal.title}
              </p>
              <p className="mt-1 truncate text-slate-500" style={{ fontSize: 11 }}>
                {deal.company} - {deal.segment}
              </p>
            </div>
            <GripVertical size={14} className="mt-0.5 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={deal.priority} />
            {blocked && <StatusBadge label="BLOCKED" colors={statusColors.blocked} />}
            {overdue && <StatusBadge label="OVERDUE" colors={statusColors.overdue} />}
            {stale && <StatusBadge label="STALE" colors={statusColors.stale} />}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <OwnerAvatar name={deal.owner} />
              <span className="truncate text-slate-600" style={{ fontSize: 11 }}>{deal.owner}</span>
            </div>
            <span className="shrink-0 font-bold text-slate-900" style={{ fontSize: 12 }}>{fmtMoney(deal.value)}</span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1 ${overdue ? "text-red-600" : "text-slate-500"}`} style={{ fontSize: 11 }}>
              <Clock size={11} />
              {dueLabel(deal.dueDate)}
            </span>
            <span className="text-slate-400" style={{ fontSize: 10 }}>{deal.probability}%</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {deal.tags.slice(0, 2).map((tagValue) => (
              <span key={tagValue} className="rounded bg-slate-100 px-2 py-0.5 text-slate-500" style={{ fontSize: 10 }}>{tagValue}</span>
            ))}
          </div>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-white">
        <ContextMenuSub>
          <ContextMenuSubTrigger>Change owner</ContextMenuSubTrigger>
          <ContextMenuSubContent className="bg-white">
            {owners.map((owner) => (
              <ContextMenuItem key={owner.id} onSelect={() => onPatch({ owner_id: owner.id })}>
                <UserRound size={14} />
                {owner.name}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Change priority</ContextMenuSubTrigger>
          <ContextMenuSubContent className="bg-white">
            {PRIORITIES.map((priority) => (
              <ContextMenuItem key={priority} onSelect={() => onPatch({ priority })}>
                <Flag size={14} />
                {priority}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Set due date</ContextMenuSubTrigger>
          <ContextMenuSubContent className="bg-white">
            <ContextMenuItem onSelect={() => onPatch({ due_date: relativeDate(1) })}>
              <CalendarDays size={14} />
              Tomorrow
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onPatch({ due_date: relativeDate(7) })}>
              <CalendarDays size={14} />
              In 7 days
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onPatch({ due_date: relativeDate(30) })}>
              <CalendarDays size={14} />
              In 30 days
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Add tag</ContextMenuSubTrigger>
          <ContextMenuSubContent className="bg-white">
            {TAG_CHOICES.map((tagValue) => (
              <ContextMenuItem key={tagValue} onSelect={() => onPatch({ tags: Array.from(new Set([...deal.tags, tagValue])).slice(0, 6) })}>
                <Tag size={14} />
                {tagValue}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem
          onSelect={() => onPatch({ blocker: deal.blocker ? null : "Needs follow-up before the deal can move." })}
        >
          <Flag size={14} />
          {deal.blocker ? "Remove blocker" : "Mark blocked"}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Move to column</ContextMenuSubTrigger>
          <ContextMenuSubContent className="bg-white">
            {STAGES.filter((stage) => stage.id !== deal.stage).map((stage) => (
              <ContextMenuItem key={stage.id} onSelect={() => onMove(deal.id, stage.id)}>
                {stage.title}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={onArchive}>
          <Archive size={14} />
          Archive
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function NewDealDialog({
  draft,
  clients,
  campaigns,
  owners,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: NewDealDraft | null;
  clients: ClientOption[];
  campaigns: CampaignOption[];
  owners: OwnerOption[];
  saving: boolean;
  onChange: (draft: NewDealDraft | null) => void;
  onClose: () => void;
  onSubmit: (draft: NewDealDraft) => void;
}) {
  const filteredCampaigns = useMemo(() => {
    if (!draft?.clientId) return campaigns;
    return campaigns.filter((campaign) => campaign.client_id === draft.clientId);
  }, [campaigns, draft?.clientId]);

  function patch(update: Partial<NewDealDraft>) {
    if (!draft) return;
    onChange({ ...draft, ...update });
  }

  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-white sm:max-w-xl">
        {draft && (
          <>
            <DialogHeader>
              <DialogTitle>New deal</DialogTitle>
              <DialogDescription>Select a campaign or client before creating the card.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <QuickField label="Campaign">
                <Select
                  value={draft.campaignId}
                  onValueChange={(campaignId) => {
                    const campaign = campaigns.find((item) => item.id === campaignId);
                    patch({
                      campaignId,
                      clientId: campaign?.client_id || draft.clientId,
                      title: campaign && !draft.title ? `${campaign.client_name} ${campaign.name}` : draft.title,
                    });
                  }}
                >
                  <SelectTrigger className="h-9 bg-white border-slate-200" style={{ fontSize: 12 }}>
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No campaign</SelectItem>
                    {filteredCampaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.client_name} - {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </QuickField>

              <QuickField label="Client">
                <Select
                  value={draft.clientId || undefined}
                  onValueChange={(clientId) => {
                    const nextCampaign = campaigns.find((campaign) => campaign.id === draft.campaignId && campaign.client_id === clientId);
                    patch({ clientId, campaignId: nextCampaign ? draft.campaignId : "none" });
                  }}
                >
                  <SelectTrigger className="h-9 bg-white border-slate-200" style={{ fontSize: 12 }}>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </QuickField>

              <QuickField label="Owner">
                <Select value={draft.ownerId} onValueChange={(ownerId) => patch({ ownerId })}>
                  <SelectTrigger className="h-9 bg-white border-slate-200" style={{ fontSize: 12 }}>
                    <SelectValue placeholder="Owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {owners.map((owner) => <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </QuickField>

              <QuickField label="Stage">
                <Select value={draft.stage} onValueChange={(stage) => patch({ stage: stage as StageId })}>
                  <SelectTrigger className="h-9 bg-white border-slate-200" style={{ fontSize: 12 }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </QuickField>

              <QuickField label="Priority">
                <Select value={draft.priority} onValueChange={(priority) => patch({ priority: priority as Priority })}>
                  <SelectTrigger className="h-9 bg-white border-slate-200" style={{ fontSize: 12 }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}
                  </SelectContent>
                </Select>
              </QuickField>

              <QuickField label="Due date">
                <Input type="date" value={draft.dueDate} onChange={(event) => patch({ dueDate: event.target.value })} className="h-9 bg-white border-slate-200" />
              </QuickField>

              <div className="sm:col-span-2">
                <QuickField label="Title">
                  <Input
                    value={draft.title}
                    onChange={(event) => patch({ title: event.target.value })}
                    placeholder="Leave blank to generate from campaign or client"
                    className="h-9 bg-white border-slate-200"
                  />
                </QuickField>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="button" onClick={() => onSubmit(draft)} disabled={saving || (!draft.clientId && draft.campaignId === "none")} className="bg-indigo-500 text-white hover:bg-indigo-600">
                Create deal
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DealDetailSheet({
  deal,
  owners,
  onClose,
  onPatch,
  onMove,
}: {
  deal: Deal | null;
  owners: OwnerOption[];
  onClose: () => void;
  onPatch: (dealId: string, patch: DealPatch, successMessage?: string) => void;
  onMove: (dealId: string, stage: StageId) => void;
}) {
  return (
    <Sheet open={Boolean(deal)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-white sm:max-w-xl">
        {deal && (
          <>
            <SheetHeader className="border-b border-slate-100 p-5 pr-12">
              <SheetTitle className="text-slate-900" style={{ fontSize: 18 }}>{deal.title}</SheetTitle>
              <SheetDescription>
                {deal.company} - {deal.segment}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-5 pb-6">
              <div className="grid grid-cols-2 gap-3">
                <DetailMetric label="Deal value" value={fmtMoney(deal.value)} />
                <DetailMetric label="Probability" value={`${deal.probability}%`} />
                <DetailMetric label="Due date" value={dueLabel(deal.dueDate)} tone={isOverdue(deal) ? "danger" : undefined} />
                <DetailMetric label="Last activity" value={dueLabel(deal.lastActivityDate)} />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <QuickField label="Owner">
                  <Select value={deal.ownerId || undefined} onValueChange={(ownerId) => onPatch(deal.id, { owner_id: ownerId })}>
                    <SelectTrigger className="h-9 bg-white border-slate-200" style={{ fontSize: 12 }}>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((owner) => <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </QuickField>
                <QuickField label="Priority">
                  <Select value={deal.priority} onValueChange={(priority) => onPatch(deal.id, { priority: priority as Priority })}>
                    <SelectTrigger className="h-9 bg-white border-slate-200" style={{ fontSize: 12 }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </QuickField>
                <QuickField label="Due date">
                  <Input type="date" value={deal.dueDate} onChange={(event) => onPatch(deal.id, { due_date: event.target.value })} className="h-9 bg-white border-slate-200" />
                </QuickField>
                <QuickField label="Stage">
                  <Select value={deal.stage} onValueChange={(stage) => onMove(deal.id, stage as StageId)}>
                    <SelectTrigger className="h-9 bg-white border-slate-200" style={{ fontSize: 12 }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </QuickField>
              </div>

              <section className="rounded-lg border border-slate-200 p-3">
                <h3 className="font-bold text-slate-800" style={{ fontSize: 13 }}>Contact</h3>
                <p className="mt-2 text-slate-700" style={{ fontSize: 12 }}>{deal.contactName}</p>
                <p className="text-slate-500" style={{ fontSize: 12 }}>{deal.contactEmail || "No email on file"}</p>
              </section>

              <section className="rounded-lg border border-slate-200 p-3">
                <h3 className="font-bold text-slate-800" style={{ fontSize: 13 }}>Notes</h3>
                <p className="mt-2 text-slate-600" style={{ fontSize: 12 }}>{deal.notes || "No notes yet."}</p>
                <p className="mt-3 text-slate-500" style={{ fontSize: 11 }}>{deal.lastActivityNote}</p>
                {deal.blocker && (
                  <p className="mt-3 rounded-md px-2 py-1.5" style={{ background: "#FCEBEB", color: "#A32D2D", fontSize: 11 }}>
                    {deal.blocker}
                  </p>
                )}
              </section>

              <section className="rounded-lg border border-slate-200 p-3">
                <h3 className="font-bold text-slate-800" style={{ fontSize: 13 }}>Activity log</h3>
                <div className="mt-3 flex flex-col gap-3">
                  {deal.activityLog.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
                      <div>
                        <p className="text-slate-700" style={{ fontSize: 12 }}>{entry.text}</p>
                        <p className="text-slate-400" style={{ fontSize: 10 }}>
                          {entry.actor} - {new Date(entry.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {deal.activityLog.length === 0 && (
                    <p className="text-slate-400" style={{ fontSize: 12 }}>No activity yet.</p>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailMetric({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-slate-400" style={{ fontSize: 10 }}>{label}</p>
      <p className={tone === "danger" ? "font-bold text-red-600" : "font-bold text-slate-800"} style={{ fontSize: 13 }}>{value}</p>
    </div>
  );
}

function QuickField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-slate-500 font-semibold" style={{ fontSize: 11 }}>{label}</span>
      {children}
    </label>
  );
}

function getActiveFilterPills(filters: FilterState, owners: OwnerOption[]) {
  const pills: Array<{ key: string; label: string }> = [];
  if (filters.owner !== "all") pills.push({ key: "owner", label: owners.find((owner) => owner.id === filters.owner)?.name || "Owner" });
  filters.priorities.forEach((priority) => pills.push({ key: `priority:${priority}`, label: priority }));
  filters.tags.forEach((tagValue) => pills.push({ key: `tag:${tagValue}`, label: tagValue }));
  if (filters.dueDate !== "all") pills.push({ key: "dueDate", label: filters.dueDate === "week" ? "This week" : filters.dueDate === "month" ? "This month" : filters.dueDate === "overdue" ? "Overdue" : "Custom range" });
  if (filters.showBlockedOnly) pills.push({ key: "showBlockedOnly", label: "Blocked" });
  if (filters.showStaleOnly) pills.push({ key: "showStaleOnly", label: "Stale" });
  return pills;
}

function clearFilter(key: string, filters: FilterState, setFilters: (value: FilterState) => void) {
  if (key === "owner") setFilters({ ...filters, owner: "all" });
  else if (key.startsWith("priority:")) setFilters({ ...filters, priorities: filters.priorities.filter((item) => item !== key.replace("priority:", "")) });
  else if (key.startsWith("tag:")) setFilters({ ...filters, tags: filters.tags.filter((item) => item !== key.replace("tag:", "")) });
  else if (key === "dueDate") setFilters({ ...filters, dueDate: "all", customFrom: "", customTo: "" });
  else if (key === "showBlockedOnly") setFilters({ ...filters, showBlockedOnly: false });
  else if (key === "showStaleOnly") setFilters({ ...filters, showStaleOnly: false });
}
