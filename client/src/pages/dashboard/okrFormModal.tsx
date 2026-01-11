import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { KeyResult, MeasurementScale, Okr } from "@/features/okr/okrTypes";
import { logInfo, logWarn } from "@/utils/logger";

export type OkrFormMode = "create" | "edit" | "copy";

export interface OkrFormValues {
  objective: string;
  description: string;
  owners: string[];
  dueDate: string;
  category: string;
  vertical: string;
  keyResults: KeyResult[];
}

interface OkrFormModalProps {
  isOpen: boolean;
  mode: OkrFormMode;
  initialData?: Okr;
  ownerOptions: string[];
  currentUser: string;
  onClose: () => void;
  onSubmit: (values: OkrFormValues) => void;
}

interface FormErrors {
  objective?: string;
  owners?: string;
  dueDate?: string;
  category?: string;
  vertical?: string;
  keyResults?: string;
}

const emptyKeyResult = (owner: string): KeyResult => ({
  id: `kr-${Date.now()}-${Math.round(Math.random() * 1000)}`,
  title: "",
  measurementScale: "numeric",
  current: 0,
  target: 100,
  owner,
  dueDate: ""
});

const categoryOptions = ["Individual", "Department"];
const departmentOptions = ["Backend", "Frontend", "QA", "HR", "DevOps", "Ops", "AI/ML", "General"];

