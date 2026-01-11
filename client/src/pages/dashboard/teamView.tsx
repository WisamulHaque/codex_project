import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { LoadingOverlay } from "@/components/ui/loadingOverlay";
import { logInfo, logWarn } from "@/utils/logger";
import {
  bulkCreateUsers,
  bulkDeleteUsers,
  bulkUpdateRoles,
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  updateUserRole,
  type ApiRole,
  type UserSummary
} from "@/services/userManagementService";

interface TeamMember {
  id: string;
  username: string;
  email: string;
  joinedOn: string;
  role: "Admin" | "Manager" | "Employee";
  department: string;
  designation: string;
  okrsAssigned: number;
  manager: string;
}

interface TeamViewProps {
  currentUserRole: "admin" | "manager" | "employee";
  currentUserName: string;
}

const roleFilters = ["all", "Admin", "Manager", "Employee"] as const;

const emptyFormState: Omit<TeamMember, "id" | "okrsAssigned" | "joinedOn"> = {
  username: "",
  email: "",
  role: "Employee",
  department: "",
  designation: "",
  manager: ""
};

export default function TeamView({ currentUserRole, currentUserName }: TeamViewProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<(typeof roleFilters)[number]>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [formState, setFormState] = useState(emptyFormState);
  const [bulkRole, setBulkRole] = useState<TeamMember["role"]>("Employee");
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; label: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"success" | "error">("success");
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkImportError, setBulkImportError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const pageSize = 5;

  const canManageAll = currentUserRole === "admin";
  const canCreateUsers = currentUserRole === "admin";

  const canEditMember = (_member: TeamMember) => canManageAll;
  const canDeleteMember = (member: TeamMember) => canManageAll && member.role !== "Admin";

  const selectedMembers = useMemo(
    () => members.filter((member) => selectedIds.includes(member.id)),
    [members, selectedIds]
  );
  const hasAdminSelection = selectedMembers.some((member) => member.role === "Admin");

  const setToast = (message: string, tone: "success" | "error") => {
    setToastMessage(message);
    setToastTone(tone);
  };

  const mapRoleToApi = (role: TeamMember["role"]): ApiRole => role.toLowerCase() as ApiRole;

  const mapRoleToUi = (role: ApiRole | undefined): TeamMember["role"] => {
    if (role === "admin") {
      return "Admin";
    }
    if (role === "manager") {
      return "Manager";
    }
    return "Employee";
  };

  const mapUserToMember = (user: UserSummary): TeamMember => ({
    id: user.id,
    username: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    joinedOn: new Date(user.createdAt).toISOString().slice(0, 10),
    role: mapRoleToUi(user.role),
    department: user.department ?? "-",
    designation: user.designation ?? "-",
    okrsAssigned: user.okrsAssigned ?? 0,
    manager: user.manager ?? "-"
  });

  const pagedMembers = members;

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [roleFilter, searchTerm]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    let isMounted = true;
    const roleParam = roleFilter === "all" ? undefined : roleFilter.toLowerCase();
    const searchParam = searchTerm.trim();

    const timer = window.setTimeout(() => {
      setIsLoading(true);
      logInfo("ui", "Fetching users list");

      listUsers({
        page,
        limit: pageSize,
        search: searchParam || undefined,
        role: roleParam
      })
        .then((response) => {
          if (!isMounted) {
            return;
          }
          const mapped = response.data.map(mapUserToMember);
          setMembers(mapped);
          setTotalPages(response.pagination.totalPages);
          setTotalItems(response.pagination.totalItems);
          setSelectedIds((prev) => prev.filter((id) => mapped.some((member) => member.id === id)));
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Unable to load users.";
          setToast(message, "error");
          logWarn("ui", message);
        })
        .finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
    }, 350);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [page, pageSize, roleFilter, searchTerm, reloadKey]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleSelectAllVisible = () => {
    if (!canManageAll) {
      return;
    }
    const selectableIds = pagedMembers.filter(canEditMember).map((member) => member.id);
    const allSelected = selectableIds.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) => {
      if (allSelected) {
        return prev.filter((id) => !selectableIds.includes(id));
      }
      return Array.from(new Set([...prev, ...selectableIds]));
    });
  };

  const openCreateForm = () => {
    setEditingMember(null);
    setFormState({ ...emptyFormState, manager: currentUserName });
    setIsFormOpen(true);
  };

  const openEditForm = (member: TeamMember) => {
    setEditingMember(member);
    setFormState({
      username: member.username,
      email: member.email,
      role: member.role,
      department: member.department,
      designation: member.designation,
      manager: member.manager
    });
    setIsFormOpen(true);
  };

 

  const handleSaveMember = async () => {
    if (!formState.username.trim() || !formState.email.trim()) {
      setToast("Name and email are required.", "error");
      return;
    }
    if (!canManageAll) {
      setToast("Only admins can manage users.", "error");
      return;
    }

    setIsLoading(true);
    try {
      if (editingMember) {
        const updatePayload = {
          fullName: formState.username,
          email: formState.email,
          department: formState.department.trim() || undefined,
          designation: formState.designation.trim() || undefined,
          manager: formState.manager.trim() || undefined
        };
        await updateUser(editingMember.id, updatePayload);

        if (canManageAll && formState.role !== editingMember.role) {
          await updateUserRole(editingMember.id, mapRoleToApi(formState.role));
        }

        setToast("User updated successfully!", "success");
      } else {
        const createPayload = {
          fullName: formState.username,
          email: formState.email,
          role: mapRoleToApi(formState.role),
          department: formState.department.trim() || undefined,
          designation: formState.designation.trim() || undefined,
          manager: formState.manager.trim() || undefined
        };
        await createUser(createPayload);
        setToast("User created successfully! Invite email sent.", "success");
        setPage(1);
      }

      setIsFormOpen(false);
      setReloadKey((prev) => prev + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save user.";
      setToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkRoleUpdate = async () => {
    if (!selectedIds.length) {
      return;
    }

    if (!canManageAll) {
      setToast("Only admins can update roles.", "error");
      return;
    }

    setIsLoading(true);
    try {
      await bulkUpdateRoles({ userIds: selectedIds, role: mapRoleToApi(bulkRole) });
      setToast(`Updated role for ${selectedIds.length} users.`, "success");
      setSelectedIds([]);
      setReloadKey((prev) => prev + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update roles.";
      setToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMembers = (ids: string[]) => {
    if (!ids.length) {
      return;
    }

    if (!canManageAll) {
      setToast("Only admins can delete users.", "error");
      return;
    }
    if (members.some((member) => ids.includes(member.id) && member.role === "Admin")) {
      setToast("Admin accounts cannot be deleted.", "error");
      return;
    }

    setDeleteTarget({ ids, label: ids.length > 1 ? `${ids.length} users` : "this user" });
  };

  const parseCsvFile = async (file: File) => {
    const content = await file.text();
    const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) {
      throw new Error("CSV must include a header row and at least one user.");
    }

    const headers = lines[0].split(",").map((header) => header.trim());
    const requiredHeaders = ["fullName", "email"];
    const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
    if (missingHeaders.length) {
      throw new Error(`Missing required columns: ${missingHeaders.join(", ")}`);
    }

    const findValue = (row: string[], key: string) => {
      const index = headers.indexOf(key);
      return index >= 0 ? row[index]?.trim() ?? "" : "";
    };

    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((value) => value.trim());
      const roleValue = findValue(values, "role");
      const normalizedRole = roleValue?.toLowerCase();
      const role =
        normalizedRole === "admin" || normalizedRole === "manager" || normalizedRole === "employee"
          ? (normalizedRole as ApiRole)
          : undefined;

      return {
        fullName: findValue(values, "fullName"),
        email: findValue(values, "email"),
        role,
        department: findValue(values, "department"),
        designation: findValue(values, "designation"),
        manager: findValue(values, "manager")
      };
    });
    const filtered = rows.filter((row) => row.fullName && row.email);
    if (!filtered.length) {
      throw new Error("No valid users found in the CSV.");
    }
    return filtered;
  };

  const confirmDelete = () => {
    if (!deleteTarget) {
      return;
    }

    if (!canManageAll) {
      setToast("Only admins can delete users.", "error");
      setDeleteTarget(null);
      return;
    }

    setIsLoading(true);
    const idsToDelete = deleteTarget.ids;
    const deletePromise =
      idsToDelete.length > 1 ? bulkDeleteUsers({ userIds: idsToDelete }) : deleteUser(idsToDelete[0]);

    deletePromise
      .then(() => {
        setSelectedIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
        setToast("User(s) deleted successfully!", "success");
        setDeleteTarget(null);
        setReloadKey((prev) => prev + 1);
        return;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Unable to delete users.";
        setToast(message, "error");
        setDeleteTarget(null);
      })
      .finally(() => setIsLoading(false));
  };

  return (
    <section className="pageSection">
      <div className="sectionHeader">
        <div>
          <h1>User Management</h1>
          <p className="muted">Manage users, roles, and access to OKRs.</p>
        </div>
        <div className="sectionActions">
          {!canCreateUsers ? (
            <span className="caption">View-only access</span>
          ) : (
            <>
              <Button variant="secondary" type="button" onClick={() => setIsBulkImportOpen(true)}>
                Bulk Import
              </Button>
              <Button type="button" onClick={openCreateForm}>
                Create User
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="userManagementToolbar">
        <div className="toolbarGroup">
          <input
            className="inputControl"
            placeholder="Search by name, email, department"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <select
            className="inputControl"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as (typeof roleFilters)[number])}
          >
            {roleFilters.map((role) => (
              <option key={role} value={role}>
                {role === "all" ? "All Roles" : role}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbarGroup">
          <Button variant="secondary" type="button" onClick={handleSelectAllVisible} disabled={!canManageAll}>
            {selectedIds.length ? "Clear Selection" : "Select Visible"}
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={() => handleDeleteMembers(selectedIds)}
            disabled={!selectedIds.length || !canManageAll || hasAdminSelection}
          >
            Delete Selected
          </Button>
          <div className="bulkRole">
            <select
              className="inputControl"
              value={bulkRole}
              onChange={(event) => setBulkRole(event.target.value as TeamMember["role"])}
              disabled={!selectedIds.length || !canManageAll}
            >
              <option value="Employee">Set Role: Employee</option>
              <option value="Manager">Set Role: Manager</option>
              <option value="Admin">Set Role: Admin</option>
            </select>
            <Button type="button" onClick={handleBulkRoleUpdate} disabled={!selectedIds.length || !canManageAll}>
              Update Role
            </Button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="teamHeader">
          <div>
            <h2>Team directory</h2>
            <p className="muted">Role-based access controls are applied to each user.</p>
          </div>
          <span className="caption">
            {canManageAll ? "Admin access: edit profiles, change roles, manage users" : "View-only access"}
          </span>
        </div>

        <div className="tableWrap">
          <table className="teamTable">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={
                      pagedMembers.length > 0 &&
                      pagedMembers.filter(canEditMember).every((member) => selectedIds.includes(member.id))
                    }
                    onChange={handleSelectAllVisible}
                    aria-label="Select all"
                    disabled={!canManageAll}
                  />
                </th>
                <th>Username</th>
                <th>Email</th>
                <th>Joined On</th>
                <th>Role</th>
                <th>Department</th>
                <th>Designation</th>
                <th>OKRs Assigned</th>
                <th>Manager</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
                {pagedMembers.length ? (
                  pagedMembers.map((member) => {
                    const canEdit = canEditMember(member);
                    const canDelete = canDeleteMember(member);
                    return (
                      <tr key={member.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(member.id)}
                            onChange={() => handleToggleSelect(member.id)}
                            disabled={!canEdit}
                            aria-label={`Select ${member.username}`}
                          />
                        </td>
                      <td>{member.username}</td>
                      <td>{member.email}</td>
                      <td>{member.joinedOn}</td>
                      <td>
                        <span className={`roleBadge role${member.role}`}>{member.role}</span>
                      </td>
                      <td>{member.department}</td>
                      <td>{member.designation}</td>
                      <td>{member.okrsAssigned}</td>
                      <td>{member.manager}</td>
                      <td>
                        <div className="tableActions">
                          {canEdit ? (
                            <>
                              <button type="button" className="tableAction" onClick={() => openEditForm(member)}>
                                Edit
                              </button>
                              {canDelete ? (
                                <button
                                  type="button"
                                  className="tableAction"
                                  onClick={() => handleDeleteMembers([member.id])}
                                >
                                  Delete
                                </button>
                              ) : (
                                <span className="caption">Admin account</span>
                              )}
                            </>
                          ) : (
                            <span className="caption">View only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="caption">
                    No users match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <Button
            variant="secondary"
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="caption">
            Page {page} of {totalPages} · {totalItems} users
          </span>
          <Button
            variant="secondary"
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      <Modal
        isOpen={isFormOpen}
        title={editingMember ? "Edit User" : "Create User"}
        size="lg"
        onClose={() => setIsFormOpen(false)}
        actions={
          <>
            <Button variant="secondary" type="button" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveMember}>
              Save User
            </Button>
          </>
        }
      >
        <div className="formGrid twoColumn">
          <div className="inputField">
            <label htmlFor="userName">Full Name</label>
            <input
              id="userName"
              className="inputControl"
              value={formState.username}
              onChange={(event) => setFormState((prev) => ({ ...prev, username: event.target.value }))}
            />
          </div>
          <div className="inputField">
            <label htmlFor="userEmail">Email</label>
            <input
              id="userEmail"
              className="inputControl"
              type="email"
              value={formState.email}
              onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
            />
          </div>
          <div className="inputField">
            <label htmlFor="userRole">Role</label>
            <select
              id="userRole"
              className="inputControl"
              value={formState.role}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, role: event.target.value as TeamMember["role"] }))
              }
              disabled={!canManageAll}
            >
              <option value="Employee">Employee</option>
              <option value="Manager">Manager</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isBulkImportOpen}
        title="Bulk User Import"
        onClose={() => {
          setIsBulkImportOpen(false);
          setBulkImportError(null);
          setBulkFile(null);
        }}
        actions={
          <>
            <Button variant="secondary" type="button" onClick={() => setIsBulkImportOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!bulkFile) {
                  setBulkImportError("Please select a CSV file to upload.");
                  return;
                }
                setIsLoading(true);
                setBulkImportError(null);
                try {
                  const users = await parseCsvFile(bulkFile);
                  if (!users.length) {
                    throw new Error("No users found in the CSV.");
                  }
                  await bulkCreateUsers({ users });
                  setToast("Bulk import completed successfully!", "success");
                  setIsBulkImportOpen(false);
                  setBulkFile(null);
                  setReloadKey((prev) => prev + 1);
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Bulk import failed.";
                  setBulkImportError(message);
                  setToast(message, "error");
                } finally {
                  setIsLoading(false);
                }
              }}
            >
              Upload CSV
            </Button>
          </>
        }
      >
        <div className="bulkImport">
          <p className="muted">Upload a CSV file with user details to create accounts in bulk.</p>
          <input
            type="file"
            className="fileInput"
            accept=".csv"
            onChange={(event) => {
              setBulkFile(event.target.files?.[0] ?? null);
              setBulkImportError(null);
            }}
          />
          <p className="caption">Expected headers: fullName, email, role, department, designation, manager</p>
          {bulkImportError ? <span className="errorText">{bulkImportError}</span> : null}
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        title="Delete Users"
        description={`Are you sure you want to delete ${deleteTarget?.label}?`}
        onClose={() => setDeleteTarget(null)}
        actions={
          <>
            <Button variant="secondary" type="button" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" type="button" onClick={confirmDelete}>
              Yes, Delete
            </Button>
          </>
        }
      />

      {toastMessage ? (
        <div className={`toast ${toastTone === "success" ? "toastSuccess" : ""}`}>{toastMessage}</div>
      ) : null}
      {isLoading ? <LoadingOverlay message="Updating users" /> : null}
    </section>
  );
}
