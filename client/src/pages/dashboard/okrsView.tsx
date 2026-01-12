import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { LoadingOverlay } from "@/components/ui/loadingOverlay";
import { Modal } from "@/components/ui/modal";
import type { KeyResult, KeyResultStatus, Okr, OkrStatus } from "@/features/okr/okrTypes";
import type { Comment as CommentItem, CommentReply } from "@/features/comments/commentTypes";
import { OkrFormModal, OkrFormMode, OkrFormValues } from "@/pages/dashboard/okrFormModal";
import {
  createComment,
  createReply,
  deleteComment,
  getCommentsByOkr,
  updateComment
} from "@/services/commentService";
import {
  cloneOkr,
  createOkr,
  deleteOkr,
  getOkrById,
  getOkrs,
  updateKeyResultStatus,
  updateOkr
} from "@/services/okrService";
import { listUsers } from "@/services/userManagementService";
import { logError, logInfo } from "@/utils/logger";

interface OkrsViewProps {
  currentUser: string;
  currentUserId: string;
  openCreateOnLoad?: boolean;
  onCreateHandled?: () => void;
  openOkrId?: string;
  onOkrOpened?: () => void;
}

type KeyResultStatusLabel = "On Track" | "At Risk" | "Off Track" | "Completed";
type DisplayStatus = "On Track" | "At Risk" | "Off Track" | "Completed";

type DeleteTarget =
  | { type: "comment"; commentId: string }
  | { type: "reply"; commentId: string; replyId: string };

const statusToneMap: Record<DisplayStatus, "success" | "warning" | "danger" | "info"> = {
  "On Track": "success",
  "At Risk": "warning",
  "Off Track": "danger",
  Completed: "info"
};

const statusFilterOptions: Array<DisplayStatus | "all"> = ["all", "On Track", "At Risk", "Off Track", "Completed"];
const categoryFilterOptions = ["all", "Individual", "Department"];
const departmentFilterOptions = [
  "all",
  "Backend",
  "Frontend",
  "QA",
  "HR",
  "DevOps",
  "Ops",
  "AI/ML",
  "General"
];

const keyResultStatusOptions: KeyResultStatusLabel[] = ["On Track", "At Risk", "Off Track", "Completed"];

const keyResultStatusLabelMap: Record<KeyResultStatus, KeyResultStatusLabel> = {
  onTrack: "On Track",
  atRisk: "At Risk",
  offTrack: "Off Track",
  completed: "Completed"
};

const keyResultStatusValueMap: Record<KeyResultStatusLabel, KeyResultStatus> = {
  "On Track": "onTrack",
  "At Risk": "atRisk",
  "Off Track": "offTrack",
  Completed: "completed"
};

const calculateKeyResultStatus = (result: KeyResult): KeyResultStatusLabel => {
  if (result.target === 0) {
    return "On Track";
  }

  const ratio = result.current / result.target;
  if (ratio >= 1) {
    return "Completed";
  }
  if (ratio >= 0.7) {
    return "On Track";
  }
  if (ratio >= 0.4) {
    return "At Risk";
  }
  return "Off Track";
};

const deriveOkrDisplayStatus = (okr: Okr): DisplayStatus => {
  if (okr.progress >= 100) {
    return "Completed";
  }

  let hasAtRisk = false;
  for (const result of okr.keyResults) {
    const label = result.status ? keyResultStatusLabelMap[result.status] : calculateKeyResultStatus(result);
    if (label === "Off Track") {
      return "Off Track";
    }
    if (label === "At Risk") {
      hasAtRisk = true;
    }
  }

  return hasAtRisk ? "At Risk" : "On Track";
};

const renderMentions = (text: string) => {
  const parts = text.split(/(@[A-Za-z0-9._-]+(?:\s+[A-Za-z0-9._-]+)*)/g);
  return parts.map((part, index) =>
    part.startsWith("@") ? (
      <span key={`${part}-${index}`} className="mention">
        {part}
      </span>
    ) : (
      part
    )
  );
};

const getMentionQuery = (text: string) => {
  const lastAt = text.lastIndexOf("@");
  if (lastAt === -1) {
    return null;
  }

  const afterAt = text.slice(lastAt + 1);
  if (!afterAt.trim() || afterAt.includes(" ")) {
    return null;
  }

  return afterAt.trim().toLowerCase();
};

const applyMention = (text: string, mention: string) => {
  const lastAt = text.lastIndexOf("@");
  if (lastAt === -1) {
    return text;
  }

  const before = text.slice(0, lastAt + 1);
  return `${before}${mention} `;
};

const formatRelativeTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) {
    return "Just now";
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString();
};

const getAuthorLabel = (name: string, email: string) => {
  const trimmed = name?.trim();
  return trimmed ? trimmed : email;
};

