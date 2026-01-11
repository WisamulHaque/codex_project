import { OkrDto } from "@/features/okr/okrTypes";

export const okrMockData: OkrDto[] = [
  {
    id: "okr-001",
    objective: "Launch the next-gen analytics dashboard",
    description: "Deliver a faster, insight-rich dashboard experience for enterprise customers.",
    owner: "Product Growth",
    owners: ["Product Growth", "Avery Morgan"],
    dueDate: "2024-12-15",
    category: "Product",
    vertical: "Analytics",
    status: "onTrack",
    keyResults: [
      {
        id: "kr-001",
        title: "Ship beta to 5 pilot customers",
        measurementScale: "numeric",
        current: 3,
        target: 5,
        owner: "Product Growth",
        dueDate: "2024-10-20"
      },
      {
        id: "kr-002",
        title: "Reduce dashboard load time to <2s",
        measurementScale: "numeric",
        current: 1.8,
        target: 2,
        owner: "Engineering",
        dueDate: "2024-11-05"
      },
      {
        id: "kr-003",
        title: "Achieve 90% feature adoption",
        measurementScale: "percentage",
        current: 75,
        target: 90,
        owner: "Customer Success",
        dueDate: "2024-12-01"
      }
    ]
  },
  {
    id: "okr-002",
    objective: "Expand enterprise retention",
    description: "Increase retention outcomes with targeted executive engagement.",
    owner: "Customer Success",
    owners: ["Customer Success", "Jordan Lee"],
    dueDate: "2024-11-30",
    category: "Retention",
    vertical: "Enterprise",
    status: "atRisk",
    keyResults: [
      {
        id: "kr-004",
        title: "Reach 95% renewal rate",
        measurementScale: "percentage",
        current: 88,
        target: 95,
        owner: "Customer Success",
        dueDate: "2024-11-20"
      },
      {
        id: "kr-005",
        title: "Run 12 executive QBRs",
        measurementScale: "numeric",
        current: 5,
        target: 12,
        owner: "Executive Success",
        dueDate: "2024-11-30"
      }
    ]
  },
  {
    id: "okr-003",
    objective: "Improve internal execution cadence",
    description: "Strengthen weekly OKR rituals and coaching.",
    owner: "Operations",
    owners: ["Operations", "Morgan Steele"],
    dueDate: "2024-10-28",
    category: "Operations",
    vertical: "People Ops",
    status: "offTrack",
    keyResults: [
      {
        id: "kr-006",
        title: "Increase weekly OKR updates to 85%",
        measurementScale: "percentage",
        current: 48,
        target: 85,
        owner: "Operations",
        dueDate: "2024-10-15"
      },
      {
        id: "kr-007",
        title: "Roll out new OKR coaching sessions",
        measurementScale: "numeric",
        current: 2,
        target: 6,
        owner: "People Operations",
        dueDate: "2024-10-25"
      }
    ]
  }
];
