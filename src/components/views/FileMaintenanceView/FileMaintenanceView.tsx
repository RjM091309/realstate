import React from 'react';
import { Navigate } from 'react-router-dom';

/** File Maintenance is a modal on Add Unit by Location — keep route as redirect. */
export function FileMaintenanceView() {
  return <Navigate to="/add-unit-by-location" replace />;
}
