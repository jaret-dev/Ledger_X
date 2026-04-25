import { useState, type FormEvent } from "react";
import {
  useCreateBudget,
  useUpdateBudget,
  useCreateBill,
  useUpdateBill,
  useCreateDebt,
  useUpdateDebt,
  useCreateAdHoc,
  useUpdateAdHoc,
  useCreateIncome,
  useUpdateIncome,
  useCreateManualAccount,
  useUpdateAccount,
  useUpdateTransaction,
} from "../api/mutations";
import { Field, ModalActions, Select, TextInput, Textarea } from "./Modal";
import { useHousehold } from "../api/queries";

/**
 * One form component per resource. All follow the same shape:
 *   - take { initial?, onClose } — `initial` toggles create vs edit mode
 *   - hold local state per field (controlled inputs)
 *   - call create/update mutation, close on success
 *
 * Keep these in one file (vs one per resource) since they share so
 * much structure — easier to scan + extend than 6 separate files.
 */

// ─── Budget ──────────────────────────────────────────────────────────

type BudgetInitial = {
  id: number;
  name: string;
  category: string;
  amount: number;
  cycleType: "paycheck" | "monthly" | "biweekly";
};

const BUDGET_CATEGORIES = [
  "groceries",
  "gas",
  "dining",
  "entertainment",
  "household",
  "transport",
  "subscription",
  "other",
];

export function BudgetForm({
  initial,
  onClose,
}: {
  initial?: BudgetInitial;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? BUDGET_CATEGORIES[0]!);
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [cycleType, setCycleType] = useState<BudgetInitial["cycleType"]>(
    initial?.cycleType ?? "paycheck",
  );
  const create = useCreateBudget();
  const update = useUpdateBudget();
  const isPending = create.isPending || update.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = { name, category, amount: Number(amount), cycleType };
    if (initial) {
      update.mutate({ id: initial.id, input }, { onSuccess: onClose });
    } else {
      create.mutate(input, { onSuccess: onClose });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Name" htmlFor="b-name">
        <TextInput
          id="b-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Groceries"
        />
      </Field>
      <Field label="Category" htmlFor="b-cat">
        <Select id="b-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
          {BUDGET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Per-cycle amount (CAD)" htmlFor="b-amt">
        <TextInput
          id="b-amt"
          type="number"
          step="0.01"
          min="0"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="400"
        />
      </Field>
      <Field label="Cycle" htmlFor="b-cycle">
        <Select
          id="b-cycle"
          value={cycleType}
          onChange={(e) => setCycleType(e.target.value as BudgetInitial["cycleType"])}
        >
          <option value="paycheck">Per paycheck</option>
          <option value="monthly">Monthly</option>
          <option value="biweekly">Biweekly</option>
        </Select>
      </Field>
      <ModalActions
        onCancel={onClose}
        primaryLabel={initial ? "Save" : "Create"}
        isPending={isPending}
      />
    </form>
  );
}

// ─── RecurringBill ───────────────────────────────────────────────────

type BillInitial = {
  id: number;
  name: string;
  category: string;
  amount: number;
  amountVariable: boolean;
  frequency: "monthly" | "biweekly" | "quarterly" | "annual";
  dueDayOfMonth: number | null;
  nextDueDate: string;
  autopay: boolean;
  paymentMethod: string | null;
};

const BILL_CATEGORIES = [
  "housing",
  "utilities",
  "insurance",
  "subscription",
  "transport",
  "other",
];

export function BillForm({ initial, onClose }: { initial?: BillInitial; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? BILL_CATEGORIES[0]!);
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [variable, setVariable] = useState(initial?.amountVariable ?? false);
  const [frequency, setFrequency] = useState<BillInitial["frequency"]>(
    initial?.frequency ?? "monthly",
  );
  const [dueDay, setDueDay] = useState(initial?.dueDayOfMonth?.toString() ?? "1");
  const [nextDue, setNextDue] = useState(initial?.nextDueDate ?? todayIso());
  const [autopay, setAutopay] = useState(initial?.autopay ?? true);
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? "");
  const create = useCreateBill();
  const update = useUpdateBill();
  const isPending = create.isPending || update.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = {
      name,
      category,
      amount: Number(amount),
      amountVariable: variable,
      frequency,
      dueDayOfMonth: dueDay ? Number(dueDay) : null,
      nextDueDate: nextDue,
      autopay,
      paymentMethod: paymentMethod || null,
    };
    if (initial) {
      update.mutate({ id: initial.id, input }, { onSuccess: onClose });
    } else {
      create.mutate(input, { onSuccess: onClose });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Name" htmlFor="bl-name">
        <TextInput
          id="bl-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rent"
        />
      </Field>
      <Field label="Category" htmlFor="bl-cat">
        <Select id="bl-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
          {BILL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Amount (CAD)" htmlFor="bl-amt">
        <TextInput
          id="bl-amt"
          type="number"
          step="0.01"
          min="0"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <div className="mb-3 flex items-center gap-2 text-[12px]">
        <input
          id="bl-var"
          type="checkbox"
          checked={variable}
          onChange={(e) => setVariable(e.target.checked)}
        />
        <label htmlFor="bl-var" className="text-ink-2">
          Amount varies (e.g. hydro)
        </label>
      </div>
      <Field label="Frequency" htmlFor="bl-freq">
        <Select
          id="bl-freq"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as BillInitial["frequency"])}
        >
          <option value="monthly">Monthly</option>
          <option value="biweekly">Biweekly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
        </Select>
      </Field>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Field label="Due day (1-31)" htmlFor="bl-day">
          <TextInput
            id="bl-day"
            type="number"
            min="1"
            max="31"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
          />
        </Field>
        <Field label="Next due date" htmlFor="bl-next">
          <TextInput
            id="bl-next"
            type="date"
            required
            value={nextDue}
            onChange={(e) => setNextDue(e.target.value)}
          />
        </Field>
      </div>
      <div className="mb-3 flex items-center gap-2 text-[12px]">
        <input
          id="bl-auto"
          type="checkbox"
          checked={autopay}
          onChange={(e) => setAutopay(e.target.checked)}
        />
        <label htmlFor="bl-auto" className="text-ink-2">
          Autopay
        </label>
      </div>
      <Field label="Payment method (display)" htmlFor="bl-pm" hint="e.g. TD Chq ····8842">
        <TextInput
          id="bl-pm"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        />
      </Field>
      <ModalActions
        onCancel={onClose}
        primaryLabel={initial ? "Save" : "Create"}
        isPending={isPending}
      />
    </form>
  );
}

