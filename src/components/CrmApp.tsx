"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { todayStrIST } from "@/lib/geo";
import { LEAD_STAGES, stageRequiresBudget } from "@/lib/leadStages";

const STAGES = LEAD_STAGES;
const EVENT_TYPES = ["Call", "Meeting", "Site Visit", "Builder Meeting"] as const;
const DOC_TYPES = ["Brochure", "Price Sheet", "Floor Plan", "Legal Document", "RERA PDF"] as const;
const CONTACT_TYPES = ["Buyer", "Builder", "Vendor", "Seller", "Broker"] as const;
const LEAD_STATUSES = ["Open", "On Hold", "Won", "Lost"] as const;
const LEAD_STATUS_COLORS: Record<string, string> = {
  Open: "#3b82f6",
  "On Hold": "#f59e0b",
  Won: "#22c55e",
  Lost: "#ef4444",
};
const LOSS_REASONS = [
  "Disqualified",
  "Rejected",
  "Budget Mismatch",
  "Not Interested",
  "No Response",
  "Lost to Competitor",
  "Other",
] as const;
const INTERACTION_TYPES = [
  "Call",
  "WhatsApp",
  "Meeting",
  "Email",
  "Site Visit",
  "Note",
  "Document Shared",
  "Stage Change",
  "Deal Update",
] as const;
const INTERACTION_ICONS: Record<string, string> = {
  Call: "📞",
  WhatsApp: "💬",
  Meeting: "🤝",
  Email: "✉️",
  "Site Visit": "🏠",
  Note: "📝",
  "Document Shared": "📄",
  "Stage Change": "🔀",
  "Deal Update": "💰",
};

type Lead = {
  id: string;
  name: string;
  phone: string;
  interest: string | null;
  propertyType: string | null;
  budgetRange: string | null;
  preferredLocation: string | null;
  stage: string;
  status: string;
  lossReason: string | null;
  source: string | null;
  notes: string | null;
  contactId: string | null;
  assignedToId: string | null;
  assignedTo?: { id: string; name: string | null; email: string } | null;
  createdAt: string;
};
type BuyerDetails = {
  budget: string | null;
  preferredLocation: string | null;
  needs: string | null;
  status: string;
  nextFollowUp: string | null;
};
type BuilderDetails = {
  projects: string | null;
  commissionStructure: string | null;
  lastVisited: string | null;
  nextVisit: string | null;
  brochureLink: string | null;
};
type BrokerDetails = {
  agencyName: string | null;
  commissionSplit: string | null;
  status: string;
};
type VendorDetails = {
  serviceType: string | null;
  rateCardRef: string | null;
  status: string;
};
type SellerDetails = {
  propertyRef: string | null;
  askingPrice: string | null;
  status: string;
};
type Contact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  types: string[];
  company: string | null;
  tags: string | null;
  createdAt: string;
  buyerDetails: BuyerDetails | null;
  builderDetails: BuilderDetails | null;
  brokerDetails: BrokerDetails | null;
  vendorDetails: VendorDetails | null;
  sellerDetails: SellerDetails | null;
};
type Interaction = {
  id: string;
  contactId: string;
  type: string;
  content: string;
  createdBy: string | null;
  createdAt: string;
};
type Project = {
  id: string;
  name: string;
  builder: string | null;
  builderId: string | null;
  builderContact?: { id: string; name: string } | null;
  price: string | null;
  photo: string | null;
  brochureLink: string | null;
  floorPlanLink: string | null;
  amenities: string | null;
  nearby: string | null;
  commission: string | null;
  notes: string | null;
};
type EventItem = {
  id: string;
  title: string;
  type: string;
  date: string;
  time: string | null;
  projectId: string | null;
  project?: { id: string; name: string } | null;
};
type Task = {
  id: string;
  title: string;
  dueDate: string | null;
  status: string; // pending, done, snoozed
  contactId: string | null;
};
type DocumentItem = {
  id: string;
  name: string;
  type: string;
  link: string;
};

type Tab =
  | "dashboard"
  | "leads"
  | "contacts"
  | "projects"
  | "calendar"
  | "tasks"
  | "docs"
  | "team"
  | "reports"
  | "ai"
  | "settings";

type ModalState =
  | { type: "lead"; entity: Partial<Lead> }
  | { type: "contact"; entity: Partial<Contact> }
  | { type: "project"; entity: Partial<Project> }
  | { type: "event"; entity: Partial<EventItem> }
  | { type: "task"; entity: Partial<Task> }
  | { type: "doc"; entity: Partial<DocumentItem> }
  | { type: "interaction"; contactId: string }
  | { type: "whatsapp"; project: Project };

function esc(s: string | null | undefined) {
  return s || "";
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
// Extracts the yyyy-mm-dd portion from either a plain date string or a full
// ISO datetime string, so DateTime fields (e.g. Task.dueDate, nextFollowUp,
// nextVisit) can be compared against todayStr() consistently.
function dateOnlyStr(d: string | null | undefined) {
  return d ? d.slice(0, 10) : null;
}
function isToday(d: string | null) {
  return dateOnlyStr(d) === todayStr();
}
function isOverdue(d: string | null) {
  const day = dateOnlyStr(d);
  return !!day && day < todayStr();
}
function isUpcoming(d: string | null) {
  const day = dateOnlyStr(d);
  return !!day && day > todayStr();
}
function fmt(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function normalizePhone(phone: string) {
  let digits = (phone || "").replace(/[^0-9]/g, "");
  if (digits.length === 10) digits = "91" + digits;
  return digits;
}
function waLink(phone: string) {
  return "https://wa.me/" + normalizePhone(phone);
}

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json" } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Request failed");
  }
  return res.json();
}

