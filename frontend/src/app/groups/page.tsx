"use client";

import { useMemo, useState } from "react";
import Button from "@/components/Buttons";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PayrollGroup {
  id: string;
  name: string;
  creator: string;
  memberCount: number;
  createdAt: string; // ISO date string
}

type SortField = "name" | "createdAt";
type SortDirection = "asc" | "desc";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_GROUPS: PayrollGroup[] = [
  {
    id: "1",
    name: "Engineering Team",
    creator: "Alice Johnson",
    memberCount: 24,
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    name: "Marketing Department",
    creator: "Bob Smith",
    memberCount: 12,
    createdAt: "2024-02-03",
  },
  {
    id: "3",
    name: "Sales Force Alpha",
    creator: "Alice Johnson",
    memberCount: 31,
    createdAt: "2024-03-20",
  },
  {
    id: "4",
    name: "Product Design",
    creator: "Carol Williams",
    memberCount: 8,
    createdAt: "2024-04-11",
  },
  {
    id: "5",
    name: "DevOps Crew",
    creator: "Bob Smith",
    memberCount: 6,
    createdAt: "2024-05-07",
  },
  {
    id: "6",
    name: "Customer Support",
    creator: "David Lee",
    memberCount: 19,
    createdAt: "2024-06-01",
  },
  {
    id: "7",
    name: "Finance & Accounting",
    creator: "Carol Williams",
    memberCount: 10,
    createdAt: "2024-06-18",
  },
  {
    id: "8",
    name: "Executive Leadership",
    creator: "David Lee",
    memberCount: 5,
    createdAt: "2024-07-02",
  },
];

// Derive unique creators for the filter dropdown
const ALL_CREATORS = Array.from(
  new Set(MOCK_GROUPS.map((g) => g.creator)),
).sort();

// ---------------------------------------------------------------------------
// Helper – format date for display
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SortIcon({
  field,
  active,
  direction,
}: {
  field: SortField;
  active: boolean;
  direction: SortDirection;
}) {
  void field; // used by caller for identification
  if (!active) {
    return (
      <svg
        className="ml-1 inline h-4 w-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16V4m0 0L3 8m4-4l4 4m6 4v8m0 0l4-4m-4 4l-4-4"
        />
      </svg>
    );
  }
  return direction === "asc" ? (
    <svg
      className="ml-1 inline h-4 w-4 text-blue-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
      />
    </svg>
  ) : (
    <svg
      className="ml-1 inline h-4 w-4 text-blue-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GroupsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Handle column header click – toggle direction if same field, else reset to asc
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  const filteredAndSorted = useMemo(() => {
    let result = [...MOCK_GROUPS];

    // Filter by name search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((g) => g.name.toLowerCase().includes(q));
    }

    // Filter by creator
    if (creatorFilter !== "all") {
      result = result.filter((g) => g.creator === creatorFilter);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [searchQuery, creatorFilter, sortField, sortDirection]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Groups</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and organise your payroll groups
          </p>
        </div>
        <Button
          id="create-group-btn"
          variant="primary"
          type="button"
          aria-label="Create new payroll group"
        >
          + Create Group
        </Button>
      </div>

      {/* Filters row */}
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
          </span>
          <input
            id="group-search-input"
            type="text"
            placeholder="Search groups by name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm text-gray-800 placeholder-gray-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            aria-label="Search groups by name"
          />
        </div>

        {/* Creator filter dropdown */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="creator-filter"
            className="whitespace-nowrap text-sm font-medium text-gray-700"
          >
            Filter by creator:
          </label>
          <select
            id="creator-filter"
            value={creatorFilter}
            onChange={(e) => setCreatorFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All Creators</option>
            {ALL_CREATORS.map((creator) => (
              <option key={creator} value={creator}>
                {creator}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results summary */}
      <p className="mb-3 text-sm text-gray-500">
        Showing{" "}
        <span className="font-semibold text-gray-700">
          {filteredAndSorted.length}
        </span>{" "}
        {filteredAndSorted.length === 1 ? "group" : "groups"}
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {/* Group Name – sortable */}
              <th
                scope="col"
                className="px-6 py-3 text-left font-semibold text-gray-600"
              >
                <button
                  id="sort-by-name-btn"
                  type="button"
                  onClick={() => handleSort("name")}
                  className="flex cursor-pointer items-center gap-1 transition hover:text-blue-600"
                  aria-label="Sort by group name"
                >
                  Group Name
                  <SortIcon
                    field="name"
                    active={sortField === "name"}
                    direction={sortDirection}
                  />
                </button>
              </th>

              {/* Creator */}
              <th
                scope="col"
                className="px-6 py-3 text-left font-semibold text-gray-600"
              >
                Creator
              </th>

              {/* Member Count */}
              <th
                scope="col"
                className="px-6 py-3 text-left font-semibold text-gray-600"
              >
                Members
              </th>

              {/* Created Date – sortable */}
              <th
                scope="col"
                className="px-6 py-3 text-left font-semibold text-gray-600"
              >
                <button
                  id="sort-by-date-btn"
                  type="button"
                  onClick={() => handleSort("createdAt")}
                  className="flex cursor-pointer items-center gap-1 transition hover:text-blue-600"
                  aria-label="Sort by created date"
                >
                  Created Date
                  <SortIcon
                    field="createdAt"
                    active={sortField === "createdAt"}
                    direction={sortDirection}
                  />
                </button>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-gray-400"
                >
                  No groups match your filters.
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((group) => (
                <tr
                  key={group.id}
                  className="transition hover:bg-blue-50/40"
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {/* Link to detail page (not implemented yet) */}
                    <a
                      href={`/groups/${group.id}`}
                      className="text-blue-600 hover:underline"
                      aria-label={`View details for ${group.name}`}
                    >
                      {group.name}
                    </a>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{group.creator}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {group.memberCount}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatDate(group.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