// ─── Debt ────────────────────────────────────────────────────────────

type DebtInitial = {
  id: number;
  name: string;
  type: "credit_card" | "line_of_credit" | "loan" | "student_loan" | "mortgage";
  balance: number;
  originalBalance: number | null;
  creditLimit: number | null;
  apr: number;
  minPayment: number;
  dueDayOfMonth: number | null;
};

export function DebtForm({ initial, onClose }: { initial?: DebtInitial; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<DebtInitial["type"]>(initial?.type ?? "credit_card");
  const [balance, setBalance] = useState(initial?.balance?.toString() ?? "");
  const [originalBalance, setOriginalBalance] = useState(
    initial?.originalBalance?.toString() ?? "",
  );
  const [creditLimit, setCreditLimit] = useState(initial?.creditLimit?.toString() ?? "");
  const [apr, setApr] = useState(initial?.apr?.toString() ?? "");
  const [minPayment, setMinPayment] = useState(initial?.minPayment?.toString() ?? "");
  const [dueDay, setDueDay] = useState(initial?.dueDayOfMonth?.toString() ?? "");
  const create = useCreateDebt();
  const update = useUpdateDebt();
  const isPending = create.isPending || update.isPending;

  const isRevolving = type === "credit_card" || type === "line_of_credit";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = {
      name,
      type,
      balance: Number(balance),
      originalBalance: originalBalance ? Number(originalBalance) : null,
      creditLimit: creditLimit ? Number(creditLimit) : null,
      apr: Number(apr),
      minPayment: Number(minPayment),
      dueDayOfMonth: dueDay ? Number(dueDay) : null,
    };
    if (initial) {
      update.mutate({ id: initial.id, input }, { onSuccess: onClose });
    } else {
      create.mutate(input, { onSuccess: onClose });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Name" htmlFor="d-name">
        <TextInput
          id="d-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="TD Visa"
        />
      </Field>
      <Field label="Type" htmlFor="d-type">
        <Select
          id="d-type"
          value={type}
          onChange={(e) => setType(e.target.value as DebtInitial["type"])}
        >
          <option value="credit_card">Credit card</option>
          <option value="line_of_credit">Line of credit</option>
          <option value="loan">Loan</option>
          <option value="student_loan">Student loan</option>
          <option value="mortgage">Mortgage</option>
        </Select>
      </Field>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Field label="Current balance" htmlFor="d-bal">
          <TextInput
            id="d-bal"
            type="number"
            step="0.01"
            min="0"
            required
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        </Field>
        <Field
          label={isRevolving ? "Credit limit" : "Original balance"}
          htmlFor="d-secondary"
          hint={isRevolving ? "" : "for installment loans"}
        >
          <TextInput
            id="d-secondary"
            type="number"
            step="0.01"
            min="0"
            value={isRevolving ? creditLimit : originalBalance}
            onChange={(e) =>
              isRevolving ? setCreditLimit(e.target.value) : setOriginalBalance(e.target.value)
            }
          />
        </Field>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Field label="APR (%)" htmlFor="d-apr">
          <TextInput
            id="d-apr"
            type="number"
            step="0.01"
            min="0"
            required
            value={apr}
            onChange={(e) => setApr(e.target.value)}
          />
        </Field>
        <Field label="Min payment" htmlFor="d-min">
          <TextInput
            id="d-min"
            type="number"
            step="0.01"
            min="0"
            required
            value={minPayment}
            onChange={(e) => setMinPayment(e.target.value)}
          />
        </Field>
        <Field label="Due day" htmlFor="d-day">
          <TextInput
            id="d-day"
            type="number"
            min="1"
            max="31"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
          />
        </Field>
      </div>
      <ModalActions
        onCancel={onClose}
        primaryLabel={initial ? "Save" : "Create"}
        isPending={isPending}
      />
    </form>
  );
}

// ─── AdHoc ───────────────────────────────────────────────────────────

type AdHocInitial = {
  id: number;
  name: string;
  description: string | null;
  category: "travel" | "gifts" | "auto" | "medical" | "home" | "other";
  amount: number;
  dueDate: string;
  status: "planned" | "funded" | "paid" | "cancelled";
  notes: string | null;
};

export function AdHocForm({
  initial,
  onClose,
}: {
  initial?: AdHocInitial;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<AdHocInitial["category"]>(
    initial?.category ?? "other",
  );
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? todayIso());
  const [status, setStatus] = useState<AdHocInitial["status"]>(initial?.status ?? "planned");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const create = useCreateAdHoc();
  const update = useUpdateAdHoc();
  const isPending = create.isPending || update.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = {
      name,
      description: description || null,
      category,
      amount: Number(amount),
      dueDate,
      status,
      notes: notes || null,
    };
    if (initial) {
      update.mutate({ id: initial.id, input }, { onSuccess: onClose });
    } else {
      create.mutate(input, { onSuccess: onClose });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Name" htmlFor="a-name">
        <TextInput
          id="a-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Connor's wedding · hotel"
        />
      </Field>
      <Field label="Short description" htmlFor="a-desc">
        <TextInput
          id="a-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Hilton Niagara · two nights"
        />
      </Field>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Field label="Category" htmlFor="a-cat">
          <Select
            id="a-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as AdHocInitial["category"])}
          >
            <option value="travel">Travel</option>
            <option value="gifts">Gifts</option>
            <option value="auto">Auto</option>
            <option value="medical">Medical</option>
            <option value="home">Home</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Amount (CAD)" htmlFor="a-amt">
          <TextInput
            id="a-amt"
            type="number"
            step="0.01"
            min="0"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Field label="Due date" htmlFor="a-due">
          <TextInput
            id="a-due"
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
        <Field label="Status" htmlFor="a-status">
          <Select
            id="a-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AdHocInitial["status"])}
          >
            <option value="planned">Planned</option>
            <option value="funded">Funded</option>
            <option value="paid">Paid</option>
          </Select>
        </Field>
      </div>
      <Field label="Notes" htmlFor="a-notes">
        <Textarea
          id="a-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <ModalActions
        onCancel={onClose}
        primaryLabel={initial ? "Save" : "Create"}
        isPending={isPending}
      />
    </form>
  );
}

// ─── Income ──────────────────────────────────────────────────────────

type IncomeInitial = {
  id: number;
  userId: number;
  name: string;
  type: "salary" | "self_employed" | "bonus" | "other";
  amount: number;
  amountVariable: boolean;
  frequency: "biweekly" | "monthly" | "annual" | "variable";
  payDayOfWeek: number | null;
  nextPayDate: string | null;
  isPrimary: boolean;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function IncomeForm({
  initial,
  onClose,
}: {
  initial?: IncomeInitial;
  onClose: () => void;
}) {
  const householdQ = useHousehold();
  const [name, setName] = useState(initial?.name ?? "");
  const [userId, setUserId] = useState(initial?.userId?.toString() ?? "");
  const [type, setType] = useState<IncomeInitial["type"]>(initial?.type ?? "salary");
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [variable, setVariable] = useState(initial?.amountVariable ?? false);
  const [frequency, setFrequency] = useState<IncomeInitial["frequency"]>(
    initial?.frequency ?? "biweekly",
  );
  const [payDay, setPayDay] = useState(initial?.payDayOfWeek?.toString() ?? "");
  const [nextPay, setNextPay] = useState(initial?.nextPayDate ?? "");
  const [primary, setPrimary] = useState(initial?.isPrimary ?? false);
  const create = useCreateIncome();
  const update = useUpdateIncome();
  const isPending = create.isPending || update.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = {
      userId: Number(userId),
      name,
      type,
      amount: Number(amount),
      amountVariable: variable,
      frequency,
      payDayOfWeek: payDay ? Number(payDay) : null,
      nextPayDate: nextPay || null,
      isPrimary: primary,
    };
    if (initial) {
      update.mutate({ id: initial.id, input }, { onSuccess: onClose });
    } else {
      create.mutate(input, { onSuccess: onClose });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Source name" htmlFor="i-name">
        <TextInput
          id="i-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mojo Food Group"
        />
      </Field>
      <Field label="Earner" htmlFor="i-user">
        <Select id="i-user" required value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Select…</option>
          {householdQ.data?.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Field label="Type" htmlFor="i-type">
          <Select
            id="i-type"
            value={type}
            onChange={(e) => setType(e.target.value as IncomeInitial["type"])}
          >
            <option value="salary">Salary</option>
            <option value="self_employed">Self-employed</option>
            <option value="bonus">Bonus</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Amount" htmlFor="i-amt">
          <TextInput
            id="i-amt"
            type="number"
            step="0.01"
            min="0"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Frequency" htmlFor="i-freq">
        <Select
          id="i-freq"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as IncomeInitial["frequency"])}
        >
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
          <option value="variable">Variable</option>
        </Select>
      </Field>
      {frequency === "biweekly" && (
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Field label="Pay day" htmlFor="i-day">
            <Select id="i-day" value={payDay} onChange={(e) => setPayDay(e.target.value)}>
              <option value="">—</option>
              {DAYS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Next pay date" htmlFor="i-next">
            <TextInput
              id="i-next"
              type="date"
              value={nextPay}
              onChange={(e) => setNextPay(e.target.value)}
            />
          </Field>
        </div>
      )}
      <div className="mb-3 flex items-center gap-3 text-[12px]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={variable}
            onChange={(e) => setVariable(e.target.checked)}
          />
          <span className="text-ink-2">Variable amount</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={primary}
            onChange={(e) => setPrimary(e.target.checked)}
          />
          <span className="text-ink-2">Primary source (drives paycheck cycle)</span>
        </label>
      </div>
      <ModalActions
        onCancel={onClose}
        primaryLabel={initial ? "Save" : "Create"}
        isPending={isPending}
      />
    </form>
  );
}

// ─── Manual Account ──────────────────────────────────────────────────

type AccountInitial = {
  id: number;
  institution: string;
  nickname: string;
  type: "depository" | "credit" | "loan" | "investment";
  subtype: string | null;
  currentBalance: number | null;
  creditLimit: number | null;
  currency: string;
};

export function AccountForm({
  initial,
  onClose,
}: {
  initial?: AccountInitial;
  onClose: () => void;
}) {
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [type, setType] = useState<AccountInitial["type"]>(initial?.type ?? "depository");
  const [subtype, setSubtype] = useState(initial?.subtype ?? "");
  const [balance, setBalance] = useState(initial?.currentBalance?.toString() ?? "");
  const [creditLimit, setCreditLimit] = useState(initial?.creditLimit?.toString() ?? "");
  const create = useCreateManualAccount();
  const update = useUpdateAccount();
  const isPending = create.isPending || update.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = {
      institution,
      nickname,
      type,
      subtype: subtype || null,
      currentBalance: balance ? Number(balance) : null,
      creditLimit: creditLimit ? Number(creditLimit) : null,
      currency: "CAD",
    };
    if (initial) {
      update.mutate({ id: initial.id, input }, { onSuccess: onClose });
    } else {
      create.mutate(input, { onSuccess: onClose });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Institution" htmlFor="ac-inst">
        <TextInput
          id="ac-inst"
          required
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          placeholder="Ontario Student Assistance Program"
        />
      </Field>
      <Field label="Nickname" htmlFor="ac-nick">
        <TextInput
          id="ac-nick"
          required
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="OSAP"
        />
      </Field>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Field label="Type" htmlFor="ac-type">
          <Select
            id="ac-type"
            value={type}
            onChange={(e) => setType(e.target.value as AccountInitial["type"])}
          >
            <option value="depository">Depository</option>
            <option value="credit">Credit</option>
            <option value="loan">Loan</option>
            <option value="investment">Investment</option>
          </Select>
        </Field>
        <Field label="Subtype" htmlFor="ac-sub" hint="e.g. checking, tfsa, student_loan">
          <TextInput id="ac-sub" value={subtype} onChange={(e) => setSubtype(e.target.value)} />
        </Field>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Field label="Current balance" htmlFor="ac-bal">
          <TextInput
            id="ac-bal"
            type="number"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        </Field>
        <Field label="Credit limit (cards/LOC only)" htmlFor="ac-lim">
          <TextInput
            id="ac-lim"
            type="number"
            step="0.01"
            min="0"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
          />
        </Field>
      </div>
      <ModalActions
        onCancel={onClose}
        primaryLabel={initial ? "Save" : "Create"}
        isPending={isPending}
      />
    </form>
  );
}

// ─── Transaction edit (recategorize / hide / notes) ─────────────────

type TransactionInitial = {
  id: number;
  merchantName: string | null;
  merchantRaw: string;
  date: string;
  amount: number;
  category: string | null;
  notes: string | null;
  isHidden: boolean;
};

const TXN_CATEGORIES = [
  "groceries",
  "gas",
  "dining",
  "entertainment",
  "household",
  "transport",
  "travel",
  "gifts",
  "medical",
  "subscription",
  "income",
  "debt_payment",
  "transfer",
  "other",
];

export function TransactionEditForm({
  initial,
  onClose,
}: {
  initial: TransactionInitial;
  onClose: () => void;
}) {
  const [category, setCategory] = useState(initial.category ?? "other");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [hidden, setHidden] = useState(initial.isHidden);
  const update = useUpdateTransaction();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate(
      {
        id: initial.id,
        input: {
          category,
          categorySource: "user",
          notes: notes || null,
          isHidden: hidden,
        },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4 border border-line bg-bg-2 px-4 py-3 text-[12px] text-ink-2">
        <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
          {initial.date}
        </div>
        <div className="mt-1 text-[13px] text-ink">
          {initial.merchantName ?? initial.merchantRaw}
        </div>
        <div className="mt-1 font-mono text-[12px]">
          {initial.amount < 0
            ? `+${Math.abs(initial.amount).toFixed(2)}`
            : initial.amount.toFixed(2)}{" "}
          CAD
        </div>
      </div>

      <Field label="Category" htmlFor="t-cat">
        <Select id="t-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
          {TXN_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Notes" htmlFor="t-notes">
        <Textarea id="t-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="mb-3 flex items-center gap-2 text-[12px]">
        <input
          id="t-hidden"
          type="checkbox"
          checked={hidden}
          onChange={(e) => setHidden(e.target.checked)}
        />
        <label htmlFor="t-hidden" className="text-ink-2">
          Hide from totals (use for transfers between own accounts)
        </label>
      </div>

      <ModalActions onCancel={onClose} primaryLabel="Save" isPending={update.isPending} />
    </form>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
