"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";

const STAGES = [
  "Lead",
  "Qualification",
  "Consultation",
  "Site Visit",
  "Negotiation",
  "Booked",
  "Registration",
  "Closed",
] as const;
const EVENT_TYPES = ["Call", "Meeting", "Site Visit", "Builder Meeting"] as const;
const NOTE_TYPES = ["Meeting", "Builder", "Buyer"] as const;
const DOC_TYPES = ["Brochure", "Price Sheet", "Floor Plan", "Legal Document", "RERA PDF"] as const;

type Lead = {
  id: string;
  name: string;
  phone: string;
  interest: string | null;
  stage: string;
  source: string | null;
  notes: string | null;
  createdAt: string;
};
type Buyer = {
  id: string;
  name: string;
  budget: string | null;
  location: string | null;
  needs: string | null;
  status: string;
  lastContact: string | null;
  nextFollowUp: string | null;
  interestedProjects: string | null;
};
type Builder = {
  id: string;
  name: string;
  contact: string | null;
  projects: string | null;
  commission: string | null;
  lastVisited: string | null;
  nextVisit: string | null;
  brochureLink: string | null;
  notes: string | null;
};
type Project = {
  id: string;
  name: string;
  builder: string | null;
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
};
type Task = {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
};
type Note = {
  id: string;
  type: string;
  relatedTo: string | null;
  text: string;
  createdAt: string;
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
  | "buyers"
  | "builders"
  | "projects"
  | "calendar"
  | "tasks"
  | "notes"
  | "docs"
  | "ai"
  | "settings";

type ModalState =
  | { type: "lead"; entity: Partial<Lead> }
  | { type: "buyer"; entity: Partial<Buyer> }
  | { type: "builder"; entity: Partial<Builder> }
  | { type: "project"; entity: Partial<Project> }
  | { type: "event"; entity: Partial<EventItem> }
  | { type: "task"; entity: Partial<Task> }
  | { type: "note"; entity: Partial<Note> }
  | { type: "doc"; entity: Partial<DocumentItem> };

function esc(s: string | null | undefined) {
  return s || "";
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function isToday(d: string | null) {
  return d === todayStr();
}
function fmt(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function waLink(phone: string) {
  let digits = (phone || "").replace(/[^0-9]/g, "");
  if (digits.length === 10) digits = "91" + digits;
  return "https://wa.me/" + digits;
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

export default function CrmApp() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [tab, setTab] = useState<Tab>("dashboard");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: string; id: string; label: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const aiMessagesRef = useRef<HTMLDivElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  async function loadAll() {
    const [l, b, bl, p, e, t, n, d] = await Promise.all([
      api<Lead[]>("/api/leads"),
      api<Buyer[]>("/api/buyers"),
      api<Builder[]>("/api/builders"),
      api<Project[]>("/api/projects"),
      api<EventItem[]>("/api/events"),
      api<Task[]>("/api/tasks"),
      api<Note[]>("/api/notes"),
      api<DocumentItem[]>("/api/documents"),
    ]);
    setLeads(l);
    setBuyers(b);
    setBuilders(bl);
    setProjects(p);
    setEvents(e);
    setTasks(t);
    setNotes(n);
    setDocs(d);
    setLoaded(true);
  }

  useEffect(() => {
    loadAll();
  }, []);

  // ---- CRUD helpers ----
  async function saveLead(data: Partial<Lead>) {
    if (data.id) {
      const updated = await api<Lead>(`/api/leads/${data.id}`, { method: "PUT", body: JSON.stringify(data) });
      setLeads((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } else {
      const created = await api<Lead>("/api/leads", { method: "POST", body: JSON.stringify(data) });
      setLeads((prev) => [created, ...prev]);
    }
    setModal(null);
  }
  async function saveBuyer(data: Partial<Buyer>) {
    if (data.id) {
      const updated = await api<Buyer>(`/api/buyers/${data.id}`, { method: "PUT", body: JSON.stringify(data) });
      setBuyers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } else {
      const created = await api<Buyer>("/api/buyers", { method: "POST", body: JSON.stringify(data) });
      setBuyers((prev) => [created, ...prev]);
    }
    setModal(null);
  }
  async function saveBuilder(data: Partial<Builder>) {
    if (data.id) {
      const updated = await api<Builder>(`/api/builders/${data.id}`, { method: "PUT", body: JSON.stringify(data) });
      setBuilders((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } else {
      const created = await api<Builder>("/api/builders", { method: "POST", body: JSON.stringify(data) });
      setBuilders((prev) => [created, ...prev]);
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
  async function saveNote(data: Partial<Note>) {
    const created = await api<Note>("/api/notes", { method: "POST", body: JSON.stringify(data) });
    setNotes((prev) => [created, ...prev]);
    setModal(null);
  }
  async function saveDoc(data: Partial<DocumentItem>) {
    const created = await api<DocumentItem>("/api/documents", { method: "POST", body: JSON.stringify(data) });
    setDocs((prev) => [created, ...prev]);
    setModal(null);
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
      buyer: async () => {
        await api(`/api/buyers/${id}`, { method: "DELETE" });
        setBuyers((prev) => prev.filter((x) => x.id !== id));
      },
      builder: async () => {
        await api(`/api/builders/${id}`, { method: "DELETE" });
        setBuilders((prev) => prev.filter((x) => x.id !== id));
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
      note: async () => {
        await api(`/api/notes/${id}`, { method: "DELETE" });
        setNotes((prev) => prev.filter((x) => x.id !== id));
      },
      doc: async () => {
        await api(`/api/documents/${id}`, { method: "DELETE" });
        setDocs((prev) => prev.filter((x) => x.id !== id));
      },
    };
    await map[kind]();
    setConfirmDelete(null);
  }

  async function toggleTask(t: Task) {
    const updated = await api<Task>(`/api/tasks/${t.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...t, done: !t.done }),
    });
    setTasks((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  async function moveLeadStage(id: string, stage: string) {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));
    await api(`/api/leads/${id}`, { method: "PUT", body: JSON.stringify({ ...lead, stage }) });
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

  const todaysTasks = tasks.filter((t) => t.dueDate === todayStr() && !t.done);
  const todaysFollowups = buyers.filter((b) => isToday(b.nextFollowUp));
  const todaysVisits = events.filter((e) => e.date === todayStr() && e.type === "Site Visit");
  const todaysMeetings = events.filter(
    (e) => e.date === todayStr() && (e.type === "Meeting" || e.type === "Builder Meeting")
  );
  const buildersToVisit = builders.filter((b) => b.nextVisit && b.nextVisit <= todayStr());
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
              ["buyers", "🧑‍💼 Buyers"],
              ["builders", "🏗️ Builders"],
              ["projects", "🏢 Projects"],
              ["calendar", "📅 Calendar"],
              ["tasks", "✅ Tasks"],
              ["notes", "📝 Notes"],
              ["docs", "📁 Documents"],
              ["ai", "✨ AI Assistant"],
              ["settings", "⚙️ Settings"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <div key={id} className={`nav-item ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
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
                todaysTasks={todaysTasks}
                todaysFollowups={todaysFollowups}
                todaysVisits={todaysVisits}
                todaysMeetings={todaysMeetings}
                buildersToVisit={buildersToVisit}
                recentLeads={recentLeads}
                docs={docs}
                leads={leads}
                onQuickAdd={(type) => setModal({ type, entity: {} } as ModalState)}
                onOpenBuyer={(id) => setModal({ type: "buyer", entity: buyers.find((b) => b.id === id) || {} })}
                onOpenLead={(id) => setModal({ type: "lead", entity: leads.find((l) => l.id === id) || {} })}
                onOpenBuilder={(id) => setModal({ type: "builder", entity: builders.find((b) => b.id === id) || {} })}
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
                onAdd={() => setModal({ type: "lead", entity: {} })}
                onEdit={(l) => setModal({ type: "lead", entity: l })}
                onDelete={(id) => requestDelete("lead", id, leads.find((l) => l.id === id)?.name || "lead")}
                onMoveStage={moveLeadStage}
                dragId={dragId}
                setDragId={setDragId}
              />
            )}
            {tab === "buyers" && (
              <BuyersTab
                buyers={buyers}
                onAdd={() => setModal({ type: "buyer", entity: {} })}
                onEdit={(b) => setModal({ type: "buyer", entity: b })}
                onDelete={(id) => requestDelete("buyer", id, buyers.find((b) => b.id === id)?.name || "buyer")}
              />
            )}
            {tab === "builders" && (
              <BuildersTab
                builders={builders}
                onAdd={() => setModal({ type: "builder", entity: {} })}
                onEdit={(b) => setModal({ type: "builder", entity: b })}
                onDelete={(id) => requestDelete("builder", id, builders.find((b) => b.id === id)?.name || "builder")}
              />
            )}
            {tab === "projects" && (
              <ProjectsTab
                projects={projects}
                onAdd={() => setModal({ type: "project", entity: {} })}
                onEdit={(p) => setModal({ type: "project", entity: p })}
                onDelete={(id) => requestDelete("project", id, projects.find((p) => p.id === id)?.name || "project")}
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
                onDelete={(id) => requestDelete("task", id, tasks.find((t) => t.id === id)?.title || "task")}
              />
            )}
            {tab === "notes" && (
              <NotesTab
                notes={notes}
                onAdd={() => setModal({ type: "note", entity: {} })}
                onDelete={(id) => requestDelete("note", id, "this note")}
              />
            )}
            {tab === "docs" && (
              <DocsTab
                docs={docs}
                onAdd={() => setModal({ type: "doc", entity: {} })}
                onDelete={(id) => requestDelete("doc", id, docs.find((d) => d.id === id)?.name || "document")}
              />
            )}
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
            {tab === "settings" && <SettingsTab showToast={showToast} />}
          </div>
        </div>
      </div>

      {modal && (
        <EntityModal
          modal={modal}
          onCancel={() => setModal(null)}
          onSaveLead={saveLead}
          onSaveBuyer={saveBuyer}
          onSaveBuilder={saveBuilder}
          onSaveProject={saveProject}
          onSaveEvent={saveEvent}
          onSaveTask={saveTask}
          onSaveNote={saveNote}
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
  return (
    <div className="pipeline">
      {STAGES.map((s) => {
        const cards = leads.filter((l) => l.stage === s);
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
  );
}

function Dashboard(props: {
  todaysTasks: Task[];
  todaysFollowups: Buyer[];
  todaysVisits: EventItem[];
  todaysMeetings: EventItem[];
  buildersToVisit: Builder[];
  recentLeads: Lead[];
  docs: DocumentItem[];
  leads: Lead[];
  onQuickAdd: (type: "lead" | "task" | "event" | "buyer" | "builder") => void;
  onOpenBuyer: (id: string) => void;
  onOpenLead: (id: string) => void;
  onOpenBuilder: (id: string) => void;
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
        <div className="qa-chip" onClick={() => props.onQuickAdd("buyer")}>
          + Add Buyer
        </div>
        <div className="qa-chip" onClick={() => props.onQuickAdd("builder")}>
          + Add Builder
        </div>
      </div>

      {props.buildersToVisit.length > 0 && (
        <div className="card" style={{ marginBottom: 16, border: "1.5px solid #4f46e5" }}>
          <h3>
            🏗️ Builders To Visit <span className="count">{props.buildersToVisit.length}</span>
          </h3>
          {props.buildersToVisit.map((b) => (
            <div key={b.id} className="item-row clickable" onClick={() => props.onOpenBuilder(b.id)}>
              <span className="item-title">{b.name}</span>
              <span className="item-sub">{esc(b.projects)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid3" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>
            Today&apos;s Tasks <span className="count">{props.todaysTasks.length}</span>
          </h3>
          {props.todaysTasks.length === 0 ? (
            <div className="empty-sm">Nothing due today.</div>
          ) : (
            props.todaysTasks.map((t) => (
              <div key={t.id} className="item-row">
                <span className="item-title">{t.title}</span>
              </div>
            ))
          )}
        </div>
        <div className="card">
          <h3>
            Today&apos;s Follow-ups <span className="count">{props.todaysFollowups.length}</span>
          </h3>
          {props.todaysFollowups.length === 0 ? (
            <div className="empty-sm">No follow-ups today.</div>
          ) : (
            props.todaysFollowups.map((b) => (
              <div key={b.id} className="item-row clickable" onClick={() => props.onOpenBuyer(b.id)}>
                <span className="item-title">{b.name}</span>
                <span className="item-sub">{esc(b.needs)}</span>
              </div>
            ))
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
              <div key={l.id} className="item-row clickable" onClick={() => props.onOpenLead(l.id)}>
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
  onAdd,
  onEdit,
  onDelete,
  onMoveStage,
  dragId,
  setDragId,
}: {
  leads: Lead[];
  onAdd: () => void;
  onEdit: (l: Lead) => void;
  onDelete: (id: string) => void;
  onMoveStage: (id: string, stage: string) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
}) {
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Leads</h2>
        </div>
        <button className="btn" onClick={onAdd}>
          + Add Lead
        </button>
      </div>
      <Pipeline leads={leads} onMoveStage={onMoveStage} dragId={dragId} setDragId={setDragId} />
      <div style={{ height: 20 }} />
      {leads.length === 0 ? (
        <div className="empty">No leads yet.</div>
      ) : (
        <div className="list-grid">
          {leads.map((l) => (
            <div className="row-card" key={l.id}>
              <div className="rc-main">
                <div className="rc-name">{l.name}</div>
                <div className="rc-meta">
                  {l.phone} · {esc(l.interest)} · {esc(l.source)}
                </div>
              </div>
              <span className="pill pill-stage">{l.stage}</span>
              <div className="row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => onEdit(l)}>
                  Edit
                </button>
                <button className="btn-danger" onClick={() => onDelete(l.id)}>
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

function BuyersTab({
  buyers,
  onAdd,
  onEdit,
  onDelete,
}: {
  buyers: Buyer[];
  onAdd: () => void;
  onEdit: (b: Buyer) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Buyers</h2>
        </div>
        <button className="btn" onClick={onAdd}>
          + Add Buyer
        </button>
      </div>
      {buyers.length === 0 ? (
        <div className="empty">No buyer profiles yet.</div>
      ) : (
        <div className="card-grid">
          {buyers.map((b) => (
            <div className="entity-card" key={b.id}>
              <div className="top-strip" />
              <div className="entity-name">{b.name}</div>
              {fieldRow("Budget", b.budget)}
              {fieldRow("Location", b.location)}
              {fieldRow("Needs", b.needs)}
              {fieldRow("Status", b.status)}
              {fieldRow("Last Contact", fmt(b.lastContact))}
              {fieldRow("Next Follow-up", fmt(b.nextFollowUp))}
              <div className="entity-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => onEdit(b)}>
                  Edit
                </button>
                <button className="btn-danger" onClick={() => onDelete(b.id)}>
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

function BuildersTab({
  builders,
  onAdd,
  onEdit,
  onDelete,
}: {
  builders: Builder[];
  onAdd: () => void;
  onEdit: (b: Builder) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Builders</h2>
        </div>
        <button className="btn" onClick={onAdd}>
          + Add Builder
        </button>
      </div>
      {builders.length === 0 ? (
        <div className="empty">No builder profiles yet.</div>
      ) : (
        <div className="card-grid">
          {builders.map((b) => (
            <div className="entity-card" key={b.id}>
              <div className="top-strip" />
              <div className="entity-name">{b.name}</div>
              {fieldRow("Contact", b.contact)}
              {fieldRow("Projects", b.projects)}
              {fieldRow("Commission", b.commission)}
              {fieldRow("Last Visited", fmt(b.lastVisited))}
              {b.nextVisit && (
                <div className="entity-field">
                  <span className="l">Next Visit</span>
                  <span className="v" style={b.nextVisit <= todayStr() ? { color: "var(--danger)" } : {}}>
                    {fmt(b.nextVisit)}
                  </span>
                </div>
              )}
              {fieldRow("Brochure", b.brochureLink, true)}
              {b.notes && <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 8 }}>{b.notes}</div>}
              <div className="entity-actions">
                {b.contact && (
                  <>
                    <a className="btn btn-ghost btn-sm" href={`tel:${b.contact.replace(/[^0-9+]/g, "")}`} title="Call">
                      📞
                    </a>
                    <a className="btn btn-ghost btn-sm" href={waLink(b.contact)} target="_blank" rel="noopener" title="WhatsApp">
                      💬
                    </a>
                  </>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => onEdit(b)}>
                  Edit
                </button>
                <button className="btn-danger" onClick={() => onDelete(b.id)}>
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

function ProjectsTab({
  projects,
  onAdd,
  onEdit,
  onDelete,
}: {
  projects: Project[];
  onAdd: () => void;
  onEdit: (p: Project) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Projects</h2>
        </div>
        <button className="btn" onClick={onAdd}>
          + Add Project
        </button>
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
              {fieldRow("Builder", p.builder)}
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
                <button className="btn-danger" onClick={() => onDelete(p.id)}>
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
  onDelete,
}: {
  tasks: Task[];
  onAdd: () => void;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const sorted = [...tasks].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
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
            <div className={`task-row ${t.done ? "done" : ""}`} key={t.id}>
              <div className={`task-check ${t.done ? "checked" : ""}`} onClick={() => onToggle(t)} />
              <div className="task-title">{t.title}</div>
              <div className="task-due">{fmt(t.dueDate)}</div>
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

function NotesTab({
  notes,
  onAdd,
  onDelete,
}: {
  notes: Note[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  const sorted = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Notes</h2>
        </div>
        <button className="btn" onClick={onAdd}>
          + Add Note
        </button>
      </div>
      {sorted.length === 0 ? (
        <div className="empty">No notes yet.</div>
      ) : (
        <div className="list-grid">
          {sorted.map((n) => (
            <div className="row-card" key={n.id}>
              <div className="rc-main">
                <div className="rc-name">{esc(n.relatedTo) || n.type}</div>
                <div className="rc-meta">
                  {n.type} · {fmt(n.createdAt)}
                </div>
                <div style={{ fontSize: 13, marginTop: 6 }}>{n.text}</div>
              </div>
              <button className="btn-danger" onClick={() => onDelete(n.id)}>
                Delete
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

type Profile = { id: string; email: string; name: string | null; role: string; createdAt: string };

function SettingsTab({ showToast }: { showToast: (msg: string) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Profile>("/api/settings/profile")
      .then(setProfile)
      .catch(() => showToast("Could not load profile"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    </>
  );
}

function EntityModal({
  modal,
  onCancel,
  onSaveLead,
  onSaveBuyer,
  onSaveBuilder,
  onSaveProject,
  onSaveEvent,
  onSaveTask,
  onSaveNote,
  onSaveDoc,
  showToast,
}: {
  modal: ModalState;
  onCancel: () => void;
  onSaveLead: (d: Partial<Lead>) => void;
  onSaveBuyer: (d: Partial<Buyer>) => void;
  onSaveBuilder: (d: Partial<Builder>) => void;
  onSaveProject: (d: Partial<Project>) => void;
  onSaveEvent: (d: Partial<EventItem>) => void;
  onSaveTask: (d: Partial<Task>) => void;
  onSaveNote: (d: Partial<Note>) => void;
  onSaveDoc: (d: Partial<DocumentItem>) => void;
  showToast: (msg: string) => void;
}) {
  const [form, setForm] = useState<Record<string, unknown>>({ ...modal.entity });
  const photoFileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!modal.entity.id;

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function str(key: string) {
    return (form[key] as string) || "";
  }

  async function handleSave() {
    if (modal.type === "lead") {
      if (!str("name").trim() || !str("phone").trim()) {
        showToast("Name and phone required");
        return;
      }
      onSaveLead({
        id: modal.entity.id,
        name: str("name"),
        phone: str("phone"),
        interest: str("interest"),
        stage: str("stage") || "Lead",
        source: str("source"),
      });
    } else if (modal.type === "buyer") {
      if (!str("name").trim()) {
        showToast("Name required");
        return;
      }
      onSaveBuyer({
        id: modal.entity.id,
        name: str("name"),
        budget: str("budget"),
        location: str("location"),
        needs: str("needs"),
        status: str("status") || "Looking",
        lastContact: str("lastContact"),
        nextFollowUp: str("nextFollowUp"),
      });
    } else if (modal.type === "builder") {
      if (!str("name").trim()) {
        showToast("Name required");
        return;
      }
      onSaveBuilder({
        id: modal.entity.id,
        name: str("name"),
        contact: str("contact"),
        projects: str("projects"),
        commission: str("commission"),
        lastVisited: str("lastVisited"),
        nextVisit: str("nextVisit"),
        brochureLink: str("brochureLink"),
        notes: str("notes"),
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
      });
    } else if (modal.type === "task") {
      if (!str("title").trim()) {
        showToast("Title required");
        return;
      }
      onSaveTask({ title: str("title"), dueDate: str("dueDate") || todayStr() });
    } else if (modal.type === "note") {
      if (!str("text").trim()) {
        showToast("Note text required");
        return;
      }
      onSaveNote({ type: str("type") || "Meeting", relatedTo: str("relatedTo"), text: str("text") });
    } else if (modal.type === "doc") {
      if (!str("name").trim() || !str("link").trim()) {
        showToast("Name and link required");
        return;
      }
      onSaveDoc({ name: str("name"), type: str("type") || "Brochure", link: str("link") });
    }
  }

  const titleMap: Record<ModalState["type"], string> = {
    lead: `${isEdit ? "Edit" : "Add"} Lead`,
    buyer: `${isEdit ? "Edit" : "Add"} Buyer`,
    builder: `${isEdit ? "Edit" : "Add"} Builder`,
    project: `${isEdit ? "Edit" : "Add"} Project`,
    event: `${isEdit ? "Edit" : "Add"} Event`,
    task: "Add Task",
    note: "Add Note",
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
              <label>Interest</label>
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
              <label>Source</label>
              <input value={str("source")} onChange={(e) => set("source", e.target.value)} />
            </div>
          </>
        )}

        {modal.type === "buyer" && (
          <>
            <div className="field">
              <label>Name</label>
              <input value={str("name")} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="field">
              <label>Budget</label>
              <input value={str("budget")} onChange={(e) => set("budget", e.target.value)} placeholder="₹1.5 Cr" />
            </div>
            <div className="field">
              <label>Location</label>
              <input value={str("location")} onChange={(e) => set("location", e.target.value)} />
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
              <label>Last Contact</label>
              <input type="date" value={str("lastContact").slice(0, 10)} onChange={(e) => set("lastContact", e.target.value)} />
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

        {modal.type === "builder" && (
          <>
            <div className="field">
              <label>Name</label>
              <input value={str("name")} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="field">
              <label>Contact</label>
              <input value={str("contact")} onChange={(e) => set("contact", e.target.value)} />
            </div>
            <div className="field">
              <label>Projects</label>
              <input value={str("projects")} onChange={(e) => set("projects", e.target.value)} />
            </div>
            <div className="field">
              <label>Commission</label>
              <input value={str("commission")} onChange={(e) => set("commission", e.target.value)} />
            </div>
            <div className="field">
              <label>Last Visited</label>
              <input type="date" value={str("lastVisited").slice(0, 10)} onChange={(e) => set("lastVisited", e.target.value)} />
            </div>
            <div className="field">
              <label>Next Visit</label>
              <input type="date" value={str("nextVisit").slice(0, 10)} onChange={(e) => set("nextVisit", e.target.value)} />
            </div>
            <div className="field">
              <label>Brochure Link</label>
              <input value={str("brochureLink")} onChange={(e) => set("brochureLink", e.target.value)} />
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea value={str("notes")} onChange={(e) => set("notes", e.target.value)} />
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
              <label>Builder</label>
              <input value={str("builder")} onChange={(e) => set("builder", e.target.value)} />
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
            <div className="field">
              <label>Commission</label>
              <input value={str("commission")} onChange={(e) => set("commission", e.target.value)} />
            </div>
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
              <input type="date" value={str("dueDate") || todayStr()} onChange={(e) => set("dueDate", e.target.value)} />
            </div>
          </>
        )}

        {modal.type === "note" && (
          <>
            <div className="field">
              <label>Type</label>
              <select value={str("type") || "Meeting"} onChange={(e) => set("type", e.target.value)}>
                {NOTE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Related To</label>
              <input value={str("relatedTo")} onChange={(e) => set("relatedTo", e.target.value)} placeholder="e.g. Dr. Sharma" />
            </div>
            <div className="field">
              <label>Note</label>
              <textarea value={str("text")} onChange={(e) => set("text", e.target.value)} />
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