function compressImage(file: File, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---- CSV export ----
function csvValue(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const lines = [headers.map(csvValue).join(","), ...rows.map((r) => r.map(csvValue).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function CrmApp({
  currentUser,
}: {
  currentUser: { name: string | null; email: string; role: string; attendanceEnabled?: boolean };
}) {
  const isOwner = currentUser.role !== "Employee";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);

  function loadTeamUsers() {
    api<TeamUser[]>("/api/settings/users")
      .then(setTeamUsers)
      .catch(() => {});
  }

  useEffect(() => {
    if (isOwner) loadTeamUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  const [tab, setTab] = useState<Tab>("dashboard");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: string; id: string; label: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [contactDetail, setContactDetail] = useState<(Contact & { interactions: Interaction[] }) | null>(null);
  const [contactTypeFilter, setContactTypeFilter] = useState<string>("");
  const [contactSearch, setContactSearch] = useState("");

  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const aiMessagesRef = useRef<HTMLDivElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  async function loadAll() {
    const [l, c, p, e, t, d] = await Promise.all([
      api<Lead[]>("/api/leads"),
      api<Contact[]>("/api/contacts"),
      api<Project[]>("/api/projects"),
      api<EventItem[]>("/api/events"),
      api<Task[]>("/api/tasks"),
      api<DocumentItem[]>("/api/documents"),
    ]);
    setLeads(l);
    setContacts(c);
    setProjects(p);
    setEvents(e);
    setTasks(t);
    setDocs(d);
    setLoaded(true);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function loadContactDetail(id: string) {
    const full = await api<Contact & { interactions: Interaction[] }>(`/api/contacts/${id}`);
    setContactDetail(full);
  }

  function openContact(id: string) {
    setTab("contacts");
    setSelectedContactId(id);
    loadContactDetail(id);
  }

  // ---- CRUD helpers ----
  async function saveLead(data: Partial<Lead>) {
    if (data.id) {
      const updated = await api<Lead>(`/api/leads/${data.id}`, { method: "PUT", body: JSON.stringify(data) });
      setLeads((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } else {
      const created = await api<Lead & { duplicate?: boolean }>("/api/leads", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (created.duplicate) {
        showToast(`${created.name} already has an open lead — opening that instead of creating a new one`);
        setLeads((prev) => prev.map((x) => (x.id === created.id ? created : x)));
      } else {
        setLeads((prev) => [created, ...prev]);
      }
      loadAll();
    }
    setModal(null);
  }

  async function saveContact(data: Partial<Contact> & Record<string, unknown>) {
    if (data.id) {
      const updated = await api<Contact>(`/api/contacts/${data.id}`, { method: "PUT", body: JSON.stringify(data) });
      setContacts((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      if (selectedContactId === updated.id) loadContactDetail(updated.id);
    } else {
      const created = await api<Contact>("/api/contacts", { method: "POST", body: JSON.stringify(data) });
      setContacts((prev) => [created, ...prev]);
    }
    setModal(null);
  }

  async function saveProject(data: Partial<Project>) {
    if (data.id) {
      const updated = await api<Project>(`/api/projects/${data.id}`, { method: "PUT", body: JSON.stringify(data) });
      setProjects((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } else {
      const created = await api<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) });
      setProjects((prev) => [created, ...prev]);
    }
    setModal(null);
  }
  async function saveEvent(data: Partial<EventItem>) {
    if (data.id) {
      const updated = await api<EventItem>(`/api/events/${data.id}`, { method: "PUT", body: JSON.stringify(data) });
      setEvents((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } else {
      const created = await api<EventItem>("/api/events", { method: "POST", body: JSON.stringify(data) });
      setEvents((prev) => [created, ...prev]);
    }
    setModal(null);
  }
  async function saveTask(data: Partial<Task>) {
    const created = await api<Task>("/api/tasks", { method: "POST", body: JSON.stringify(data) });
    setTasks((prev) => [created, ...prev]);
    setModal(null);
  }

  async function setDeadLeadRecheck(contactId: string, contactName: string) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 60);
    const created = await api<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: `Recheck cold lead: ${contactName}`,
        dueDate: dueDate.toISOString().slice(0, 10),
        contactId,
        recurrenceFreq: "daily",
        recurrenceInterval: 60,
        recurringUntilCancelled: true,
      }),
    });
    setTasks((prev) => [created, ...prev]);
    showToast("Dead lead recheck set — will resurface every 60 days");
  }
  async function saveDoc(data: Partial<DocumentItem>) {
    const created = await api<DocumentItem>("/api/documents", { method: "POST", body: JSON.stringify(data) });
    setDocs((prev) => [created, ...prev]);
    setModal(null);
  }

  async function logInteraction(contactId: string, type: string, content: string) {
    await api<Interaction>(`/api/contacts/${contactId}/interactions`, {
      method: "POST",
      body: JSON.stringify({ type, content }),
    });
    if (selectedContactId === contactId) loadContactDetail(contactId);
  }

  function requestDelete(kind: string, id: string, label: string) {
    setConfirmDelete({ kind, id, label });
  }
  async function doDelete() {
    if (!confirmDelete) return;
    const { kind, id } = confirmDelete;
    const map: Record<string, () => Promise<void>> = {
      lead: async () => {
        await api(`/api/leads/${id}`, { method: "DELETE" });
        setLeads((prev) => prev.filter((x) => x.id !== id));
      },
      contact: async () => {
        await api(`/api/contacts/${id}`, { method: "DELETE" });
        setContacts((prev) => prev.filter((x) => x.id !== id));
        if (selectedContactId === id) {
          setSelectedContactId(null);
          setContactDetail(null);
        }
      },
      project: async () => {
        await api(`/api/projects/${id}`, { method: "DELETE" });
        setProjects((prev) => prev.filter((x) => x.id !== id));
      },
      event: async () => {
        await api(`/api/events/${id}`, { method: "DELETE" });
        setEvents((prev) => prev.filter((x) => x.id !== id));
      },
      task: async () => {
        await api(`/api/tasks/${id}`, { method: "DELETE" });
        setTasks((prev) => prev.filter((x) => x.id !== id));
      },
      doc: async () => {
        await api(`/api/documents/${id}`, { method: "DELETE" });
        setDocs((prev) => prev.filter((x) => x.id !== id));
      },
    };
    try {
      await map[kind]();
      setConfirmDelete(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed");
      setConfirmDelete(null);
    }
  }

  async function toggleTask(t: Task) {
    const updated = await api<Task>(`/api/tasks/${t.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...t, status: t.status === "done" ? "pending" : "done" }),
    });
    setTasks((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  async function snoozeTask(t: Task) {
    const updated = await api<Task>(`/api/tasks/${t.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...t, status: t.status === "snoozed" ? "pending" : "snoozed" }),
    });
    setTasks((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  async function moveLeadStage(id: string, stage: string) {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    if (stageRequiresBudget(stage) && !lead.budgetRange) {
      showToast(`Set a Budget Range before moving this lead to ${stage}`);
      return;
    }
    const prevStage = lead.stage;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));
    try {
      await api(`/api/leads/${id}`, { method: "PUT", body: JSON.stringify({ ...lead, stage }) });
    } catch (e) {
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage: prevStage } : l)));
      showToast(e instanceof Error ? e.message : "Could not move lead");
    }
  }

  async function shareProjectOnWhatsApp(project: Project, contact: Contact, message: string) {
    if (!contact.phone) {
      showToast("This contact has no phone number.");
      return;
    }
    window.open(`https://wa.me/${normalizePhone(contact.phone)}?text=${encodeURIComponent(message)}`, "_blank");
    await logInteraction(contact.id, "Document Shared", `Brochure sent — ${project.name}`);
    showToast(`Shared ${project.name} with ${contact.name}`);
  }

  async function sendAI() {
    if (!aiInput.trim()) return;
    const question = aiInput.trim();
    setAiMessages((prev) => [...prev, { role: "user", text: question }]);
    setAiInput("");
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const json = await res.json();
      const text = res.ok ? json.text : json.error;
      setAiMessages((prev) => [...prev, { role: "assistant", text }]);
    } catch {
      setAiMessages((prev) => [...prev, { role: "assistant", text: "Something went wrong reaching the assistant. Try again." }]);
    }
    setAiLoading(false);
    setTimeout(() => {
      aiMessagesRef.current?.scrollTo({ top: aiMessagesRef.current.scrollHeight });
    }, 30);
  }

  if (!loaded) {
    return (
      <div id="rdos-root">
        <div className="loading">Loading your day…</div>
      </div>
    );
  }

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const overdueTasks = pendingTasks.filter((t) => isOverdue(t.dueDate));
  const todaysTasks = pendingTasks.filter((t) => isToday(t.dueDate));
  const upcomingTasks = pendingTasks.filter((t) => isUpcoming(t.dueDate));

  const buyerContacts = contacts.filter((c) => c.buyerDetails);
  const overdueFollowups = buyerContacts.filter((c) => isOverdue(c.buyerDetails!.nextFollowUp));
  const todaysFollowups = buyerContacts.filter((c) => isToday(c.buyerDetails!.nextFollowUp));
  const upcomingFollowups = buyerContacts.filter((c) => isUpcoming(c.buyerDetails!.nextFollowUp));

  const builderContacts = contacts.filter((c) => c.builderDetails?.nextVisit);
  const overdueVisits = builderContacts.filter((c) => isOverdue(c.builderDetails!.nextVisit));
  const todaysVisitsToBuilders = builderContacts.filter((c) => isToday(c.builderDetails!.nextVisit));
  const upcomingVisits = builderContacts.filter((c) => isUpcoming(c.builderDetails!.nextVisit));
  const buildersToVisit = [...overdueVisits, ...todaysVisitsToBuilders];

  const todaysVisits = events.filter((e) => e.date === todayStr() && e.type === "Site Visit");
  const todaysMeetings = events.filter(
    (e) => e.date === todayStr() && (e.type === "Meeting" || e.type === "Builder Meeting")
  );
  const recentLeads = [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  return (
    <div id="rdos-root">
      <div className="app-shell">
        <div className="sidebar">
          <div className="brand">
            <div className="brand-mark">R</div>
            <div>
              <div className="brand-title">RealtyOS</div>
              <div className="brand-sub">Your CRM</div>
            </div>
          </div>
          {(
            [
              ["dashboard", "🏠 Dashboard"],
              ["leads", "📋 Leads"],
              ["contacts", "👥 Contacts"],
              ["projects", "🏢 Projects"],
              ["calendar", "📅 Calendar"],
              ["tasks", "✅ Tasks"],
              ["docs", "📁 Documents"],
              ["team", "🧑‍🤝‍🧑 Team"],
              ...(isOwner ? [["reports", "📊 Reports"] as [Tab, string]] : []),
              ["ai", "✨ AI Assistant"],
              ["settings", "⚙️ Settings"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <div
              key={id}
              className={`nav-item ${tab === id ? "active" : ""}`}
              onClick={() => {
                setTab(id);
                if (id !== "contacts") {
                  setSelectedContactId(null);
                  setContactDetail(null);
                }
              }}
            >
              {label}
            </div>
          ))}
          <div className="nav-item" onClick={() => signOut({ callbackUrl: "/login" })} style={{ marginTop: "auto" }}>
            🚪 Sign out
          </div>
        </div>
        <div className="main">
          <div className="content">
            {tab === "dashboard" && (
              <Dashboard
                overdueTasks={overdueTasks}
                todaysTasks={todaysTasks}
                upcomingTasks={upcomingTasks}
                overdueFollowups={overdueFollowups}
                todaysFollowups={todaysFollowups}
                upcomingFollowups={upcomingFollowups}
                todaysVisits={todaysVisits}
                todaysMeetings={todaysMeetings}
                buildersToVisit={buildersToVisit}
                upcomingVisits={upcomingVisits}
                recentLeads={recentLeads}
                docs={docs}
                leads={leads}
                onQuickAdd={(type) => {
                  if (type === "contact") setModal({ type: "contact", entity: {} });
                  else setModal({ type, entity: {} } as ModalState);
                }}
                onOpenContact={openContact}
                onOpenLead={(id) => setModal({ type: "lead", entity: leads.find((l) => l.id === id) || {} })}
                onMoveStage={moveLeadStage}
                dragId={dragId}
                setDragId={setDragId}
                aiMessages={aiMessages}
                aiLoading={aiLoading}
                aiInput={aiInput}
                setAiInput={setAiInput}
                sendAI={sendAI}
                aiMessagesRef={aiMessagesRef}
              />
            )}
            {tab === "leads" && (
              <LeadsTab
                leads={leads}
                isOwner={isOwner}
                onAdd={() => setModal({ type: "lead", entity: {} })}
                onEdit={(l) => setModal({ type: "lead", entity: l })}
                onDelete={isOwner ? (id) => requestDelete("lead", id, leads.find((l) => l.id === id)?.name || "lead") : undefined}
                onMoveStage={moveLeadStage}
                dragId={dragId}
                setDragId={setDragId}
                onOpenContact={openContact}
              />
            )}
            {tab === "contacts" &&
              (selectedContactId && contactDetail ? (
                <ContactDetail
                  contact={contactDetail}
                  onBack={() => {
                    setSelectedContactId(null);
                    setContactDetail(null);
                  }}
                  onEdit={() => setModal({ type: "contact", entity: contactDetail })}
                  onDelete={isOwner ? () => requestDelete("contact", contactDetail.id, contactDetail.name) : undefined}
                  onLogInteraction={() => setModal({ type: "interaction", contactId: contactDetail.id })}
                  onAddTask={() => setModal({ type: "task", entity: { contactId: contactDetail.id } })}
                  onSetDeadLeadRecheck={() => setDeadLeadRecheck(contactDetail.id, contactDetail.name)}
                />
              ) : (
                <ContactsTab
                  contacts={contacts}
                  typeFilter={contactTypeFilter}
                  setTypeFilter={setContactTypeFilter}
                  search={contactSearch}
                  setSearch={setContactSearch}
                  onAdd={() => setModal({ type: "contact", entity: {} })}
                  onOpen={openContact}
                  onDelete={isOwner ? (id, name) => requestDelete("contact", id, name) : undefined}
                />
              ))}
            {tab === "projects" && (
              <ProjectsTab
                projects={projects}
                onAdd={() => setModal({ type: "project", entity: {} })}
                onEdit={(p) => setModal({ type: "project", entity: p })}
                onDelete={isOwner ? (id) => requestDelete("project", id, projects.find((p) => p.id === id)?.name || "project") : undefined}
                onShare={(p) => setModal({ type: "whatsapp", project: p })}
              />
            )}
            {tab === "calendar" && (
              <CalendarTab
                events={events}
                onAdd={() => setModal({ type: "event", entity: {} })}
                onEdit={(e) => setModal({ type: "event", entity: e })}
                onDelete={(id) => requestDelete("event", id, events.find((e) => e.id === id)?.title || "event")}
              />
            )}
            {tab === "tasks" && (
              <TasksTab
                tasks={tasks}
                onAdd={() => setModal({ type: "task", entity: {} })}
                onToggle={toggleTask}
                onSnooze={snoozeTask}
                onDelete={(id) => requestDelete("task", id, tasks.find((t) => t.id === id)?.title || "task")}
              />
            )}
            {tab === "docs" && (
              <DocsTab
                docs={docs}
                onAdd={() => setModal({ type: "doc", entity: {} })}
                onDelete={(id) => requestDelete("doc", id, docs.find((d) => d.id === id)?.name || "document")}
              />
            )}
            {tab === "team" && (
              <TeamTab currentUser={currentUser} isOwner={isOwner} teamUsers={teamUsers} showToast={showToast} />
            )}
            {tab === "reports" && isOwner && <ReportsTab showToast={showToast} />}
            {tab === "ai" && (
              <>
                <div className="page-head">
                  <div>
                    <h2>AI Assistant</h2>
                  </div>
                </div>
                <AIBox
                  messages={aiMessages}
                  loading={aiLoading}
                  input={aiInput}
                  setInput={setAiInput}
                  onSend={sendAI}
                  scrollRef={aiMessagesRef}
                />
              </>
            )}
            {tab === "settings" && (
              <SettingsTab
                showToast={showToast}
                currentUser={currentUser}
                isOwner={isOwner}
                teamUsers={teamUsers}
                loadTeamUsers={loadTeamUsers}
              />
            )}
          </div>
        </div>
      </div>

      {modal && modal.type === "whatsapp" && (
        <WhatsAppShareModal
          project={modal.project}
          contacts={contacts}
          onCancel={() => setModal(null)}
          onShare={async (contact, message) => {
            await shareProjectOnWhatsApp(modal.project, contact, message);
            setModal(null);
          }}
        />
      )}

      {modal && modal.type === "interaction" && (
        <LogInteractionModal
          onCancel={() => setModal(null)}
          onSave={async (type, content) => {
            await logInteraction(modal.contactId, type, content);
            setModal(null);
          }}
        />
      )}

      {modal && modal.type !== "whatsapp" && modal.type !== "interaction" && (
        <EntityModal
          modal={modal}
          contacts={contacts}
          projects={projects}
          teamUsers={teamUsers}
          isOwner={isOwner}
          onCancel={() => setModal(null)}
          onSaveLead={saveLead}
          onSaveContact={saveContact}
          onSaveProject={saveProject}
          onSaveEvent={saveEvent}
          onSaveTask={saveTask}
          onSaveDoc={saveDoc}
          showToast={showToast}
        />
      )}

      {confirmDelete && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 360 }}>
            <h3>Delete {confirmDelete.label}?</h3>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6 }}>This can&apos;t be undone.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="btn" style={{ background: "var(--danger)" }} onClick={doDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Pipeline({
  leads,
  onMoveStage,
  dragId,
  setDragId,
}: {
  leads: Lead[];
  onMoveStage: (id: string, stage: string) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
}) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const openLeads = leads.filter((l) => l.status === "Open" || l.status === "On Hold");
  const closedCount = leads.length - openLeads.length;
  return (
    <div>
    <div className="pipeline">
      {STAGES.map((s) => {
        const cards = openLeads.filter((l) => l.stage === s);
        return (
          <div className="pcol" key={s}>
            <div className="pcol-head">
              <span>{s}</span>
              <span>{cards.length}</span>
            </div>
            <div
              className={`pcol-body ${dragOverStage === s ? "dragover" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(s);
              }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStage(null);
                if (dragId) onMoveStage(dragId, s);
              }}
            >
              {cards.map((l) => (
                <div
                  key={l.id}
                  className="pcard"
                  draggable
                  onDragStart={() => setDragId(l.id)}
                  onDragEnd={() => setDragId(null)}
                >
                  <strong>{l.name}</strong>
                  <br />
                  <span style={{ color: "var(--ink-faint)" }}>{esc(l.interest)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
    {closedCount > 0 && (
      <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 6 }}>
        {closedCount} closed lead{closedCount === 1 ? "" : "s"} (Won/Lost) not shown on the board — view them in the Leads list.
      </div>
    )}
    </div>
  );
}

function Dashboard(props: {
  overdueTasks: Task[];
  todaysTasks: Task[];
  upcomingTasks: Task[];
  overdueFollowups: Contact[];
  todaysFollowups: Contact[];
  upcomingFollowups: Contact[];
  todaysVisits: EventItem[];
  todaysMeetings: EventItem[];
  buildersToVisit: Contact[];
  upcomingVisits: Contact[];
  recentLeads: Lead[];
  docs: DocumentItem[];
  leads: Lead[];
  onQuickAdd: (type: "lead" | "task" | "event" | "contact") => void;
  onOpenContact: (id: string) => void;
  onOpenLead: (id: string) => void;
  onMoveStage: (id: string, stage: string) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  aiMessages: { role: "user" | "assistant"; text: string }[];
  aiLoading: boolean;
  aiInput: string;
  setAiInput: (v: string) => void;
  sendAI: () => void;
  aiMessagesRef: React.RefObject<HTMLDivElement | null>;
}) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  return (
    <>
      <div className="greeting">
        <h1>{greet}</h1>
        <p>Here&apos;s what needs your attention today.</p>
      </div>

      <div className="quick-add-row">
        <div className="qa-chip" onClick={() => props.onQuickAdd("lead")}>
          + Add Lead
        </div>
        <div className="qa-chip" onClick={() => props.onQuickAdd("task")}>
          + Add Task
        </div>
        <div className="qa-chip" onClick={() => props.onQuickAdd("event")}>
          + Add Event
        </div>
        <div className="qa-chip" onClick={() => props.onQuickAdd("contact")}>
          + Add Contact
        </div>
      </div>

      {props.buildersToVisit.length > 0 && (
        <div className="card" style={{ marginBottom: 16, border: "1.5px solid #4f46e5" }}>
          <h3>
            🏗️ Builders To Visit <span className="count">{props.buildersToVisit.length}</span>
          </h3>
          {props.buildersToVisit.map((c) => (
            <div key={c.id} className="item-row clickable" onClick={() => props.onOpenContact(c.id)}>
              <span className="item-title">{c.name}</span>
              <span className="item-sub">
                {esc(c.builderDetails?.projects)}
                {isOverdue(c.builderDetails?.nextVisit ?? null) && " · Overdue"}
              </span>
            </div>
          ))}
          {props.upcomingVisits.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--ink-faint)" }}>
                {props.upcomingVisits.length} upcoming
              </summary>
              {props.upcomingVisits.map((c) => (
                <div key={c.id} className="item-row clickable" onClick={() => props.onOpenContact(c.id)}>
                  <span className="item-title">{c.name}</span>
                  <span className="item-sub">{fmt(c.builderDetails?.nextVisit ?? null)}</span>
                </div>
              ))}
            </details>
          )}
        </div>
      )}

      <div className="grid3" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>
            Tasks{" "}
            <span className="count">{props.overdueTasks.length + props.todaysTasks.length}</span>
          </h3>
          {props.overdueTasks.length === 0 && props.todaysTasks.length === 0 ? (
            <div className="empty-sm">Nothing due today.</div>
          ) : (
            <>
              {props.overdueTasks.map((t) => (
                <div key={t.id} className="item-row">
                  <span className="item-title">{t.title}</span>
                  <span className="item-sub" style={{ color: "#ef4444" }}>
                    Overdue · {fmt(t.dueDate)}
                  </span>
                </div>
              ))}
              {props.todaysTasks.map((t) => (
                <div key={t.id} className="item-row">
                  <span className="item-title">{t.title}</span>
                </div>
              ))}
            </>
          )}
          {props.upcomingTasks.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--ink-faint)" }}>
                {props.upcomingTasks.length} upcoming
              </summary>
              {props.upcomingTasks.map((t) => (
                <div key={t.id} className="item-row">
                  <span className="item-title">{t.title}</span>
                  <span className="item-sub">{fmt(t.dueDate)}</span>
                </div>
              ))}
            </details>
          )}
        </div>
        <div className="card">
          <h3>
            Follow-ups{" "}
            <span className="count">{props.overdueFollowups.length + props.todaysFollowups.length}</span>
          </h3>
          {props.overdueFollowups.length === 0 && props.todaysFollowups.length === 0 ? (
            <div className="empty-sm">No follow-ups today.</div>
          ) : (
            <>
              {props.overdueFollowups.map((c) => (
                <div key={c.id} className="item-row clickable" onClick={() => props.onOpenContact(c.id)}>
                  <span className="item-title">{c.name}</span>
                  <span className="item-sub" style={{ color: "#ef4444" }}>
                    Overdue · {esc(c.buyerDetails?.needs)}
                  </span>
                </div>
              ))}
              {props.todaysFollowups.map((c) => (
                <div key={c.id} className="item-row clickable" onClick={() => props.onOpenContact(c.id)}>
                  <span className="item-title">{c.name}</span>
                  <span className="item-sub">{esc(c.buyerDetails?.needs)}</span>
                </div>
              ))}
            </>
          )}
          {props.upcomingFollowups.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--ink-faint)" }}>
                {props.upcomingFollowups.length} upcoming
              </summary>
              {props.upcomingFollowups.map((c) => (
                <div key={c.id} className="item-row clickable" onClick={() => props.onOpenContact(c.id)}>
                  <span className="item-title">{c.name}</span>
                  <span className="item-sub">{fmt(c.buyerDetails?.nextFollowUp ?? null)}</span>
                </div>
              ))}
            </details>
          )}
        </div>
        <div className="card">
          <h3>
            Today&apos;s Site Visits <span className="count">{props.todaysVisits.length}</span>
          </h3>
          {props.todaysVisits.length === 0 ? (
            <div className="empty-sm">No visits scheduled.</div>
          ) : (
            props.todaysVisits.map((e) => (
              <div key={e.id} className="item-row">
                <span className="item-title">{e.title}</span>
                <span className="item-sub">{esc(e.time)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid3" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3>
            Today&apos;s Meetings <span className="count">{props.todaysMeetings.length}</span>
          </h3>
          {props.todaysMeetings.length === 0 ? (
            <div className="empty-sm">No meetings today.</div>
          ) : (
            props.todaysMeetings.map((e) => (
              <div key={e.id} className="item-row">
                <span className="item-title">{e.title}</span>
                <span className="item-sub">{esc(e.time)}</span>
              </div>
            ))
          )}
        </div>
        <div className="card">
          <h3>
            Pending Documents <span className="count">{props.docs.length}</span>
          </h3>
          {props.docs.length === 0 ? (
            <div className="empty-sm">No documents saved yet.</div>
          ) : (
            props.docs.slice(0, 4).map((d) => (
              <div key={d.id} className="item-row">
                <span className="item-title">{d.name}</span>
                <span className="item-sub">{d.type}</span>
              </div>
            ))
          )}
        </div>
        <div className="card">
          <h3>
            Recent Leads <span className="count">{props.recentLeads.length}</span>
          </h3>
          {props.recentLeads.length === 0 ? (
            <div className="empty-sm">No leads yet.</div>
          ) : (
            props.recentLeads.map((l) => (
              <div
                key={l.id}
                className="item-row clickable"
                onClick={() => (l.contactId ? props.onOpenContact(l.contactId) : props.onOpenLead(l.id))}
              >
                <span className="item-title">{l.name}</span>
                <span className="pill pill-stage">{l.stage}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="page-head">
        <h2 style={{ fontSize: 18 }}>Pipeline</h2>
      </div>
      <Pipeline leads={props.leads} onMoveStage={props.onMoveStage} dragId={props.dragId} setDragId={props.setDragId} />

      <div style={{ marginTop: 24 }}>
        <div className="page-head">
          <h2 style={{ fontSize: 18 }}>✨ Ask RealtyOS</h2>
        </div>
        <AIBox
          messages={props.aiMessages}
          loading={props.aiLoading}
          input={props.aiInput}
          setInput={props.setAiInput}
          onSend={props.sendAI}
          scrollRef={props.aiMessagesRef}
        />
      </div>
    </>
  );
}

function AIBox({
  messages,
  loading,
  input,
  setInput,
  onSend,
  scrollRef,
}: {
  messages: { role: "user" | "assistant"; text: string }[];
  loading: boolean;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="ai-box">
      <div className="ai-messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="empty-sm">Try: &quot;Show me projects under ₹1.5 Cr in Civil Lines&quot;</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`ai-msg ${m.role}`}>
              {m.text}
            </div>
          ))
        )}
        {loading && <div className="ai-msg assistant">Thinking…</div>}
      </div>
      <div className="ai-input-row">
        <input
          type="text"
          placeholder="Ask about your leads, buyers, or projects…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
        />
        <button className="btn" onClick={onSend}>
          Ask
        </button>
      </div>
    </div>
  );
}

function LeadsTab({
  leads,
  isOwner,
  onAdd,
  onEdit,
  onDelete,
  onMoveStage,
  dragId,
  setDragId,
  onOpenContact,
}: {
  leads: Lead[];
  isOwner: boolean;
  onAdd: () => void;
  onEdit: (l: Lead) => void;
  onDelete?: (id: string) => void;
  onMoveStage: (id: string, stage: string) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onOpenContact: (id: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  function exportCsv() {
    downloadCsv(
      `realtyos-leads-${todayStr()}.csv`,
      [
        "Name",
        "Phone",
        "Stage",
        "Status",
        "Loss Reason",
        "Assigned To",
        "Source",
        "Property Type",
        "Budget Range",
        "Preferred Location",
        "Interest",
        "Created",
      ],
      leads.map((l) => [
        l.name,
        l.phone,
        l.stage,
        l.status,
        l.lossReason || "",
        l.assignedTo?.name || l.assignedTo?.email || "",
        l.source || "",
        l.propertyType || "",
        l.budgetRange || "",
        l.preferredLocation || "",
        l.interest || "",
        fmt(l.createdAt),
      ])
    );
  }
  const counts = LEAD_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s).length;
    return acc;
  }, {});
  const visibleLeads = statusFilter === "All" ? leads : leads.filter((l) => l.status === statusFilter);
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Leads</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={exportCsv}>
            Export CSV
          </button>
          <button className="btn" onClick={onAdd}>
            + Add Lead
          </button>
        </div>
      </div>
      <Pipeline leads={leads} onMoveStage={onMoveStage} dragId={dragId} setDragId={setDragId} />
      <div style={{ height: 20 }} />
      <div className="chip-row" style={{ marginBottom: 14 }}>
        <button
          className={`chip ${statusFilter === "All" ? "active" : ""}`}
          onClick={() => setStatusFilter("All")}
        >
          All {leads.length}
        </button>
        {LEAD_STATUSES.map((s) => (
          <button
            key={s}
            className={`chip ${statusFilter === s ? "active" : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {s} {counts[s]}
          </button>
        ))}
      </div>
      {visibleLeads.length === 0 ? (
        <div className="empty">No leads match this filter.</div>
      ) : (
        <div className="list-grid">
          {visibleLeads.map((l) => (
            <div className="row-card" key={l.id}>
              <div className="rc-main">
                <div
                  className="rc-name"
                  style={l.contactId ? { cursor: "pointer", color: "#4f46e5" } : {}}
                  onClick={() => l.contactId && onOpenContact(l.contactId)}
                >
                  {l.name}
                </div>
                <div className="rc-meta">
                  {l.phone} · {esc(l.interest)} · {esc(l.source)}
                  {l.status === "Lost" && l.lossReason ? ` · ${l.lossReason}` : ""}
                  {isOwner ? ` · Assigned: ${l.assignedTo?.name || l.assignedTo?.email || "Unassigned"}` : ""}
                </div>
              </div>
              <span className="pill pill-stage">{l.stage}</span>
              <span
                className="pill"
                style={{
                  background: `${LEAD_STATUS_COLORS[l.status] || "#6b7280"}22`,
                  color: LEAD_STATUS_COLORS[l.status] || "#6b7280",
                }}
              >
                {l.status}
              </span>
              <div className="row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => onEdit(l)}>
                  Edit
                </button>
                {onDelete && (
                  <button className="btn-danger" onClick={() => onDelete(l.id)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function fieldRow(label: string, value: string | null | undefined, isLink?: boolean) {
  if (!value) return null;
  return (
    <div className="entity-field" key={label}>
      <span className="l">{label}</span>
      {isLink ? (
        <a href={value} target="_blank" rel="noopener" style={{ color: "#4f46e5" }} className="v">
          Link
        </a>
      ) : (
        <span className="v">{value}</span>
      )}
    </div>
  );
}

// ---------------- CONTACTS ----------------

function ContactsTab({
  contacts,
  typeFilter,
  setTypeFilter,
  search,
  setSearch,
  onAdd,
  onOpen,
  onDelete,
}: {
  contacts: Contact[];
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  onAdd: () => void;
  onOpen: (id: string) => void;
  onDelete?: (id: string, name: string) => void;
}) {
  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (typeFilter && !c.types.includes(typeFilter)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${c.name} ${c.phone || ""} ${c.company || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contacts, typeFilter, search]);

  function exportCsv() {
    downloadCsv(
      `realtyos-contacts-${todayStr()}.csv`,
      ["Name", "Phone", "Email", "Types", "Company", "Budget", "Needs", "Builder Commission", "Broker Agency"],
      filtered.map((c) => [
        c.name,
        c.phone || "",
        c.email || "",
        c.types.join("/"),
        c.company || "",
        c.buyerDetails?.budget || "",
        c.buyerDetails?.needs || "",
        c.builderDetails?.commissionStructure || "",
        c.brokerDetails?.agencyName || "",
      ])
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Contacts</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={exportCsv}>
            Export CSV
          </button>
          <button className="btn" onClick={onAdd}>
            + Add Contact
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, company…"
          style={{
            flex: "1 1 220px",
            padding: "9px 14px",
            border: "1px solid var(--border)",
            borderRadius: 20,
            fontSize: 13,
            background: "var(--surface-solid)",
          }}
        />
      </div>
      <div className="chip-row" style={{ marginBottom: 18 }}>
        <div className={`chip ${typeFilter === "" ? "active" : ""}`} onClick={() => setTypeFilter("")}>
          All
        </div>
        {CONTACT_TYPES.map((t) => (
          <div key={t} className={`chip ${typeFilter === t ? "active" : ""}`} onClick={() => setTypeFilter(t)}>
            {t}
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">No contacts match.</div>
      ) : (
        <div className="list-grid">
          {filtered.map((c) => (
            <div className="row-card" key={c.id}>
              <div className="rc-main" style={{ cursor: "pointer" }} onClick={() => onOpen(c.id)}>
                <div className="rc-name">{c.name}</div>
                <div className="rc-meta">
                  {c.phone || "No phone"} {c.company ? `· ${c.company}` : ""}
                </div>
                <div style={{ marginTop: 6 }}>
                  {c.types.map((t) => (
                    <span key={t} className="badge">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="row-actions">
                {c.phone && (
                  <div className="quick-actions" style={{ display: "flex", gap: 6 }}>
                    <a className="qa-btn" href={`tel:${c.phone.replace(/[^0-9+]/g, "")}`} title="Call">
                      📞
                    </a>
                    <a className="qa-btn" href={waLink(c.phone)} target="_blank" rel="noopener" title="WhatsApp">
                      💬
                    </a>
                  </div>
                )}
                {onDelete && (
                  <button className="btn-danger" onClick={() => onDelete(c.id, c.name)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ContactDetail({
  contact,
  onBack,
  onEdit,
  onDelete,
  onLogInteraction,
  onAddTask,
  onSetDeadLeadRecheck,
}: {
  contact: Contact & { interactions: Interaction[] };
  onBack: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onLogInteraction: () => void;
  onAddTask: () => void;
  onSetDeadLeadRecheck: () => void;
}) {
  function exportCsv() {
    downloadCsv(
      `realtyos-${contact.name.replace(/\s+/g, "-").toLowerCase()}-history-${todayStr()}.csv`,
      ["Type", "Content", "Logged By", "Date"],
      contact.interactions.map((i) => [i.type, i.content, i.createdBy || "", fmtDateTime(i.createdAt)])
    );
  }

  return (
    <>
      <div className="detail-back" onClick={onBack}>
        ← Back to Contacts
      </div>
      <div className="detail-header">
        <div>
          <div className="detail-name">{contact.name}</div>
          <div className="detail-meta">
            {contact.phone || "No phone"} {contact.company ? `· ${contact.company}` : ""}
          </div>
          <div style={{ marginTop: 8 }}>
            {contact.types.map((t) => (
              <span key={t} className="badge">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {contact.phone && (
            <>
              <a className="btn btn-ghost btn-sm" href={`tel:${contact.phone.replace(/[^0-9+]/g, "")}`}>
                📞 Call
              </a>
              <a className="btn btn-ghost btn-sm" href={waLink(contact.phone)} target="_blank" rel="noopener">
                💬 WhatsApp
              </a>
            </>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onAddTask}>
            + Add Task
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onEdit}>
            Edit
          </button>
          {onDelete && (
            <button className="btn-danger" onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="card-grid" style={{ marginBottom: 20 }}>
        {contact.buyerDetails && (
          <div className="entity-card">
            <div className="entity-name">Buyer Details</div>
            {fieldRow("Budget", contact.buyerDetails.budget)}
            {fieldRow("Preferred Location", contact.buyerDetails.preferredLocation)}
            {fieldRow("Needs", contact.buyerDetails.needs)}
            {fieldRow("Status", contact.buyerDetails.status)}
            {fieldRow("Next Follow-up", fmt(contact.buyerDetails.nextFollowUp))}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={onSetDeadLeadRecheck}>
              🔁 Set Dead Lead Recheck (60 days)
            </button>
          </div>
        )}
        {contact.builderDetails && (
          <div className="entity-card">
            <div className="entity-name">Builder Details</div>
            {fieldRow("Projects", contact.builderDetails.projects)}
            {fieldRow("Commission", contact.builderDetails.commissionStructure)}
            {fieldRow("Last Visited", fmt(contact.builderDetails.lastVisited))}
            {fieldRow("Next Visit", fmt(contact.builderDetails.nextVisit))}
            {fieldRow("Brochure", contact.builderDetails.brochureLink, true)}
          </div>
        )}
        {contact.brokerDetails && (
          <div className="entity-card">
            <div className="entity-name">Broker Details</div>
            {fieldRow("Agency", contact.brokerDetails.agencyName)}
            {fieldRow("Commission Split", contact.brokerDetails.commissionSplit)}
            {fieldRow("Status", contact.brokerDetails.status)}
          </div>
        )}
        {contact.vendorDetails && (
          <div className="entity-card">
            <div className="entity-name">Vendor Details</div>
            {fieldRow("Service Type", contact.vendorDetails.serviceType)}
            {fieldRow("Rate Card Ref", contact.vendorDetails.rateCardRef)}
            {fieldRow("Status", contact.vendorDetails.status)}
          </div>
        )}
        {contact.sellerDetails && (
          <div className="entity-card">
            <div className="entity-name">Seller Details</div>
            {fieldRow("Property Ref", contact.sellerDetails.propertyRef)}
            {fieldRow("Asking Price", contact.sellerDetails.askingPrice)}
            {fieldRow("Status", contact.sellerDetails.status)}
          </div>
        )}
      </div>

      <div className="page-head">
        <div>
          <h2 style={{ fontSize: 18 }}>History</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={exportCsv}>
            Export CSV
          </button>
          <button className="btn" onClick={onLogInteraction}>
            + Log Interaction
          </button>
        </div>
      </div>

      {contact.interactions.length === 0 ? (
        <div className="empty">No interactions logged yet.</div>
      ) : (
        <div className="timeline">
          {contact.interactions.map((i) => (
            <div className="timeline-item" key={i.id}>
              <div className="timeline-icon">{INTERACTION_ICONS[i.type] || "•"}</div>
              <div className="timeline-body">
                <div className="timeline-content">{i.content}</div>
                <div className="timeline-meta">
                  {i.type} · {i.createdBy || "Unknown"} · {fmtDateTime(i.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function LogInteractionModal({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (type: string, content: string) => void;
}) {
  const [type, setType] = useState<string>("Call");
  const [content, setContent] = useState("");
  return (
    <div className="modal-back" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <h3>Log Interaction</h3>
        <div className="field">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {INTERACTION_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>What happened</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="What was discussed…" />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={() => {
              if (!content.trim()) return;
              onSave(type, content.trim());
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- PROJECTS + WHATSAPP SHARE ----------------

function ProjectsTab({
  projects,
  onAdd,
  onEdit,
  onDelete,
  onShare,
}: {
  projects: Project[];
  onAdd: () => void;
  onEdit: (p: Project) => void;
  onDelete?: (id: string) => void;
  onShare: (p: Project) => void;
}) {
  function exportCsv() {
    downloadCsv(
      `realtyos-projects-${todayStr()}.csv`,
      ["Name", "Builder", "Price", "Commission", "Status"],
      projects.map((p) => [p.name, p.builderContact?.name || p.builder || "", p.price || "", p.commission || "", ""])
    );
  }
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Projects</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={exportCsv}>
            Export CSV
          </button>
          <button className="btn" onClick={onAdd}>
            + Add Project
          </button>
        </div>
      </div>
      {projects.length === 0 ? (
        <div className="empty">No projects yet.</div>
      ) : (
        <div className="card-grid">
          {projects.map((p) => (
            <div className="entity-card" key={p.id}>
              {p.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.photo}
                  alt={p.name}
                  style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 10, marginBottom: 12 }}
                />
              ) : (
                <div className="top-strip" />
              )}
              <div className="entity-name">{p.name}</div>
              {fieldRow("Builder", p.builderContact?.name || p.builder)}
              {fieldRow("Price", p.price)}
              {fieldRow("Brochure", p.brochureLink, true)}
              {fieldRow("Floor Plan", p.floorPlanLink, true)}
              {fieldRow("Amenities", p.amenities)}
              {fieldRow("Nearby", p.nearby)}
              {fieldRow("Commission", p.commission)}
              {p.notes && <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 8 }}>{p.notes}</div>}
              <div className="entity-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => onEdit(p)}>
                  Edit
                </button>
                {onDelete && (
                  <button className="btn-danger" onClick={() => onDelete(p.id)}>
                    Delete
                  </button>
                )}
              </div>
              <div className="entity-actions" style={{ marginTop: 6 }}>
                <button
                  className="btn btn-sm"
                  style={{ width: "100%", background: "#25D366" }}
                  onClick={() => onShare(p)}
                  disabled={!p.brochureLink}
                  title={p.brochureLink ? "Share via WhatsApp" : "Add a brochure link first"}
                >
                  💬 Share via WhatsApp
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function WhatsAppShareModal({
  project,
  contacts,
  onCancel,
  onShare,
}: {
  project: Project;
  contacts: Contact[];
  onCancel: () => void;
  onShare: (contact: Contact, message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [message, setMessage] = useState("");

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = contacts.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone || "").includes(q));
    return list.sort((a, b) => {
      const aBuyer = a.types.includes("Buyer") ? 0 : 1;
      const bBuyer = b.types.includes("Buyer") ? 0 : 1;
      return aBuyer - bBuyer;
    });
  }, [contacts, search]);

  function pick(c: Contact) {
    setSelected(c);
    setMessage(`Hi ${c.name}, sharing details of ${project.name} — ${project.price || ""}. Brochure: ${project.brochureLink}`);
  }

  return (
    <div className="modal-back" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <h3>Share &quot;{project.name}&quot; via WhatsApp</h3>
        {!selected ? (
          <>
            <div className="field">
              <label>Pick a contact</label>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts…" />
            </div>
            <div className="list-grid" style={{ maxHeight: 300, overflowY: "auto" }}>
              {sorted.length === 0 ? (
                <div className="empty-sm">No contacts found.</div>
              ) : (
                sorted.map((c) => (
                  <div
                    key={c.id}
                    className="item-row clickable"
                    onClick={() => pick(c)}
                    style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px" }}
                  >
                    <span className="item-title">{c.name}</span>
                    <span className="item-sub">
                      {c.types.join("/")} {c.phone ? `· ${c.phone}` : "· no phone"}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label>Sending to</label>
              <input value={`${selected.name} (${selected.phone || "no phone"})`} readOnly />
            </div>
            <div className="field">
              <label>Message</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>
                ← Choose different contact
              </button>
              <button className="btn" onClick={() => onShare(selected, message)}>
                Open WhatsApp
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CalendarTab({
  events,
  onAdd,
  onEdit,
  onDelete,
}: {
  events: EventItem[];
  onAdd: () => void;
  onEdit: (e: EventItem) => void;
  onDelete: (id: string) => void;
}) {
  const sorted = [...events].sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Calendar</h2>
        </div>
        <button className="btn" onClick={onAdd}>
          + Add Event
        </button>
      </div>
      {sorted.length === 0 ? (
        <div className="empty">No events scheduled.</div>
      ) : (
        <div className="list-grid">
          {sorted.map((e) => (
            <div className="row-card" key={e.id}>
              <div className="rc-main">
                <div className="rc-name">{e.title}</div>
                <div className="rc-meta">
                  {fmt(e.date)} {e.time ? `· ${e.time}` : ""} · {e.type}
                  {e.project ? ` · ${e.project.name}` : ""}
                </div>
              </div>
              <div className="row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => onEdit(e)}>
                  Edit
                </button>
                <button className="btn-danger" onClick={() => onDelete(e.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function TasksTab({
  tasks,
  onAdd,
  onToggle,
  onSnooze,
  onDelete,
}: {
  tasks: Task[];
  onAdd: () => void;
  onToggle: (t: Task) => void;
  onSnooze: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const sorted = [...tasks].sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0));
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Tasks</h2>
        </div>
        <button className="btn" onClick={onAdd}>
          + Add Task
        </button>
      </div>
      {sorted.length === 0 ? (
        <div className="empty">No tasks yet.</div>
      ) : (
        <div className="list-grid">
          {sorted.map((t) => (
            <div className={`task-row ${t.status === "done" ? "done" : ""}`} key={t.id}>
              <div className={`task-check ${t.status === "done" ? "checked" : ""}`} onClick={() => onToggle(t)} />
              <div className="task-title">{t.title}</div>
              <div className="task-due" style={{ color: isOverdue(t.dueDate) && t.status === "pending" ? "#ef4444" : undefined }}>
                {fmt(t.dueDate)}
                {t.status === "snoozed" ? " · Snoozed" : ""}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onSnooze(t)}>
                {t.status === "snoozed" ? "Unsnooze" : "Snooze"}
              </button>
              <button className="btn-danger" onClick={() => onDelete(t.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function DocsTab({
  docs,
  onAdd,
  onDelete,
}: {
  docs: DocumentItem[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Documents</h2>
        </div>
        <button className="btn" onClick={onAdd}>
          + Add Document Link
        </button>
      </div>
      <div className="empty-sm" style={{ marginBottom: 14 }}>
        Store links to your files (Google Drive, etc.).
      </div>
      {docs.length === 0 ? (
        <div className="empty">No documents saved yet.</div>
      ) : (
        <div className="list-grid">
          {docs.map((d) => (
            <div className="row-card" key={d.id}>
              <div className="rc-main">
                <div className="rc-name">{d.name}</div>
                <div className="rc-meta">{d.type}</div>
              </div>
              <a href={d.link} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
                Open
              </a>
              <button className="btn-danger" onClick={() => onDelete(d.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------- TEAM / ATTENDANCE ----------------

type AttendanceLocationT = {
  id: string;
  userId: string;
  label: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};
type AttendanceRecord = {
  id: string;
  userId: string;
  user: { id: string; name: string | null; email: string };
  date: string;
  checkInAt: string | null;
  checkInLocation: string | null;
  checkOutAt: string | null;
  status: string;
};
type AttendanceSettingsT = { fullDayHours: number; halfDayHours: number };

function getCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location isn't available on this device/browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(new Error(err.message || "Could not get your location.")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  "Full Day": "#22c55e",
  "Half Day": "#f59e0b",
  Absent: "#ef4444",
  Incomplete: "#6b7280",
};

function TeamTab({
  currentUser,
  isOwner,
  teamUsers,
  showToast,
}: {
  currentUser: { name: string | null; email: string; role: string; attendanceEnabled?: boolean };
  isOwner: boolean;
  teamUsers: TeamUser[];
  showToast: (msg: string) => void;
}) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [locations, setLocations] = useState<AttendanceLocationT[]>([]);
  const [settings, setSettings] = useState<AttendanceSettingsT>({ fullDayHours: 8, halfDayHours: 4 });

  const [locUserId, setLocUserId] = useState("");
  const [locLabel, setLocLabel] = useState("");
  const [locLat, setLocLat] = useState("");
  const [locLng, setLocLng] = useState("");
  const [locRadius, setLocRadius] = useState("200");
  const [savingLoc, setSavingLoc] = useState(false);

  const [fullHoursInput, setFullHoursInput] = useState("8");
  const [halfHoursInput, setHalfHoursInput] = useState("4");
  const [savingSettings, setSavingSettings] = useState(false);

  function loadRecords() {
    api<AttendanceRecord[]>("/api/attendance")
      .then((rs) => {
        setRecords(rs);
        const today = todayStrIST();
        setTodayRecord(rs.find((r) => r.date === today && r.user.email === currentUser.email) || null);
      })
      .catch(() => showToast("Could not load attendance"));
  }

  useEffect(() => {
    loadRecords();
    if (isOwner) {
      api<AttendanceLocationT[]>("/api/attendance/locations").then(setLocations).catch(() => {});
    }
    api<AttendanceSettingsT>("/api/attendance/settings").then((s) => {
      setSettings(s);
      setFullHoursInput(String(s.fullDayHours));
      setHalfHoursInput(String(s.halfDayHours));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  async function handleCheckIn() {
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      const res = await fetch("/api/attendance/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pos),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Check-in failed");
      } else {
        showToast(`Checked in at ${json.checkInLocation}`);
        loadRecords();
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Check-in failed");
    }
    setBusy(false);
  }

  async function handleCheckOut() {
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      const res = await fetch("/api/attendance/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pos),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Check-out failed");
      } else {
        showToast(`Checked out — marked ${json.status}`);
        loadRecords();
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Check-out failed");
    }
    setBusy(false);
  }

  async function handleUseMyLocation() {
    try {
      const pos = await getCurrentPosition();
      setLocLat(pos.latitude.toFixed(6));
      setLocLng(pos.longitude.toFixed(6));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not get location");
    }
  }

  async function handleAddLocation() {
    if (!locUserId || !locLabel.trim() || !locLat || !locLng) {
      showToast("Employee, label, and coordinates are required");
      return;
    }
    setSavingLoc(true);
    try {
      const res = await fetch("/api/attendance/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: locUserId,
          label: locLabel.trim(),
          latitude: parseFloat(locLat),
          longitude: parseFloat(locLng),
          radiusMeters: parseInt(locRadius, 10) || 200,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Could not add location");
      } else {
        showToast("Location added");
        setLocLabel("");
        setLocLat("");
        setLocLng("");
        setLocRadius("200");
        setLocations((prev) => [...prev, json]);
      }
    } catch {
      showToast("Something went wrong. Try again.");
    }
    setSavingLoc(false);
  }

  async function handleDeleteLocation(id: string) {
    try {
      await fetch(`/api/attendance/locations/${id}`, { method: "DELETE" });
      setLocations((prev) => prev.filter((l) => l.id !== id));
    } catch {
      showToast("Could not remove location");
    }
  }

  async function handleSaveSettings() {
    const fullDayHours = parseFloat(fullHoursInput);
    const halfDayHours = parseFloat(halfHoursInput);
    if (!fullDayHours || !halfDayHours || halfDayHours >= fullDayHours) {
      showToast("Full day hours must be greater than half day hours");
      return;
    }
    setSavingSettings(true);
    try {
      const res = await fetch("/api/attendance/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullDayHours, halfDayHours }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Could not save");
      } else {
        setSettings(json);
        showToast("Saved");
      }
    } catch {
      showToast("Something went wrong. Try again.");
    }
    setSavingSettings(false);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Team</h2>
        </div>
      </div>

      {currentUser.role === "Employee" && currentUser.attendanceEnabled === false ? (
        <div className="card" style={{ maxWidth: 440, marginBottom: 20 }}>
          <h3>Today's Attendance</h3>
          <div className="empty-sm">Attendance tracking isn't required for your account.</div>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 440, marginBottom: 20 }}>
          <h3>Today's Attendance</h3>
          {todayRecord?.checkInAt ? (
            <div style={{ fontSize: 13, marginBottom: 12 }}>
              Checked in at {fmtDateTime(todayRecord.checkInAt)} ({todayRecord.checkInLocation})
              {todayRecord.checkOutAt && <> · Checked out at {fmtDateTime(todayRecord.checkOutAt)}</>}
            </div>
          ) : (
            <div className="empty-sm" style={{ marginBottom: 12 }}>
              Not checked in yet today.
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn"
              onClick={handleCheckIn}
              disabled={busy || !!todayRecord?.checkInAt}
            >
              Check In
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleCheckOut}
              disabled={busy || !todayRecord?.checkInAt || !!todayRecord?.checkOutAt}
            >
              Check Out
            </button>
          </div>
        </div>
      )}

      {isOwner && (
        <div className="card" style={{ maxWidth: 520, marginBottom: 20 }}>
          <h3>Allowed Locations</h3>
          {locations.length === 0 ? (
            <div className="empty-sm" style={{ marginBottom: 12 }}>
              No locations set up yet.
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              {locations.map((l) => {
                const owner = teamUsers.find((u) => u.id === l.userId);
                return (
                  <div className="entity-field" key={l.id}>
                    <span className="l">
                      {l.label} <span style={{ opacity: 0.6 }}>· {owner?.name || owner?.email || "Unknown"}</span>
                    </span>
                    <span className="v" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {l.radiusMeters}m radius
                      <button className="btn-danger" onClick={() => handleDeleteLocation(l.id)}>
                        Remove
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="field">
            <label>Employee</label>
            <select value={locUserId} onChange={(e) => setLocUserId(e.target.value)}>
              <option value="">Select…</option>
              {teamUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Label</label>
            <input value={locLabel} onChange={(e) => setLocLabel(e.target.value)} placeholder="Office, Site A…" />
          </div>
          <div className="field">
            <label>Coordinates</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={locLat} onChange={(e) => setLocLat(e.target.value)} placeholder="Latitude" />
              <input value={locLng} onChange={(e) => setLocLng(e.target.value)} placeholder="Longitude" />
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={handleUseMyLocation}>
              📍 Use My Current Location
            </button>
          </div>
          <div className="field">
            <label>Radius (meters)</label>
            <input value={locRadius} onChange={(e) => setLocRadius(e.target.value)} />
          </div>
          <button className="btn" onClick={handleAddLocation} disabled={savingLoc}>
            {savingLoc ? "Adding…" : "Add Location"}
          </button>
        </div>
      )}

      {isOwner && (
        <div className="card" style={{ maxWidth: 440, marginBottom: 20 }}>
          <h3>Attendance Thresholds</h3>
          <div className="field">
            <label>Full Day Hours</label>
            <input value={fullHoursInput} onChange={(e) => setFullHoursInput(e.target.value)} />
          </div>
          <div className="field">
            <label>Half Day Hours</label>
            <input value={halfHoursInput} onChange={(e) => setHalfHoursInput(e.target.value)} />
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 10 }}>
            Currently: {settings.fullDayHours}h = Full Day, {settings.halfDayHours}h = Half Day, below that = Absent.
          </div>
          <button className="btn" onClick={handleSaveSettings} disabled={savingSettings}>
            {savingSettings ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      <div className="page-head">
        <h2 style={{ fontSize: 18 }}>Attendance History</h2>
      </div>
      {records.length === 0 ? (
        <div className="empty">No attendance records yet.</div>
      ) : (
        <div className="list-grid">
          {records.map((r) => (
            <div className="row-card" key={r.id}>
              <div className="rc-main">
                <div className="rc-name">
                  {isOwner ? r.user.name || r.user.email : fmt(r.date)}
                </div>
                <div className="rc-meta">
                  {isOwner && `${fmt(r.date)} · `}
                  {r.checkInAt ? `In ${fmtDateTime(r.checkInAt)} (${r.checkInLocation})` : "No check-in"}
                  {r.checkOutAt ? ` · Out ${fmtDateTime(r.checkOutAt)}` : ""}
                </div>
              </div>
              <span
                className="pill"
                style={{
                  background: `${ATTENDANCE_STATUS_COLORS[r.status] || "#6b7280"}22`,
                  color: ATTENDANCE_STATUS_COLORS[r.status] || "#6b7280",
                }}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------- REPORTS ----------------

type LeadReport = {
  funnel: { stage: string; count: number }[];
  statusBreakdown: { open: number; onHold: number; won: number; lost: number };
  winRate: number | null;
  totalLeads: number;
  sourcePerformance: { source: string; total: number; won: number; lost: number; winRate: number | null }[];
};

function ReportsTab({ showToast }: { showToast: (msg: string) => void }) {
  const [report, setReport] = useState<LeadReport | null>(null);

  useEffect(() => {
    api<LeadReport>("/api/reports/leads")
      .then(setReport)
      .catch(() => showToast("Could not load reports"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!report) {
    return (
      <>
        <div className="page-head">
          <h2>Reports</h2>
        </div>
        <div className="empty-sm">Loading…</div>
      </>
    );
  }

  const maxFunnelCount = Math.max(1, ...report.funnel.map((f) => f.count));

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Reports</h2>
        </div>
      </div>

      <div className="grid3" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3>Total Leads</h3>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{report.totalLeads}</div>
        </div>
        <div className="card">
          <h3>Win Rate</h3>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#22c55e" }}>
            {report.winRate === null ? "—" : `${report.winRate}%`}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
            {report.statusBreakdown.won} Won · {report.statusBreakdown.lost} Lost
          </div>
        </div>
        <div className="card">
          <h3>Status Breakdown</h3>
          <div style={{ fontSize: 12.5, lineHeight: 1.9 }}>
            <div>Open: {report.statusBreakdown.open}</div>
            <div>On Hold: {report.statusBreakdown.onHold}</div>
            <div>Won: {report.statusBreakdown.won}</div>
            <div>Lost: {report.statusBreakdown.lost}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Pipeline Funnel</h3>
        {report.funnel.map((f) => (
          <div key={f.stage} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
              <span>{f.stage}</span>
              <span style={{ fontWeight: 700 }}>{f.count}</span>
            </div>
            <div style={{ background: "var(--border)", borderRadius: 6, height: 8, overflow: "hidden" }}>
              <div
                style={{
                  width: `${(f.count / maxFunnelCount) * 100}%`,
                  background: "var(--grad)",
                  height: "100%",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Lead Source Performance</h3>
        {report.sourcePerformance.length === 0 ? (
          <div className="empty-sm">No leads yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--ink-faint)" }}>
                  <th style={{ padding: "6px 8px" }}>Source</th>
                  <th style={{ padding: "6px 8px" }}>Total</th>
                  <th style={{ padding: "6px 8px" }}>Won</th>
                  <th style={{ padding: "6px 8px" }}>Lost</th>
                  <th style={{ padding: "6px 8px" }}>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {report.sourcePerformance.map((s) => (
                  <tr key={s.source} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 8px" }}>{s.source}</td>
                    <td style={{ padding: "6px 8px" }}>{s.total}</td>
                    <td style={{ padding: "6px 8px" }}>{s.won}</td>
                    <td style={{ padding: "6px 8px" }}>{s.lost}</td>
                    <td style={{ padding: "6px 8px" }}>{s.winRate === null ? "—" : `${s.winRate}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

type Profile = { id: string; email: string; name: string | null; role: string; createdAt: string };
type TeamUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  position: string | null;
  accessStart: string | null;
  accessEnd: string | null;
  attendanceEnabled: boolean;
  createdAt: string;
};

function SettingsTab({
  showToast,
  currentUser,
  isOwner,
  teamUsers,
  loadTeamUsers,
}: {
  showToast: (msg: string) => void;
  currentUser: { name: string | null; email: string; role: string; attendanceEnabled?: boolean };
  isOwner: boolean;
  teamUsers: TeamUser[];
  loadTeamUsers: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"Owner" | "Employee">("Employee");
  const [newUserPosition, setNewUserPosition] = useState("");
  const [newUserAccessStart, setNewUserAccessStart] = useState("");
  const [newUserAccessEnd, setNewUserAccessEnd] = useState("");
  const [newUserAttendanceEnabled, setNewUserAttendanceEnabled] = useState(true);
  const [addingUser, setAddingUser] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<"Owner" | "Employee">("Employee");
  const [editPosition, setEditPosition] = useState("");
  const [editAccessStart, setEditAccessStart] = useState("");
  const [editAccessEnd, setEditAccessEnd] = useState("");
  const [editAttendanceEnabled, setEditAttendanceEnabled] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    api<Profile>("/api/settings/profile")
      .then(setProfile)
      .catch(() => showToast("Could not load profile"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddUser() {
    if (!newUserEmail.trim() || !newUserPassword) {
      showToast("Email and password required");
      return;
    }
    if (newUserPassword.length < 8) {
      showToast("Password must be at least 8 characters");
      return;
    }
    setAddingUser(true);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newUserEmail.trim(),
          password: newUserPassword,
          name: newUserName.trim(),
          role: newUserRole,
          position: newUserPosition.trim(),
          accessStart: newUserAccessStart,
          accessEnd: newUserAccessEnd,
          attendanceEnabled: newUserAttendanceEnabled,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Could not add user");
      } else {
        showToast("User added");
        setNewUserEmail("");
        setNewUserName("");
        setNewUserPassword("");
        setNewUserRole("Employee");
        setNewUserPosition("");
        setNewUserAccessStart("");
        setNewUserAccessEnd("");
        setNewUserAttendanceEnabled(true);
        loadTeamUsers();
      }
    } catch {
      showToast("Something went wrong. Try again.");
    }
    setAddingUser(false);
  }

  function startEdit(u: TeamUser) {
    setEditingId(u.id);
    setEditRole(u.role === "Owner" ? "Owner" : "Employee");
    setEditPosition(u.position || "");
    setEditAccessStart(u.accessStart || "");
    setEditAccessEnd(u.accessEnd || "");
    setEditAttendanceEnabled(u.attendanceEnabled);
  }

  async function handleSaveEdit(u: TeamUser) {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/settings/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: u.name,
          role: editRole,
          position: editPosition.trim(),
          accessStart: editAccessStart,
          accessEnd: editAccessEnd,
          attendanceEnabled: editAttendanceEnabled,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Could not update user");
      } else {
        showToast("Updated");
        setEditingId(null);
        loadTeamUsers();
      }
    } catch {
      showToast("Something went wrong. Try again.");
    }
    setSavingEdit(false);
  }

  async function handleDeleteUser(id: string) {
    try {
      const res = await fetch(`/api/settings/users/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json.error || "Could not delete user");
      } else {
        loadTeamUsers();
      }
    } catch {
      showToast("Something went wrong. Try again.");
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast("Fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("New passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      showToast("New password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || "Could not change password");
      } else {
        showToast("Password updated");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      showToast("Something went wrong. Try again.");
    }
    setSaving(false);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Settings</h2>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, maxWidth: 440 }}>
        <h3>Profile</h3>
        {profile ? (
          <>
            <div className="entity-field">
              <span className="l">Name</span>
              <span className="v">{profile.name || "—"}</span>
            </div>
            <div className="entity-field">
              <span className="l">Email</span>
              <span className="v">{profile.email}</span>
            </div>
            <div className="entity-field">
              <span className="l">Role</span>
              <span className="v">{profile.role}</span>
            </div>
          </>
        ) : (
          <div className="empty-sm">Loading…</div>
        )}
      </div>

      <div className="card" style={{ maxWidth: 440 }}>
        <h3>Change Password</h3>
        <div className="field">
          <label>Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label>New Password</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="field">
          <label>Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <button className="btn" onClick={handleChangePassword} disabled={saving}>
          {saving ? "Saving…" : "Update Password"}
        </button>
      </div>

      {isOwner && (
        <div className="card" style={{ maxWidth: 520, marginTop: 20 }}>
          <h3>Team</h3>
          {teamUsers.length === 0 ? (
            <div className="empty-sm">Loading…</div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              {teamUsers.map((u) =>
                editingId === u.id ? (
                  <div key={u.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{u.name || u.email}</div>
                    <div className="field">
                      <label>Role</label>
                      <select value={editRole} onChange={(e) => setEditRole(e.target.value as "Owner" | "Employee")}>
                        <option value="Employee">Employee</option>
                        <option value="Owner">Owner</option>
                      </select>
                    </div>
                    {editRole === "Employee" && (
                      <>
                        <div className="field">
                          <label>Position</label>
                          <input
                            value={editPosition}
                            onChange={(e) => setEditPosition(e.target.value)}
                            placeholder="Sales Executive"
                          />
                        </div>
                        <div className="field">
                          <label>Access Hours (leave blank for no restriction)</label>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              type="time"
                              value={editAccessStart}
                              onChange={(e) => setEditAccessStart(e.target.value)}
                            />
                            <input
                              type="time"
                              value={editAccessEnd}
                              onChange={(e) => setEditAccessEnd(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="field">
                          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={editAttendanceEnabled}
                              onChange={(e) => setEditAttendanceEnabled(e.target.checked)}
                            />
                            Require geo-attendance check-in/out
                          </label>
                        </div>
                      </>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-sm" onClick={() => handleSaveEdit(u)} disabled={savingEdit}>
                        {savingEdit ? "Saving…" : "Save"}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="entity-field" key={u.id}>
                    <span className="l">
                      {u.name || u.email} <span style={{ opacity: 0.6 }}>· {u.role}</span>
                      {u.position && <span style={{ opacity: 0.6 }}> · {u.position}</span>}
                      {u.accessStart && u.accessEnd && (
                        <span style={{ opacity: 0.6 }}>
                          {" "}
                          · {u.accessStart}–{u.accessEnd}
                        </span>
                      )}
                      {u.role === "Employee" && !u.attendanceEnabled && (
                        <span style={{ opacity: 0.6 }}> · Attendance not required</span>
                      )}
                    </span>
                    <span className="v" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {u.email}
                      <button className="btn btn-ghost btn-sm" onClick={() => startEdit(u)}>
                        Edit
                      </button>
                      {u.email !== currentUser.email && (
                        <button className="btn-danger" onClick={() => handleDeleteUser(u.id)}>
                          Remove
                        </button>
                      )}
                    </span>
                  </div>
                )
              )}
            </div>
          )}

          <h3 style={{ marginTop: 0 }}>Add Team Member</h3>
          <div className="field">
            <label>Name</label>
            <input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Temporary Password</label>
            <input
              type="password"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="field">
            <label>Role</label>
            <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as "Owner" | "Employee")}>
              <option value="Employee">Employee — can't delete records or see commission</option>
              <option value="Owner">Owner — full access</option>
            </select>
          </div>
          {newUserRole === "Employee" && (
            <>
              <div className="field">
                <label>Position</label>
                <input
                  value={newUserPosition}
                  onChange={(e) => setNewUserPosition(e.target.value)}
                  placeholder="Sales Executive"
                />
              </div>
              <div className="field">
                <label>Access Hours (leave blank for no restriction)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="time"
                    value={newUserAccessStart}
                    onChange={(e) => setNewUserAccessStart(e.target.value)}
                  />
                  <input
                    type="time"
                    value={newUserAccessEnd}
                    onChange={(e) => setNewUserAccessEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={newUserAttendanceEnabled}
                    onChange={(e) => setNewUserAttendanceEnabled(e.target.checked)}
                  />
                  Require geo-attendance check-in/out
                </label>
              </div>
            </>
          )}
          <button className="btn" onClick={handleAddUser} disabled={addingUser}>
            {addingUser ? "Adding…" : "Add User"}
          </button>
        </div>
      )}
    </>
  );
}

function EntityModal({
  modal,
  contacts,
  projects,
  teamUsers,
  isOwner,
  onCancel,
  onSaveLead,
  onSaveContact,
  onSaveProject,
  onSaveEvent,
  onSaveTask,
  onSaveDoc,
  showToast,
}: {
  modal: Exclude<ModalState, { type: "whatsapp"; project: Project } | { type: "interaction"; contactId: string }>;
  contacts: Contact[];
  projects: Project[];
  teamUsers: TeamUser[];
  isOwner: boolean;
  onCancel: () => void;
  onSaveLead: (d: Partial<Lead>) => void;
  onSaveContact: (d: Partial<Contact> & Record<string, unknown>) => void;
  onSaveProject: (d: Partial<Project>) => void;
  onSaveEvent: (d: Partial<EventItem>) => void;
  onSaveTask: (d: Partial<Task>) => void;
  onSaveDoc: (d: Partial<DocumentItem>) => void;
  showToast: (msg: string) => void;
}) {
  const [form, setForm] = useState<Record<string, unknown>>(() => {
    if (modal.type === "contact") {
      const c = modal.entity;
      return {
        ...c,
        types: c.types ? [...c.types] : [],
        budget: c.buyerDetails?.budget,
        preferredLocation: c.buyerDetails?.preferredLocation,
        needs: c.buyerDetails?.needs,
        status: c.buyerDetails?.status,
        nextFollowUp: c.buyerDetails?.nextFollowUp,
        projects: c.builderDetails?.projects,
        commissionStructure: c.builderDetails?.commissionStructure,
        lastVisited: c.builderDetails?.lastVisited,
        nextVisit: c.builderDetails?.nextVisit,
        brochureLink: c.builderDetails?.brochureLink,
        agencyName: c.brokerDetails?.agencyName,
        commissionSplit: c.brokerDetails?.commissionSplit,
        brokerStatus: c.brokerDetails?.status,
        serviceType: c.vendorDetails?.serviceType,
        rateCardRef: c.vendorDetails?.rateCardRef,
        vendorStatus: c.vendorDetails?.status,
        propertyRef: c.sellerDetails?.propertyRef,
        askingPrice: c.sellerDetails?.askingPrice,
        sellerStatus: c.sellerDetails?.status,
      };
    }
    return { ...modal.entity };
  });
  const photoFileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!modal.entity.id;

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function str(key: string) {
    return (form[key] as string) || "";
  }
  const selectedTypes: string[] = (form.types as string[]) || [];
  function toggleType(t: string) {
    setForm((f) => {
      const cur: string[] = (f.types as string[]) || [];
      const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
      return { ...f, types: next };
    });
  }

  async function handleSave() {
    if (modal.type === "lead") {
      if (!str("name").trim() || !str("phone").trim()) {
        showToast("Name and phone required");
        return;
      }
      const stage = str("stage") || "Lead";
      if (stageRequiresBudget(stage) && !str("budgetRange").trim()) {
        showToast("Budget Range is required from Qualification stage onward");
        return;
      }
      onSaveLead({
        id: modal.entity.id,
        name: str("name"),
        phone: str("phone"),
        interest: str("interest"),
        propertyType: str("propertyType"),
        budgetRange: str("budgetRange"),
        preferredLocation: str("preferredLocation"),
        stage,
        status: str("status") || "Open",
        lossReason: str("status") === "Lost" ? str("lossReason") || null : null,
        source: str("source"),
        assignedToId: isOwner ? str("assignedToId") || null : undefined,
      });
    } else if (modal.type === "contact") {
      if (!str("name").trim()) {
        showToast("Name required");
        return;
      }
      if (selectedTypes.length === 0) {
        showToast("Select at least one contact type");
        return;
      }
      onSaveContact({
        id: modal.entity.id,
        name: str("name"),
        phone: str("phone"),
        email: str("email"),
        types: selectedTypes,
        company: str("company"),
        tags: str("tags"),
        budget: str("budget"),
        preferredLocation: str("preferredLocation"),
        needs: str("needs"),
        status: str("status") || "Looking",
        nextFollowUp: str("nextFollowUp"),
        projects: str("projects"),
        commissionStructure: str("commissionStructure"),
        lastVisited: str("lastVisited"),
        nextVisit: str("nextVisit"),
        brochureLink: str("brochureLink"),
        agencyName: str("agencyName"),
        commissionSplit: str("commissionSplit"),
        brokerStatus: str("brokerStatus") || "Active",
        serviceType: str("serviceType"),
        rateCardRef: str("rateCardRef"),
        vendorStatus: str("vendorStatus") || "Active",
        propertyRef: str("propertyRef"),
        askingPrice: str("askingPrice"),
        sellerStatus: str("sellerStatus") || "Active",
      });
    } else if (modal.type === "project") {
      if (!str("name").trim()) {
        showToast("Project name required");
        return;
      }
      let photo = (modal.entity as Partial<Project>).photo || "";
      const file = photoFileRef.current?.files?.[0];
      if (file) {
        try {
          photo = await compressImage(file, 700);
        } catch {
          showToast("Could not process that image, saved without it.");
        }
      }
      onSaveProject({
        id: modal.entity.id,
        name: str("name"),
        builder: str("builder"),
        builderId: str("builderId") || null,
        price: str("price"),
        photo,
        brochureLink: str("brochureLink"),
        floorPlanLink: str("floorPlanLink"),
        amenities: str("amenities"),
        nearby: str("nearby"),
        commission: str("commission"),
        notes: str("notes"),
      });
    } else if (modal.type === "event") {
      if (!str("title").trim()) {
        showToast("Title required");
        return;
      }
      onSaveEvent({
        id: modal.entity.id,
        title: str("title"),
        type: str("type") || "Meeting",
        date: str("date") || todayStr(),
        time: str("time"),
        projectId: str("type") === "Site Visit" ? str("projectId") || null : null,
      });
    } else if (modal.type === "task") {
      if (!str("title").trim()) {
        showToast("Title required");
        return;
      }
      onSaveTask({
        title: str("title"),
        dueDate: str("dueDate") || todayStr(),
        contactId: (modal.entity as Partial<Task>).contactId ?? null,
      });
    } else if (modal.type === "doc") {
      if (!str("name").trim() || !str("link").trim()) {
        showToast("Name and link required");
        return;
      }
      onSaveDoc({ name: str("name"), type: str("type") || "Brochure", link: str("link") });
    }
  }

  const titleMap: Record<typeof modal.type, string> = {
    lead: `${isEdit ? "Edit" : "Add"} Lead`,
    contact: `${isEdit ? "Edit" : "Add"} Contact`,
    project: `${isEdit ? "Edit" : "Add"} Project`,
    event: `${isEdit ? "Edit" : "Add"} Event`,
    task: "Add Task",
    doc: "Add Document Link",
  };

  return (
    <div className="modal-back" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <h3>{titleMap[modal.type]}</h3>

        {modal.type === "lead" && (
          <>
            <div className="field">
              <label>Name</label>
              <input value={str("name")} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={str("phone")} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="field">
              <label>Property Type</label>
              <input value={str("propertyType")} onChange={(e) => set("propertyType", e.target.value)} placeholder="3BHK, Shop, Plot, ..." />
            </div>
            <div className="field">
              <label>
                Budget Range
                {stageRequiresBudget(str("stage") || "Lead") && <span style={{ color: "#ef4444" }}> *</span>}
              </label>
              <input value={str("budgetRange")} onChange={(e) => set("budgetRange", e.target.value)} placeholder="₹40-50L" />
            </div>
            <div className="field">
              <label>Preferred Location</label>
              <input value={str("preferredLocation")} onChange={(e) => set("preferredLocation", e.target.value)} />
            </div>
            <div className="field">
              <label>Interest / Notes</label>
              <input value={str("interest")} onChange={(e) => set("interest", e.target.value)} />
            </div>
            <div className="field">
              <label>Stage</label>
              <select value={str("stage") || "Lead"} onChange={(e) => set("stage", e.target.value)}>
                {STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select value={str("status") || "Open"} onChange={(e) => set("status", e.target.value)}>
                {LEAD_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            {str("status") === "Lost" && (
              <div className="field">
                <label>Loss Reason</label>
                <select value={str("lossReason")} onChange={(e) => set("lossReason", e.target.value)}>
                  <option value="">Select a reason…</option>
                  {LOSS_REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label>Source</label>
              <input value={str("source")} onChange={(e) => set("source", e.target.value)} />
            </div>
            {isOwner && (
              <div className="field">
                <label>Assigned To</label>
                <select value={str("assignedToId")} onChange={(e) => set("assignedToId", e.target.value)}>
                  <option value="">Unassigned</option>
                  {teamUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {modal.type === "contact" && (
          <>
            <div className="field">
              <label>Name</label>
              <input value={str("name")} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={str("phone")} onChange={(e) => set("phone", e.target.value)} placeholder="+91 ..." />
            </div>
            <div className="field">
              <label>Email</label>
              <input value={str("email")} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="field">
              <label>Company</label>
              <input value={str("company")} onChange={(e) => set("company", e.target.value)} />
            </div>

            <div className="field">
              <label>Type (select all that apply)</label>
              <div className="chip-row">
                {CONTACT_TYPES.map((t) => (
                  <div key={t} className={`chip ${selectedTypes.includes(t) ? "active" : ""}`} onClick={() => toggleType(t)}>
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {selectedTypes.includes("Buyer") && (
              <>
                <div className="field">
                  <label>Budget</label>
                  <input value={str("budget")} onChange={(e) => set("budget", e.target.value)} placeholder="₹1.5 Cr" />
                </div>
                <div className="field">
                  <label>Preferred Location</label>
                  <input value={str("preferredLocation")} onChange={(e) => set("preferredLocation", e.target.value)} />
                </div>
                <div className="field">
                  <label>Needs</label>
                  <input value={str("needs")} onChange={(e) => set("needs", e.target.value)} placeholder="3 BHK" />
                </div>
                <div className="field">
                  <label>Status</label>
                  <input value={str("status") || "Looking"} onChange={(e) => set("status", e.target.value)} />
                </div>
                <div className="field">
                  <label>Next Follow-up</label>
                  <input
                    type="date"
                    value={str("nextFollowUp").slice(0, 10)}
                    onChange={(e) => set("nextFollowUp", e.target.value)}
                  />
                </div>
              </>
            )}

            {selectedTypes.includes("Builder") && (
              <>
                <div className="field">
                  <label>Projects</label>
                  <input value={str("projects")} onChange={(e) => set("projects", e.target.value)} />
                </div>
                {isOwner && (
                  <div className="field">
                    <label>Commission Structure</label>
                    <input value={str("commissionStructure")} onChange={(e) => set("commissionStructure", e.target.value)} />
                  </div>
                )}
                <div className="field">
                  <label>Last Visited</label>
                  <input
                    type="date"
                    value={str("lastVisited").slice(0, 10)}
                    onChange={(e) => set("lastVisited", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Next Visit</label>
                  <input type="date" value={str("nextVisit").slice(0, 10)} onChange={(e) => set("nextVisit", e.target.value)} />
                </div>
                <div className="field">
                  <label>Brochure Link</label>
                  <input value={str("brochureLink")} onChange={(e) => set("brochureLink", e.target.value)} />
                </div>
              </>
            )}

            {selectedTypes.includes("Broker") && (
              <>
                <div className="field">
                  <label>Agency Name</label>
                  <input value={str("agencyName")} onChange={(e) => set("agencyName", e.target.value)} />
                </div>
                {isOwner && (
                  <div className="field">
                    <label>Commission Split</label>
                    <input value={str("commissionSplit")} onChange={(e) => set("commissionSplit", e.target.value)} />
                  </div>
                )}
                <div className="field">
                  <label>Broker Status</label>
                  <select value={str("brokerStatus") || "Active"} onChange={(e) => set("brokerStatus", e.target.value)}>
                    <option>Active</option>
                    <option>Inactive</option>
                    <option>Dormant</option>
                  </select>
                </div>
              </>
            )}

            {selectedTypes.includes("Vendor") && (
              <>
                <div className="field">
                  <label>Service Type</label>
                  <input value={str("serviceType")} onChange={(e) => set("serviceType", e.target.value)} placeholder="Photography, Legal, ..." />
                </div>
                <div className="field">
                  <label>Rate Card Reference</label>
                  <input value={str("rateCardRef")} onChange={(e) => set("rateCardRef", e.target.value)} />
                </div>
                <div className="field">
                  <label>Vendor Status</label>
                  <select value={str("vendorStatus") || "Active"} onChange={(e) => set("vendorStatus", e.target.value)}>
                    <option>Active</option>
                    <option>Inactive</option>
                    <option>Dormant</option>
                  </select>
                </div>
              </>
            )}

            {selectedTypes.includes("Seller") && (
              <>
                <div className="field">
                  <label>Property Reference</label>
                  <input value={str("propertyRef")} onChange={(e) => set("propertyRef", e.target.value)} placeholder="Which listing/project" />
                </div>
                <div className="field">
                  <label>Asking Price</label>
                  <input value={str("askingPrice")} onChange={(e) => set("askingPrice", e.target.value)} />
                </div>
                <div className="field">
                  <label>Seller Status</label>
                  <select value={str("sellerStatus") || "Active"} onChange={(e) => set("sellerStatus", e.target.value)}>
                    <option>Active</option>
                    <option>Inactive</option>
                    <option>Dormant</option>
                  </select>
                </div>
              </>
            )}

            <div className="field">
              <label>Tags (optional)</label>
              <input value={str("tags")} onChange={(e) => set("tags", e.target.value)} placeholder="VIP, Cold, ..." />
            </div>
          </>
        )}

        {modal.type === "project" && (
          <>
            <div className="field">
              <label>Project Name</label>
              <input value={str("name")} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="field">
              <label>Builder (contact)</label>
              <select value={str("builderId")} onChange={(e) => set("builderId", e.target.value)}>
                <option value="">— None —</option>
                {contacts
                  .filter((c) => c.types.includes("Builder"))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field">
              <label>Builder (free text fallback)</label>
              <input value={str("builder")} onChange={(e) => set("builder", e.target.value)} placeholder="If not in Contacts yet" />
            </div>
            <div className="field">
              <label>Price</label>
              <input value={str("price")} onChange={(e) => set("price", e.target.value)} />
            </div>
            <div className="field">
              <label>Photo</label>
              <input type="file" accept="image/*" ref={photoFileRef} />
              {(modal.entity as Partial<Project>).photo && (
                <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 4 }}>
                  Current photo saved — choose a new file to replace it.
                </div>
              )}
            </div>
            <div className="field">
              <label>Brochure Link</label>
              <input value={str("brochureLink")} onChange={(e) => set("brochureLink", e.target.value)} />
            </div>
            <div className="field">
              <label>Floor Plan Link</label>
              <input value={str("floorPlanLink")} onChange={(e) => set("floorPlanLink", e.target.value)} />
            </div>
            <div className="field">
              <label>Amenities</label>
              <input value={str("amenities")} onChange={(e) => set("amenities", e.target.value)} />
            </div>
            <div className="field">
              <label>Nearby</label>
              <input value={str("nearby")} onChange={(e) => set("nearby", e.target.value)} />
            </div>
            {isOwner && (
              <div className="field">
                <label>Commission</label>
                <input value={str("commission")} onChange={(e) => set("commission", e.target.value)} />
              </div>
            )}
            <div className="field">
              <label>Notes</label>
              <textarea value={str("notes")} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </>
        )}

        {modal.type === "event" && (
          <>
            <div className="field">
              <label>Title</label>
              <input value={str("title")} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={str("type") || "Meeting"} onChange={(e) => set("type", e.target.value)}>
                {EVENT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            {str("type") === "Site Visit" && (
              <div className="field">
                <label>Property</label>
                <select value={str("projectId")} onChange={(e) => set("projectId", e.target.value)}>
                  <option value="">Select a property…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label>Date</label>
              <input type="date" value={str("date") || todayStr()} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="field">
              <label>Time</label>
              <input type="time" value={str("time")} onChange={(e) => set("time", e.target.value)} />
            </div>
          </>
        )}

        {modal.type === "task" && (
          <>
            <div className="field">
              <label>Title</label>
              <input value={str("title")} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div className="field">
              <label>Due Date</label>
              <input
                type="date"
                value={str("dueDate").slice(0, 10) || todayStr()}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            </div>
          </>
        )}

        {modal.type === "doc" && (
          <>
            <div className="field">
              <label>Name</label>
              <input value={str("name")} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={str("type") || "Brochure"} onChange={(e) => set("type", e.target.value)}>
                {DOC_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Link</label>
              <input value={str("link")} onChange={(e) => set("link", e.target.value)} placeholder="https://..." />
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