export function OkrFormModal({
  isOpen,
  mode,
  initialData,
  ownerOptions,
  currentUser,
  onClose,
  onSubmit
}: OkrFormModalProps) {
  const [form, setForm] = useState<OkrFormValues>(() => ({
    objective: "",
    description: "",
    owners: [currentUser],
    dueDate: "",
    category: "",
    vertical: "",
    keyResults: [emptyKeyResult(currentUser)]
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [isOwnerMenuOpen, setIsOwnerMenuOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialData) {
      setForm({
        objective: initialData.objective,
        description: initialData.description ?? "",
        owners: initialData.owners.length ? initialData.owners : [initialData.owner ?? currentUser],
        dueDate: initialData.dueDate,
        category: initialData.category ?? "",
        vertical: initialData.vertical ?? "",
        keyResults: initialData.keyResults.length
          ? initialData.keyResults
          : [emptyKeyResult(currentUser)]
      });
    } else {
      setForm({
        objective: "",
        description: "",
        owners: [currentUser],
        dueDate: "",
        category: "",
        vertical: "",
        keyResults: [emptyKeyResult(currentUser)]
      });
    }

    setErrors({});
    setIsOwnerMenuOpen(false);
    setPendingDeleteId(null);
  }, [currentUser, initialData, isOpen]);

  const title = useMemo(() => {
    if (mode === "edit") {
      return "Edit OKR";
    }
    if (mode === "copy") {
      return "Copy OKR";
    }
    return "Create New OKR";
  }, [mode]);

  const handleOwnerToggle = (owner: string) => {
    setForm((prev) => {
      const exists = prev.owners.includes(owner);
      const nextOwners = exists ? prev.owners.filter((item) => item !== owner) : [...prev.owners, owner];
      return { ...prev, owners: nextOwners.length ? nextOwners : prev.owners };
    });
  };

  const handleKeyResultChange = <K extends keyof KeyResult>(index: number, field: K, value: KeyResult[K]) => {
    setForm((prev) => {
      const next = [...prev.keyResults];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, keyResults: next };
    });
  };

  const handleAddKeyResult = () => {
    setForm((prev) => ({
      ...prev,
      keyResults: [...prev.keyResults, emptyKeyResult(prev.owners[0] ?? currentUser)]
    }));
  };

  const handleDeleteKeyResult = () => {
    if (!pendingDeleteId) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      keyResults: prev.keyResults.filter((item) => item.id !== pendingDeleteId)
    }));
    setPendingDeleteId(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    if (!form.objective.trim()) {
      nextErrors.objective = "Objective title is required.";
    }
    if (!form.owners.length) {
      nextErrors.owners = "Select at least one owner.";
    }
    if (!form.dueDate.trim()) {
      nextErrors.dueDate = "Due date is required.";
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(form.dueDate);
      if (Number.isNaN(dueDate.getTime()) || dueDate <= today) {
        nextErrors.dueDate = "Due date must be in the future.";
      }
    }
    if (!form.keyResults.length || form.keyResults.some((kr) => !kr.title.trim())) {
      nextErrors.keyResults = "Each key result needs a title.";
    }
    if (!form.category.trim()) {
      nextErrors.category = "Category is required.";
    }
    if (!form.vertical.trim()) {
      nextErrors.vertical = "Department is required.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      logWarn("ui", "OKR form validation failed");
      return;
    }

    setErrors({});
    logInfo("ui", `Submitting OKR form (${mode})`);
    onSubmit({
      ...form,
      owners: form.owners.length ? form.owners : [currentUser]
    });
  };

  return (
    <Modal isOpen={isOpen} title={title} size="lg" onClose={onClose}>
      <form className="okrForm" onSubmit={handleSubmit}>
        <div className="formSection">
          <h3>Objective</h3>
          <div className="inputField">
            <label htmlFor="okrTitle">Title</label>
            <input
              id="okrTitle"
              className={`inputControl ${errors.objective ? "inputError" : ""}`}
              placeholder="Objective title"
              value={form.objective}
              onChange={(event) => setForm((prev) => ({ ...prev, objective: event.target.value }))}
            />
            {errors.objective ? <span className="errorText">{errors.objective}</span> : null}
          </div>
          <div className="inputField">
            <label htmlFor="okrDescription">Description</label>
            <textarea
              id="okrDescription"
              className="inputControl"
              placeholder="Describe the objective (optional)"
              rows={3}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <div className="formGrid twoColumn">
            <div className="inputField multiSelectField">
              <label>Owner</label>
              <button
                type="button"
                className={`multiSelect ${errors.owners ? "inputError" : ""}`}
                onClick={() => setIsOwnerMenuOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={isOwnerMenuOpen}
              >
                {form.owners.length ? form.owners.join(", ") : "Select owners"}
              </button>
              {errors.owners ? <span className="errorText">{errors.owners}</span> : null}
              {isOwnerMenuOpen ? (
                <div className="multiSelectMenu" role="listbox">
                  {ownerOptions.map((owner) => (
                    <label key={owner} className="checkboxRow">
                      <input
                        type="checkbox"
                        checked={form.owners.includes(owner)}
                        onChange={() => handleOwnerToggle(owner)}
                      />
                      <span>{owner}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="inputField">
              <label htmlFor="okrDueDate">Due Date</label>
              <input
                id="okrDueDate"
                type="date"
                className={`inputControl ${errors.dueDate ? "inputError" : ""}`}
                value={form.dueDate}
                onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
              />
              {errors.dueDate ? <span className="errorText">{errors.dueDate}</span> : null}
            </div>
            <div className="inputField">
            <label htmlFor="okrCategory">Category</label>
            <select
              id="okrCategory"
              className={`inputControl ${errors.category ? "inputError" : ""}`}
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            >
              <option value="">Select category</option>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {errors.category ? <span className="errorText">{errors.category}</span> : null}
          </div>
          <div className="inputField">
            <label htmlFor="okrVertical">Department</label>
            <select
              id="okrVertical"
              className={`inputControl ${errors.vertical ? "inputError" : ""}`}
              value={form.vertical}
              onChange={(event) => setForm((prev) => ({ ...prev, vertical: event.target.value }))}
            >
              <option value="">Select department</option>
              {departmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {errors.vertical ? <span className="errorText">{errors.vertical}</span> : null}
          </div>
          </div>
        </div>

        <div className="formSection">
          <div className="formSectionHeader">
            <h3>Key Results</h3>
            <Button type="button" variant="secondary" onClick={handleAddKeyResult}>
              Add Key Result
            </Button>
          </div>
          {errors.keyResults ? <span className="errorText">{errors.keyResults}</span> : null}
          <div className="keyResultGrid">
            {form.keyResults.map((result, index) => (
              <div key={result.id} className="keyResultCard">
                <div className="keyResultHeader">
                  <p className="caption">Key Result {index + 1}</p>
                  <button
                    type="button"
                    className="iconButton destructiveIcon"
                    onClick={() => setPendingDeleteId(result.id)}
                    aria-label="Delete key result"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M6 7h12v2H6V7zm2 3h2v8H8v-8zm6 0h2v8h-2v-8zM9 4h6l1 1h4v2H4V5h4l1-1z"
                      />
                    </svg>
                  </button>
                </div>
                <div className="inputField">
                  <label>Title</label>
                  <input
                    className="inputControl"
                    value={result.title}
                    onChange={(event) => handleKeyResultChange(index, "title", event.target.value)}
                  />
                </div>
                <div className="formGrid twoColumn">
                  <div className="inputField">
                    <label>Measurement Scale</label>
                    <select
                      className="inputControl"
                      value={result.measurementScale}
                      onChange={(event) =>
                        handleKeyResultChange(index, "measurementScale", event.target.value as MeasurementScale)
                      }
                    >
                      <option value="percentage">Percentage</option>
                      <option value="numeric">Numeric</option>
                    </select>
                  </div>
                  <div className="inputField">
                    <label>Owner</label>
                    <select
                      className="inputControl"
                      value={result.owner}
                      onChange={(event) => handleKeyResultChange(index, "owner", event.target.value)}
                    >
                      {ownerOptions.map((owner) => (
                        <option key={owner} value={owner}>
                          {owner}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="inputField">
                    <label>Current Value</label>
                    <input
                      className="inputControl"
                      type="number"
                      value={result.current}
                      onChange={(event) => handleKeyResultChange(index, "current", Number(event.target.value))}
                    />
                  </div>
                  <div className="inputField">
                    <label>Total Value</label>
                    <input
                      className="inputControl"
                      type="number"
                      value={result.target}
                      onChange={(event) => handleKeyResultChange(index, "target", Number(event.target.value))}
                    />
                  </div>
                  <div className="inputField">
                    <label>Due Date</label>
                    <input
                      className="inputControl"
                      type="date"
                      value={result.dueDate}
                      onChange={(event) => handleKeyResultChange(index, "dueDate", event.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="formActions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{mode === "edit" ? "Save Changes" : "Save"}</Button>
        </div>
      </form>

      <Modal
        isOpen={Boolean(pendingDeleteId)}
        title="Delete key result"
        description="Are you sure you want to delete this key result?"
        onClose={() => setPendingDeleteId(null)}
        actions={
          <>
            <Button variant="secondary" type="button" onClick={() => setPendingDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" type="button" onClick={handleDeleteKeyResult}>
              Yes, Delete
            </Button>
          </>
        }
      />
    </Modal>
  );
}
