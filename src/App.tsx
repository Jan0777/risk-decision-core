/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { WorkflowEditor } from './pages/admin/WorkflowEditor';
import { JobsDashboard } from './pages/admin/JobsDashboard';
import { PerformanceDashboard } from './pages/admin/PerformanceDashboard';

// WhatIfEditor removed

export default function App() {
  useEffect(() => {
    localStorage.removeItem('cu_base_policy');
    localStorage.removeItem('cu_draft_policy');
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<WorkflowEditor />} />
          <Route path="workflow" element={<WorkflowEditor />} />
          <Route path="dashboard" element={<PerformanceDashboard />} />
          <Route path="jobs" element={<JobsDashboard />} />
        </Route>

        {/* Redirect any legacy /admin path back to the clean root-aligned equivalent */}
        <Route path="/admin" element={<Navigate to="/" replace />} />
        <Route path="/admin/workflow" element={<Navigate to="/" replace />} />
        <Route path="/admin/dashboard" element={<Navigate to="/dashboard" replace />} />
        <Route path="/admin/jobs" element={<Navigate to="/jobs" replace />} />
        <Route path="/admin/*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
