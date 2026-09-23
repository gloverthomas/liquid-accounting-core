import type { LucideIcon } from "lucide-react";
import type { MouseEvent, RefObject } from "react";
import {
  Landmark,
  Plus,
  ReceiptText,
  ShoppingBag,
  Users,
} from "lucide-react";

type WorkspaceSection = "Sales" | "Purchases" | "Banking" | "Contacts";

type Metric = {
  label: string;
  value: string;
  detail: string;
};

type TableRow = {
  primary: string;
  secondary: string;
  date: string;
  status: string;
  amount: string;
};

type SectionContent = {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  icon: LucideIcon;
  metrics: Metric[];
  tableTitle: string;
  columns: [string, string, string, string, string];
  rows: TableRow[];
};

const content: Record<WorkspaceSection, SectionContent> = {
  Sales: {
    eyebrow: "Sales",
    title: "Invoices",
    description: "Create invoices, follow up payments and stay on top of your cash flow.",
    action: "Create invoice",
    icon: ShoppingBag,
    metrics: [
      { label: "Money owed", value: "$14,945.00", detail: "8 invoices awaiting payment" },
      { label: "Overdue", value: "$6,530.00", detail: "2 invoices need attention" },
      { label: "Paid this month", value: "$23,184.00", detail: "12.4% more than May" },
    ],
    tableTitle: "Recent invoices",
    columns: ["Customer", "Invoice", "Due", "Status", "Amount"],
    rows: [
      { primary: "Hamilton Studio", secondary: "INV-1048", date: "25 Jun 2026", status: "Awaiting payment", amount: "$3,240.00" },
      { primary: "Aster Coffee Roasters", secondary: "INV-1047", date: "26 Jun 2026", status: "Sent", amount: "$1,875.00" },
      { primary: "Northline Architecture", secondary: "INV-1045", date: "22 Jun 2026", status: "Overdue", amount: "$5,410.00" },
    ],
  },
  Purchases: {
    eyebrow: "Purchases",
    title: "Bills",
    description: "Track what you owe, schedule payments and keep supplier records together.",
    action: "Create bill",
    icon: ReceiptText,
    metrics: [
      { label: "Bills to pay", value: "$6,412.80", detail: "5 bills due in the next 30 days" },
      { label: "Due this week", value: "$2,050.00", detail: "2 supplier payments scheduled" },
      { label: "Paid this month", value: "$18,290.64", detail: "Across 17 bills" },
    ],
    tableTitle: "Upcoming bills",
    columns: ["Supplier", "Bill", "Due", "Status", "Amount"],
    rows: [
      { primary: "Hawthorne Printing", secondary: "BILL-2281", date: "25 Jun 2026", status: "Due soon", amount: "$840.00" },
      { primary: "Civic Internet", secondary: "BILL-2280", date: "27 Jun 2026", status: "Scheduled", amount: "$310.80" },
      { primary: "Merchant Electric", secondary: "BILL-2278", date: "30 Jun 2026", status: "Unpaid", amount: "$900.00" },
    ],
  },
  Banking: {
    eyebrow: "Banking",
    title: "Transactions",
    description: "Reconcile your accounts and make sure every transaction is categorised.",
    action: "Reconcile",
    icon: Landmark,
    metrics: [
      { label: "Westpac Business", value: "$42,860.42", detail: "Last updated 2 minutes ago" },
      { label: "To reconcile", value: "14", detail: "Transactions need a category" },
      { label: "Cash in", value: "$11,285.00", detail: "In the last 7 days" },
    ],
    tableTitle: "Transactions to review",
    columns: ["Payee", "Reference", "Date", "Category", "Amount"],
    rows: [
      { primary: "Google Workspace", secondary: "Card payment", date: "23 Jun 2026", status: "Software", amount: "-$52.00" },
      { primary: "Hamilton Studio", secondary: "Bank transfer", date: "23 Jun 2026", status: "Uncategorised", amount: "+$3,240.00" },
      { primary: "Reece Plumbing", secondary: "Card payment", date: "22 Jun 2026", status: "Repairs & maintenance", amount: "-$188.00" },
    ],
  },
  Contacts: {
    eyebrow: "Contacts",
    title: "Customers & suppliers",
    description: "Keep the people and businesses you work with organised in one place.",
    action: "Add contact",
    icon: Users,
    metrics: [
      { label: "All contacts", value: "128", detail: "92 customers and 36 suppliers" },
      { label: "New this month", value: "8", detail: "Added to your address book" },
      { label: "With overdue invoices", value: "2", detail: "Require follow-up" },
    ],
    tableTitle: "Recently updated",
    columns: ["Contact", "Type", "Last activity", "Status", "Balance"],
    rows: [
      { primary: "Hamilton Studio", secondary: "Customer", date: "Invoice sent today", status: "Active", amount: "$3,240.00 owed" },
      { primary: "Hawthorne Printing", secondary: "Supplier", date: "Bill added yesterday", status: "Active", amount: "$840.00 to pay" },
      { primary: "Aster Coffee Roasters", secondary: "Customer", date: "Invoice viewed 20 Jun", status: "Active", amount: "$1,875.00 owed" },
    ],
  },
};

export function WorkspacePage({
  section,
  onPrimaryAction,
  headingRef,
}: {
  section: WorkspaceSection;
  onPrimaryAction: (event: MouseEvent<HTMLButtonElement>) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const page = content[section];
  const Icon = page.icon;

  return (
    <>
      <section className="page-intro">
        <div>
          <p className="eyebrow">{page.eyebrow}</p>
          <h1 ref={headingRef} tabIndex={-1}>{page.title}</h1>
          <p className="subtle">{page.description}</p>
        </div>
        <button className="primary-button" type="button" onClick={onPrimaryAction}>
          <Plus size={18} />
          {page.action}
        </button>
      </section>

      <section className="section-hero">
        <div className="section-hero-icon"><Icon size={22} /></div>
        <div>
          <strong>Your {page.eyebrow.toLowerCase()} workspace is up to date</strong>
          <p>Everything you need for today is ready to review.</p>
        </div>
        <span className="section-note">Updated today</span>
      </section>

      <section className="stat-grid" aria-label={`${section} summary`}>
        {page.metrics.map((metric) => (
          <article className="stat-card" key={metric.label}>
            <div className="stat-title"><Icon size={19} /> {metric.label}</div>
            <strong className="stat-value">{metric.value}</strong>
            <span className="change neutral">{metric.detail}</span>
          </article>
        ))}
      </section>

      <section className="panel invoice-panel workspace-table">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">{page.eyebrow}</p>
            <h2>{page.tableTitle}</h2>
          </div>
          <span className="table-filter">All records</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>{page.columns.map((column) => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>
              {page.rows.map((row) => (
                <tr key={row.secondary}>
                  <td><strong>{row.primary}</strong></td>
                  <td>{row.secondary}</td>
                  <td>{row.date}</td>
                  <td><span className="status">{row.status}</span></td>
                  <td><strong>{row.amount}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export type { WorkspaceSection };
