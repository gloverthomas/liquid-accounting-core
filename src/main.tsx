import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileBarChart2,
  FileText,
  Info,
  Landmark,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { PostHogProvider } from "@posthog/react";
import { WorkspacePage, type WorkspaceSection } from "./components/WorkspacePage";
import { AiAssistant } from "./components/AiAssistant";
import { captureProductEvent, createPosthogClient } from "./analytics";
import {
  openReportingRevenueSummary,
  reportingRevenueSummaryUrl,
} from "./demoSignal";
import { initSentry, reportCrossAppUrlDrift, Sentry } from "./sentry";
import liquidLogo from "./media/liquid-logo.png";
import liquidMark from "./media/liquid-mark.png";
import "./styles.css";

initSentry("core");
const posthogClient = createPosthogClient("core");

type NavItem = {
  label: string;
  icon: typeof LayoutDashboard;
  external?: boolean;
  expandable?: boolean;
  action?: "create";
};

type AppSection = "Dashboard" | WorkspaceSection;
type Organisation = { id: string; name: string; role: string };
type DashboardSummary = { cashAtBank: number };

const navigation: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Create", icon: Plus, action: "create" },
  { label: "Sales", icon: ShoppingBag, expandable: true },
  { label: "Purchases", icon: CreditCard, expandable: true },
  { label: "Banking", icon: Landmark, expandable: true },
  { label: "Contacts", icon: Users },
  { label: "Reports", icon: FileBarChart2, external: true },
];

const navChildren: Record<string, string[]> = {
  Sales: ["Invoices"],
  Purchases: ["Bills"],
  Banking: ["Transactions"],
};

const invoices = [
  { customer: "Hamilton Studio", number: "INV-1048", due: "Due tomorrow", amount: "$3,240.00", status: "Awaiting payment" },
  { customer: "Aster Coffee Roasters", number: "INV-1047", due: "Due 26 Jun", amount: "$1,875.00", status: "Sent" },
  { customer: "Northline Architecture", number: "INV-1045", due: "Overdue 2 days", amount: "$5,410.00", status: "Overdue" },
];

const cashFlowBars = [
  { month: "Jan", incoming: 48, outgoing: 31 },
  { month: "Feb", incoming: 61, outgoing: 43 },
  { month: "Mar", incoming: 54, outgoing: 36 },
  { month: "Apr", incoming: 72, outgoing: 39 },
  { month: "May", incoming: 67, outgoing: 45 },
  { month: "Jun", incoming: 86, outgoing: 34 },
];

const defaultReportingAppUrl = "http://localhost:3001";

function resolveReportingAppUrl(configuredUrl: string | undefined) {
  const candidate = configuredUrl?.trim();
  if (!candidate) {
    return defaultReportingAppUrl;
  }

  try {
    const parsedUrl = new URL(candidate);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
      ? parsedUrl.toString()
      : defaultReportingAppUrl;
  } catch {
    return defaultReportingAppUrl;
  }
}

const reportingAppUrl = resolveReportingAppUrl(import.meta.env.VITE_REPORTING_APP_URL);
reportCrossAppUrlDrift({
  app: "core",
  configuredUrl: reportingAppUrl,
  role: "reporting-target",
});

const invoiceCustomers = ["Blue Bottle Roasters", "Northside Cafe Group", "Harbour Espresso", "Atlas Wholesale"];

function sectionFromLocation(): AppSection {
  const section = window.location.hash.slice(1);
  return section === "sales"
    ? "Sales"
    : section === "purchases"
      ? "Purchases"
      : section === "banking"
        ? "Banking"
        : section === "contacts"
          ? "Contacts"
          : "Dashboard";
}

function hashForSection(section: AppSection) {
  return section === "Dashboard" ? "" : `#${section.toLowerCase()}`;
}

function AppLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <img
      className={collapsed ? "brand-mark" : "brand"}
      src={collapsed ? liquidMark : liquidLogo}
      alt="Liquid"
    />
  );
}