export default function OkrsView({
  currentUser,
  currentUserId,
  openCreateOnLoad,
  onCreateHandled,
  openOkrId,
  onOkrOpened
}: OkrsViewProps) {
  const [okrs, setOkrs] = useState<Okr[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<OkrFormMode>("create");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeOkr, setActiveOkr] = useState<Okr | null>(null);
  const [okrToDelete, setOkrToDelete] = useState<Okr | null>(null);
  const [selectedOkrId, setSelectedOkrId] = useState<string | null>(null);
  const [expandedKeyResults, setExpandedKeyResults] = useState<Record<string, boolean>>({});
  const [keyResultStatuses, setKeyResultStatuses] = useState<Record<string, KeyResultStatusLabel>>({});
  const [comments, setComments] = useState<Record<string, CommentItem[]>>({});
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingReply, setEditingReply] = useState<{ commentId: string; replyId: string } | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<DisplayStatus | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [activeMenuOkrId, setActiveMenuOkrId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [keyResultDrafts, setKeyResultDrafts] = useState<Record<string, { current: number; target: number }>>({});
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);

  const availableOwners = useMemo(() => {
    const uniqueOwners = new Set(ownerOptions.map((owner) => owner.trim()).filter(Boolean));
    if (currentUser.trim()) {
      uniqueOwners.add(currentUser.trim());
    }
    return Array.from(uniqueOwners);
  }, [currentUser, ownerOptions]);

  const filteredOkrs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const normalizedOwnerFilter = ownerFilter.toLowerCase();
    const normalizedCategoryFilter = categoryFilter.toLowerCase();
    const normalizedDepartmentFilter = departmentFilter.toLowerCase();

    return okrs.filter((okr) => {
      const haystack = [
        okr.objective,
        okr.description ?? "",
        okr.owners.join(" "),
        okr.category ?? "",
        okr.vertical ?? "",
        okr.keyResults.map((kr) => kr.title).join(" ")
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || haystack.includes(query);
      const matchesStatus = statusFilter === "all" || deriveOkrDisplayStatus(okr) === statusFilter;
      const matchesOwner =
        ownerFilter === "all" ||
        okr.owners.some((owner) => owner.trim().toLowerCase() === normalizedOwnerFilter) ||
        okr.owner?.trim().toLowerCase() === normalizedOwnerFilter;
      const matchesCategory =
        categoryFilter === "all" || (okr.category ?? "").toLowerCase() === normalizedCategoryFilter;
      const matchesDepartment =
        departmentFilter === "all" || (okr.vertical ?? "").toLowerCase() === normalizedDepartmentFilter;

      return matchesSearch && matchesStatus && matchesOwner && matchesCategory && matchesDepartment;
    });
  }, [okrs, searchTerm, statusFilter, ownerFilter, categoryFilter, departmentFilter]);

  useEffect(() => {
    let isMounted = true;

    const loadOkrs = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await getOkrs();
        if (isMounted) {
          setOkrs(data);
        }
      } catch (error) {
        logError("ui", "Failed to load OKRs", error);
        if (isMounted) {
          setErrorMessage("Oops! Something went wrong while loading your OKRs.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    logInfo("ui", "OKRs view mounted");
    void loadOkrs();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    logInfo("ui", "Loading owner options");

    listUsers({ page: 1, limit: 200 })
      .then((response) => {
        if (!isMounted) {
          return;
        }
        const names = response.data
          .map((user) => `${user.firstName} ${user.lastName}`.trim())
          .filter(Boolean);
        setOwnerOptions(names);
      })
      .catch((error) => {
        logError("ui", "Failed to load owner options", error);
        if (isMounted) {
          setOwnerOptions([currentUser]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!okrs.length) {
      return;
    }

    setKeyResultStatuses((prev) => {
      const next = { ...prev };
      okrs.forEach((okr) => {
        okr.keyResults.forEach((result) => {
          next[result.id] = result.status ? keyResultStatusLabelMap[result.status] : calculateKeyResultStatus(result);
        });
      });
      return next;
    });
  }, [okrs]);

  useEffect(() => {
    if (!selectedOkrId) {
      return;
    }
    if (!filteredOkrs.some((okr) => okr.id === selectedOkrId)) {
      setSelectedOkrId(null);
      setIsDetailOpen(false);
    }
  }, [filteredOkrs, selectedOkrId]);

  useEffect(() => {
    if (!openOkrId || !okrs.length) {
      if (openOkrId && !okrs.length) {
        setIsLoading(true);
        getOkrById(openOkrId)
          .then((okr) => {
            setOkrs((prev) => (prev.some((item) => item.id === okr.id) ? prev : [okr, ...prev]));
            setSearchTerm("");
            setStatusFilter("all");
            setOwnerFilter("all");
            setCategoryFilter("all");
            setDepartmentFilter("all");
            setSelectedOkrId(okr.id);
            setIsDetailOpen(true);
            onOkrOpened?.();
          })
          .catch((error) => {
            logError("ui", "Failed to load OKR for notification", error);
          })
          .finally(() => setIsLoading(false));
      }
      return;
    }
    const exists = okrs.some((okr) => okr.id === openOkrId);
    if (!exists) {
      setIsLoading(true);
      getOkrById(openOkrId)
        .then((okr) => {
          setOkrs((prev) => (prev.some((item) => item.id === okr.id) ? prev : [okr, ...prev]));
          setSearchTerm("");
          setStatusFilter("all");
          setOwnerFilter("all");
          setCategoryFilter("all");
          setDepartmentFilter("all");
          setSelectedOkrId(okr.id);
          setIsDetailOpen(true);
          onOkrOpened?.();
        })
        .catch((error) => {
          logError("ui", "Failed to load OKR for notification", error);
        })
        .finally(() => setIsLoading(false));
      return;
    }
    setSearchTerm("");
    setStatusFilter("all");
    setOwnerFilter("all");
    setCategoryFilter("all");
    setDepartmentFilter("all");
    setSelectedOkrId(openOkrId);
    setIsDetailOpen(true);
    onOkrOpened?.();
  }, [openOkrId, okrs, onOkrOpened]);

  const isOwner = (okr: Okr) => {
    const normalizedUser = currentUser.trim().toLowerCase();
    if (!normalizedUser) {
      return false;
    }
    return (
      okr.owner?.trim().toLowerCase() === normalizedUser ||
      okr.owners.some((owner) => owner.trim().toLowerCase() === normalizedUser)
    );
  };
  const isCreator = (okr: Okr) => Boolean(okr.createdBy && okr.createdBy === currentUserId);
  const canManageOkr = (okr: Okr) => isOwner(okr) || isCreator(okr);

  const selectedOkr = filteredOkrs.find((okr) => okr.id === selectedOkrId) ?? null;
  const selectedComments = selectedOkr ? comments[selectedOkr.id] ?? [] : [];
  const canEditSelectedOkr = selectedOkr ? canManageOkr(selectedOkr) : false;

  useEffect(() => {
    setCommentDraft("");
    setReplyingCommentId(null);
    setReplyDrafts({});
    setEditingCommentId(null);
    setEditingReply(null);
    setEditDraft("");
    setExpandedKeyResults({});
    setCommentsError(null);
  }, [selectedOkrId]);

  useEffect(() => {
    if (!selectedOkr) {
      return;
    }
    setKeyResultDrafts((prev) => {
      const next = { ...prev };
      selectedOkr.keyResults.forEach((result) => {
        next[result.id] = { current: result.current, target: result.target };
      });
      return next;
    });
  }, [selectedOkr?.id, selectedOkr?.keyResults]);

  useEffect(() => {
    if (!selectedOkrId) {
      return;
    }

    let isActive = true;
    setIsCommentsLoading(true);
    setCommentsError(null);

    getCommentsByOkr(selectedOkrId)
      .then((data) => {
        if (!isActive) {
          return;
        }
        setComments((prev) => ({ ...prev, [selectedOkrId]: data }));
      })
      .catch((error) => {
        logError("ui", "Failed to load comments", error);
        if (isActive) {
          setCommentsError("Unable to load comments right now.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsCommentsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedOkrId]);

  const openCreateForm = () => {
    setFormMode("create");
    setActiveOkr(null);
    setIsFormOpen(true);
    setToastMessage(null);
    setActiveMenuOkrId(null);
  };

  const openEditForm = (okr: Okr) => {
    setFormMode("edit");
    setActiveOkr(okr);
    setIsFormOpen(true);
    setToastMessage(null);
    setActiveMenuOkrId(null);
  };

  const handleFormSubmit = (values: OkrFormValues) => {
    const assignMessage = values.owners.length > 1 ? `OKR assigned to ${values.owners.length} users.` : null;
    const okrStatus = formMode === "create" ? "onTrack" : activeOkr?.status ?? "onTrack";
    const payload = {
      objective: values.objective,
      description: values.description,
      owners: values.owners,
      owner: values.owners[0],
      dueDate: values.dueDate,
      category: values.category,
      vertical: values.vertical,
      status: okrStatus as OkrStatus,
      keyResults: values.keyResults.map((result) => ({
        id: result.id,
        title: result.title,
        measurementScale: result.measurementScale,
        current: result.current,
        target: result.target,
        owner: result.owner,
        dueDate: result.dueDate,
        status: result.status
      }))
    };

    const submit = async () => {
      setIsLoading(true);
      try {
        let nextOkr: Okr | null = null;
        if (formMode === "edit" && activeOkr) {
          nextOkr = await updateOkr(activeOkr.id, payload);
          setOkrs((prev) => prev.map((item) => (item.id === activeOkr.id ? nextOkr! : item)));
          setToastMessage(`OKR updated successfully!${assignMessage ? ` ${assignMessage}` : ""}`);
        } else if (formMode === "copy" && activeOkr) {
          nextOkr = await cloneOkr(activeOkr.id, payload);
          setOkrs((prev) => [nextOkr!, ...prev]);
          setToastMessage(`New OKR created from the copied objective!${assignMessage ? ` ${assignMessage}` : ""}`);
        } else {
          nextOkr = await createOkr(payload);
          setOkrs((prev) => [nextOkr!, ...prev]);
          setToastMessage(assignMessage ?? "OKR created successfully!");
        }

        setIsFormOpen(false);
        setActiveOkr(null);
        setSelectedOkrId(nextOkr?.id ?? null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save OKR.";
        setToastMessage(message);
        logError("ui", "Failed to save OKR", error);
      } finally {
        setIsLoading(false);
      }
    };

    void submit();
  };

  const handleDelete = (okr: Okr) => {
    setOkrToDelete(okr);
    setActiveMenuOkrId(null);
  };

  const confirmDelete = () => {
    if (!okrToDelete) {
      return;
    }
    const okrId = okrToDelete.id;
    setIsLoading(true);

    deleteOkr(okrId)
      .then(() => {
        setOkrs((prev) => prev.filter((item) => item.id !== okrId));
        if (selectedOkrId === okrId) {
          setSelectedOkrId(null);
        }
        setOkrToDelete(null);
        setToastMessage("OKR deleted successfully!");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Unable to delete OKR.";
        setToastMessage(message);
        logError("ui", "Failed to delete OKR", error);
      })
      .finally(() => setIsLoading(false));
  };

  const toggleKeyResult = (id: string) => {
    setExpandedKeyResults((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleKeyResultStatusChange = (id: string, status: KeyResultStatusLabel) => {
    const previous = keyResultStatuses[id] ?? "On Track";
    setKeyResultStatuses((prev) => ({ ...prev, [id]: status }));

    if (!selectedOkr) {
      return;
    }
    if (!canManageOkr(selectedOkr)) {
      setToastMessage("Only owners or creators can update the OKR status.");
      setKeyResultStatuses((prev) => ({ ...prev, [id]: previous }));
      return;
    }

    const apiStatus = keyResultStatusValueMap[status];

    updateKeyResultStatus(selectedOkr.id, id, apiStatus)
      .then((updated) => {
        setOkrs((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Unable to update key result.";
        setKeyResultStatuses((prev) => ({ ...prev, [id]: previous }));
        setToastMessage(message);
        logError("ui", "Failed to update key result status", error);
      });
  };

  const handleKeyResultDraftChange = (id: string, field: "current" | "target", value: number) => {
    const nextValue = Number.isNaN(value) ? 0 : Math.max(0, value);
    setKeyResultDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { current: 0, target: 0 }), [field]: nextValue }
    }));
  };

  const handleSaveKeyResultProgress = (id: string) => {
    if (!selectedOkr) {
      return;
    }
    if (!canManageOkr(selectedOkr)) {
      setToastMessage("Only owners or creators can update progress.");
      return;
    }

    const draft = keyResultDrafts[id];
    if (!draft) {
      return;
    }

    const nextKeyResults = selectedOkr.keyResults.map((result) =>
      result.id === id
        ? {
            ...result,
            current: draft.current,
            target: draft.target
          }
        : result
    );

    setIsLoading(true);
    updateOkr(selectedOkr.id, { keyResults: nextKeyResults })
      .then((updated) => {
        setOkrs((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setToastMessage("Progress updated.");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Unable to update progress.";
        setToastMessage(message);
        logError("ui", "Failed to update progress", error);
      })
      .finally(() => setIsLoading(false));
  };

  const handleAddComment = () => {
    if (!selectedOkr || !commentDraft.trim()) {
      return;
    }

    const message = commentDraft.trim();
    setIsCommentsLoading(true);
    setCommentsError(null);

    createComment(selectedOkr.id, message)
      .then((comment) => {
        setComments((prev) => {
          const list = prev[selectedOkr.id] ?? [];
          return { ...prev, [selectedOkr.id]: [comment, ...list] };
        });
        setCommentDraft("");
        setToastMessage("Comment added.");
      })
      .catch((error) => {
        const messageText = error instanceof Error ? error.message : "Unable to add comment.";
        setToastMessage(messageText);
        logError("ui", "Failed to add comment", error);
      })
      .finally(() => setIsCommentsLoading(false));
  };

  const handleStartEditComment = (comment: CommentItem) => {
    setEditingCommentId(comment.id);
    setEditingReply(null);
    setEditDraft(comment.message);
  };

  const handleStartEditReply = (commentId: string, reply: CommentReply) => {
    setEditingReply({ commentId, replyId: reply.id });
    setEditingCommentId(null);
    setEditDraft(reply.message);
  };

  const handleSaveEdit = () => {
    if (!selectedOkr || !editDraft.trim()) {
      return;
    }

    const message = editDraft.trim();
    const commentId = editingCommentId ?? editingReply?.commentId;
    if (!commentId) {
      return;
    }

    setIsCommentsLoading(true);
    setCommentsError(null);

    updateComment(commentId, message, editingReply?.replyId)
      .then((updated) => {
        setComments((prev) => {
          const commentList = prev[selectedOkr.id] ?? [];
          return {
            ...prev,
            [selectedOkr.id]: commentList.map((comment) => (comment.id === updated.id ? updated : comment))
          };
        });
        setEditingCommentId(null);
        setEditingReply(null);
        setEditDraft("");
        setToastMessage("Comment updated successfully!");
      })
      .catch((error) => {
        const messageText = error instanceof Error ? error.message : "Unable to update comment.";
        setToastMessage(messageText);
        logError("ui", "Failed to update comment", error);
      })
      .finally(() => setIsCommentsLoading(false));
  };

  const handleDeleteTarget = (target: DeleteTarget) => {
    setDeleteTarget(target);
  };

  const confirmDeleteComment = () => {
    if (!selectedOkr || !deleteTarget) {
      return;
    }

    setIsCommentsLoading(true);
    setCommentsError(null);

    if (deleteTarget.type === "comment") {
      deleteComment(deleteTarget.commentId)
        .then(() => {
          setComments((prev) => {
            const next = { ...prev };
            const commentList = next[selectedOkr.id] ?? [];
            next[selectedOkr.id] = commentList.filter((comment) => comment.id !== deleteTarget.commentId);
            return next;
          });
          setToastMessage("Comment deleted successfully!");
          setDeleteTarget(null);
        })
        .catch((error) => {
          const messageText = error instanceof Error ? error.message : "Unable to delete comment.";
          setToastMessage(messageText);
          logError("ui", "Failed to delete comment", error);
        })
        .finally(() => setIsCommentsLoading(false));
      return;
    }

    deleteComment(deleteTarget.commentId, deleteTarget.replyId)
      .then((response) => {
        if (response.data) {
          setComments((prev) => {
            const commentList = prev[selectedOkr.id] ?? [];
            return {
              ...prev,
              [selectedOkr.id]: commentList.map((comment) =>
                comment.id === response.data!.id ? response.data! : comment
              )
            };
          });
        }
        setToastMessage("Reply deleted successfully!");
        setDeleteTarget(null);
      })
      .catch((error) => {
        const messageText = error instanceof Error ? error.message : "Unable to delete reply.";
        setToastMessage(messageText);
        logError("ui", "Failed to delete reply", error);
      })
      .finally(() => setIsCommentsLoading(false));
  };

  const handleReply = (commentId: string) => {
    const replyText = replyDrafts[commentId]?.trim();
    if (!selectedOkr || !replyText) {
      return;
    }

    setIsCommentsLoading(true);
    setCommentsError(null);

    createReply(commentId, replyText)
      .then((updated) => {
        setComments((prev) => {
          const commentList = prev[selectedOkr.id] ?? [];
          return {
            ...prev,
            [selectedOkr.id]: commentList.map((comment) => (comment.id === updated.id ? updated : comment))
          };
        });
        setReplyDrafts((prev) => ({ ...prev, [commentId]: "" }));
        setReplyingCommentId(null);
        setToastMessage("Reply added.");
      })
      .catch((error) => {
        const messageText = error instanceof Error ? error.message : "Unable to add reply.";
        setToastMessage(messageText);
        logError("ui", "Failed to add reply", error);
      })
      .finally(() => setIsCommentsLoading(false));
  };

  const mentionQuery = getMentionQuery(commentDraft);
  const mentionSuggestions = mentionQuery
    ? availableOwners.filter((owner) => owner.toLowerCase().includes(mentionQuery)).slice(0, 4)
    : [];

  const getOwnerInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  useEffect(() => {
    if (!openCreateOnLoad) {
      return;
    }
    setFormMode("create");
    setActiveOkr(null);
    setIsFormOpen(true);
    setToastMessage(null);
    setActiveMenuOkrId(null);
    onCreateHandled?.();
  }, [openCreateOnLoad, onCreateHandled]);

  return (
    <section className="pageSection">
      <div className="sectionHeader">
        <div>
          <h1>Company OKRs</h1>
          <p className="muted">Monitor objectives and dive into detail views.</p>
        </div>
        <div className="sectionActions">
          <div className="searchField">
            <input
              className="inputControl"
              placeholder="Search OKRs, owners, key results"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <Button type="button" onClick={openCreateForm}>
            Create New OKR
          </Button>
        </div>
      </div>

      <div className="card okrFilterCard">
        <div className="okrFilterRow">
          <div className="inputField">
            <label htmlFor="okrStatusFilter">Status</label>
            <select
              id="okrStatusFilter"
              className="inputControl"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as DisplayStatus | "all")}
            >
              {statusFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All Statuses" : option}
                </option>
              ))}
            </select>
          </div>
          <div className="inputField">
            <label htmlFor="okrOwnerFilter">Owner</label>
            <select
              id="okrOwnerFilter"
              className="inputControl"
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
            >
              <option value="all">All Owners</option>
              {availableOwners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </div>
          <div className="inputField">
            <label htmlFor="okrCategoryFilter">Category</label>
            <select
              id="okrCategoryFilter"
              className="inputControl"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              {categoryFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All Categories" : option}
                </option>
              ))}
            </select>
          </div>
          <div className="inputField">
            <label htmlFor="okrDepartmentFilter">Department</label>
            <select
              id="okrDepartmentFilter"
              className="inputControl"
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
            >
              {departmentFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All Departments" : option}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="okrFilterActions">
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setStatusFilter("all");
              setOwnerFilter("all");
              setCategoryFilter("all");
              setDepartmentFilter("all");
              setSearchTerm("");
            }}
          >
            Reset Filters
          </Button>
        </div>
      </div>

      {errorMessage ? <div className="errorBanner">{errorMessage}</div> : null}

      <div className="okrCardGrid">
        {filteredOkrs.length ? (
          filteredOkrs.map((okr) => {
            const displayOwners = okr.owners.slice(0, 3);
            const remainingOwners = okr.owners.length - displayOwners.length;
            const createdBy = okr.owner ?? okr.owners[0] ?? "-";
            const displayStatus = deriveOkrDisplayStatus(okr);
            const canEdit = canManageOkr(okr);
            const canDelete = canEdit;

            return (
              <div
                key={okr.id}
                className={`okrTile ${selectedOkrId === okr.id ? "okrTileActive" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedOkrId(okr.id);
                  setIsDetailOpen(true);
                  setActiveMenuOkrId(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedOkrId(okr.id);
                    setIsDetailOpen(true);
                    setActiveMenuOkrId(null);
                  }
                }}
              >
                <div className="okrTileProgress">
                  <div className="okrTileDonut" style={{ ["--value" as const]: okr.progress }}>
                    <span>{okr.progress}%</span>
                  </div>
                </div>
                <div className="okrTileBody">
                  <div className="okrTileTop">
                    <div>
                      <h3>{okr.objective}</h3>
                      <p className="muted okrTileDescription">
                        {okr.description ?? "No description added yet."}
                      </p>
                    </div>
                    <div className="okrTileMenu">
                      <button
                        type="button"
                        className="iconButton"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveMenuOkrId((prev) => (prev === okr.id ? null : okr.id));
                        }}
                        aria-label="More actions"
                        aria-haspopup="menu"
                        aria-expanded={activeMenuOkrId === okr.id}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="currentColor"
                            d="M12 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm0 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm0 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"
                          />
                        </svg>
                      </button>
                      {activeMenuOkrId === okr.id ? (
                        <div className="okrMenuPanel" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (canEdit) {
                                openEditForm(okr);
                              }
                            }}
                            disabled={!canEdit}
                          >
                            {canEdit ? "Edit OKR" : "Edit OKR (Owner/Creator only)"}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="dangerText"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (canDelete) {
                                handleDelete(okr);
                              }
                            }}
                            disabled={!canDelete}
                          >
                            {canDelete ? "Delete OKR" : "Delete OKR (Owner/Creator only)"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="okrTileMetaRow">
                    <div className="okrMetaGroup">
                      <span className="caption">Owners</span>
                      <div className="okrAvatarStack">
                        {displayOwners.map((owner) => (
                          <span key={owner} className="okrAvatar" title={owner}>
                            {getOwnerInitials(owner)}
                          </span>
                        ))}
                        {remainingOwners > 0 ? (
                          <span className="okrAvatar okrAvatarMore">+{remainingOwners}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="okrMetaGroup">
                      <span className="caption">Created by</span>
                      <span>{createdBy}</span>
                    </div>
                    <div className="okrMetaGroup">
                      <span className="caption">Category</span>
                      <span>{okr.category ?? "Department"}</span>
                    </div>
                    <div className="okrMetaGroup">
                      <span className="caption">Due</span>
                      <span>{okr.dueDate}</span>
                    </div>
                    <Chip tone={statusToneMap[displayStatus]}>{displayStatus}</Chip>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="card emptyState">
            <h3>No OKRs match your search</h3>
            <p className="muted">Try adjusting filters or clearing the search.</p>
          </div>
        )}
      </div>

      {isLoading ? <LoadingOverlay message="Syncing OKRs" /> : null}
      {!isLoading && isCommentsLoading ? <LoadingOverlay message="Updating comments" /> : null}

      <OkrFormModal
        isOpen={isFormOpen}
        mode={formMode}
        initialData={formMode === "create" ? undefined : activeOkr ?? undefined}
        ownerOptions={availableOwners}
        currentUser={currentUser}
        onClose={() => {
          setIsFormOpen(false);
          setActiveOkr(null);
        }}
        onSubmit={handleFormSubmit}
      />

      <Modal
        isOpen={Boolean(selectedOkr) && isDetailOpen}
        title={selectedOkr?.objective ?? "Objective Detail"}
        size="lg"
        variant="side"
        closeOnOverlayClick
        onClose={() => setIsDetailOpen(false)}
      >
        {selectedOkr ? (
          <div className="okrDetailCard okrDetailPanel">
            <div className="okrDetailHeader">
              <div>
                <p className="caption">Objective Detail</p>
                <h2>{selectedOkr.objective}</h2>
                <p className="muted">{selectedOkr.description || "No description yet."}</p>
              </div>
              {(() => {
                const displayStatus = deriveOkrDisplayStatus(selectedOkr);
                return <Chip tone={statusToneMap[displayStatus]}>{displayStatus}</Chip>;
              })()}
            </div>
            <div className="okrDetailMeta">
              <div>
                <p className="caption">Owners</p>
                <p>{selectedOkr.owners.join(", ")}</p>
              </div>
              <div>
                <p className="caption">Due Date</p>
                <p>{selectedOkr.dueDate}</p>
              </div>
              <div>
                <p className="caption">Category</p>
                <p>{selectedOkr.category ?? "-"}</p>
              </div>
              <div>
                <p className="caption">Department</p>
                <p>{selectedOkr.vertical ?? "-"}</p>
              </div>
            </div>

            <div className="okrDetailSection">
              <div className="sectionHeader">
                <h3>Key Results</h3>
              </div>
              <div className="keyResultList">
                {selectedOkr.keyResults.map((result) => (
                  <div key={result.id} className="keyResultItem">
                    <button
                      type="button"
                      className="keyResultToggle"
                      onClick={() => toggleKeyResult(result.id)}
                    >
                      <span>{result.title}</span>
                      <span className="caption">{expandedKeyResults[result.id] ? "Hide" : "View"}</span>
                    </button>
                    <div className="keyResultStatus">
                      <p className="caption">Status</p>
                      <select
                        className="inputControl"
                        value={keyResultStatuses[result.id] ?? "On Track"}
                        onChange={(event) =>
                          handleKeyResultStatusChange(result.id, event.target.value as KeyResultStatusLabel)
                        }
                        disabled={!canEditSelectedOkr}
                      >
                        {keyResultStatusOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    {expandedKeyResults[result.id] ? (
                      <div className="keyResultDetails">
                        <div>
                          <p className="caption">Owner</p>
                          <p>{result.owner}</p>
                        </div>
                        <div>
                          <p className="caption">Due Date</p>
                          <p>{result.dueDate}</p>
                        </div>
                        <div>
                          <p className="caption">Current Value</p>
                          <input
                            className="inputControl inputControlSm"
                            type="number"
                            min={0}
                            value={keyResultDrafts[result.id]?.current ?? result.current}
                            onChange={(event) =>
                              handleKeyResultDraftChange(result.id, "current", Number(event.target.value))
                            }
                          />
                        </div>
                        <div>
                          <p className="caption">Total Value</p>
                          <input
                            className="inputControl inputControlSm"
                            type="number"
                            min={0}
                            value={keyResultDrafts[result.id]?.target ?? result.target}
                            onChange={(event) =>
                              handleKeyResultDraftChange(result.id, "target", Number(event.target.value))
                            }
                          />
                        </div>
                        <div className="keyResultDetailsActions">
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={() => handleSaveKeyResultProgress(result.id)}
                            disabled={!canEditSelectedOkr}
                          >
                            Update Progress
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="okrDetailSection">
              <div className="sectionHeader">
                <h3>Comments</h3>
                <span className="caption">Use @ to mention teammates.</span>
              </div>
              {commentsError ? <div className="errorBanner">{commentsError}</div> : null}
              {isCommentsLoading ? <p className="caption">Loading comments...</p> : null}
              <div className="commentList">
                {selectedComments.length ? (
                  selectedComments.map((comment) => (
                    <div key={comment.id} className="commentItem">
                      <div className="commentHeader">
                        <p className="commentAuthor">
                          {getAuthorLabel(comment.authorName, comment.authorEmail)}
                        </p>
                        <div className="commentActions">
                          <button type="button" onClick={() => handleStartEditComment(comment)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTarget({ type: "comment", commentId: comment.id })}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {editingCommentId === comment.id ? (
                        <div className="commentEdit">
                          <textarea
                            className="inputControl"
                            rows={2}
                            value={editDraft}
                            onChange={(event) => setEditDraft(event.target.value)}
                          />
                          <div className="commentEditActions">
                            <Button type="button" variant="secondary" onClick={() => setEditingCommentId(null)}>
                              Cancel
                            </Button>
                            <Button type="button" onClick={handleSaveEdit}>
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="commentText">{renderMentions(comment.message)}</p>
                      )}
                      <p className="caption">{formatRelativeTime(comment.createdAt)}</p>
                      <div className="replySection">
                        <button
                          type="button"
                          className="textLink"
                          onClick={() => setReplyingCommentId(comment.id)}
                        >
                          Reply
                        </button>
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="replyItem">
                            <div className="commentHeader">
                              <p className="commentAuthor">
                                {getAuthorLabel(reply.authorName, reply.authorEmail)}
                              </p>
                              <div className="commentActions">
                                <button type="button" onClick={() => handleStartEditReply(comment.id, reply)}>
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteTarget({
                                      type: "reply",
                                      commentId: comment.id,
                                      replyId: reply.id
                                    })
                                  }
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            {editingReply?.replyId === reply.id ? (
                              <div className="commentEdit">
                                <textarea
                                  className="inputControl"
                                  rows={2}
                                  value={editDraft}
                                  onChange={(event) => setEditDraft(event.target.value)}
                                />
                                <div className="commentEditActions">
                                  <Button type="button" variant="secondary" onClick={() => setEditingReply(null)}>
                                    Cancel
                                  </Button>
                                  <Button type="button" onClick={handleSaveEdit}>
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="commentText">{renderMentions(reply.message)}</p>
                            )}
                            <p className="caption">{formatRelativeTime(reply.createdAt)}</p>
                          </div>
                        ))}
                        {replyingCommentId === comment.id ? (
                          <div className="replyInput">
                            <textarea
                              className="inputControl"
                              rows={2}
                              placeholder="Write a reply"
                              value={replyDrafts[comment.id] ?? ""}
                              onChange={(event) =>
                                setReplyDrafts((prev) => ({ ...prev, [comment.id]: event.target.value }))
                              }
                            />
                            <div className="commentEditActions">
                              <Button type="button" variant="secondary" onClick={() => setReplyingCommentId(null)}>
                                Cancel
                              </Button>
                              <Button type="button" onClick={() => handleReply(comment.id)}>
                                Reply
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : !isCommentsLoading && !commentsError ? (
                  <p className="caption">No comments yet.</p>
                ) : null}
              </div>
              <div className="commentInput">
                <textarea
                  className="inputControl"
                  rows={2}
                  placeholder="Leave a comment"
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                />
                {mentionSuggestions.length ? (
                  <div className="mentionSuggestions">
                    {mentionSuggestions.map((owner) => (
                      <button
                        key={owner}
                        type="button"
                        className="mentionSuggestion"
                        onClick={() => setCommentDraft((prev) => applyMention(prev, owner))}
                      >
                        @{owner}
                      </button>
                    ))}
                  </div>
                ) : null}
                <Button type="button" onClick={handleAddComment}>
                  Add Comment
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(okrToDelete)}
        title="Delete OKR"
        description="Are you sure you want to delete this OKR?"
        onClose={() => setOkrToDelete(null)}
        actions={
          <>
            <Button variant="secondary" type="button" onClick={() => setOkrToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" type="button" onClick={confirmDelete}>
              Yes, Delete
            </Button>
          </>
        }
      />

      <Modal
        isOpen={Boolean(deleteTarget)}
        title="Delete comment"
        description="Are you sure you want to delete this comment?"
        onClose={() => setDeleteTarget(null)}
        actions={
          <>
            <Button variant="secondary" type="button" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" type="button" onClick={confirmDeleteComment}>
              Yes, Delete
            </Button>
          </>
        }
      />

      {toastMessage ? <div className="toast toastSuccess">{toastMessage}</div> : null}
    </section>
  );
}
