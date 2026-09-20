// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// FORK: types for the data-monitor widget (frontend/app/view/datamonitor/).
// Persisted in block.meta under the "monitor:sources" key as a JSON string.

export type DataMonitorMetricDisplay = "percent" | "number" | "duration_ms" | "text";

export type DataMonitorMetric = {
    id: string;
    label: string;
    selector: string;
    display: DataMonitorMetricDisplay;
    color?: string;
};

export type DataMonitorSource = {
    id: string;
    title: string;
    url: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";
    headers?: Record<string, string>;
    body?: string;
    intervalSec: number;
    metrics: DataMonitorMetric[];
};

// Per-source runtime state. Lives in a jotai atom; not persisted.
export type DataMonitorSourceState = {
    loading: boolean;
    error: string | null;
    lastFetchMs: number | null;
    values: Record<string, any>; // metric.id -> raw extracted value
    statuscode: number | null;
};