function App() {
  const [activeSection, setActiveSection] = useState<AppSection>(sectionFromLocation);
  const [organisation, setOrganisation] = useState<Organisation>({ id: "org_liquid_coffee", name: "Liquid Coffee Co.", role: "Owner" });
  const [dashboard, setDashboard] = useState<DashboardSummary>({ cashAtBank: 51392 });
  const [bffAvailable, setBffAvailable] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia("(max-width: 980px)").matches);
  const [expandedNav, setExpandedNav] = useState<string | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceCustomer, setInvoiceCustomer] = useState(invoiceCustomers[0]);
  const [invoiceItem, setInvoiceItem] = useState("Wholesale coffee beans — 12kg");
  const [invoiceAmount, setInvoiceAmount] = useState("1,280.00");
  const [invoiceDue, setInvoiceDue] = useState("7 Oct 2026");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const sidebarBeforeAssistantRef = useRef(false);
  const [invoiceSaved, setInvoiceSaved] = useState(false);
  const [chartsVisible, setChartsVisible] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const collapseButtonRef = useRef<HTMLButtonElement>(null);
  const modalTriggerRef = useRef<HTMLElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const createDialog = activeSection === "Purchases"
    ? { eyebrow: "New bill", title: "Create a bill", description: "This demo keeps bill creation local. The next step is to select a supplier and add bill details." }
    : activeSection === "Banking"
      ? { eyebrow: "Bank reconciliation", title: "Reconcile transactions", description: "This demo keeps reconciliation local. The next step is to match transactions to your records." }
      : activeSection === "Contacts"
        ? { eyebrow: "New contact", title: "Add a contact", description: "This demo keeps contact creation local. The next step is to add contact details." }
        : {
            eyebrow: "New invoice",
            title: "Create an invoice",
            description: "Select a customer and line item, then save the draft in Core.",
          };

  useEffect(() => {
    const revealCharts = window.setTimeout(() => setChartsVisible(true), 180);
    return () => window.clearTimeout(revealCharts);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadBffData = async () => {
      try {
        const [organisationResponse, dashboardResponse] = await Promise.all([
          fetch("/api/v1/organisation", { signal: controller.signal }),
          fetch("/api/v1/dashboard", { signal: controller.signal }),
        ]);
        if (!organisationResponse.ok || !dashboardResponse.ok) return;
        const [nextOrganisation, nextDashboard] = await Promise.all([
          organisationResponse.json() as Promise<Organisation>,
          dashboardResponse.json() as Promise<DashboardSummary>,
        ]);
        setOrganisation(nextOrganisation);
        setDashboard(nextDashboard);
        setBffAvailable(true);
        captureProductEvent(posthogClient, "bff_status", { source: "core", connected: true });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setBffAvailable(false);
        captureProductEvent(posthogClient, "bff_status", { source: "core", connected: false });
        console.info("Core BFF unavailable; displaying synthetic fallback data.");
      }
    };

    void loadBffData();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const compactViewport = window.matchMedia("(max-width: 980px)");
    const syncSidebarWithViewport = (event: MediaQueryListEvent) => {
      setSidebarCollapsed(event.matches);
    };

    compactViewport.addEventListener("change", syncSidebarWithViewport);
    return () => compactViewport.removeEventListener("change", syncSidebarWithViewport);
  }, []);

  useEffect(() => {
    if (sidebarCollapsed) {
      setExpandedNav(null);
    }
  }, [sidebarCollapsed]);

  const navigateTo = useCallback((section: AppSection) => {
    const nextHash = hashForSection(section);
    if (window.location.hash !== nextHash) {
      window.history.pushState({}, "", `${window.location.pathname}${window.location.search}${nextHash}`);
    }
    setActiveSection(section);
    captureProductEvent(posthogClient, "product_navigation", { source: "core", section });
  }, []);

  const closeInvoiceModal = useCallback(() => {
    setInvoiceModalOpen(false);
    setInvoiceSaved(false);
    requestAnimationFrame(() => modalTriggerRef.current?.focus());
  }, []);

  const openCreateDialog = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    modalTriggerRef.current = event.currentTarget;
    setInvoiceModalOpen(true);
    setInvoiceSaved(false);
    captureProductEvent(posthogClient, "create_dialog_opened", { source: "core", section: activeSection });
  }, [activeSection]);

  const saveInvoiceDraft = useCallback(() => {
    setInvoiceSaved(true);
    captureProductEvent(posthogClient, "create_dialog_opened", { source: "core", section: "Sales" });
    window.setTimeout(() => {
      closeInvoiceModal();
      navigateTo("Sales");
    }, 700);
  }, [closeInvoiceModal, navigateTo]);

  const openReports = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      void openReportingRevenueSummary({
        posthog: posthogClient,
        reportingAppUrl,
        source: "reports_nav",
      });
    },
    [],
  );

  const toggleAssistant = useCallback(() => {
    setAssistantOpen((open) => {
      const next = !open;
      if (next) {
        sidebarBeforeAssistantRef.current = sidebarCollapsed;
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(sidebarBeforeAssistantRef.current);
      }
      return next;
    });
    captureProductEvent(posthogClient, "product_navigation", {
      source: "core",
      section: "AI Assistant",
    });
  }, [sidebarCollapsed]);

  const closeAssistant = useCallback(() => {
    setAssistantOpen(false);
    setSidebarCollapsed(sidebarBeforeAssistantRef.current);
  }, []);

  useEffect(() => {
    if (!invoiceModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeInvoiceModal();
        return;
      }

      if (event.key !== "Tab" || !modalRef.current) {
        return;
      }

      const focusable = [...modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      const first = focusable[0];
      const last = focusable.at(-1);

      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    modalRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeInvoiceModal, invoiceModalOpen]);

  useEffect(() => {
    const syncSectionWithLocation = () => setActiveSection(sectionFromLocation());
    window.addEventListener("popstate", syncSectionWithLocation);
    window.addEventListener("hashchange", syncSectionWithLocation);
    return () => {
      window.removeEventListener("popstate", syncSectionWithLocation);
      window.removeEventListener("hashchange", syncSectionWithLocation);
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} ref={sidebarRef}>
        <div className="sidebar-header">
          <AppLogo collapsed={sidebarCollapsed} />
        </div>
        <button
          className="collapse-button"
          ref={collapseButtonRef}
          type="button"
          aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={() => {
            setSidebarCollapsed((collapsed) => !collapsed);
            // LIQ-6: keep keyboard focus on the control after the shell reflows.
            requestAnimationFrame(() => collapseButtonRef.current?.focus());
          }}
        >
          {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>

        <nav id="workspace-nav" aria-label="Primary navigation">
          <p className="nav-heading sidebar-label">Workspace</p>
          <ul className="nav-list">
            {navigation.map(({ label, icon: Icon, external, expandable, action }) => (
              <li key={label}>
                {external ? (
                  <a
                    className="nav-link"
                    href={reportingRevenueSummaryUrl(reportingAppUrl)}
                    title="Opens the standalone reporting application"
                    aria-label="Reports, opens the standalone reporting application"
                    onClick={(event) => {
                      void openReports(event);
                    }}
                  >
                    <Icon size={19} />
                    <span className="sidebar-label">{label}</span>
                  </a>
                ) : (
                  <>
                    <button
                      className={`nav-link ${action === "create" ? "nav-create" : ""} ${activeSection === label ? "nav-active" : ""}`}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-current={action ? undefined : activeSection === label ? "page" : undefined}
                      aria-expanded={expandable ? expandedNav === label : undefined}
                      onClick={(event) => {
                        if (action === "create") {
                          openCreateDialog(event);
                          return;
                        }
                        if (expandable && !sidebarCollapsed) {
                          setExpandedNav((current) => (current === label ? null : label));
                        }
                        navigateTo(label as AppSection);
                      }}
                    >
                      <Icon size={19} />
                      <span className="sidebar-label">{label}</span>
                      {expandable ? (
                        <ChevronRight
                          className={`nav-chevron ${expandedNav === label ? "nav-chevron-open" : ""}`}
                          size={16}
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                    {expandable && expandedNav === label && !sidebarCollapsed ? (
                      <ul className="nav-sublist">
                        {navChildren[label].map((child) => (
                          <li key={child}>
                            <button className="nav-sublink" type="button" onClick={() => navigateTo(label as AppSection)}>
                              {child}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-link" type="button" title="Settings" aria-label="Settings">
            <Settings size={19} />
            <span className="sidebar-label">Settings</span>
          </button>
          <div className="profile-card" title="Jordan Green" aria-label="Jordan Green, Owner">
            <span className="profile-avatar" aria-hidden="true">JG</span>
            <span className="sidebar-label">
              <strong>Jordan Green</strong>
              <small>Owner</small>
            </span>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="search-box">
            <Search size={18} />
            <input aria-label="Search" placeholder="Search transactions, contacts and more" />
            <kbd>⌘ K</kbd>
          </div>
          <div className="topbar-actions">
            <button
              className="ai-assistant-launch"
              type="button"
              aria-pressed={assistantOpen}
              aria-controls="liquid-ai-assistant"
              onClick={toggleAssistant}
            >
              <Sparkles size={15} aria-hidden="true" />
              <span>AI Assistant</span>
            </button>
            <button
              className="business-switcher"
              type="button"
              aria-label={`${organisation.name}, ${organisation.role}`}
              title={organisation.name}
            >
              <span className="business-avatar" aria-hidden="true">LC</span>
            </button>
          </div>
        </header>

        <div className="workspace-body">
      <main className="main-content">
        <div className="page">
          {activeSection === "Dashboard" ? (
            <>
          <section className="page-intro">
            <div>
              <p className="eyebrow">Tuesday, 24 June</p>
              <h1 ref={pageHeadingRef} tabIndex={-1}>Good morning, Jordan</h1>
              <p className="subtle">Here is what is happening in {organisation.name} today.</p>
            </div>
            <button className="primary-button" type="button" onClick={openCreateDialog}>
              <Plus size={18} />
              Create invoice
            </button>
          </section>

          <section className="attention-banner" aria-label="Cash-flow alert">
            <div className="attention-icon">
              <Sparkles size={19} />
            </div>
            <div>
              <strong>Cash flow is trending up</strong>
              <p>You have $8,235 due in the next 7 days. Sending two reminders could help you stay ahead.</p>
            </div>
            <button type="button">Review invoices <ArrowRight size={16} /></button>
          </section>

          <section className="stat-grid" aria-label="Business summary">
            <article className="stat-card">
              <div className="stat-title"><WalletCards size={19} /> Bank balance</div>
              <strong className="stat-value">{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(dashboard.cashAtBank)}</strong>
              <span className="change positive"><TrendingUp size={15} /> 8.4% from last month</span>
            </article>
            <article className="stat-card">
              <div className="stat-title"><FileText size={19} /> Money owed</div>
              <strong className="stat-value">$14,945.00</strong>
              <span className="change neutral">8 invoices awaiting payment</span>
            </article>
            <article className="stat-card">
              <div className="stat-title"><CreditCard size={19} /> Bills to pay</div>
              <strong className="stat-value">$6,412.80</strong>
              <span className="change negative"><TrendingDown size={15} /> 2 due this week</span>
            </article>
          </section>

          <section className="analytics-section" aria-labelledby="business-charts-title">
            <div className="analytics-heading">
              <div>
                <p className="panel-kicker">Your business</p>
                <h2 id="business-charts-title">Performance at a glance</h2>
              </div>
              <span>Last 3 months</span>
            </div>

            <div className="analytics-grid">
              <article className="analytics-card">
                <div className="analytics-card-header">
                  <div><h3>Income</h3><Info size={14} aria-label="Income information" /></div>
                  <span>Last 3 months</span>
                </div>
                <strong>$61,275.00</strong>
                <div className="mini-bar-chart" role="img" aria-label="Income over the last three months: April $29,400, May $45,300, June $61,275.">
                  <div className="mini-chart-grid" aria-hidden="true"><span /><span /><span /></div>
                  <div className="mini-bar-columns">
                    {[48, 74, 92].map((height, index) => (
                      <div key={height} className="mini-bar-column">
                        <i className="mini-bar income-bar" style={{ height: chartsVisible ? `${height}%` : "5%", transitionDelay: `${index * 160}ms` }} />
                        <span>{["Apr", "May", "Jun"][index]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mini-legend"><span><i className="legend-income" />Income</span></div>
              </article>

              <article className="analytics-card">
                <div className="analytics-card-header">
                  <div><h3>Expenses</h3><Info size={14} aria-label="Expenses information" /></div>
                  <span>Last 3 months</span>
                </div>
                <strong>$18,432.27</strong>
                <div className="mini-bar-chart" role="img" aria-label="Expenses over the last three months: April $13,270, May $8,846, June $18,432.">
                  <div className="mini-chart-grid" aria-hidden="true"><span /><span /><span /></div>
                  <div className="mini-bar-columns">
                    {[72, 48, 100].map((height, index) => (
                      <div key={height} className="mini-bar-column">
                        <i className="mini-bar expense-bar" style={{ height: chartsVisible ? `${height}%` : "5%", transitionDelay: `${index * 160 + 140}ms` }} />
                        <span>{["Apr", "May", "Jun"][index]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mini-legend"><span><i className="legend-expense" />Expenses</span></div>
              </article>

              <article className="analytics-card">
                <div className="analytics-card-header">
                  <div><h3>Financial position</h3><Info size={14} aria-label="Financial position information" /></div>
                  <span>This financial year</span>
                </div>
                <strong>$144,439.49</strong>
                <div className="mini-line-chart" role="img" aria-label="Financial position across April, May and June. Assets: April $95,000, May $122,000, June $144,439. Liabilities: April $55,000, May $50,000, June $54,000. Net position: April $40,000, May $72,000, June $90,000.">
                  <div className="mini-chart-grid" aria-hidden="true"><span /><span /><span /></div>
                  <svg viewBox="0 0 280 116" preserveAspectRatio="none" aria-hidden="true">
                    <polyline className={`financial-line assets ${chartsVisible ? "draw-line" : ""}`} points="0,84 140,55 280,27" />
                    <polyline className={`financial-line liabilities ${chartsVisible ? "draw-line" : ""}`} points="0,73 140,82 280,76" />
                    <polyline className={`financial-line profit ${chartsVisible ? "draw-line" : ""}`} points="0,88 140,70 280,43" />
                  </svg>
                  <div className="line-chart-labels"><span>Apr</span><span>May</span><span>Jun</span></div>
                </div>
                <div className="mini-legend"><span><i className="legend-asset" />Assets</span><span><i className="legend-expense" />Liabilities</span><span><i className="legend-profit" />Net position</span></div>
              </article>
            </div>
          </section>

          <section className="dashboard-grid">
            <article className="panel cash-panel">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">Cash flow</p>
                  <h2>Money in and out</h2>
                </div>
                <button className="text-button" type="button">View cash flow <ArrowRight size={16} /></button>
              </div>
              <div className="chart-summary">
                <div>
                  <span>Projected balance</span>
                  <strong>$51,392</strong>
                </div>
                <span className="change positive"><TrendingUp size={15} /> 12.4%</span>
              </div>
              <div className="bar-chart" role="img" aria-label="Cash flow over six months. Money in rises from 48 percent in January to 86 percent in June; money out is between 31 and 45 percent each month.">
                <div className="bar-chart-grid" aria-hidden="true"><span /><span /><span /><span /></div>
                <div className="bar-chart-legend"><span><i className="legend-income" />Money in</span><span><i className="legend-outgoing" />Money out</span></div>
                <div className="bar-chart-columns">
                  {cashFlowBars.map((bar, index) => (
                    <div className="bar-chart-column" key={bar.month}>
                      <div className="bar-pair">
                        <span className="bar bar-income" style={{ height: chartsVisible ? `${bar.incoming}%` : "4%", transitionDelay: `${index * 140}ms` }} />
                        <span className="bar bar-outgoing" style={{ height: chartsVisible ? `${bar.outgoing}%` : "4%", transitionDelay: `${index * 140 + 90}ms` }} />
                      </div>
                      <span>{bar.month}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="panel activity-panel">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">Up next</p>
                  <h2>Keep things moving</h2>
                </div>
                <button className="icon-button" type="button" aria-label="More actions"><MoreHorizontal size={20} /></button>
              </div>
              <div className="task-list">
                <button className="task-item" type="button">
                  <span className="task-icon"><Send size={17} /></span>
                  <span><strong>Send 2 invoice reminders</strong><small>$6,530 is overdue</small></span>
                  <ArrowRight size={17} />
                </button>
                <button className="task-item" type="button">
                  <span className="task-icon"><Building2 size={17} /></span>
                  <span><strong>Reconcile 14 transactions</strong><small>Westpac Business account</small></span>
                  <ArrowRight size={17} />
                </button>
                <a
                  className="task-item"
                  href={reportingRevenueSummaryUrl(reportingAppUrl)}
                  onClick={(event) => {
                    void openReports(event);
                  }}
                >
                  <span className="task-icon"><FileBarChart2 size={17} /></span>
                  <span><strong>Review your sales summary</strong><small>Opens the reporting app (legacy deep link)</small></span>
                  <ArrowRight size={17} />
                </a>
              </div>
            </article>
          </section>

          <section className="panel invoice-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Invoices</p>
                <h2>Recently sent</h2>
              </div>
              <button className="text-button" type="button">View all invoices <ArrowRight size={16} /></button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Customer</th><th>Invoice</th><th>Due</th><th>Status</th><th>Amount</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.number}>
                      <td><strong>{invoice.customer}</strong></td>
                      <td>{invoice.number}</td>
                      <td className={invoice.status === "Overdue" ? "overdue" : ""}>{invoice.due}</td>
                      <td>
                        <span
                          className={`status ${
                            invoice.status === "Overdue"
                              ? "status-overdue"
                              : invoice.status === "Sent"
                                ? "status-sent"
                                : "status-awaiting"
                          }`}
                        >
                          {invoice.status}
                        </span>
                      </td>
                      <td><strong>{invoice.amount}</strong></td>
                      <td><button className="icon-button small" type="button" aria-label={`Actions for ${invoice.number}`}><MoreHorizontal size={18} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
            </>
          ) : (
            <WorkspacePage
              section={activeSection}
              onPrimaryAction={openCreateDialog}
              headingRef={pageHeadingRef}
            />
          )}
        </div>
      </main>
      <div id="liquid-ai-assistant">
        <AiAssistant
          open={assistantOpen}
          onClose={closeAssistant}
          contextLabel={activeSection === "Dashboard" ? "Dashboard" : activeSection}
          userName="Jordan"
          onMessageOutcome={(outcome) => captureProductEvent(posthogClient, "assistant_message_sent", { source: "core", outcome })}
        />
      </div>
        </div>
      </div>

      {invoiceModalOpen && (
        <div className="modal-layer" role="presentation">
          <button className="modal-backdrop" aria-label="Close create invoice dialog" onClick={closeInvoiceModal} />
          <section className="invoice-modal invoice-modal-wide" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="create-dialog-title">
            <button className="modal-close icon-button" onClick={closeInvoiceModal} aria-label="Close dialog"><X size={20} /></button>
            <span className="modal-icon"><FileText size={22} /></span>
            <p className="eyebrow">{createDialog.eyebrow}</p>
            <h2 id="create-dialog-title">{createDialog.title}</h2>
            {activeSection === "Dashboard" || activeSection === "Sales" ? (
              <>
                <p>Fill in the draft below. Saving keeps you in Core on the Sales invoices list.</p>
                <form
                  className="invoice-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveInvoiceDraft();
                  }}
                >
                  <label>
                    Customer
                    <select value={invoiceCustomer} onChange={(event) => setInvoiceCustomer(event.target.value)}>
                      {invoiceCustomers.map((customer) => (
                        <option key={customer} value={customer}>
                          {customer}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Line item
                    <input value={invoiceItem} onChange={(event) => setInvoiceItem(event.target.value)} />
                  </label>
                  <div className="invoice-form-row">
                    <label>
                      Amount (AUD)
                      <input value={invoiceAmount} onChange={(event) => setInvoiceAmount(event.target.value)} inputMode="decimal" />
                    </label>
                    <label>
                      Due date
                      <input value={invoiceDue} onChange={(event) => setInvoiceDue(event.target.value)} />
                    </label>
                  </div>
                  {invoiceSaved ? <p className="invoice-signal" role="status">Draft saved</p> : null}
                  <div className="modal-actions">
                    <button className="secondary-button" type="button" onClick={closeInvoiceModal}>
                      Not now
                    </button>
                    <button className="primary-button" type="submit">
                      Save draft <ArrowRight size={17} />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <p>{createDialog.description}</p>
                <div className="modal-actions">
                  <button className="secondary-button" type="button" onClick={closeInvoiceModal}>
                    Not now
                  </button>
                  <button className="primary-button" type="button" onClick={closeInvoiceModal}>
                    Continue <ArrowRight size={17} />
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<p>Something went wrong loading Liquid.</p>}>
    {posthogClient ? (
      <PostHogProvider client={posthogClient}>
        <App />
      </PostHogProvider>
    ) : (
      <App />
    )}
  </Sentry.ErrorBoundary>,
);
